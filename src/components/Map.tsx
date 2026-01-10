import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  calculateLocalDistance,
  interpolateDriverPosition,
  type Coordinates,
} from "@/lib/mapUtils";

// Marker pooling for better performance
class MarkerPool {
  private pool: mapboxgl.Marker[] = [];
  private active: globalThis.Map<string, mapboxgl.Marker> =
    new globalThis.Map();

  acquire(id: string, element: HTMLElement): mapboxgl.Marker {
    let marker = this.pool.pop();
    if (!marker) {
      marker = new mapboxgl.Marker({ element });
    }
    this.active.set(id, marker);
    return marker;
  }

  release(id: string): void {
    const marker = this.active.get(id);
    if (marker) {
      marker.remove();
      this.pool.push(marker);
      this.active.delete(id);
    }
  }

  getActive(id: string): mapboxgl.Marker | undefined {
    return this.active.get(id);
  }

  hasActive(id: string): boolean {
    return this.active.has(id);
  }

  releaseAll(): void {
    this.active.forEach((marker) => marker.remove());
    this.active.clear();
  }

  getActiveIds(): Set<string> {
    return new Set(this.active.keys());
  }
}
import {
  Navigation,
  Loader2,
  MapPin,
  Target,
  AlertTriangle,
} from "lucide-react";

interface ServiceAreaCheck {
  in_service: boolean;
  region: { id: string; name_ar: string; name_en: string | null } | null;
  nearest_region: { id: string; name_ar: string; distance_km: number } | null;
}

interface NearbyDriver {
  id: string;
  lat: number;
  lng: number;
  vehicle_type?: "economy" | "comfort" | "premium" | "women_only";
  vehicle_model?: string;
  vehicle_color?: string;
  rating?: number;
}

interface MapProps {
  onLocationSelect?: (location: {
    lat: number;
    lng: number;
    address?: string;
    inService?: boolean;
  }) => void;
  onRouteCalculated?: (distance: number, duration: number) => void;
  onMarkerDrag?: (
    type: "pickup" | "dropoff",
    location: { lat: number; lng: number; address?: string }
  ) => void;
  pickupLocation?: { lat: number; lng: number } | null;
  dropoffLocation?: { lat: number; lng: number } | null;
  driverLocation?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  nearbyDrivers?: NearbyDriver[];
  selectingLocation?: "pickup" | "dropoff" | null;
  draggableMarkers?: boolean;
  showRoute?: boolean;
  centerOnDriver?: boolean;
  className?: string;
}

export interface MapRef {
  flyTo: (center: [number, number], zoom?: number) => void;
  getCenter: () => mapboxgl.LngLat | undefined;
}

