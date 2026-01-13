/**
 * ران - Hook اختيار الموقع والخريطة
 * يدير logic الخريطة والبحث والتحقق من منطقة الخدمة
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import { useToast } from "./use-toast";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

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

export const useLocationPicker = (
  mapToken: string | null,
  userLocation: { lat: number; lng: number } | null
) => {
  const { toast } = useToast();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isCheckingService, setIsCheckingService] = useState(false);

  // Memoize Ramadi center coordinates
  const ramadiCenter = useMemo(
    () => [43.2954, 33.4262] as [number, number],
    []
  );

  // Check service area
  const checkServiceArea = useCallback(async (lat: number, lng: number) => {
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
  }, []);

  // Reverse geocode
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
          { headers: { "Content-Type": "application/json" } }
        );
        const data = await response.json();
        if (data.features?.[0]?.place_name) {
          setCenterAddress(data.features[0].place_name);
        } else {
          setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        checkServiceArea(lat, lng);
      } catch (error) {
        console.error("Reverse geocode error:", error);
        setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    },
    [checkServiceArea]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken) {
      console.log("Map initialization waiting:", {
        hasContainer: !!mapContainer.current,
        hasToken: !!mapToken,
      });
      return;
    }

    // Prevent duplicate initialization
    if (map.current) {
      console.log("Map already initialized");
      return;
    }

    console.log("Initializing map with token");
    mapboxgl.accessToken = mapToken;
    const initialCenter = userLocation
      ? ([userLocation.lng, userLocation.lat] as [number, number])
      : ramadiCenter;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: initialCenter,
      zoom: 16,
      pitch: 0,
    });

    // Add navigation control
    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    // Add geolocate control (center on user button)
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: true,
      showUserLocation: true,
    });
    map.current.addControl(geolocateControl, "bottom-left");

    map.current.on("load", () => {
      console.log("Map loaded successfully");
      setIsLoading(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);

      // Add user location marker
      if (userLocation) {
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="relative">
            <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
            <div class="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>
          </div>
        `;
        new mapboxgl.Marker(el)
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current!);

        // Trigger geolocate on initial load
        setTimeout(() => {
          geolocateControl.trigger();
        }, 500);
      }
    });

    map.current.on("dragstart", () => setIsDragging(true));
    map.current.on("dragend", () => {
      setIsDragging(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken, userLocation, reverseGeocode, ramadiCenter]);

  return {
    mapContainer,
    map,
    isLoading,
    isDragging,
    centerAddress,
    serviceAreaStatus,
    isCheckingService,
    setCenterAddress,
    checkServiceArea,
    reverseGeocode,
    setIsDragging,
  };
};
