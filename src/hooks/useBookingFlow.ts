/**
 * ران - Hook تدفق الحجز
 * يدير logic الحجز والأسعار واختيار المركبة والدفع
 * Google Maps Version
 */

import { useCallback, useRef, useState } from "react";
import { useToast } from "./use-toast";
import { getDirections, drawPolyline, ROUTE_STYLES } from "@/lib/googleMapService";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import type { PaymentMethod } from "@/types/savedCards";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

export const useBookingFlow = () => {
  const { toast } = useToast();
  const { apiKey: googleApiKey } = useGoogleMapsApiKey();

  const bookingMapContainer = useRef<HTMLDivElement>(null);
  const bookingMap = useRef<google.maps.Map | null>(null);

  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  // Track markers and polylines for proper cleanup
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  // Helper function to fetch and draw route
  const fetchRouteAndDraw = useCallback(
    async (pickupLocation: LocationType, dropoffLocation: LocationType) => {
      if (!googleApiKey || !bookingMap.current) {
        console.warn("⚠️ Cannot fetch route - missing map or API key");
        return;
      }

      try {
        console.log("🔍 Fetching route...");
        const result = await getDirections(
          { lat: pickupLocation.lat, lng: pickupLocation.lng },
          { lat: dropoffLocation.lat, lng: dropoffLocation.lng }
        );

        if (result && result.route && result.distanceMeters > 0) {
          console.log("✅ Route received, distance:", result.distance, "duration:", result.duration);
          // ✅ استخدام القيم الرقمية بدلاً من تحليل النص المحلي (قد يكون بالعربية)
          const distanceKm = result.distanceMeters / 1000;
          const durationMin = Math.ceil(result.durationSeconds / 60);
          setRouteDistance(Math.round(distanceKm * 10) / 10); // تقريب لأقرب 0.1 كم
          setRouteDuration(durationMin);

          // Draw route on booking map
          console.log("🎨 Drawing polyline on map...");
          drawPolyline(bookingMap.current, result.route, ROUTE_STYLES.main);
          console.log("✅ Polyline drawn");

          // Fit map to route bounds
          const bounds = new google.maps.LatLngBounds();
          result.route.forEach((point) => {
            bounds.extend(new google.maps.LatLng(point.lat, point.lng));
          });
          bounds.extend(new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng));
          bounds.extend(new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng));
          
          if (bookingMap.current) {
            console.log("📍 Fitting map to bounds...");
            bookingMap.current.fitBounds(bounds, 100);
            console.log("✅ Map bounds fitted");
          }
        } else {
          console.warn("⚠️ No route data received, using fallback distance calculation");
          // Fallback: Calculate straight-line distance (Haversine formula)
          const R = 6371; // Earth's radius in km
          const dLat = (dropoffLocation.lat - pickupLocation.lat) * Math.PI / 180;
          const dLng = (dropoffLocation.lng - pickupLocation.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(pickupLocation.lat * Math.PI / 180) * Math.cos(dropoffLocation.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          const estimatedDurationMin = Math.ceil(distanceKm / 2.5 * 60); // Assume 2.5 km/min avg speed
          
          console.log("📏 Fallback distance calculated:", Math.round(distanceKm * 10) / 10, "km");
          setRouteDistance(Math.round(distanceKm * 10) / 10);
          setRouteDuration(estimatedDurationMin);
          
          toast({
            title: "المسار التقريبي ⚠️",
            description: "تم استخدام مسافة تقريبية بسبب عدم توفر التفاصيل الدقيقة",
            variant: "default",
          });
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
    [googleApiKey, toast]
  );

  // Initialize booking map
  const initializeBookingMap = useCallback(
    (pickupLocation: LocationType, dropoffLocation: LocationType) => {
      if (!bookingMapContainer.current || !googleApiKey) return;

      // Prevent duplicate initialization
      if (bookingMap.current) {
        console.log("✅ Booking map already initialized");
        return;
      }

      // Load Google Maps if not already loaded
      if (!window.google) {
        loadGoogleMaps(googleApiKey).then(() => {
          initializeBookingMap(pickupLocation, dropoffLocation);
        }).catch(err => console.error("Booking map load error:", err));
        return;
      }

      // Ensure container has proper background
      if (bookingMapContainer.current) {
        bookingMapContainer.current.style.backgroundColor = "#1a1a1a"; // 🌙 Dark background
      }

      console.log("🗺️ Initializing booking map...");
      
      // 🌙 Dark Mode Styling (same as location picker)
      const darkModeStyles = [
        { elementType: "geometry", stylers: [{ color: "#212121" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#10b981" }] },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#2c2c2c" }]
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#10b981" }]
        },
        {
          featureType: "poi",
          elementType: "labels.text.fill",
          stylers: [{ color: "#10b981" }]
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#1a1a2e" }]
        }
      ];
      
      bookingMap.current = new google.maps.Map(bookingMapContainer.current, {
        center: new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
        zoom: 13,
        mapTypeId: 'roadmap',
        styles: darkModeStyles, // 🌙 تطبيق النمط الداكن
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        gestureHandling: "cooperative",
        draggable: true, // ✨ تفعيل السحب
        disableDefaultUI: false,
        zoomControl: true,
      });

      console.log("✅ Booking map initialized with dark mode");

      // Add pickup marker
      const pickupMarker = new google.maps.Marker({
        map: bookingMap.current,
        position: new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
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
      markersRef.current.push(pickupMarker); // ✅ FIX: تتبع العلامة للتنظيف
      console.log("📍 Pickup marker added");

      // Add dropoff marker
      const dropoffMarker = new google.maps.Marker({
        map: bookingMap.current,
        position: new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng),
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
      markersRef.current.push(dropoffMarker); // ✅ FIX: تتبع العلامة للتنظيف
      console.log("📍 Dropoff marker added");

      // Fetch and draw the route after map is fully loaded
      setTimeout(() => {
        fetchRouteAndDraw(pickupLocation, dropoffLocation);
      }, 300);
    },
    [googleApiKey, fetchRouteAndDraw]
  );

  /** @deprecated Use initializeBookingMap which calls fetchRouteAndDraw internally */
  const fetchRoute = fetchRouteAndDraw;

  const cleanup = useCallback(() => {
    // تنظيف العلامات والمسارات لمنع تسرب الذاكرة
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    bookingMap.current = null;
  }, []);

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
