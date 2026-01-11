import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ArrowRight,
  Navigation,
  Loader2,
  MapPin,
  Target,
  AlertTriangle,
  Check,
  Star,
  Clock,
  Car,
  Route,
  CalendarClock,
  ChevronDown,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import LocationSearchInput from "@/components/LocationSearchInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";
import { useActiveRide, ActiveRide } from "@/hooks/useActiveRide";
import CompactVehicleSelector from "@/components/rider/CompactVehicleSelector";
import { PaymentMethodBadge } from "@/components/rider/PaymentMethodSelector";
import PaymentMethodSheet from "@/components/rider/PaymentMethodSheet";
import { ScheduleRideDialog } from "@/components/rider/ScheduleRideDialog";
import { motion, AnimatePresence } from "framer-motion";

// Lazy load heavy components
const RideWaitingScreen = lazy(
  () => import("@/components/rider/RideWaitingScreen")
);
const LiveRideTracker = lazy(
  () => import("@/components/rider/LiveRideTracker")
);
const RideCompletedScreen = lazy(
  () => import("@/components/rider/RideCompletedScreen")
);

// Loading skeleton
const ScreenSkeleton = () => (
  <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>
);

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

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}

type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethodType =
  | "cash"
  | "wallet"
  | "card"
  | "zain_cash"
  | "super_key"
  | "nas_wallet";

const GoPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Map state
  const [isLoading, setIsLoading] = useState(true);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaCheck | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCheckingService, setIsCheckingService] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Flow state
  const [currentMode, setCurrentMode] = useState<
    "pickup" | "dropoff" | "booking" | "waiting" | "tracking"
  >("pickup");
  const [pickupLocation, setPickupLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  // User state
  const [userId, setUserId] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Booking state
  const [selectedVehicle, setSelectedVehicle] =
    useState<VehicleType>("economy");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const bookingMapContainer = useRef<HTMLDivElement>(null);
  const bookingMap = useRef<mapboxgl.Map | null>(null);

  // Active ride state
  const {
    activeRide,
    setActiveRide,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    completedRide,
    showCompletedScreen,
    clearCompletedRide,
  } = useActiveRide(userId || null);

  const ramadiCenter: [number, number] = [43.2954, 33.4262];

  // Fare calculation
  const { fareBreakdown, fareLoading } = useFareCalculation(
    pickupLocation,
    dropoffLocation,
    selectedVehicle,
    routeDistance
  );

  // Nearby drivers
  const { nearbyDriversCount, availableDriversByType } =
    useOptimizedNearbyDrivers(pickupLocation, selectedVehicle, {
      enableRealtime: !!pickupLocation,
      debounceMs: 1000,
    });

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Fetch user ID and saved places
  useEffect(() => {
    const fetchUserAndPlaces = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
          fetchSavedPlaces(session.user.id);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUserAndPlaces();
  }, []);

  // Fetch saved places
  const fetchSavedPlaces = async (userId: string) => {
    setLoadingSavedPlaces(true);
    try {
      const { data, error } = await supabase
        .from("saved_places")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSavedPlaces(data || []);
    } catch (error) {
      console.error("Error fetching saved places:", error);
    } finally {
      setLoadingSavedPlaces(false);
    }
  };

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token",
          { headers: { "Content-Type": "application/json" } }
        );
        const data = await response.json();
        if (data.token) setMapToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    fetchToken();
  }, []);

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
    } catch {
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
      } catch {
        setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    },
    [checkServiceArea]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken || currentMode === "booking") return;

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

    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.current.on("load", () => {
      setIsLoading(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);

      // Add user location marker if available
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
      }

      // Add route source
      map.current?.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });

      // Route glow layer
      map.current?.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00d9a5",
          "line-width": 12,
          "line-blur": 8,
          "line-opacity": 0.4,
        },
      });

      // Route main layer
      map.current?.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#00d9a5", "line-width": 5, "line-opacity": 1 },
      });
    });

    map.current.on("dragstart", () => setIsDragging(true));
    map.current.on("dragend", () => {
      setIsDragging(false);
      const center = map.current?.getCenter();
      if (center) reverseGeocode(center.lat, center.lng);
    });
    map.current.on("moveend", () => {
      if (!isDragging) {
        const center = map.current?.getCenter();
        if (center) reverseGeocode(center.lat, center.lng);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapToken, userLocation, reverseGeocode, currentMode]);

  // Fetch route when both locations are set
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation || !mapToken) return;

    const fetchRoute = async () => {
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

          // Draw route on map
          const source = map.current?.getSource(
            "route"
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
            map.current?.fitBounds(bounds, { padding: 80, duration: 1000 });
          }
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    };

    fetchRoute();
  }, [pickupLocation, dropoffLocation, mapToken]);

  // Initialize booking mode map
  useEffect(() => {
    if (
      currentMode !== "booking" ||
      !bookingMapContainer.current ||
      !mapToken ||
      !pickupLocation ||
      !dropoffLocation
    )
      return;

    mapboxgl.accessToken = mapToken;

    bookingMap.current = new mapboxgl.Map({
      container: bookingMapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [pickupLocation.lng, pickupLocation.lat],
      zoom: 13,
      interactive: false,
    });

    bookingMap.current.on("load", () => {
      // Add markers
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

      // Add route
      bookingMap.current?.addSource("booking-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });

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

      bookingMap.current?.addLayer({
        id: "booking-route",
        type: "line",
        source: "booking-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#00d9a5", "line-width": 4 },
      });

      // Fetch and draw route
      fetchBookingRoute();
    });

    return () => {
      bookingMap.current?.remove();
      bookingMap.current = null;
    };
  }, [currentMode, mapToken, pickupLocation, dropoffLocation]);

  const fetchBookingRoute = async () => {
    if (!pickupLocation || !dropoffLocation) return;

    try {
      const start = `${pickupLocation.lng},${pickupLocation.lat}`;
      const end = `${dropoffLocation.lng},${dropoffLocation.lat}`;

      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${start}&end=${end}`
      );
      const data = await response.json();

      if (data.routes?.[0] && bookingMap.current) {
        const route = data.routes[0];
        const source = bookingMap.current.getSource(
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

          const bounds = new mapboxgl.LngLatBounds();
          route.geometry.coordinates.forEach((coord: [number, number]) =>
            bounds.extend(coord)
          );
          bookingMap.current.fitBounds(bounds, { padding: 40, duration: 1000 });
        }
      }
    } catch (error) {
      console.error("Error fetching booking route:", error);
    }
  };

  const centerOnUser = () => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        duration: 1000,
      });
    }
  };

  const handleConfirm = async () => {
    if (!map.current || isConfirming) return;

    setIsConfirming(true);
    try {
      const center = map.current.getCenter();

      // If we don't have an address yet, get it first
      let address = centerAddress;
      if (!address) {
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${center.lat}&lng=${center.lng}`,
            { headers: { "Content-Type": "application/json" } }
          );
          const data = await response.json();
          if (data.features?.[0]?.place_name) {
            address = data.features[0].place_name;
            setCenterAddress(address); // Update the state for future use
          } else {
            address = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
            setCenterAddress(address);
          }
        } catch {
          address = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
          setCenterAddress(address);
        }
      }

      const serviceCheck = await checkServiceArea(center.lat, center.lng);
      const location = {
        lat: center.lat,
        lng: center.lng,
        address: address,
        inService: serviceCheck?.in_service,
      };

      if (currentMode === "pickup") {
        setPickupLocation(location);
        setCurrentMode("dropoff");
        setCenterAddress("");
        setSearchQuery("");
        setServiceAreaStatus(null);
        toast({
          title: "تم تحديد موقع الانطلاق ✅",
          description: location.address,
        });
      } else if (currentMode === "dropoff") {
        setDropoffLocation(location);
        setCurrentMode("booking");
        toast({ title: "تم تحديد الوجهة ✅", description: location.address });
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSearchSelect = (location: {
    lat: number;
    lng: number;
    address: string;
  }) => {
    if (map.current) {
      map.current.flyTo({
        center: [location.lng, location.lat],
        zoom: 16,
        duration: 800,
      });
    }
    setCenterAddress(location.address);
    checkServiceArea(location.lat, location.lng);
  };

  const handleSavedPlaceSelect = (place: SavedPlace) => {
    if (map.current) {
      map.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 16,
        duration: 800,
      });
    }
    setCenterAddress(place.address);
    checkServiceArea(place.lat, place.lng);
  };

  // Reset booking state
  const resetBooking = useCallback(() => {
    setPickupLocation(null);
    setDropoffLocation(null);
    setRouteDistance(null);
    setRouteDuration(null);
    setCurrentMode("pickup");
    setShowWaitingScreen(false);
    setShowLiveTracker(false);
    setActiveRide(null);
    setCenterAddress("");
    setSearchQuery("");
  }, [setActiveRide, setShowLiveTracker, setShowWaitingScreen]);

  // Handle ride completion screen close
  const handleRideCompletion = useCallback(() => {
    clearCompletedRide();
    resetBooking();
  }, [clearCompletedRide, resetBooking]);

  const handleBookRide = async () => {
    if (!userId) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول للحجز",
        variant: "destructive",
      });
      navigate("/auth?redirect=/go");
      return;
    }

    // Check if there's already an active ride
    if (
      activeRide &&
      activeRide.status !== "completed" &&
      activeRide.status !== "cancelled"
    ) {
      toast({
        title: "لديك رحلة نشطة",
        description: "الرجاء إنهاء الرحلة الحالية قبل حجز رحلة جديدة",
        variant: "destructive",
      });
      setShowWaitingScreen(true);
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      toast({
        title: "معلومات ناقصة",
        description: "الرجاء تحديد نقطة الانطلاق والوجهة",
        variant: "destructive",
      });
      return;
    }

    // Check fare
    const totalFare = fareBreakdown?.total_fare || 0;
    if (totalFare <= 0) {
      toast({
        title: "خطأ في حساب السعر",
        description: "الرجاء إعادة المحاولة",
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);
    try {
      const { data: ride, error } = await supabase
        .from("rides")
        .insert([
          {
            rider_id: userId,
            pickup_location: {
              lat: pickupLocation.lat,
              lng: pickupLocation.lng,
            },
            dropoff_location: {
              lat: dropoffLocation.lat,
              lng: dropoffLocation.lng,
            },
            pickup_address: pickupLocation.address,
            dropoff_address: dropoffLocation.address,
            vehicle_type: selectedVehicle,
            payment_method: paymentMethod,
            estimated_fare: fareBreakdown?.total_fare || 0,
            distance_km: routeDistance
              ? Number(routeDistance.toFixed(2))
              : null,
            duration_minutes: routeDuration ? Math.round(routeDuration) : null,
            status: "pending",
          } as any,
        ])
        .select()
        .single();

      if (error) throw error;

      // Set active ride for tracking
      const pickupLoc = ride.pickup_location as unknown as {
        lat: number;
        lng: number;
      };
      const dropoffLoc = ride.dropoff_location as unknown as {
        lat: number;
        lng: number;
      };

      setActiveRide({
        id: ride.id,
        pickup_location: pickupLoc,
        dropoff_location: dropoffLoc,
        pickup_address: ride.pickup_address,
        dropoff_address: ride.dropoff_address,
        status: ride.status,
        estimated_fare: ride.estimated_fare,
        final_fare: ride.final_fare,
        distance_km: ride.distance_km,
        duration_minutes: ride.duration_minutes,
        vehicle_type: ride.vehicle_type,
        driver_id: ride.driver_id,
        created_at: ride.created_at,
        completed_at: ride.completed_at,
      });

      // Show waiting screen
      setShowWaitingScreen(true);

      // Trigger ride matching
      await supabase.functions.invoke("match-ride", {
        body: { ride_id: ride.id },
      });

      toast({
        title: "تم إرسال طلبك ✅",
        description: "جاري البحث عن سائق قريب",
      });
    } catch (error: any) {
      console.error("Booking error:", error);
      toast({
        title: "فشل الحجز",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const isPickup = currentMode === "pickup";
  const isDropoff = currentMode === "dropoff";
  const isBookingMode = currentMode === "booking";

  // Show completed screen for rating
  if (showCompletedScreen && completedRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <RideCompletedScreen
          ride={{
            id: completedRide.id,
            pickup_address: completedRide.pickup_address,
            dropoff_address: completedRide.dropoff_address,
            final_fare: completedRide.final_fare,
            estimated_fare: completedRide.estimated_fare,
            distance_km: completedRide.distance_km,
            duration_minutes: completedRide.duration_minutes,
            driver_id: completedRide.driver_id,
          }}
          driverName={completedRide.driver?.full_name || "السائق"}
          onClose={handleRideCompletion}
        />
      </Suspense>
    );
  }

  // Show waiting screen if ride is pending or accepted
  if (showWaitingScreen && activeRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <RideWaitingScreen
          rideId={activeRide.id}
          pickupAddress={
            activeRide.pickup_address ||
            pickupLocation?.address ||
            "موقعي الحالي"
          }
          dropoffAddress={
            activeRide.dropoff_address || dropoffLocation?.address || ""
          }
          estimatedFare={
            activeRide.estimated_fare || fareBreakdown?.total_fare || 0
          }
          onCancel={resetBooking}
          onDriverFound={() => {
            setShowWaitingScreen(false);
            setShowLiveTracker(true);
          }}
        />
      </Suspense>
    );
  }

  // Show live tracker if ride is in progress
  if (showLiveTracker && activeRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <LiveRideTracker
          ride={activeRide}
          onRideCompleted={resetBooking}
          onRideCancelled={resetBooking}
        />
      </Suspense>
    );
  }

  // Booking confirmation screen
  if (isBookingMode && pickupLocation && dropoffLocation) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background flex flex-col"
      >
        {/* Header */}
        <div className="bg-card/95 backdrop-blur-md border-b border-border/50 z-30">
          <div className="flex items-center justify-between p-4 safe-area-top">
            <button
              onClick={() => setCurrentMode("dropoff")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              تأكيد الرحلة
            </h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Map with route */}
        <div className="h-44 relative overflow-hidden">
          <div ref={bookingMapContainer} className="absolute inset-0" />
          {/* Route info overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex gap-2">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex-1 bg-card/90 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <Navigation className="w-4 h-4 text-green-500" />
              <span className="text-sm font-bold">
                {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
              </span>
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex-1 bg-card/90 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-bold">
                {routeDuration ? `${Math.round(routeDuration)} دقيقة` : "---"}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Booking details */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-32">
          {/* Route summary */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-3 bg-muted/30 rounded-2xl p-4 border border-border/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-500/20" />
                <div className="w-0.5 h-8 bg-gradient-to-b from-green-500 to-blue-500 my-1" />
                <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">
                    من
                  </p>
                  <p className="font-semibold text-sm line-clamp-1">
                    {pickupLocation.address}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">
                    إلى
                  </p>
                  <p className="font-semibold text-sm line-clamp-1">
                    {dropoffLocation.address}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Trip info summary */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 p-3 rounded-xl border bg-primary/10 border-primary/30"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-foreground">
                رحلة سريعة وآمنة
              </p>
              <p className="text-xs text-muted-foreground">
                سيتم البحث عن أقرب سائق متاح فور تأكيد الحجز
              </p>
            </div>
          </motion.div>

          {/* Vehicle selector */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <p className="text-sm font-semibold text-muted-foreground px-1 flex items-center gap-2">
              <Car className="w-4 h-4" />
              نوع المركبة
            </p>
            <CompactVehicleSelector
              selectedVehicle={selectedVehicle}
              onSelect={setSelectedVehicle}
              availableDrivers={availableDriversByType}
              baseFare={fareBreakdown?.total_fare}
            />
          </motion.div>

          {/* Fare breakdown */}
          {fareBreakdown && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  تفاصيل الأجرة
                </p>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                  تقديرية
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الأجرة الأساسية</span>
                  <span>
                    {(fareBreakdown.base_fare || 0).toLocaleString()} د.ع
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    أجرة المسافة ({routeDistance?.toFixed(1) || 0} كم)
                  </span>
                  <span>
                    {(fareBreakdown.distance_fare || 0).toLocaleString()} د.ع
                  </span>
                </div>
                {fareBreakdown.vehicle_multiplier &&
                  fareBreakdown.vehicle_multiplier > 1 && (
                    <div className="flex justify-between text-amber-600">
                      <span>رسوم نوع المركبة</span>
                      <span>×{fareBreakdown.vehicle_multiplier}</span>
                    </div>
                  )}
                <div className="border-t border-border/50 pt-2 mt-2 flex justify-between font-bold text-lg">
                  <span>الإجمالي</span>
                  <span className="text-primary">
                    {(fareBreakdown.total_fare || 0).toLocaleString()} د.ع
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Payment method */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-2"
          >
            <p className="text-sm font-semibold text-muted-foreground px-1 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              طريقة الدفع
            </p>
            <PaymentMethodBadge
              method={paymentMethod}
              onClick={() => setPaymentSheetOpen(true)}
            />
          </motion.div>

          {/* Schedule option */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <ScheduleRideDialog
              pickup={pickupLocation}
              dropoff={dropoffLocation}
              vehicleType={selectedVehicle}
              paymentMethod={paymentMethod}
              estimatedFare={fareBreakdown?.total_fare || null}
              onScheduled={() => {
                toast({
                  title: "تم جدولة الرحلة ✅",
                  description: "سيتم تذكيرك قبل الموعد",
                });
                resetBooking();
              }}
            />
          </motion.div>
        </div>

        {/* Book button - Fixed bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border/50 safe-area-bottom z-40">
          <Button
            onClick={handleBookRide}
            disabled={isBooking || fareLoading}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-primary/80 rounded-2xl shadow-lg shadow-primary/30"
          >
            {isBooking ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الحجز...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                احجز الآن •{" "}
                {fareBreakdown?.total_fare?.toLocaleString() || "---"} د.ع
              </span>
            )}
          </Button>
        </div>

        {/* Payment Method Sheet */}
        <PaymentMethodSheet
          open={paymentSheetOpen}
          onOpenChange={setPaymentSheetOpen}
          selectedMethod={paymentMethod}
          onSelect={setPaymentMethod}
        />
      </motion.div>
    );
  }

  // Location picker screen
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card/95 backdrop-blur-md border-b border-border/50 z-30"
      >
        <div className="flex items-center justify-between p-4 safe-area-top">
          <button
            onClick={() => {
              if (currentMode === "dropoff" && pickupLocation) {
                setCurrentMode("pickup");
                setPickupLocation(null);
              } else {
                navigate(-1);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            {isPickup ? (
              <>
                <Target className="w-5 h-5 text-green-500" />
                حدد موقع الانطلاق
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5 text-blue-500" />
                حدد الوجهة
              </>
            )}
          </h1>
          <div className="w-10" />
        </div>

        {/* Progress indicator */}
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                isPickup || pickupLocation ? "bg-green-500" : "bg-muted"
              }`}
            />
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                isDropoff || dropoffLocation ? "bg-blue-500" : "bg-muted"
              }`}
            />
          </div>
        </div>
      </motion.div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Drag instruction */}
        <AnimatePresence>
          {!isDragging && centerAddress && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none"
            >
              <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border/50">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-lg">👆</span>
                  اسحب الخريطة لتغيير الموقع
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Location pin */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ y: isDragging ? -10 : 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-3 border-white ${
                  isPickup
                    ? "bg-gradient-to-br from-green-400 to-green-600"
                    : "bg-gradient-to-br from-blue-400 to-blue-600"
                }`}
              >
                {isPickup ? (
                  <Target className="w-5 h-5 text-white" />
                ) : (
                  <MapPin className="w-5 h-5 text-white" />
                )}
              </div>
              <div
                className={`w-1 h-8 mx-auto rounded-b-full ${
                  isPickup
                    ? "bg-gradient-to-b from-green-500 to-green-600"
                    : "bg-gradient-to-b from-blue-500 to-blue-600"
                }`}
              />
              {/* Shadow */}
              <motion.div
                animate={{
                  scale: isDragging ? 0.6 : 1,
                  opacity: isDragging ? 0.3 : 0.5,
                }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-2 bg-black rounded-full blur-sm"
              />
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-3 px-4 py-2 bg-card/95 backdrop-blur-md rounded-xl shadow-lg border border-border/50 max-w-[280px]"
            >
              <p className="text-sm font-semibold text-foreground text-center line-clamp-2">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-card/90 backdrop-blur-md flex items-center justify-center z-30">
            <div className="text-center">
              <Loader2 className="w-14 h-14 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground font-medium">
                جاري تحميل الخريطة...
              </p>
            </div>
          </div>
        )}

        {/* Center on user button */}
        {userLocation && (
          <button
            onClick={centerOnUser}
            className="absolute bottom-5 left-4 w-14 h-14 bg-card/95 backdrop-blur-md rounded-2xl border border-border/50 shadow-xl flex items-center justify-center hover:bg-accent transition-all duration-200 active:scale-95 z-40 group"
          >
            <Navigation className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* Bottom panel */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-card/95 backdrop-blur-md border-t border-border/50 shadow-2xl z-30 rounded-t-3xl"
      >
        <div className="p-3 sm:p-4">
          {/* Service area warning */}
          {serviceAreaStatus && !serviceAreaStatus.in_service && (
            <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm mb-1">
                  ⚠️ خارج منطقة الخدمة
                </p>
                {serviceAreaStatus.nearest_region && (
                  <p className="text-amber-700 text-xs">
                    أقرب منطقة: {serviceAreaStatus.nearest_region.name_ar} (
                    {serviceAreaStatus.nearest_region.distance_km} كم)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Address display */}
          <div className="flex items-start gap-3 mb-4 p-3 rounded-xl border bg-card/50">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                isPickup
                  ? "bg-green-500/20 border-green-400"
                  : "bg-blue-500/20 border-blue-400"
              }`}
            >
              {isPickup ? (
                <Target className="w-6 h-6 text-green-600" />
              ) : (
                <MapPin className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-semibold px-2 py-1 rounded-full inline-block mb-1 ${
                  isPickup
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {isPickup ? "🚗 موقع الانطلاق" : "🎯 الوجهة"}
              </p>
              <p className="font-semibold text-foreground text-sm line-clamp-2">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
              {centerAddress && (
                <p className="text-xs text-muted-foreground mt-1">
                  اسحب الخريطة لتغيير الموقع • اضغط للتأكيد
                </p>
              )}
            </div>
          </div>

          {/* Search input */}
          <div className="mb-3">
            <LocationSearchInput
              placeholder={
                isPickup
                  ? "اكتب لتحديد موقع الانطلاق..."
                  : "اكتب لتحديد الوجهة..."
              }
              value={searchQuery}
              onChange={setSearchQuery}
              onLocationSelect={handleSearchSelect}
              type={isPickup ? "pickup" : "dropoff"}
              userLocation={userLocation}
              className="w-full"
            />
          </div>

          {/* Saved places (dropoff only) */}
          {isDropoff && savedPlaces.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 px-1 flex items-center gap-2">
                <Star className="w-3 h-3 text-amber-600" />
                أماكني المحفوظة
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {loadingSavedPlaces ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  savedPlaces.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handleSavedPlaceSelect(place)}
                      className="flex flex-col items-center flex-shrink-0 w-24 h-28 p-2 rounded-xl border border-border/50 hover:border-amber-500 hover:bg-amber-500/10 transition-all"
                    >
                      <div className="text-4xl mb-2">{place.icon || "📍"}</div>
                      <p className="text-[11px] font-semibold text-center line-clamp-2">
                        {place.name}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Confirm button */}
          <Button
            onClick={handleConfirm}
            disabled={isCheckingService || isConfirming}
            className={`w-full h-14 text-base sm:text-lg font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] ${
              isPickup
                ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-500/30"
                : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/30"
            }`}
          >
            {isCheckingService || isConfirming ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>
                  {isConfirming ? "جاري التأكيد..." : "جاري التحقق..."}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>تأكيد {isPickup ? "موقع الانطلاق" : "الوجهة"}</span>
                <span>{isPickup ? "🚗" : "🎯"}</span>
              </div>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default GoPage;
