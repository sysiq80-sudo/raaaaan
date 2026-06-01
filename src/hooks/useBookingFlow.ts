/**
 * ران - Hook تدفق الحجز
 * يدير logic الحجز والأسعار واختيار المركبة والدفع
 * Google Maps Version
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./use-toast";
import { getDirections, createSvgIcon, getOrCreateSharedMap } from "@/lib/googleMapService";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import { useAdaptiveRouting } from "@/hooks/useAdaptiveRouting";
import { logger } from "@/lib/logger";
import { showErrorToast } from "@/lib/toastHelpers";
import type { PaymentMethod } from "@/types/savedCards";
import useRiderStore from "@/stores/riderStore";

const LOG_CONTEXT = "useBookingFlow";

interface LocationType {
  lat: number;
  lng: number;
  address: string;
  snappedLat?: number;
  snappedLng?: number;
}

interface IntermediateStop {
  id: string;
  address: string;
  location: { lat: number; lng: number } | null;
  estimatedTime?: number;
  distanceFromPrevious?: number;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";

export const useBookingFlow = () => {
  const { toast } = useToast();
  const { apiKey: googleApiKey } = useGoogleMapsApiKey();
  const storedPaymentMethod = useRiderStore((state) => state.selectedPayment);
  const setStoredPaymentMethod = useRiderStore((state) => state.setPayment);

  // Phase 7: Adaptive routing — OSRM primary, Haversine fallback
  const { currentAdapter: routingAdapter, getRoute: getAdaptiveRoute } = useAdaptiveRouting();

  const bookingMapContainer = useRef<HTMLDivElement>(null);
  const bookingMap = useRef<google.maps.Map | null>(null);

  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethodState] = useState<PaymentMethod>(storedPaymentMethod);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  // Track markers for proper cleanup
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  useEffect(() => {
    setPaymentMethodState(storedPaymentMethod);
  }, [storedPaymentMethod]);

  const setPaymentMethod = useCallback(
    (method: PaymentMethod) => {
      setPaymentMethodState(method);
      setStoredPaymentMethod(method);
    },
    [setStoredPaymentMethod],
  );

  // Helper: fit camera to show all markers
  const fitBoundsToMarkers = useCallback((
    pickupLocation: LocationType,
    dropoffLocation: LocationType,
    intermediateStops?: IntermediateStop[]
  ) => {
    if (!bookingMap.current) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(
      pickupLocation.snappedLat ?? pickupLocation.lat,
      pickupLocation.snappedLng ?? pickupLocation.lng
    ));
    bounds.extend(new google.maps.LatLng(
      dropoffLocation.snappedLat ?? dropoffLocation.lat,
      dropoffLocation.snappedLng ?? dropoffLocation.lng
    ));
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
  }, []);

  // Helper function to fetch route distance/duration (NO polyline drawing for rider)
  const fetchRouteAndDraw = useCallback(
    async (
      pickupLocation: LocationType,
      dropoffLocation: LocationType,
      intermediateStops?: IntermediateStop[]
    ) => {
      const hasMap = !!bookingMap.current;
      logger.debug(LOG_CONTEXT, 'fetchRouteAndDraw CALLED', {
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

      const origin = {
        lat: pickupLocation.snappedLat ?? pickupLocation.lat,
        lng: pickupLocation.snappedLng ?? pickupLocation.lng
      };
      const destination = {
        lat: dropoffLocation.snappedLat ?? dropoffLocation.lat,
        lng: dropoffLocation.snappedLng ?? dropoffLocation.lng
      };
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
          logger.debug(LOG_CONTEXT, 'ADAPTIVE ROUTE SUCCESS', { routeDistance: Math.round(distanceKm * 10) / 10 });
          logger.debug(LOG_CONTEXT, "Adaptive route received", { distanceKm, durationMin });

          // Fit camera to markers only (no polyline for rider)
          fitBoundsToMarkers(pickupLocation, dropoffLocation, intermediateStops);
          return; // ✅ تم — لا حاجة لـ Google Directions
        }

        // ─── Fallback: Google Directions API ─────────────────────────────────
        if (!googleApiKey) {
          logger.warn(LOG_CONTEXT, "No routing adapter and no Google API key — using Haversine fallback");
          const R = 6371;
          const dLat = (destination.lat - origin.lat) * Math.PI / 180;
          const dLng = (destination.lng - origin.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c * 1.35;
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

          // Fit camera to markers only (no polyline for rider)
          fitBoundsToMarkers(pickupLocation, dropoffLocation, intermediateStops);
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
    [routingAdapter, getAdaptiveRoute, googleApiKey, toast, fitBoundsToMarkers]
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
      if (!bookingMapContainer.current || !googleApiKey) {
        logger.debug(LOG_CONTEXT, 'initializeBookingMap: container or apiKey missing, computing distance only', {
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
          bookingMapContainer.current.style.backgroundColor = "#1a1a1a";
        }

        logger.debug(LOG_CONTEXT, "Initializing booking map");

        // ✅ بدون styles مخصصة — نفس المظهر الافتراضي لخريطة الانطلاق/الوصول
        bookingMap.current = getOrCreateSharedMap(bookingMapContainer.current, {
          center: new google.maps.LatLng(pickupLocation.lat, pickupLocation.lng),
          zoom: 13,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: "cooperative",
          draggable: true,
          disableDefaultUI: false,
          zoomControl: true,
        });

        logger.debug(LOG_CONTEXT, "Booking map initialized with dark mode");
      }

      // Clear previous markers & polylines
      clearDrawing();

      // Add pickup marker
      const pickupPinSvg = `
        <svg viewBox="0 0 80 65" width="80" height="65" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style type="text/css">
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&amp;display=swap');
              .text-label {
                font-family: 'Cairo', sans-serif;
                font-size: 10px;
                font-weight: 900;
                text-anchor: middle;
              }
            </style>
            <filter id="shadowP" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
            </filter>
          </defs>
          <!-- White background label with shadow -->
          <rect x="2" y="2" width="76" height="22" rx="8" fill="#ffffff" stroke="#10b981" stroke-width="1.5" filter="url(#shadowP)"/>
          <!-- Green square -->
          <rect x="60" y="9" width="8" height="8" rx="2" fill="#10b981"/>
          <!-- الانطلاق text -->
          <text x="35" y="16" fill="#10b981" class="text-label">الانطلاق</text>
          <!-- Pin icon -->
          <g transform="translate(28, 28)">
            <path d="M12,2.06a5.5,5.5,0,0,0-.5,10.97v8.41a.5.5,0,0,0,.5.5.5.5,0,0,0,.5-.5V13.03A5.5,5.5,0,0,0,12,2.06Zm0,10a4.5,4.5,0,1,1,4.5-4.5A4.5,4.5,0,0,1,12,12.06Z" fill="#10b981"/>
          </g>
        </svg>
      `;
      const pickupMarker = new google.maps.Marker({
        map: bookingMap.current,
        position: new google.maps.LatLng(pickupLocation.snappedLat ?? pickupLocation.lat, pickupLocation.snappedLng ?? pickupLocation.lng),
        title: "الانطلاق",
        icon: createSvgIcon(pickupPinSvg, 1.8, 80, 65, 40, 47),
        zIndex: 100,
      });
      markersRef.current.push(pickupMarker);
      logger.debug(LOG_CONTEXT, "Pickup marker added");

      // Add dropoff marker
      const dropoffPinSvg = `
        <svg viewBox="0 0 80 65" width="80" height="65" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style type="text/css">
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&amp;display=swap');
              .text-label {
                font-family: 'Cairo', sans-serif;
                font-size: 10px;
                font-weight: 900;
                text-anchor: middle;
              }
            </style>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
            </filter>
          </defs>
          <!-- White background label with shadow -->
          <rect x="2" y="2" width="76" height="22" rx="8" fill="#ffffff" stroke="#0ea5e9" stroke-width="1.5" filter="url(#shadow)"/>
          <!-- Blue dot -->
          <circle cx="64" cy="13" r="4" fill="#0ea5e9"/>
          <!-- الوصول text -->
          <text x="35" y="16" fill="#0ea5e9" class="text-label">الوصول</text>
          <!-- Pin icon -->
          <g transform="translate(28, 28)">
            <path d="M12,2.06a5.5,5.5,0,0,0-.5,10.97v8.41a.5.5,0,0,0,.5.5.5.5,0,0,0,.5-.5V13.03A5.5,5.5,0,0,0,12,2.06Zm0,10a4.5,4.5,0,1,1,4.5-4.5A4.5,4.5,0,0,1,12,12.06Z" fill="#0ea5e9"/>
          </g>
        </svg>
      `;
      const dropoffMarker = new google.maps.Marker({
        map: bookingMap.current,
        position: new google.maps.LatLng(dropoffLocation.snappedLat ?? dropoffLocation.lat, dropoffLocation.snappedLng ?? dropoffLocation.lng),
        title: "الوصول",
        icon: createSvgIcon(dropoffPinSvg, 1.8, 80, 65, 40, 47),
        zIndex: 101,
      });
      markersRef.current.push(dropoffMarker);
      logger.debug(LOG_CONTEXT, "Dropoff marker added");

      // Add intermediate stops markers
      if (intermediateStops) {
        intermediateStops.forEach((stop, index) => {
          if (stop.location) {
            const stopPinSvg = `
              <svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                <path d="M12,2.06a5.5,5.5,0,0,0-.5,10.97v8.41a.5.5,0,0,0,.5.5.5.5,0,0,0,.5-.5V13.03A5.5,5.5,0,0,0,12,2.06Zm0,10a4.5,4.5,0,1,1,4.5-4.5A4.5,4.5,0,0,1,12,12.06Z" fill="#f59e0b"/>
              </svg>
            `;
            const stopMarker = new google.maps.Marker({
              map: bookingMap.current,
              position: new google.maps.LatLng(stop.location.lat, stop.location.lng),
              title: `محطة ${index + 1}: ${stop.address}`,
              icon: createSvgIcon(stopPinSvg, 1.1),
              zIndex: 102 + index,
            });
            markersRef.current.push(stopMarker);
            logger.debug(LOG_CONTEXT, `Intermediate stop ${index + 1} marker added`);
          }
        });
      }

      // Fetch route distance/duration and fit camera (no polyline drawn)
      fetchRouteAndDraw(pickupLocation, dropoffLocation, intermediateStops);
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