const Map = forwardRef<MapRef, MapProps>(
  (
    {
      onLocationSelect,
      onRouteCalculated,
      onMarkerDrag,
      pickupLocation,
      dropoffLocation,
      driverLocation,
      userLocation,
      nearbyDrivers,
      selectingLocation,
      draggableMarkers = false,
      showRoute = true,
      centerOnDriver = false,
      className = "h-64",
    },
    ref
  ) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const userMarker = useRef<mapboxgl.Marker | null>(null);
    const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
    // nearbyDriverMarkersRef removed - now using GeoJSON clustering
    const centerMarkerRef = useRef<HTMLDivElement | null>(null);

    const [currentUserLocation, setCurrentUserLocation] = useState<{
      lat: number;
      lng: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [mapToken, setMapToken] = useState<string | null>(null);
    const [routeDistance, setRouteDistance] = useState<number | null>(null);
    const [routeDuration, setRouteDuration] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [centerAddress, setCenterAddress] = useState<string>("");
    const [serviceAreaStatus, setServiceAreaStatus] =
      useState<ServiceAreaCheck | null>(null);
    const [isCheckingService, setIsCheckingService] = useState(false);

    // Ramadi center as fallback (Anbar province)
    const ramadiCenter: [number, number] = [43.2954, 33.4262];

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      flyTo: (center: [number, number], zoom?: number) => {
        map.current?.flyTo({ center, zoom: zoom || 15, duration: 1500 });
      },
      getCenter: () => map.current?.getCenter(),
    }));

    // Check service area
    const checkServiceArea = useCallback(
      async (lat: number, lng: number): Promise<ServiceAreaCheck | null> => {
        try {
          setIsCheckingService(true);
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
          );
          const data = await response.json();
          setServiceAreaStatus(data);
          return data;
        } catch (error) {
          console.error("Service area check error:", error);
          return null;
        } finally {
          setIsCheckingService(false);
        }
      },
      []
    );

    // Reverse geocode center point
    const reverseGeocodeCenter = useCallback(
      async (lat: number, lng: number) => {
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
            { headers: { "Content-Type": "application/json" } }
          );
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            setCenterAddress(data.features[0].place_name || "");
          }
          // Also check service area when reverse geocoding
          if (selectingLocation) {
            checkServiceArea(lat, lng);
          }
        } catch (error) {
          console.error("Reverse geocode error:", error);
        }
      },
      [selectingLocation, checkServiceArea]
    );

    // Fetch Mapbox token from edge function
    useEffect(() => {
      const fetchToken = async () => {
        try {
          console.log("Fetching Mapbox token...");
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const tokenData = await response.json();
          console.log("Token response:", tokenData);

          if (tokenData.token) {
            setMapToken(tokenData.token);
          } else {
            console.error("Failed to get Mapbox token:", tokenData.error);
            setLocationError(
              "تعذر تحميل الخريطة - يرجى التحقق من مفتاح Mapbox"
            );
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Error fetching Mapbox token:", error);
          setLocationError("تعذر تحميل الخريطة");
          setIsLoading(false);
        }
      };

      fetchToken();
    }, []);

    // Initialize map when token is available
    useEffect(() => {
      if (!mapContainer.current || !mapToken) return;

      mapboxgl.accessToken = mapToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: ramadiCenter,
        zoom: 12,
        pitch: 45,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        "top-left"
      );

      // Add geolocate control
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
      });
      map.current.addControl(geolocate, "top-left");

      map.current.on("load", () => {
        setIsLoading(false);

        // Add route source and layer
        map.current?.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [],
            },
          },
        });

        // Route line - glow effect
        map.current?.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#00d9a5",
            "line-width": 12,
            "line-blur": 8,
            "line-opacity": 0.4,
          },
        });

        // Route line - main
        map.current?.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#00d9a5",
            "line-width": 5,
            "line-opacity": 1,
          },
        });

        // Animated dashes layer
        map.current?.addLayer({
          id: "route-dashes",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-dasharray": [0, 4, 3],
          },
        });

        // Add nearby drivers clustering source
        map.current?.addSource("nearby-drivers", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // Cluster circles - outer glow
        map.current?.addLayer({
          id: "driver-clusters-glow",
          type: "circle",
          source: "nearby-drivers",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#3b82f6",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              25,
              5,
              35,
              10,
              45,
            ],
            "circle-blur": 0.8,
            "circle-opacity": 0.4,
          },
        });

        // Cluster circles - main
        map.current?.addLayer({
          id: "driver-clusters",
          type: "circle",
          source: "nearby-drivers",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#60a5fa",
              5,
              "#3b82f6",
              10,
              "#2563eb",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              5,
              24,
              10,
              30,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Cluster count text
        map.current?.addLayer({
          id: "driver-cluster-count",
          type: "symbol",
          source: "nearby-drivers",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 14,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        // Individual driver points (unclustered)
        map.current?.addLayer({
          id: "unclustered-drivers",
          type: "circle",
          source: "nearby-drivers",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#3b82f6",
            "circle-radius": 10,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Add car icon for unclustered drivers
        map.current?.addLayer({
          id: "unclustered-drivers-icon",
          type: "symbol",
          source: "nearby-drivers",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": "car-15",
            "icon-size": 1.2,
            "icon-allow-overlap": true,
          },
        });

        // Click handler for clusters to zoom in
        map.current?.on("click", "driver-clusters", (e) => {
          const features = map.current?.queryRenderedFeatures(e.point, {
            layers: ["driver-clusters"],
          });
          if (!features?.length) return;

          const clusterId = features[0].properties?.cluster_id;
          const source = map.current?.getSource(
            "nearby-drivers"
          ) as mapboxgl.GeoJSONSource;

          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || !map.current) return;

            const geometry = features[0].geometry;
            if (geometry.type === "Point") {
              map.current.easeTo({
                center: geometry.coordinates as [number, number],
                zoom: zoom || 15,
              });
            }
          });
        });

        // Change cursor on cluster hover
        map.current?.on("mouseenter", "driver-clusters", () => {
          if (map.current) map.current.getCanvas().style.cursor = "pointer";
        });
        map.current?.on("mouseleave", "driver-clusters", () => {
          if (map.current) map.current.getCanvas().style.cursor = "";
        });

        // Click handler for unclustered drivers to show popup
        map.current?.on("click", "unclustered-drivers", (e) => {
          if (!map.current || !e.features?.length) return;

          const feature = e.features[0];
          const geometry = feature.geometry;
          if (geometry.type !== "Point") return;

          const coordinates = geometry.coordinates.slice() as [number, number];
          const properties = feature.properties;

          // Get vehicle type label
          const vehicleTypeLabels: Record<string, string> = {
            economy: "اقتصادي",
            comfort: "مريح",
            premium: "فاخر",
            women_only: "للنساء فقط",
          };

          const vehicleType = properties?.vehicle_type || "economy";
          const vehicleLabel = vehicleTypeLabels[vehicleType] || "اقتصادي";
          const vehicleModel = properties?.vehicle_model || "سيارة";
          const vehicleColor = properties?.vehicle_color || "";
          const rating = properties?.rating
            ? parseFloat(properties.rating).toFixed(1)
            : "5.0";

          // Create popup content
          const popupContent = `
          <div class="driver-popup" style="direction: rtl; font-family: 'IBM Plex Sans Arabic', sans-serif; padding: 4px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                  <circle cx="7" cy="17" r="2"/>
                  <path d="M9 17h6"/>
                  <circle cx="17" cy="17" r="2"/>
                </svg>
              </div>
              <div>
                <p style="margin: 0; font-weight: 600; font-size: 14px; color: #1f2937;">سائق متاح</p>
                <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                  <span style="color: #fbbf24;">★</span>
                  <span style="font-size: 13px; color: #4b5563;">${rating}</span>
                </div>
              </div>
            </div>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 12px; color: #6b7280;">نوع السيارة</span>
                <span style="font-size: 13px; font-weight: 500; color: #1f2937;">${vehicleModel} ${vehicleColor}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #6b7280;">الفئة</span>
                <span style="font-size: 12px; padding: 2px 8px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;">${vehicleLabel}</span>
              </div>
            </div>
            <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center;">سائق قريب ومتاح للرحلات</p>
          </div>
        `;

          // Ensure popup is visible when map is wrapped
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          // Create and add popup
          new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: "280px",
            className: "driver-info-popup",
          })
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });

        // Change cursor on unclustered driver hover
        map.current?.on("mouseenter", "unclustered-drivers", () => {
          if (map.current) map.current.getCanvas().style.cursor = "pointer";
        });
        map.current?.on("mouseleave", "unclustered-drivers", () => {
          if (map.current) map.current.getCanvas().style.cursor = "";
        });

        // Try to get user location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              setCurrentUserLocation({ lat: latitude, lng: longitude });

              if (map.current) {
                // Add padding to account for bottom overlay (approx 40% of screen height)
                // This ensures the user location appears in the visible center above the overlay
                map.current.flyTo({
                  center: [longitude, latitude],
                  zoom: 15,
                  duration: 2000,
                  padding: { top: 80, bottom: 350, left: 40, right: 40 },
                });

                // Add prominent user location marker
                const el = document.createElement("div");
                el.className = "user-location-marker";
                el.style.cssText = "z-index: 100;";
                el.innerHTML = `
                <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
                  <!-- Outer pulse ring -->
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(0, 217, 165, 0.2); border-radius: 50%; animation: pulse-ring 2s ease-out infinite;"></div>
                  <!-- Middle pulse ring -->
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background: rgba(0, 217, 165, 0.3); border-radius: 50%; animation: pulse-ring 2s ease-out 0.5s infinite;"></div>
                  <!-- Main marker circle -->
                  <div style="position: relative; width: 20px; height: 20px; background: linear-gradient(135deg, #00d9a5, #00b894); border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0, 217, 165, 0.5), 0 2px 4px rgba(0,0,0,0.2); z-index: 10;"></div>
                  <!-- Location label -->
                  <div style="position: absolute; top: -32px; background: white; padding: 4px 10px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-size: 11px; font-weight: 600; color: #00b894; white-space: nowrap; z-index: 11;">موقعك الحالي</div>
                </div>
              `;

                userMarker.current = new mapboxgl.Marker(el)
                  .setLngLat([longitude, latitude])
                  .addTo(map.current);
              }
            },
            (error) => {
              console.log("Geolocation error:", error.message);
              setLocationError("تعذر تحديد موقعك الحالي");
            },
            { enableHighAccuracy: true, timeout: 30000 }
          );
        }

        // Add atmosphere effect
        map.current?.setFog({
          color: "rgb(20, 20, 25)",
          "high-color": "rgb(36, 92, 66)",
          "horizon-blend": 0.1,
        });

        // Initial reverse geocode for center
        const center = map.current?.getCenter();
        if (center) {
          reverseGeocodeCenter(center.lat, center.lng);
        }
      });

      // Handle map drag events for center pin mode
      map.current.on("dragstart", () => {
        setIsDragging(true);
      });

      map.current.on("dragend", () => {
        setIsDragging(false);
        const center = map.current?.getCenter();
        if (center) {
          reverseGeocodeCenter(center.lat, center.lng);
        }
      });

      map.current.on("moveend", () => {
        const center = map.current?.getCenter();
        if (center && !isDragging) {
          reverseGeocodeCenter(center.lat, center.lng);
        }
      });

      // Handle map click for location selection
      map.current.on("click", (e) => {
        if (onLocationSelect) {
          onLocationSelect({
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          });
        }
      });

      return () => {
        map.current?.remove();
      };
    }, [mapToken, reverseGeocodeCenter]);

    // Center map on user location when first detected
    useEffect(() => {
      if (!map.current || !userLocation) return;

      // Only center if this is the first time user location is set and no pickup location exists
      if (!pickupLocation) {
        map.current.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 15,
          duration: 1500,
        });
      }
    }, [userLocation, pickupLocation]);

    // Fetch and draw route when both locations are set
    useEffect(() => {
      console.log("🗺️ Route useEffect triggered:", {
        hasMap: !!map.current,
        pickupLocation,
        dropoffLocation,
        mapToken: !!mapToken,
        showRoute,
        isLoading,
      });

      // Wait for map to be loaded
      if (
        !map.current ||
        !pickupLocation ||
        !dropoffLocation ||
        !mapToken ||
        isLoading
      )
        return;

      // Skip if route display is disabled
      if (!showRoute) {
        // Clear existing route if showRoute is false
        const source = map.current?.getSource(
          "route"
        ) as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          });
        }
        return;
      }

      // Check if pickup and dropoff are the same location (within ~100m)
      const isSameLocation =
        Math.abs(pickupLocation.lat - dropoffLocation.lat) < 0.001 &&
        Math.abs(pickupLocation.lng - dropoffLocation.lng) < 0.001;

      console.log("📏 Distance check:", {
        latDiff: Math.abs(pickupLocation.lat - dropoffLocation.lat),
        lngDiff: Math.abs(pickupLocation.lng - dropoffLocation.lng),
        isSameLocation,
      });

      if (isSameLocation) {
        console.log(
          "⚠️ Pickup and dropoff are the same location, skipping route calculation"
        );
        return;
      }

      const fetchRoute = async () => {
        try {
          const start = `${pickupLocation.lng},${pickupLocation.lat}`;
          const end = `${dropoffLocation.lng},${dropoffLocation.lat}`;

          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`,
            {
              headers: {
                apikey:
                  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo",
              },
            }
          );

          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates;

            // Update route on map
            const source = map.current?.getSource(
              "route"
            ) as mapboxgl.GeoJSONSource;
            if (source) {
              source.setData({
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: coordinates,
                },
              });
            }

            // Set route info
            const distance = route.distance / 1000; // Convert to km
            const duration = route.duration / 60; // Convert to minutes
            setRouteDistance(distance);
            setRouteDuration(duration);

            // Notify parent component
            if (onRouteCalculated) {
              onRouteCalculated(distance, duration);
            }

            // Fit map to route bounds
            const bounds = new mapboxgl.LngLatBounds();
            coordinates.forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });

            map.current?.fitBounds(bounds, {
              padding: 80,
              duration: 1000,
            });
          }
        } catch (error) {
          console.error("Error fetching route:", error);
        }
      };

      fetchRoute();
    }, [
      pickupLocation,
      dropoffLocation,
      mapToken,
      showRoute,
      onRouteCalculated,
      isLoading,
    ]);

    // Reverse geocode for marker drag
    const reverseGeocodeMarker = useCallback(
      async (lat: number, lng: number): Promise<string> => {
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
            { headers: { "Content-Type": "application/json" } }
          );
          const data = await response.json();
          return (
            data.features?.[0]?.place_name ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          );
        } catch {
          return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
      },
      []
    );

    // Update pickup marker
    useEffect(() => {
      if (!map.current || !pickupLocation) return;

      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
      }

      const el = document.createElement("div");
      el.className = draggableMarkers
        ? "cursor-grab active:cursor-grabbing"
        : "";
      el.innerHTML = `
      <div class="flex flex-col items-center pickup-marker-animation" style="transform: translateY(-50%);">
        <!-- Pin Head -->
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-xl" style="background: linear-gradient(135deg, #00d9a5, #00b389); box-shadow: 0 4px 15px rgba(0, 217, 165, 0.5);">
            <div class="w-4 h-4 rounded-full bg-white"></div>
          </div>
        </div>
        <!-- Pin Stem -->
        <div class="w-1 h-6" style="background: linear-gradient(to bottom, #00d9a5, #00b389);"></div>
        <!-- Pin Point - This is the exact location -->
        <div class="relative">
          <div class="absolute -inset-2 rounded-full animate-ping opacity-40" style="background: #00d9a5;"></div>
          <div class="w-3 h-3 rounded-full border-2 border-white shadow-lg" style="background: #00d9a5;"></div>
        </div>
        ${
          draggableMarkers
            ? '<p class="text-xs text-center mt-2 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg text-primary font-medium whitespace-nowrap shadow-md">اسحب للتعديل</p>'
            : ""
        }
      </div>
    `;

      const marker = new mapboxgl.Marker({
        element: el,
        draggable: draggableMarkers,
      })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .addTo(map.current);

      if (draggableMarkers && onMarkerDrag) {
        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const address = await reverseGeocodeMarker(lngLat.lat, lngLat.lng);
          onMarkerDrag("pickup", { lat: lngLat.lat, lng: lngLat.lng, address });
        });
      }

      pickupMarkerRef.current = marker;
    }, [pickupLocation, draggableMarkers, onMarkerDrag, reverseGeocodeMarker]);

    // Update dropoff marker - Using bright glowing blue
    useEffect(() => {
      if (!map.current || !dropoffLocation) return;

      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.remove();
      }

      const el = document.createElement("div");
      el.className = draggableMarkers
        ? "cursor-grab active:cursor-grabbing"
        : "";
      el.innerHTML = `
      <div class="flex flex-col items-center dropoff-marker-animation" style="transform: translateY(-50%);">
        <!-- Pin Head -->
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-xl" style="background: linear-gradient(135deg, #3b82f6, #2563eb); box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5);">
            <div class="w-4 h-4 rounded-full bg-white"></div>
          </div>
        </div>
        <!-- Pin Stem -->
        <div class="w-1 h-6" style="background: linear-gradient(to bottom, #3b82f6, #2563eb);"></div>
        <!-- Pin Point - This is the exact location -->
        <div class="relative">
          <div class="absolute -inset-2 rounded-full animate-ping opacity-40" style="background: #3b82f6;"></div>
          <div class="w-3 h-3 rounded-full border-2 border-white shadow-lg" style="background: #3b82f6;"></div>
        </div>
        ${
          draggableMarkers
            ? '<p class="text-xs text-center mt-2 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg text-blue-500 font-medium whitespace-nowrap shadow-md">اسحب للتعديل</p>'
            : ""
        }
      </div>
    `;

      const marker = new mapboxgl.Marker({
        element: el,
        draggable: draggableMarkers,
      })
        .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
        .addTo(map.current);

      if (draggableMarkers && onMarkerDrag) {
        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const address = await reverseGeocodeMarker(lngLat.lat, lngLat.lng);
          onMarkerDrag("dropoff", {
            lat: lngLat.lat,
            lng: lngLat.lng,
            address,
          });
        });
      }

      dropoffMarkerRef.current = marker;
    }, [dropoffLocation, draggableMarkers, onMarkerDrag, reverseGeocodeMarker]);

    // Store previous driver position for smooth interpolation
    const prevDriverLocation = useRef<Coordinates | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Update driver marker with smooth CSS transitions
    useEffect(() => {
      if (!map.current || !driverLocation) {
        // Remove marker if no driver location
        if (driverMarkerRef.current) {
          driverMarkerRef.current.remove();
          driverMarkerRef.current = null;
        }
        prevDriverLocation.current = null;
        return;
      }

      // Create or update driver marker
      if (!driverMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "driver-marker-container";
        el.style.cssText = "transition: transform 1s ease-out;";
        el.innerHTML = `
        <div class="flex flex-col items-center driver-marker-animation">
          <div class="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl" style="background: linear-gradient(135deg, #3b82f6, #2563eb); box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); transition: transform 0.3s ease;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
              <circle cx="7" cy="17" r="2"></circle>
              <path d="M9 17h6"></path>
              <circle cx="17" cy="17" r="2"></circle>
            </svg>
          </div>
          <div class="w-1 h-6" style="background: linear-gradient(to bottom, #3b82f6, transparent);"></div>
          <div class="w-3 h-3 rounded-full animate-pulse" style="background: rgba(59, 130, 246, 0.4);"></div>
          <p class="text-xs text-center mt-1 bg-blue-500/90 px-2 py-0.5 rounded text-white font-medium whitespace-nowrap">السائق</p>
        </div>
      `;

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map.current);

        driverMarkerRef.current = marker;
        prevDriverLocation.current = driverLocation;
      } else {
        // Smooth interpolation using turf.js for smooth movement
        const prev = prevDriverLocation.current;
        if (prev) {
          // Only animate if distance is reasonable (not a teleport)
          const distance = calculateLocalDistance(prev, driverLocation);
          if (distance < 2) {
            // Less than 2km - smooth transition
            // Cancel any existing animation
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }

            // Animate over 1 second with interpolation
            const startTime = performance.now();
            const duration = 1000; // 1 second

            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);

              // Ease out cubic for smooth deceleration
              const easeProgress = 1 - Math.pow(1 - progress, 3);

              const interpolated = interpolateDriverPosition(
                { ...prev, id: "", timestamp: 0 },
                { ...driverLocation, id: "", timestamp: 0 },
                easeProgress
              );

              driverMarkerRef.current?.setLngLat([
                interpolated.lng,
                interpolated.lat,
              ]);

              if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
              } else {
                prevDriverLocation.current = driverLocation;
              }
            };

            animationFrameRef.current = requestAnimationFrame(animate);
          } else {
            // Teleport for large distances
            driverMarkerRef.current.setLngLat([
              driverLocation.lng,
              driverLocation.lat,
            ]);
            prevDriverLocation.current = driverLocation;
          }
        } else {
          driverMarkerRef.current.setLngLat([
            driverLocation.lng,
            driverLocation.lat,
          ]);
          prevDriverLocation.current = driverLocation;
        }
      }

      // Center on driver if requested
      if (centerOnDriver) {
        map.current.easeTo({
          center: [driverLocation.lng, driverLocation.lat],
          zoom: 16,
          duration: 1500,
          easing: (t) => 1 - Math.pow(1 - t, 3), // Ease out cubic
        });
      }

      // Cleanup animation on unmount
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [driverLocation, centerOnDriver]);

    // Update nearby drivers using clustering (GeoJSON source)
    useEffect(() => {
      if (!map.current || !nearbyDrivers) return;

      // Check if source exists
      const source = map.current.getSource(
        "nearby-drivers"
      ) as mapboxgl.GeoJSONSource;
      if (!source) return;

      // Convert nearby drivers to GeoJSON features with full properties
      const features: GeoJSON.Feature<GeoJSON.Point>[] = nearbyDrivers.map(
        (driver) => ({
          type: "Feature",
          properties: {
            id: driver.id,
            vehicle_type: driver.vehicle_type || "economy",
            vehicle_model: driver.vehicle_model || "",
            vehicle_color: driver.vehicle_color || "",
            rating: driver.rating || 5.0,
          },
          geometry: {
            type: "Point",
            coordinates: [driver.lng, driver.lat],
          },
        })
      );

      // Update the source data
      source.setData({
        type: "FeatureCollection",
        features,
      });
    }, [nearbyDrivers]);

    const centerOnUser = () => {
      if (userLocation && map.current) {
        map.current.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 16,
          duration: 1500,
        });
      }
    };

    // Confirm center location
    const handleConfirmLocation = async () => {
      if (!map.current || !onLocationSelect) return;
      const center = map.current.getCenter();
      const serviceCheck = await checkServiceArea(center.lat, center.lng);
      onLocationSelect({
        lat: center.lat,
        lng: center.lng,
        address: centerAddress || undefined,
        inService: serviceCheck?.in_service,
      });
    };

    return (
      <div className={`relative rounded-2xl overflow-hidden ${className}`}>
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Simple Circle Marker with Label */}
        {selectingLocation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div
              className={`flex flex-col items-center transition-all duration-200 ${
                isDragging ? "scale-110" : ""
              }`}
            >
              {/* Label Card */}
              <div
                className={`mb-3 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg border ${
                  selectingLocation === "pickup"
                    ? "bg-primary/20 border-primary/40"
                    : "bg-destructive/20 border-destructive/40"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    selectingLocation === "pickup"
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  {selectingLocation === "pickup"
                    ? "نقطة الانطلاق"
                    : "نقطة الوصول"}
                </span>
              </div>

              {/* Simple Circle Marker */}
              <div className="relative">
                {/* Outer pulse ring */}
                <div
                  className={`absolute -inset-3 rounded-full animate-ping opacity-30 ${
                    selectingLocation === "pickup"
                      ? "bg-primary"
                      : "bg-destructive"
                  }`}
                />
                {/* Outer glow ring */}
                <div
                  className={`absolute -inset-2 rounded-full opacity-40 ${
                    selectingLocation === "pickup"
                      ? "bg-primary"
                      : "bg-destructive"
                  }`}
                />
                {/* Main circle with white border */}
                <div
                  className={`relative w-6 h-6 rounded-full border-4 border-white shadow-xl ${
                    selectingLocation === "pickup"
                      ? "bg-primary"
                      : "bg-destructive"
                  }`}
                  style={{
                    boxShadow:
                      selectingLocation === "pickup"
                        ? "0 0 20px rgba(0, 217, 165, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3)"
                        : "0 0 20px rgba(239, 68, 68, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3)",
                  }}
                />
              </div>

              {/* Drag hint */}
              {!isDragging && (
                <p className="mt-4 text-xs font-medium bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-border/50">
                  حرّك الخريطة لتحديد الموقع
                </p>
              )}
            </div>
          </div>
        )}

        {/* Address preview at bottom when selecting */}
        {selectingLocation && centerAddress && (
          <div className="absolute bottom-20 left-3 right-3 z-20">
            <div className="bg-card/95 backdrop-blur-sm rounded-xl p-4 border border-border shadow-xl">
              {/* Service area warning */}
              {serviceAreaStatus && !serviceAreaStatus.in_service && (
                <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-600">
                      هذا الموقع خارج منطقة الخدمة
                    </p>
                    {serviceAreaStatus.nearest_region && (
                      <p className="text-amber-500/80">
                        أقرب منطقة: {serviceAreaStatus.nearest_region.name_ar} (
                        {serviceAreaStatus.nearest_region.distance_km} كم)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* In service indicator */}
              {serviceAreaStatus?.in_service && serviceAreaStatus.region && (
                <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-primary/10 border border-primary/20">
                  <Target className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">
                    داخل منطقة الخدمة: {serviceAreaStatus.region.name_ar}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectingLocation === "pickup"
                      ? "bg-primary/20"
                      : "bg-destructive/20"
                  }`}
                >
                  {selectingLocation === "pickup" ? (
                    <Target className="w-5 h-5 text-primary" />
                  ) : (
                    <MapPin className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">
                    {selectingLocation === "pickup"
                      ? "موقع الانطلاق"
                      : "الوجهة"}
                  </p>
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {centerAddress}
                  </p>
                </div>
              </div>
              <button
                onClick={handleConfirmLocation}
                disabled={isCheckingService}
                className={`w-full mt-3 py-3 rounded-xl font-medium text-white transition-all disabled:opacity-50 ${
                  selectingLocation === "pickup"
                    ? "bg-primary hover:bg-primary/90 shadow-glow"
                    : "bg-destructive hover:bg-destructive/90"
                }`}
              >
                {isCheckingService ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  `تأكيد ${
                    selectingLocation === "pickup" ? "موقع الانطلاق" : "الوجهة"
                  }`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                جاري تحميل الخريطة...
              </p>
            </div>
          </div>
        )}

        {/* Location error */}
        {locationError && (
          <div className="absolute top-3 left-3 right-3 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 z-10">
            <p className="text-xs text-warning">{locationError}</p>
          </div>
        )}

        {/* Route info */}
        {routeDistance && routeDuration && !selectingLocation && (
          <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm rounded-xl px-4 py-2 border border-border/50 z-10">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">المسافة: </span>
                <span className="font-bold text-primary">
                  {routeDistance.toFixed(1)} كم
                </span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div>
                <span className="text-muted-foreground">الوقت: </span>
                <span className="font-bold text-foreground">
                  {Math.round(routeDuration)} دقيقة
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Center on user button */}
        {userLocation && (
          <button
            onClick={centerOnUser}
            className="absolute bottom-4 left-4 w-10 h-10 bg-card rounded-xl border border-border shadow-lg flex items-center justify-center hover:bg-accent transition-colors z-10"
          >
            <Navigation className="w-5 h-5 text-primary" />
          </button>
        )}

        {/* Gradient overlay */}
        {!selectingLocation && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none z-10" />
        )}
      </div>
    );
  }
);

Map.displayName = "Map";

export default Map;
