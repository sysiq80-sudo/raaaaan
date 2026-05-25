import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import {
  calculateLocalDistance,
  interpolateDriverPosition,
  type Coordinates,
  simplifyRoute,
} from "@/lib/googleMapsUtils";
import {
  GoogleMarkerPool,
  getMarkerIcon,
  drawPolyline,
  drawPolygon,
  calculateBounds,
  fitMapToBounds,
  reverseGeocodeCoordinates,
  geocodeAddress,
  getDirections,
  getDarkMapStyle,
  ROUTE_STYLES,
} from "@/lib/googleMapService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
interface ServiceAreaCheck {
  in_service: boolean;
  region: {
    id: string;
    name_ar: string;
    name_en: string | null;
  } | null;
  nearest_region: {
    id: string;
    name_ar: string;
    distance_km: number;
  } | null;
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

export interface MapProps {
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
  driverLocation?: { lat: number; lng: number; heading?: number | null } | null;
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
  getCenter: () => { lat: number; lng: number } | undefined;
}

// Constants
const DEFAULT_CENTER = { lat: 33.4233, lng: 43.2974 }; // Ramadi, Iraq
const DEFAULT_ZOOM = 14;

/**
 * Map Component - Google Maps Integration
 * Replaces Mapbox with Google Maps for improved performance and RTL support
 */
const Map = forwardRef<MapRef, MapProps>((props, ref) => {
  const {
    onLocationSelect,
    onRouteCalculated,
    onMarkerDrag,
    pickupLocation,
    dropoffLocation,
    driverLocation,
    userLocation,
    nearbyDrivers = [],
    selectingLocation,
    draggableMarkers = false,
    showRoute = true,
    centerOnDriver = false,
    className,
  } = props;

  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markerPool = useRef(new GoogleMarkerPool());
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const driverMarkersRef = useRef(new globalThis.Map<string, google.maps.Marker>());
  const prevDriverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const driverAnimationRef = useRef<number | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUserLocationRef = useRef(userLocation);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centerAddress, setCenterAddress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [serviceAreaStatus, setServiceAreaStatus] = useState<ServiceAreaCheck | null>(null);
  const [isCheckingServiceArea, setIsCheckingServiceArea] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);

  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();

  // Helper Functions
  const calculateHeading = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const l1 = lat1 * Math.PI / 180;
    const l2 = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  const drawCarIcon = (currentHeading: number): google.maps.Icon => {
    const carSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <g transform="rotate(${Math.round(currentHeading)} 24 24)">
          <!-- Soft shadow -->
          <rect x="16" y="8" width="16" height="32" rx="6" fill="black" opacity="0.3"/>
          <!-- Car body (Premium sleek design, emerald tinted dark) -->
          <rect x="16" y="6" width="16" height="32" rx="6" fill="#0f172a" stroke="#5bdda6" stroke-width="1.5"/>
          <!-- Windshield -->
          <path d="M18 16 Q24 14 30 16 L29 20 L19 20 Z" fill="#020617"/>
          <!-- Rear Window -->
          <path d="M18 30 Q24 32 30 30 L29 26 L19 26 Z" fill="#020617"/>
          <!-- Headlights -->
          <rect x="17" y="6" width="3" height="2" fill="#fbbf24" rx="1"/>
          <rect x="28" y="6" width="3" height="2" fill="#fbbf24" rx="1"/>
          <!-- Tail lights -->
          <rect x="17" y="36" width="4" height="2" fill="#ef4444" rx="1"/>
          <rect x="27" y="36" width="4" height="2" fill="#ef4444" rx="1"/>
          <!-- Mirrors -->
          <rect x="14" y="18" width="2" height="3" fill="#1e293b" rx="1"/>
          <rect x="32" y="18" width="2" height="3" fill="#1e293b" rx="1"/>
        </g>
      </svg>
    `;
    return {
      url: "data:image/svg+xml," + encodeURIComponent(carSvg),
      scaledSize: new google.maps.Size(48, 48),
      anchor: new google.maps.Point(24, 24),
    };
  };

  /**
   * Check if location is in service area
   */
  const checkServiceArea = useCallback(
    async (lat: number, lng: number): Promise<ServiceAreaCheck> => {
      setIsCheckingServiceArea(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-service-area?lat=${lat}&lng=${lng}`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        );

        if (response.ok) {
          const data = await response.json();
          setServiceAreaStatus(data);
          return data;
        }

        return {
          in_service: false,
          region: null,
          nearest_region: null,
        };
      } catch (err) {
        console.error("Service area check error:", err);
        return {
          in_service: false,
          region: null,
          nearest_region: null,
        };
      } finally {
        setIsCheckingServiceArea(false);
      }
    },
    []
  );

  /**
   * Reverse geocode center of map (debounced to avoid excessive API calls)
   */
  const reverseGeocodeCenter = useCallback(() => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      const address = await reverseGeocodeCoordinates(center.lat(), center.lng());
      setCenterAddress(address);
      if (selectingLocation) {
        checkServiceArea(center.lat(), center.lng());
      }
    }, 400);
  }, [selectingLocation, checkServiceArea]);

  /**
   * Reverse geocode a marker
   */
  const reverseGeocodeMarker = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      return reverseGeocodeCoordinates(lat, lng);
    },
    []
  );

  /**
   * Fly to location
   */
  const flyToLocation = useCallback(
    (lat: number, lng: number, zoom: number = 16): void => {
      if (!map.current) return;
      map.current.panTo(new google.maps.LatLng(lat, lng));
      map.current.setZoom(zoom);
    },
    []
  );

  /**
   * Center on user
   */
  const handleCenterOnUser = useCallback((): void => {
    if (userLocation) {
      flyToLocation(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, flyToLocation]);

  /**
   * Confirm location selection
   */
  const handleConfirmLocation = useCallback(async (): Promise<void> => {
    if (!map.current) return;

    const center = map.current.getCenter();
    const lat = center.lat();
    const lng = center.lng();

    setIsCheckingServiceArea(true);
    const serviceArea = await checkServiceArea(lat, lng);

    const address = await reverseGeocodeMarker(lat, lng);

    onLocationSelect?.({
      lat,
      lng,
      address: address || centerAddress || undefined,
      inService: serviceArea.in_service,
    });

    setIsCheckingServiceArea(false);
  }, [centerAddress, checkServiceArea, onLocationSelect, reverseGeocodeMarker]);

  // Imperative Handle
  useImperativeHandle(ref, () => ({
    flyTo: (center: [number, number], zoom: number = 14) => {
      if (map.current) {
        map.current.panTo(new google.maps.LatLng(center[1], center[0]));
        map.current.setZoom(zoom);
      }
    },
    getCenter: () => {
      if (!map.current) return undefined;
      const center = map.current.getCenter();
      return { lat: center.lat(), lng: center.lng() };
    },
  }));

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || isApiKeyLoading) return;
    if (!apiKey) {
      console.warn("⚠️ Google Maps API key is empty — map will not load");
      return;
    }

    // Load Google Maps via centralized loader
    loadGoogleMaps(apiKey).then(() => {
      if (!window.google || !mapContainer.current) return;

      map.current = new google.maps.Map(mapContainer.current!, {
        center: new google.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        styles: getDarkMapStyle(),
        gestureHandling: "greedy",
      });

      // Add map listeners
      map.current.addListener("dragstart", () => setIsDragging(true));
      map.current.addListener("dragend", () => {
        setIsDragging(false);
        reverseGeocodeCenter();
      });
      map.current.addListener("idle", () => {
        reverseGeocodeCenter();
      });

      // Center on user location if available at init time
      if (initialUserLocationRef.current) {
        const userLatLng = new google.maps.LatLng(initialUserLocationRef.current.lat, initialUserLocationRef.current.lng);
        map.current.setCenter(userLatLng);
      }

      setIsLoading(false);
    }).catch((err) => {
      console.error("Map load error:", err);
      setError("Failed to load Google Maps");
      setIsLoading(false);
    });

    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isApiKeyLoading]);

  // Handle user location
  useEffect(() => {
    if (!map.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    } else {
      userMarkerRef.current = new google.maps.Marker({
        map: map.current,
        position: new google.maps.LatLng(userLocation.lat, userLocation.lng),
        title: "موقعك الحالي",
        icon: getMarkerIcon("user"),
        opacity: 0.8,
      });
    }

    // Center on user if pickup not selected
    if (!pickupLocation) {
      map.current.panTo(new google.maps.LatLng(userLocation.lat, userLocation.lng));
    }
  }, [userLocation, pickupLocation]);

  // Handle pickup location
  useEffect(() => {
    if (!map.current || !pickupLocation) return;

    const position = new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng);

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setPosition(position);
    } else {
      pickupMarkerRef.current = new google.maps.Marker({
        map: map.current,
        position,
        title: "نقطة الانطلاق",
        icon: getMarkerIcon("pickup"),
        draggable: draggableMarkers,
      });

      if (draggableMarkers) {
        pickupMarkerRef.current.addListener("dragend", async (event) => {
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          const address = await reverseGeocodeMarker(lat, lng);
          onMarkerDrag?.("pickup", { lat, lng, address: address || undefined });
        });
      }
    }
  }, [pickupLocation, draggableMarkers, onMarkerDrag, reverseGeocodeMarker]);

  // Handle dropoff location
  useEffect(() => {
    if (!map.current || !dropoffLocation) return;

    const position = new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng);

    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setPosition(position);
    } else {
      dropoffMarkerRef.current = new google.maps.Marker({
        map: map.current,
        position,
        title: "نقطة الوصول",
        icon: getMarkerIcon("dropoff"),
        draggable: draggableMarkers,
      });

      if (draggableMarkers) {
        dropoffMarkerRef.current.addListener("dragend", async (event) => {
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          const address = await reverseGeocodeMarker(lat, lng);
          onMarkerDrag?.("dropoff", { lat, lng, address: address || undefined });
        });
      }
    }
  }, [dropoffLocation, draggableMarkers, onMarkerDrag, reverseGeocodeMarker]);

  // Handle route
  useEffect(() => {
    if (
      !map.current ||
      !pickupLocation ||
      !dropoffLocation ||
      !showRoute ||
      isLoading
    )
      return;

    const fetchRoute = async () => {
      try {
        const result = await getDirections(pickupLocation, dropoffLocation);

        if (result) {
          // Remove old polyline
          routePolylineRef.current?.setMap(null);

          // Draw new route
          routePolylineRef.current = drawPolyline(map.current!, result.route, {
            ...ROUTE_STYLES.main,
          });

          // Calculate distance and duration
          const distance = parseFloat(result.distance.replace(/[^\d.-]/g, ""));
          const duration = parseInt(result.duration.replace(/[^\d]/g, ""));

          setRouteDistance(distance);
          setRouteDuration(Math.ceil(duration / 60)); // Convert to minutes

          onRouteCalculated?.(distance, Math.ceil(duration / 60));

          // Fit bounds
          const bounds = calculateBounds([
            pickupLocation,
            dropoffLocation,
            ...result.route,
          ]);
          fitMapToBounds(map.current!, bounds, 100);
        }
      } catch (err) {
        console.error("Route calculation error:", err);
      }
    };

    fetchRoute();
  }, [
    pickupLocation,
    dropoffLocation,
    showRoute,
    isLoading,
    onRouteCalculated,
  ]);

  // Handle driver location with smooth animation
  useEffect(() => {
    if (!map.current || !driverLocation) return;

    const position = new google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    let targetHeading = driverLocation.heading || 0;

    // Fallback: calculate heading if device didn't provide one
    if (!driverLocation.heading && prevDriverLocationRef.current) {
      const pLat = prevDriverLocationRef.current.lat;
      const pLng = prevDriverLocationRef.current.lng;
      if (pLat !== driverLocation.lat || pLng !== driverLocation.lng) {
        targetHeading = calculateHeading(pLat, pLng, driverLocation.lat, driverLocation.lng);
      }
    }

    if (driverMarkerRef.current) {
      // Calculate if we should animate or teleport
      if (prevDriverLocationRef.current) {
        const distance = calculateLocalDistance(
          prevDriverLocationRef.current.lat,
          prevDriverLocationRef.current.lng,
          driverLocation.lat,
          driverLocation.lng
        );

        if (distance < 0.2) {
          // Animate if close
          let progress = 0;
          const duration = 1000; // 1 second
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            progress = Math.min(elapsed / duration, 1);

            const interpolated = {
              lat: prevDriverLocationRef.current!.lat + (driverLocation.lat - prevDriverLocationRef.current!.lat) * progress,
              lng: prevDriverLocationRef.current!.lng + (driverLocation.lng - prevDriverLocationRef.current!.lng) * progress
            };

            driverMarkerRef.current?.setPosition(
              new google.maps.LatLng(interpolated.lat, interpolated.lng)
            );
            driverMarkerRef.current?.setIcon(drawCarIcon(targetHeading));

            if (progress < 1) {
              driverAnimationRef.current = requestAnimationFrame(animate);
            }
          };

          driverAnimationRef.current = requestAnimationFrame(animate);
        } else {
          driverMarkerRef.current.setPosition(position);
          driverMarkerRef.current.setIcon(drawCarIcon(targetHeading));
        }
      } else {
        driverMarkerRef.current.setPosition(position);
        driverMarkerRef.current.setIcon(drawCarIcon(targetHeading));
      }
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        map: map.current,
        position,
        title: "السائق",
        icon: drawCarIcon(targetHeading),
      });
    }

    if (centerOnDriver) {
      map.current.panTo(position);
      map.current.setZoom(16);
    }

    prevDriverLocationRef.current = driverLocation;

    return () => {
      if (driverAnimationRef.current) {
        cancelAnimationFrame(driverAnimationRef.current);
      }
    };
  }, [driverLocation?.lat, driverLocation?.lng, driverLocation?.heading, centerOnDriver]);

  // Handle nearby drivers — diff markers instead of destroy-recreate
  useEffect(() => {
    if (!map.current) return;

    const currentIds = new Set(nearbyDrivers.map((d) => d.id));

    // Remove markers for drivers no longer present
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        driverMarkersRef.current.delete(id);
      }
    });

    // Add or update markers
    nearbyDrivers.forEach((driver) => {
      const existing = driverMarkersRef.current.get(driver.id);
      if (existing) {
        // Update position only
        existing.setPosition(new google.maps.LatLng(driver.lat, driver.lng));
      } else {
        // Create new marker
        const marker = new google.maps.Marker({
          map: map.current,
          position: new google.maps.LatLng(driver.lat, driver.lng),
          title: `${driver.vehicle_model || "سيارة"} - ${driver.rating || 0}⭐`,
          icon: getMarkerIcon("driver"),
          opacity: 0.7,
        });

        marker.addListener("click", () => {
          new google.maps.InfoWindow({
            content: `
              <div style="text-align: right; direction: rtl; padding: 10px;">
                <h3>${driver.vehicle_model}</h3>
                <p>النوع: ${driver.vehicle_type}</p>
                <p>التقييم: ${driver.rating}⭐</p>
              </div>
            `,
            position: new google.maps.LatLng(driver.lat, driver.lng),
          }).open(map.current);
        });

        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [nearbyDrivers]);

  return (
    <div className={`relative w-full h-full bg-gray-900 ${className}`}>
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">جاري تحميل الخريطة...</div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-4 right-4 p-4 bg-red-600 text-white rounded">
          {error}
        </div>
      )}

      {/* Center Pin (for location selection) */}
      {selectingLocation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-4xl">📍</div>
        </div>
      )}

      {/* Location Info (for selection) */}
      {selectingLocation && (
        <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-lg shadow-lg">
          <p className="text-sm text-gray-600 mb-2">
            {centerAddress || "جاري تحميل العنوان..."}
          </p>
          {isCheckingServiceArea ? (
            <p className="text-sm text-blue-600">جاري التحقق من منطقة الخدمة...</p>
          ) : serviceAreaStatus?.in_service ? (
            <p className="text-sm text-green-600">✅ ضمن منطقة الخدمة</p>
          ) : (
            <p className="text-sm text-red-600">
              ⚠️ خارج منطقة الخدمة
              {serviceAreaStatus?.nearest_region && (
                ` - أقرب منطقة: ${serviceAreaStatus.nearest_region.name_ar}`
              )}
            </p>
          )}
          <button
            onClick={handleConfirmLocation}
            disabled={isCheckingServiceArea}
            className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            تأكيد الموقع
          </button>
        </div>
      )}

      {/* Route Info */}
      {routeDistance && routeDuration && (
        <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg text-right">
          <p className="text-sm font-medium">
            {routeDistance.toFixed(1)} كم
          </p>
          <p className="text-sm text-gray-600">{routeDuration} دقيقة</p>
        </div>
      )}

      {/* Geolocate Button */}
      <button
        onClick={handleCenterOnUser}
        className="absolute bottom-4 right-4 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 z-10"
        title="موقعي الحالي"
      >
        📍
      </button>
    </div>
  );
});

Map.displayName = "Map";

export default Map;
