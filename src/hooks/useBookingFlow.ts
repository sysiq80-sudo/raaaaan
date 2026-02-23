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

export const useBookingFlow = (apiKey: string | null) => {
  const { toast } = useToast();
  const { apiKey: googleApiKey } = useGoogleMapsApiKey();

  const bookingMapContainer = useRef<HTMLDivElement>(null);
  const bookingMap = useRef<google.maps.Map | null>(null);

  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
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

        if (result && result.route) {
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
      console.log("📍 Dropoff marker added");

      // Fetch and draw the route after map is fully loaded
      setTimeout(() => {
        fetchRouteAndDraw(pickupLocation, dropoffLocation);
      }, 300);
    },
    [googleApiKey, fetchRouteAndDraw]
  );

  // Fetch route
  const fetchRoute = useCallback(
    async (pickupLocation: LocationType, dropoffLocation: LocationType) => {
      if (!googleApiKey) return;

      try {
        const result = await getDirections(
          { lat: pickupLocation.lat, lng: pickupLocation.lng },
          { lat: dropoffLocation.lat, lng: dropoffLocation.lng }
        );

        if (result) {
          setRouteDistance(parseFloat(result.distance.replace(/[^\d.-]/g, "")));
          setRouteDuration(Math.ceil(parseInt(result.duration.replace(/[^\d]/g, "")) / 60));

          // Draw route on booking map
          if (bookingMap.current) {
            drawPolyline(bookingMap.current, result.route, ROUTE_STYLES.main);

            // Fit map to route bounds
            const bounds = new google.maps.LatLngBounds();
            result.route.forEach((point) => {
              bounds.extend(new google.maps.LatLng(point.lat, point.lng));
            });
            bounds.extend(new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng));
            bounds.extend(new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng));
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
    [googleApiKey, toast]
  );

  const cleanup = useCallback(() => {
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
