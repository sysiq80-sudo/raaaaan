/**
 * ران - Hook تدفق الحجز
 * يدير logic الحجز والأسعار واختيار المركبة والدفع
 * Google Maps Version
 */

import { useCallback, useRef, useState } from "react";
import { useToast } from "./use-toast";
import {
  getDirections,
  drawPolyline,
  ROUTE_STYLES,
} from "@/lib/googleMapService";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import { getMapStyle } from "@/utils/mapStyles";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethodType =
  | "cash"
  | "wallet"
  | "card"
  | "zain_cash"
  | "super_key"
  | "nas_wallet";

export const useBookingFlow = (apiKey: string | null) => {
  const { toast } = useToast();
  const { apiKey: googleApiKey } = useGoogleMapsApiKey();

  const bookingMapContainer = useRef<HTMLDivElement>(null);
  const bookingMap = useRef<google.maps.Map | null>(null);
  const waypointMarkersRef = useRef<google.maps.Marker[]>([]);

  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  const clearWaypointMarkers = useCallback(() => {
    waypointMarkersRef.current.forEach((marker) => marker.setMap(null));
    waypointMarkersRef.current = [];
  }, []);

  const renderWaypointMarkers = useCallback(
    (waypoints: Array<{ lat: number; lng: number }>) => {
      if (!bookingMap.current) return;

      clearWaypointMarkers();

      waypointMarkersRef.current = waypoints.map((point, index) => {
        return new google.maps.Marker({
          map: bookingMap.current,
          position: new google.maps.LatLng(point.lat, point.lng),
          title: `توقف ${index + 1}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#f59e0b",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            scale: 7,
          },
          zIndex: 102 + index,
        });
      });
    },
    [clearWaypointMarkers],
  );

  // Helper function to fetch and draw route
  const fetchRouteAndDraw = useCallback(
    async (
      pickupLocation: LocationType,
      dropoffLocation: LocationType,
      waypoints: LocationType[] = [],
      options?: { optimizeWaypoints?: boolean },
    ) => {
      if (!googleApiKey || !bookingMap.current) {
        console.warn("⚠️ Cannot fetch route - missing map or API key");
        return;
      }

      try {
        console.log("🔍 Fetching route...");
        const result = await getDirections(
          { lat: pickupLocation.lat, lng: pickupLocation.lng },
          { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          waypoints.map((point) => ({ lat: point.lat, lng: point.lng })),
          { optimizeWaypoints: options?.optimizeWaypoints ?? true },
        );

        if (result && result.route) {
          console.log(
            "✅ Route received, distance:",
            result.distance,
            "duration:",
            result.duration,
          );
          setRouteDistance(parseFloat(result.distance.replace(/[^\d.-]/g, "")));
          setRouteDuration(
            Math.ceil(parseInt(result.duration.replace(/[^\d]/g, "")) / 60),
          );

          // Draw route on booking map
          console.log("🎨 Drawing polyline on map...");
          drawPolyline(bookingMap.current, result.route, ROUTE_STYLES.main);
          console.log("✅ Polyline drawn");

          renderWaypointMarkers(
            waypoints.map((point) => ({ lat: point.lat, lng: point.lng })),
          );

          // Fit map to route bounds
          const bounds = new google.maps.LatLngBounds();
          result.route.forEach((point) => {
            bounds.extend(new google.maps.LatLng(point.lat, point.lng));
          });
          bounds.extend(
            new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
          );
          bounds.extend(
            new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng),
          );

          if (bookingMap.current) {
            console.log("📍 Fitting map to bounds...");
            bookingMap.current.fitBounds(bounds, 100);
            console.log("✅ Map bounds fitted");
          }
        } else {
          console.error("❌ No route data received");
        }
      } catch (error) {
        console.error("❌ Error fetching route:", error);
        toast({
          title: "خطأ في الاتجاهات",
          description: "فشل في جلب المسار - تحقق من الإنترنت",
          variant: "destructive",
        });
      }
    },
    [googleApiKey, toast, renderWaypointMarkers],
  );

  // Initialize booking map
  const initializeBookingMap = useCallback(
    (
      pickupLocation: LocationType,
      dropoffLocation: LocationType,
      waypoints: LocationType[] = [],
      options?: { optimizeWaypoints?: boolean },
    ) => {
      if (!bookingMapContainer.current || !googleApiKey) return;

      // Prevent duplicate initialization
      if (bookingMap.current) {
        console.log("✅ Booking map already initialized");
        return;
      }

      // Load Google Maps if not already loaded
      if (!window.google) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places,directions&language=ar`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          initializeBookingMap(pickupLocation, dropoffLocation);
        };
        document.head.appendChild(script);
        return;
      }

      // 🌙 خلفية مناسبة للثيم
      if (bookingMapContainer.current) {
        const isDark =
          document.documentElement.classList.contains("dark") ||
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        bookingMapContainer.current.style.backgroundColor = isDark
          ? "#1a1a2e"
          : "#f5f5f5";
      }

      console.log("🗺️ Initializing booking map...");

      // 🎨 استخدام أنماط الخريطة الذكية
      const mapStyle = getMapStyle();

      bookingMap.current = new google.maps.Map(bookingMapContainer.current, {
        center: new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
        zoom: 13,
        mapTypeId: "roadmap",
        styles: mapStyle, // 🎨 نمط ذكي يتكيف مع الثيم
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        gestureHandling: "cooperative",
        draggable: true, // ✨ تفعيل السحب
        disableDefaultUI: false,
        zoomControl: true,
      });

      console.log("✅ Booking map initialized with adaptive theme styles");

      // Add pickup marker
      const pickupMarker = new google.maps.Marker({
        map: bookingMap.current,
        position: new google.maps.LatLng(
          pickupLocation.lat,
          pickupLocation.lng,
        ),
        title: "الانطلاق",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 10,
        },
        zIndex: 100,
      });
      console.log("📍 Pickup marker added");

      // Add dropoff marker
      const dropoffMarker = new google.maps.Marker({
        map: bookingMap.current,
        position: new google.maps.LatLng(
          dropoffLocation.lat,
          dropoffLocation.lng,
        ),
        title: "الوصول",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#2A6CD5",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 10,
        },
        zIndex: 101,
      });
      console.log("📍 Dropoff marker added");

      renderWaypointMarkers(
        waypoints.map((point) => ({ lat: point.lat, lng: point.lng })),
      );

      // Fetch and draw the route after map is fully loaded
      setTimeout(() => {
        fetchRouteAndDraw(pickupLocation, dropoffLocation, waypoints, options);
      }, 300);
    },
    [googleApiKey, fetchRouteAndDraw, renderWaypointMarkers],
  );

  // Fetch route
  const fetchRoute = useCallback(
    async (
      pickupLocation: LocationType,
      dropoffLocation: LocationType,
      waypoints: LocationType[] = [],
      options?: { optimizeWaypoints?: boolean },
    ) => {
      if (!googleApiKey) return;

      try {
        const result = await getDirections(
          { lat: pickupLocation.lat, lng: pickupLocation.lng },
          { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          waypoints.map((point) => ({ lat: point.lat, lng: point.lng })),
          { optimizeWaypoints: options?.optimizeWaypoints ?? true },
        );

        if (result) {
          setRouteDistance(parseFloat(result.distance.replace(/[^\d.-]/g, "")));
          setRouteDuration(
            Math.ceil(parseInt(result.duration.replace(/[^\d]/g, "")) / 60),
          );

          // Draw route on booking map
          if (bookingMap.current) {
            drawPolyline(bookingMap.current, result.route, ROUTE_STYLES.main);
            renderWaypointMarkers(
              waypoints.map((point) => ({ lat: point.lat, lng: point.lng })),
            );

            // Fit map to route bounds
            const bounds = new google.maps.LatLngBounds();
            result.route.forEach((point) => {
              bounds.extend(new google.maps.LatLng(point.lat, point.lng));
            });
            bounds.extend(
              new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
            );
            bounds.extend(
              new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng),
            );
            bookingMap.current.fitBounds(bounds, 80);
          }
        }
      } catch (error) {
        console.error("Error fetching route:", error);
        toast({
          title: "خطأ في الاتجاهات",
          description: "فشل في جلب المسار",
          variant: "destructive",
        });
      }
    },
    [googleApiKey, toast, renderWaypointMarkers],
  );

  const cleanup = useCallback(() => {
    bookingMap.current = null;
    clearWaypointMarkers();
  }, [clearWaypointMarkers]);

  return {
    bookingMapContainer,
    bookingMap,
    selectedVehicle,
    setSelectedVehicle,
    paymentMethod,
    setPaymentMethod,
    routeDistance,
    setRouteDistance,
    routeDuration,
    setRouteDuration,
    isBooking,
    setIsBooking,
    paymentSheetOpen,
    setPaymentSheetOpen,
    initializeBookingMap,
    fetchRoute,
    cleanup,
  };
};
