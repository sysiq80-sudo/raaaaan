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
import { useAdaptiveRouting } from "@/hooks/useAdaptiveRouting";
import { logger } from "@/lib/logger";
import { showErrorToast } from "@/lib/toastHelpers";
import type { PaymentMethod } from "@/types/savedCards";

const LOG_CONTEXT = "useBookingFlow";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

export const useBookingFlow = () => {
  const { toast } = useToast();
  const { apiKey: googleApiKey } = useGoogleMapsApiKey();

  // Phase 7: Adaptive routing — OSRM primary, Haversine fallback
  const { currentAdapter: routingAdapter, getRoute: getAdaptiveRoute } = useAdaptiveRouting();

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
    async (
      pickupLocation: LocationType,
      dropoffLocation: LocationType,
      intermediateStops?: IntermediateStop[]
    ) => {
      const hasMap = !!bookingMap.current;
      console.error('🔴 [useBookingFlow] fetchRouteAndDraw CALLED', {
        hasMap,
        hasRoutingAdapter: !!routingAdapter,
        hasGoogleApiKey: !!googleApiKey,
        pickup: `${pickupLocation.lat.toFixed(4)},${pickupLocation.lng.toFixed(4)}`,
        dropoff: `${dropoffLocation.lat.toFixed(4)},${dropoffLocation.lng.toFixed(4)}`,
        stopsCount: intermediateStops?.length || 0,
      });
      if (!hasMap) {
        logger.debug(LOG_CONTEXT, "No map instance — will compute distance without drawing");
      }

      const origin = { lat: pickupLocation.lat, lng: pickupLocation.lng };
      const destination = { lat: dropoffLocation.lat, lng: dropoffLocation.lng };
      const waypoints = intermediateStops
        ?.filter((s) => s.location && s.location.lat && s.location.lng)
        .map((s) => ({ lat: s.location!.lat, lng: s.location!.lng })) || [];

      try {
        // ─── Phase 7: Adaptive Routing (OSRM → Haversine fallback) ───────────
        if (routingAdapter) {
          logger.debug(LOG_CONTEXT, "Using adaptive routing...");
          const routeResult = await getAdaptiveRoute(origin, destination, waypoints);

          const distanceKm = routeResult.distance / 1000;
          const durationMin = Math.ceil(routeResult.duration / 60);
          setRouteDistance(Math.round(distanceKm * 10) / 10);
          setRouteDuration(durationMin);
          console.error('🔴 [useBookingFlow] ADAPTIVE ROUTE SUCCESS → routeDistance =', Math.round(distanceKm * 10) / 10);
          logger.debug(LOG_CONTEXT, "Adaptive route received", { distanceKm, durationMin });

          if (routeResult.path.length > 0 && bookingMap.current) {
            const polyline = drawPolyline(bookingMap.current, routeResult.path, ROUTE_STYLES.main);
            if (polyline) polylinesRef.current.push(polyline);

            const bounds = new google.maps.LatLngBounds();
            routeResult.path.forEach((point) => {
              bounds.extend(new google.maps.LatLng(point.lat, point.lng));
            });
            bounds.extend(new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng));
            bounds.extend(new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng));
            
            if (intermediateStops) {
              intermediateStops.forEach((stop) => {
                if (stop.location) {
                  bounds.extend(new google.maps.LatLng(stop.location.lat, stop.location.lng));
                }
              });
            }

            bookingMap.current.fitBounds(bounds, {
              top: 80,
              bottom: window.innerHeight * 0.55 + 20,
              left: 50,
              right: 50,
            });
          }
          return; // ✅ تم — لا حاجة لـ Google Directions
        }

        // ─── Fallback: Google Directions API ─────────────────────────────────
        if (!googleApiKey) {
          logger.warn(LOG_CONTEXT, "No routing adapter and no Google API key — using Haversine fallback");
          // Haversine distance calculation
          const R = 6371;
          const dLat = (destination.lat - origin.lat) * Math.PI / 180;
          const dLng = (destination.lng - origin.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c * 1.35; // 1.35x factor for road vs straight-line
          setRouteDistance(Math.round(distanceKm * 10) / 10);
          setRouteDuration(Math.ceil(distanceKm * 2.5));
          logger.debug(LOG_CONTEXT, "Haversine fallback route", { distanceKm: distanceKm.toFixed(1) });
          return;
        }

        logger.debug(LOG_CONTEXT, "Fetching route via Google Directions...");
        const result = await getDirections(origin, destination, waypoints);

        if (result && result.route && result.distanceMeters > 0) {
          logger.debug(LOG_CONTEXT, "Route received", { distance: result.distance, duration: result.duration });
          const distanceKm = result.distanceMeters / 1000;
          const durationMin = Math.ceil(result.durationSeconds / 60);
          setRouteDistance(Math.round(distanceKm * 10) / 10);
          setRouteDuration(durationMin);

          if (hasMap && bookingMap.current) {
            const polyline = drawPolyline(bookingMap.current, result.route, ROUTE_STYLES.main);
            if (polyline) polylinesRef.current.push(polyline);

            const bounds = new google.maps.LatLngBounds();
            result.route.forEach((point) => {
              bounds.extend(new google.maps.LatLng(point.lat, point.lng));
            });
            bounds.extend(new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng));
            bounds.extend(new google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng));
            
            if (intermediateStops) {
              intermediateStops.forEach((stop) => {
                if (stop.location) {
                  bounds.extend(new google.maps.LatLng(stop.location.lat, stop.location.lng));
                }
              });
            }

            bookingMap.current.fitBounds(bounds, {
              top: 80,
              bottom: window.innerHeight * 0.55 + 20,
              left: 50,
              right: 50,
            });
          }
        } else {
          logger.warn(LOG_CONTEXT, "No route data received from Google, using Haversine fallback");
          const R = 6371;
          const dLat = (dropoffLocation.lat - pickupLocation.lat) * Math.PI / 180;
          const dLng = (dropoffLocation.lng - pickupLocation.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(pickupLocation.lat * Math.PI / 180) * Math.cos(dropoffLocation.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          setRouteDistance(Math.round(distanceKm * 10) / 10);
          setRouteDuration(Math.ceil(distanceKm / 2.5 * 60));
          toast({
            title: "المسار التقريبي ⚠️",
            description: "تم استخدام مسافة تقريبية بسبب عدم توفر التفاصيل الدقيقة",
            variant: "default",
          });
        }
      } catch (error) {
        console.error('🔴 [useBookingFlow] fetchRouteAndDraw CATCH ERROR:', error);
        logger.error(LOG_CONTEXT, "Error fetching route", error);
        showErrorToast(toast, "خطأ في الاتجاهات", "فشل في جلب المسار - تحقق من الإنترنت");
      }
    },
    [routingAdapter, getAdaptiveRoute, googleApiKey, toast]
  );

  const clearDrawing = useCallback(() => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    polylinesRef.current = [];
  }, []);

  // Initialize booking map
  const initializeBookingMap = useCallback(
    (
      pickupLocation: LocationType,
      dropoffLocation: LocationType,
      intermediateStops?: IntermediateStop[]
    ) => {
      // Always compute route distance (even if map container isn't mounted yet)
      // This ensures fareBreakdown gets populated and the booking button works
      if (!bookingMapContainer.current || !googleApiKey) {
        console.error('🔴 [useBookingFlow] initializeBookingMap: container or apiKey missing, computing distance only', {
          hasContainer: !!bookingMapContainer.current,
          hasApiKey: !!googleApiKey,
        });
        logger.warn(LOG_CONTEXT, "Map container or API key not ready — computing distance only");
        fetchRouteAndDraw(pickupLocation, dropoffLocation, intermediateStops);
        return;
      }

      // Load Google Maps if not already loaded
      if (!window.google) {
        loadGoogleMaps(googleApiKey).then(() => {
          initializeBookingMap(pickupLocation, dropoffLocation, intermediateStops);
        }).catch((err) => {
          logger.error(LOG_CONTEXT, "Booking map load error", err);
          showErrorToast(toast, "خطأ في تحميل الخريطة", "تحقق من الاتصال أو حدّث الصفحة");
        });
        return;
      }

      // If map is not initialized yet, initialize it
      if (!bookingMap.current) {
        if (bookingMapContainer.current) {
          bookingMapContainer.current.style.backgroundColor = "#1a1a1a"; // 🌙 Dark background
        }

        logger.debug(LOG_CONTEXT, "Initializing booking map");
        
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

        logger.debug(LOG_CONTEXT, "Booking map initialized with dark mode");
      }

      // Clear previous markers & polylines
      clearDrawing();

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
      markersRef.current.push(pickupMarker);
      logger.debug(LOG_CONTEXT, "Pickup marker added");

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
      markersRef.current.push(dropoffMarker);
      logger.debug(LOG_CONTEXT, "Dropoff marker added");

      // Add intermediate stops markers
      if (intermediateStops) {
        intermediateStops.forEach((stop, index) => {
          if (stop.location) {
            const stopMarker = new google.maps.Marker({
              map: bookingMap.current,
              position: new google.maps.LatLng(stop.location.lat, stop.location.lng),
              title: `محطة ${index + 1}: ${stop.address}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "#f59e0b", // Yellow/Orange
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
                scale: 8,
              },
              zIndex: 102 + index,
            });
            markersRef.current.push(stopMarker);
            logger.debug(LOG_CONTEXT, `Intermediate stop ${index + 1} marker added`);
          }
        });
      }

      // Fetch and draw the route after map is fully loaded
      if (bookingMap.current) {
        google.maps.event.addListenerOnce(bookingMap.current, 'idle', () => {
          fetchRouteAndDraw(pickupLocation, dropoffLocation, intermediateStops);
        });
      } else {
        fetchRouteAndDraw(pickupLocation, dropoffLocation, intermediateStops);
      }
    },
    [googleApiKey, fetchRouteAndDraw, clearDrawing]
  );

  /** @deprecated Use initializeBookingMap which calls fetchRouteAndDraw internally */
  const fetchRoute = fetchRouteAndDraw;

  const cleanup = useCallback(() => {
    clearDrawing();
    bookingMap.current = null;
  }, [clearDrawing]);

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
