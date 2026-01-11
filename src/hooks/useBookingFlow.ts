/**
 * ران - Hook تدفق الحجز
 * يدير logic الحجز والأسعار واختيار المركبة والدفع
 */

import { useCallback, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useToast } from "./use-toast";

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

export const useBookingFlow = (mapToken: string | null) => {
  const { toast } = useToast();

  const bookingMapContainer = useRef<HTMLDivElement>(null);
  const bookingMap = useRef<mapboxgl.Map | null>(null);

  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  // Helper function to fetch and draw route
  const fetchRouteAndDraw = useCallback(
    async (pickupLocation: LocationType, dropoffLocation: LocationType) => {
      if (!mapToken) return;

      try {
        const start = `${pickupLocation.lng},${pickupLocation.lat}`;
        const end = `${dropoffLocation.lng},${dropoffLocation.lat}`;

        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          setRouteDistance(route.distance / 1000);
          setRouteDuration(route.duration / 60);

          // Draw route on booking map
          const source = bookingMap.current?.getSource(
            "booking-route"
          ) as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: route.geometry.coordinates,
              },
            });

            // Fit map to route
            const bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach((coord: [number, number]) =>
              bounds.extend(coord)
            );
            bookingMap.current?.fitBounds(bounds, {
              padding: 80,
              duration: 1000,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    },
    [mapToken]
  );

  // Initialize booking map
  const initializeBookingMap = useCallback(
    (pickupLocation: LocationType, dropoffLocation: LocationType) => {
      if (!bookingMapContainer.current || !mapToken) return;

      mapboxgl.accessToken = mapToken;

      bookingMap.current = new mapboxgl.Map({
        container: bookingMapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [pickupLocation.lng, pickupLocation.lat],
        zoom: 13,
        interactive: false,
      });

      bookingMap.current.on("load", () => {
        // Add pickup marker
        const pickupEl = document.createElement("div");
        pickupEl.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </div>
        `;
        new mapboxgl.Marker(pickupEl)
          .setLngLat([pickupLocation.lng, pickupLocation.lat])
          .addTo(bookingMap.current!);

        // Add dropoff marker
        const dropoffEl = document.createElement("div");
        dropoffEl.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
        `;
        new mapboxgl.Marker(dropoffEl)
          .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
          .addTo(bookingMap.current!);

        // Add route source
        bookingMap.current?.addSource("booking-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          },
        });

        // Route glow layer
        bookingMap.current?.addLayer({
          id: "booking-route-glow",
          type: "line",
          source: "booking-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#00d9a5",
            "line-width": 10,
            "line-blur": 6,
            "line-opacity": 0.5,
          },
        });

        // Route main layer
        bookingMap.current?.addLayer({
          id: "booking-route",
          type: "line",
          source: "booking-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#00d9a5",
            "line-width": 4,
            "line-opacity": 1,
          },
        });

        // Fetch and draw the route after map is fully loaded
        fetchRouteAndDraw(pickupLocation, dropoffLocation);
      });
    },
    [mapToken, fetchRouteAndDraw]
  );

  // Fetch route
  const fetchRoute = useCallback(
    async (pickupLocation: LocationType, dropoffLocation: LocationType) => {
      if (!mapToken) return;

      try {
        const start = `${pickupLocation.lng},${pickupLocation.lat}`;
        const end = `${dropoffLocation.lng},${dropoffLocation.lat}`;

        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          setRouteDistance(route.distance / 1000);
          setRouteDuration(route.duration / 60);

          // Draw route on booking map
          const source = bookingMap.current?.getSource(
            "booking-route"
          ) as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: route.geometry.coordinates,
              },
            });

            // Fit map to route
            const bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach((coord: [number, number]) =>
              bounds.extend(coord)
            );
            bookingMap.current?.fitBounds(bounds, {
              padding: 80,
              duration: 1000,
            });
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
    [mapToken, toast]
  );

  const cleanup = useCallback(() => {
    bookingMap.current?.remove();
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
