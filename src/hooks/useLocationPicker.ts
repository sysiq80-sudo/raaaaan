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

  // Reverse geocode with timeout
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${lat}&lng=${lng}`,
          { 
            headers: { "Content-Type": "application/json" },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
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

  // Initialize map (only once with token)
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

    // Set token BEFORE any map operation
    mapboxgl.accessToken = mapToken;

    // Initialize map immediately (removed setTimeout)
    if (!mapContainer.current || map.current) return;

    // Use userLocation if available, otherwise Ramadi center
    const initialCenter = userLocation
      ? ([userLocation.lng, userLocation.lat] as [number, number])
      : ramadiCenter;

    try {
      console.log("🗺️ Creating map instance...");
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        // Use dark style to keep app identity consistent (no light flashes)
        style: "mapbox://styles/mapbox/dark-v11",
        center: initialCenter,
        zoom: 16,
        pitch: 0,
        attributionControl: false, // Hide attribution for faster load
      });

      // Add navigation control
      // Hide zoom/compass controls; users interact via touch
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false, showZoom: false }), "top-left");

      // NOTE: We intentionally do NOT add a GeolocateControl here to avoid duplicate
      // controls. Geolocation is handled via the top-bar geolocate button which
      // uses the global `window.appMap` reference for consistency.

      map.current.on("load", () => {
        console.log("✅ Map loaded successfully");
        setIsLoading(false); // Only hide loading after map is ready
        
        // لا نضيف دبوس هنا - الدبوس يتم عرضه في GoPage كـ DOM overlay
        
        const center = map.current?.getCenter();
        if (center) reverseGeocode(center.lat, center.lng);
      });

      // Handle load errors
      map.current.on("error", (e) => {
        console.error("❌ Map error:", e);
        setIsLoading(false);
      });

      map.current.on("dragstart", () => setIsDragging(true));
      map.current.on("dragend", () => {
        setIsDragging(false);
        const center = map.current?.getCenter();
        if (center) reverseGeocode(center.lat, center.lng);
      });
    } catch (error) {
      console.error("❌ Map initialization error:", error);
      setIsLoading(false);
      toast({
        title: "⚠️ خطأ في تحميل الخريطة",
        description: "يرجى إعادة تحميل الصفحة",
        variant: "destructive",
      });
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapToken]); // Only re-run if mapToken changes

  // Update map center when user location is available (separate effect)
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Only fly to user location if map is already loaded
    if (map.current.isStyleLoaded()) {
      console.log("Flying to user location:", userLocation);
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        duration: 1000,
      });
    }
  }, [userLocation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

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
    setIsLoading,
  };
};
