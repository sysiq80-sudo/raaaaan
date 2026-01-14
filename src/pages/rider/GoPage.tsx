import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
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
  ChevronDown,
  Zap,
  Menu,
} from "lucide-react";
import logo from "@/assets/logo.png";
import LocationSearchInput from "@/components/LocationSearchInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";
import CompactVehicleSelector from "@/components/rider/CompactVehicleSelector";
import PaymentMethodSheet from "@/components/rider/PaymentMethodSheet";
import { ScheduleRideDialog } from "@/components/rider/ScheduleRideDialog";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import StatusIcons from "@/components/common/StatusIcons";
import NetworkStatusBar from "@/components/common/NetworkStatusBar";
import StaticMapPlaceholder from "@/components/common/StaticMapPlaceholder";
import { motion, AnimatePresence } from "framer-motion";

// New custom hooks
import { useRiderData } from "@/hooks/useRiderData";
import { useLocationPicker } from "@/hooks/useLocationPicker";
import { useBookingFlow } from "@/hooks/useBookingFlow";
import { useSearchAndPlaces } from "@/hooks/useSearchAndPlaces";
import { useRideTracking } from "@/hooks/useRideTracking";
import { useLastLocation } from "@/hooks/useLastLocation";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// Performance & Enhancement hooks
import {
  usePerformanceMonitoring,
  useOperationTiming,
} from "@/hooks/usePerformanceMonitoring";
import { useLastRide, useRiderPreferences } from "@/hooks/useLocalStorage";
import { useOfflineMode } from "@/hooks/useOfflineMode";

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
const OnboardingFlow = lazy(
  () => import("@/components/rider/OnboardingFlow")
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

const GoPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Performance monitoring
  const metrics = usePerformanceMonitoring("GoPage");
  const { measureOperation } = useOperationTiming();

  // Local storage hooks
  const { lastRide, saveLastRide } = useLastRide();
  const { preferences } = useRiderPreferences();
  const { lastLocation, saveLocation } = useLastLocation();
  const [hasSeenOnboarding] = useLocalStorage("raan_onboarding_completed", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Offline support
  const { isOnline } = useOfflineMode();

  // Core data hooks
  const { userId, user, mapToken, userLocation, menuOpen, setMenuOpen } =
    useRiderData();

  // Location picker
  const {
    mapContainer,
    map,
    isLoading,
    isDragging,
    centerAddress,
    serviceAreaStatus,
    isCheckingService,
    setCenterAddress,
    checkServiceArea,
  } = useLocationPicker(mapToken, userLocation);

  // Booking flow
  const {
    bookingMapContainer,
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
    cleanup: cleanupBooking,
  } = useBookingFlow(mapToken);

  // Search and places
  const {
    searchQuery,
    setSearchQuery,
    handleSearchQueryChange,
    isSearching,
    savedPlaces,
    loadingSavedPlaces,
    handleSearchSelect,
    handleSavedPlaceSelect,
  } = useSearchAndPlaces(userId);

  // Ride tracking
  const {
    activeRide,
    setActiveRide,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    completedRide,
    showCompletedScreen,
    handleRideCompletion,
    checkActiveRideConflict,
    clearCompletedRide,
  } = useRideTracking(userId);

  // Local state
  const [currentMode, setCurrentMode] = useState<
    "pickup" | "dropoff" | "booking"
  >("pickup");
  const [pickupLocation, setPickupLocation] = useState<LocationType | null>(
    null
  );
  const [dropoffLocation, setDropoffLocation] = useState<LocationType | null>(
    null
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [localServiceAreaStatus, setLocalServiceAreaStatus] =
    useState<any>(null);

  // Fare calculation
  const { fareBreakdown, fareLoading } = useFareCalculation(
    pickupLocation,
    dropoffLocation,
    selectedVehicle,
    routeDistance
  );

  // Nearby drivers
  const { availableDriversByType } = useOptimizedNearbyDrivers(
    pickupLocation,
    selectedVehicle,
    { enableRealtime: !!pickupLocation, debounceMs: 1000 }
  );

  // Reset center address when mode changes
  useEffect(() => {
    if (currentMode === "dropoff" || currentMode === "booking") {
      setCenterAddress("");
    }
  }, [currentMode]);

  // Check if user should see onboarding (first time)
  useEffect(() => {
    if (!hasSeenOnboarding && userId) {
      setShowOnboarding(true);
    }
  }, [hasSeenOnboarding, userId]);

  // Save user location when available
  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      saveLocation({
        lat: userLocation.lat,
        lng: userLocation.lng,
        address: "موقعك الحالي",
      });
    }
  }, [userLocation, saveLocation]);

  // Fetch route when both locations are set (for initial location picker map)
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation || currentMode === "booking")
      return;
    fetchRoute(pickupLocation, dropoffLocation);
  }, [pickupLocation, dropoffLocation, fetchRoute, currentMode]);

  // Initialize booking mode map
  useEffect(() => {
    if (currentMode !== "booking" || !pickupLocation || !dropoffLocation)
      return;

    initializeBookingMap(pickupLocation, dropoffLocation);
  }, [currentMode, pickupLocation, dropoffLocation, initializeBookingMap]);

  // Local helper: center map on user location
  const centerOnUser = useCallback(() => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        duration: 800,
      });
    }
  }, [userLocation]);

  // Local helper: handle location confirmation
  const handleConfirm = useCallback(async () => {
    if (isConfirming) return;
    setIsConfirming(true);

    try {
      // الحصول على مركز الخريطة الحالي
      if (!map.current) {
        toast({
          title: "خطأ",
          description: "الخريطة غير مهيأة",
          variant: "destructive",
        });
        return;
      }

      const center = map.current.getCenter();
      let address = centerAddress;

      // إذا لم نحصل على عنوان، نحصل عليه من API
      if (!address) {
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${center.lat}&lng=${center.lng}`,
            { headers: { "Content-Type": "application/json" } }
          );
          const data = await response.json();
          if (data.features?.[0]?.place_name) {
            address = data.features[0].place_name;
          } else {
            address = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
          }
        } catch (error) {
          console.error("Reverse geocode error:", error);
          address = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
        }
      }

      // فحص منطقة الخدمة
      const serviceCheck = await checkServiceArea(center.lat, center.lng);
      setLocalServiceAreaStatus(serviceCheck);

      const location: LocationType = {
        lat: center.lat,
        lng: center.lng,
        address: address,
      };

      if (currentMode === "pickup") {
        setPickupLocation(location);
        setCurrentMode("dropoff");
        setCenterAddress("");
        setSearchQuery("");
        toast({
          title: "تم تحديد موقع الانطلاق ✅",
          description: address,
        });
      } else if (currentMode === "dropoff") {
        setDropoffLocation(location);
        setCurrentMode("booking");
        toast({ title: "تم تحديد الوجهة ✅", description: address });
      }
    } catch (error) {
      console.error("Confirm error:", error);
      toast({
        title: "خطأ",
        description: "فشل تأكيد الموقع",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  }, [currentMode, centerAddress, isConfirming, map, checkServiceArea, toast]);

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
    setLocalServiceAreaStatus(null);
  }, []);

  // Handle booking submission
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

    // Save last ride for quick rebooking
    saveLastRide({
      pickupAddress: pickupLocation.address,
      pickupLat: pickupLocation.lat,
      pickupLng: pickupLocation.lng,
      dropoffAddress: dropoffLocation.address,
      dropoffLat: dropoffLocation.lat,
      dropoffLng: dropoffLocation.lng,
      vehicleType: selectedVehicle,
      timestamp: Date.now(),
    });

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

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      </Suspense>
    );
  }

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
          driverName={"السائق"}
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
          onClose={resetBooking}
          onRideUpdate={(updatedRide) => {
            if (
              updatedRide.status === "completed" ||
              updatedRide.status === "cancelled"
            ) {
              resetBooking();
            }
          }}
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
        className="h-screen bg-background flex flex-col overflow-hidden"
      >
        {/* Offline/Online status indicator */}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-md px-4 py-2 text-center text-sm font-medium text-white flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>أنت بدون إنترنت - بعض الميزات قد لا تعمل</span>
          </div>
        )}

        {/* Progress indicator - Top */}
        <div
          className={`absolute left-0 right-0 z-50 px-4 ${
            !isOnline ? "pt-14" : "pt-2"
          }`}
        >
          <div className="flex gap-2">
            <div className="flex-1 h-1 rounded-full bg-green-500" />
            <div className="flex-1 h-1 rounded-full bg-blue-500" />
            <div className="flex-1 h-1 rounded-full bg-primary animate-pulse" />
          </div>
        </div>

        {/* Header - Transparent over map */}
        <div
          className={`absolute left-0 right-0 z-40 px-4 ${
            !isOnline ? "top-20" : "top-4"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-card/90 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 flex-shrink-0"
              aria-label="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo and Route info - Combined */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-lg">
                <img src={logo} alt="RAAN" className="w-7 h-7 rounded-lg" />
                <span className="font-bold text-lg">ران</span>
              </div>

              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-card/70 backdrop-blur-xl rounded-2xl px-3 py-2 flex items-center gap-3 shadow-lg border border-white/10"
              >
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-sm font-bold">
                    {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
                  </span>
                </div>
                <div className="w-px h-4 bg-border/30" />
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-sm font-bold">
                    {routeDuration ? `${Math.round(routeDuration)} د` : "---"}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Status Icons - Right side */}
            <StatusIcons userLocation={pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null} />

            <button
              onClick={() => setCurrentMode("dropoff")}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 to-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 flex-shrink-0"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Map - Top Half */}
        <div className="h-[45%] relative">
          <div ref={bookingMapContainer} className="absolute inset-0" />
        </div>

        {/* Details - Bottom Half with rounded top */}
        <div className="h-[55%] bg-background rounded-t-3xl -mt-4 relative z-10 flex flex-col shadow-2xl">
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
            {/* Route summary - Two lines with icons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-card rounded-2xl p-4 space-y-3 border border-border/30"
            >
              {/* Pickup location */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-500/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-green-600 font-bold mb-1">
                    📍 موقع الانطلاق
                  </p>
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {pickupLocation.address}
                  </p>
                </div>
              </div>

              {/* Divider line */}
              <div className="flex items-center gap-2 pr-11">
                <div className="flex-1 h-px bg-gradient-to-r from-green-500/20 via-muted to-blue-500/20" />
              </div>

              {/* Dropoff location */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-blue-600 font-bold mb-1">
                    🎯 موقع الوصول
                  </p>
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {dropoffLocation.address}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Vehicle selector */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <CompactVehicleSelector
                selectedVehicle={selectedVehicle}
                onSelect={setSelectedVehicle}
                availableDrivers={availableDriversByType}
                baseFare={fareBreakdown?.total_fare}
              />
            </motion.div>

            {/* Fare & Payment Row - Single Line */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex gap-2"
            >
              {/* Fare summary - Single line */}
              {fareBreakdown && (
                <div className="flex-1 bg-card rounded-xl px-4 py-3 border border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      الأجرة
                    </span>
                    <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                      تقديرية
                    </span>
                  </div>
                  <p className="font-bold text-lg text-primary">
                    {(fareBreakdown.total_fare || 0).toLocaleString()} د.ع
                  </p>
                </div>
              )}

              {/* Payment method - Single line */}
              <div
                onClick={() => setPaymentSheetOpen(true)}
                className="flex-1 bg-card rounded-xl px-4 py-3 border border-border/30 cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">💵</span>
                  <span className="text-xs text-muted-foreground">الدفع</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">نقداً</p>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            </motion.div>

            {/* Schedule option */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
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

          {/* Book button - Fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border/20 safe-area-bottom">
            <Button
              onClick={handleBookRide}
              disabled={isBooking || fareLoading}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/80 rounded-2xl shadow-xl shadow-primary/25 hover:shadow-2xl transition-all active:scale-[0.98] text-black dark:text-black"
            >
              {isBooking ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الحجز...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <span className="text-xl">🚗</span>
                  <span>احجز الآن</span>
                  <span className="text-black dark:text-black font-bold">
                    {fareBreakdown?.total_fare?.toLocaleString() || "---"} د.ع
                  </span>
                </span>
              )}
            </Button>
          </div>
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
      {/* Progress indicator - Top of screen */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-40 px-4 pt-2"
      >
        <div className="flex gap-2">
          <div
            className={`flex-1 h-1 rounded-full transition-colors ${
              isPickup || pickupLocation ? "bg-green-500" : "bg-muted/30"
            }`}
          />
          <div
            className={`flex-1 h-1 rounded-full transition-colors ${
              isDropoff || dropoffLocation ? "bg-blue-500" : "bg-muted/30"
            }`}
          />
        </div>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-0 right-0 z-30"
      >
        <div className="flex items-center justify-between p-4">
          {/* زر القائمة - دائماً في اليسار */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-card/90 backdrop-blur-md shadow-lg hover:bg-card hover:scale-105 transition-all duration-200 active:scale-95"
            aria-label="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* الشعار في المنتصف */}
          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-lg">
            <img src={logo} alt="RAAN" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-lg">ران</span>
          </div>

          {/* Status Icons - Right side */}
          <StatusIcons userLocation={userLocation} />

          {/* زر الرجوع - فقط في dropoff */}
          {isDropoff ? (
            <button
              onClick={() => {
                setCurrentMode("pickup");
                setPickupLocation(null);
              }}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 to-primary backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          ) : (
            <div className="w-11" />
          )}
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

        {/* Loading overlay with static map placeholder */}
        {isLoading && (
          <StaticMapPlaceholder
            lat={userLocation?.lat || lastLocation?.lat}
            lng={userLocation?.lng || lastLocation?.lng}
            zoom={14}
            message="جاري تحميل الخريطة..."
          />
        )}

        {/* Network status bar */}
        <NetworkStatusBar />

        {/* Center on user button */}
        {userLocation && (
          <button
            onClick={centerOnUser}
            className="absolute bottom-5 left-4 w-14 h-14 bg-card/95 backdrop-blur-md rounded-2xl border border-border/50 shadow-xl flex items-center justify-center hover:bg-accent transition-all duration-200 active:scale-95 z-40 group"
            aria-label="تحديد موقعي"
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
          {localServiceAreaStatus && !localServiceAreaStatus.in_service && (
            <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800 text-sm mb-1">
                  ⚠️ خارج منطقة الخدمة
                </p>
                {localServiceAreaStatus.nearest_region && (
                  <p className="text-amber-700 text-xs">
                    أقرب منطقة: {localServiceAreaStatus.nearest_region.name_ar}{" "}
                    ({localServiceAreaStatus.nearest_region.distance_km} كم)
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

          {/* Search input - Enhanced */}
          <div className="mb-3">
            <div className="relative">
              <LocationSearchInput
                placeholder={
                  isPickup
                    ? "🔍 اكتب لتحديد موقع الانطلاق..."
                    : "🔍 اكتب لتحديد الوجهة..."
                }
                value={searchQuery}
                onChange={setSearchQuery}
                onLocationSelect={(location) => {
                  handleSearchSelect(location);
                  if (map.current) {
                    map.current.flyTo({
                      center: [location.lng, location.lat],
                      zoom: 16,
                      duration: 800,
                    });
                  }
                  setCenterAddress(location.address);
                  checkServiceArea(location.lat, location.lng);
                }}
                type={isPickup ? "pickup" : "dropoff"}
                userLocation={userLocation}
                className="w-full text-base font-medium placeholder:text-muted-foreground/70 placeholder:font-semibold"
              />
            </div>
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
                      onClick={() => {
                        const location = handleSavedPlaceSelect(place);
                        if (map.current) {
                          map.current.flyTo({
                            center: [location.lng, location.lat],
                            zoom: 16,
                            duration: 800,
                          });
                        }
                        setCenterAddress(location.address);
                        checkServiceArea(location.lat, location.lng);
                      }}
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
            disabled={!centerAddress || isCheckingService || isConfirming}
            className={`w-full h-14 text-base sm:text-lg font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] ${
              centerAddress
                ? isPickup
                  ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-500/30"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/30"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
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

      {/* Side Menu */}
      <RiderSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={async () => {
          await supabase.auth.signOut();
          navigate("/auth");
        }}
      />
    </div>
  );
};

export default GoPage;
