import React, { useEffect, useState, useCallback, lazy, Suspense, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "mapbox-gl/dist/mapbox-gl.css";
import { ArrowRight, Navigation, Loader2, MapPin, Target, AlertTriangle, Check, Star, Clock, ChevronDown, Zap, Menu } from "lucide-react";
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
import { usePerformanceMonitoring, useOperationTiming } from "@/hooks/usePerformanceMonitoring";
import { useLastRide, useRiderPreferences } from "@/hooks/useLocalStorage";
import { useOfflineMode } from "@/hooks/useOfflineMode";

// Lazy load heavy components
const RideWaitingScreen = lazy(() => import("@/components/rider/RideWaitingScreen"));
const LiveRideTracker = lazy(() => import("@/components/rider/LiveRideTracker"));
const RideCompletedScreen = lazy(() => import("@/components/rider/RideCompletedScreen"));
const OnboardingFlow = lazy(() => import("@/components/rider/OnboardingFlow"));

// Loading skeleton
const ScreenSkeleton = () => <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>;
interface LocationType {
  lat: number;
  lng: number;
  address: string;
}
type VehicleType = "economy" | "comfort" | "premium" | "women_only";
type PaymentMethodType = "cash" | "wallet" | "card" | "zain_cash" | "super_key" | "nas_wallet";
const GoPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<any>(null);

  // Performance monitoring
  const metrics = usePerformanceMonitoring("GoPage");
  const {
    measureOperation
  } = useOperationTiming();

  // Local storage hooks
  const {
    lastRide,
    saveLastRide
  } = useLastRide();
  const {
    preferences
  } = useRiderPreferences();
  const {
    lastLocation,
    saveLocation
  } = useLastLocation();
  const [hasSeenOnboarding] = useLocalStorage("raan_onboarding_completed", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Offline support
  const {
    isOnline
  } = useOfflineMode();

  // Core data hooks
  const {
    userId,
    user,
    mapToken,
    userLocation,
    menuOpen,
    setMenuOpen
  } = useRiderData();

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
    checkServiceArea
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
    cleanup: cleanupBooking
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
    handleSavedPlaceSelect
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
    clearCompletedRide
  } = useRideTracking(userId);

  // Local state
  const [currentMode, setCurrentMode] = useState<"pickup" | "dropoff" | "booking">("pickup");
  const [pickupLocation, setPickupLocation] = useState<LocationType | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationType | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [localServiceAreaStatus, setLocalServiceAreaStatus] = useState<any>(null);

  // Fare calculation
  const {
    fareBreakdown,
    fareLoading
  } = useFareCalculation(pickupLocation, dropoffLocation, selectedVehicle, routeDistance);

  // Nearby drivers
  const {
    availableDriversByType
  } = useOptimizedNearbyDrivers(pickupLocation, selectedVehicle, {
    enableRealtime: !!pickupLocation,
    debounceMs: 1000
  });

  // Reset center address when mode changes
  useEffect(() => {
    if (currentMode === "dropoff" || currentMode === "booking") {
      setCenterAddress("");
    }
  }, [currentMode]);

  // Auto-focus search input when coming from saved places page
  useEffect(() => {
    const addPlace = searchParams.get("addPlace");
    if (addPlace && searchInputRef.current) {
      // Give UI time to render
      setTimeout(() => {
        searchInputRef.current?.focus();
        // Remove the param after using it
        setSearchParams({});
      }, 300);
    }
  }, [searchParams, setSearchParams]);

  // Check if user should see onboarding (first time)
  useEffect(() => {
    if (!hasSeenOnboarding && userId) {
      setShowOnboarding(true);
    }
  }, [hasSeenOnboarding, userId]);

  // Save user location when available (only once when location is first detected)
  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      saveLocation({
        lat: userLocation.lat,
        lng: userLocation.lng,
        address: "موقعك الحالي"
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng]);

  // Fetch route when both locations are set (for initial location picker map)
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation || currentMode === "booking") return;
    fetchRoute(pickupLocation, dropoffLocation);
  }, [pickupLocation, dropoffLocation, fetchRoute, currentMode]);

  // Initialize booking mode map
  useEffect(() => {
    if (currentMode !== "booking" || !pickupLocation || !dropoffLocation) return;
    initializeBookingMap(pickupLocation, dropoffLocation);
  }, [currentMode, pickupLocation, dropoffLocation, initializeBookingMap]);

  // Local helper: center map on user location
  const centerOnUser = useCallback(() => {
    if (!map.current) return;

    // Get fresh location when button is clicked
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const freshLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        if (map.current) {
          map.current.flyTo({
            center: [freshLocation.lng, freshLocation.lat],
            zoom: 16,
            duration: 800
          });
        }
        toast({
          title: "تم التحديث",
          description: "تم تحديث موقعك الحالي"
        });
      }, error => {
        console.error("Location error:", error);
        toast({
          title: "خطأ",
          description: "تعذر الحصول على موقعك الحالي",
          variant: "destructive"
        });
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } else {
      toast({
        title: "خطأ",
        description: "متصفحك لا يدعم تحديد الموقع",
        variant: "destructive"
      });
    }
  }, [toast]);

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
          variant: "destructive"
        });
        return;
      }
      const center = map.current.getCenter();
      let address = centerAddress;

      // إذا لم نحصل على عنوان، نحصل عليه من API
      if (!address) {
        try {
          const response = await fetch(`https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${center.lat}&lng=${center.lng}`, {
            headers: {
              "Content-Type": "application/json"
            }
          });
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
        address: address
      };
      if (currentMode === "pickup") {
        setPickupLocation(location);
        setCurrentMode("dropoff");
        setCenterAddress("");
        setSearchQuery("");
        toast({
          title: "تم تحديد موقع الانطلاق ✅",
          description: address
        });
      } else if (currentMode === "dropoff") {
        setDropoffLocation(location);
        setCurrentMode("booking");
        toast({
          title: "تم تحديد الوجهة ✅",
          description: address
        });
      }
    } catch (error) {
      console.error("Confirm error:", error);
      toast({
        title: "خطأ",
        description: "فشل تأكيد الموقع",
        variant: "destructive"
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
        variant: "destructive"
      });
      navigate("/auth?redirect=/go");
      return;
    }

    // Check if there's already an active ride
    if (activeRide && activeRide.status !== "completed" && activeRide.status !== "cancelled") {
      toast({
        title: "لديك رحلة نشطة",
        description: "الرجاء إنهاء الرحلة الحالية قبل حجز رحلة جديدة",
        variant: "destructive"
      });
      setShowWaitingScreen(true);
      return;
    }
    if (!pickupLocation || !dropoffLocation) {
      toast({
        title: "معلومات ناقصة",
        description: "الرجاء تحديد نقطة الانطلاق والوجهة",
        variant: "destructive"
      });
      return;
    }

    // Check fare
    const totalFare = fareBreakdown?.total_fare || 0;
    if (totalFare <= 0) {
      toast({
        title: "خطأ في حساب السعر",
        description: "الرجاء إعادة المحاولة",
        variant: "destructive"
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
      timestamp: Date.now()
    });
    setIsBooking(true);
    try {
      const {
        data: ride,
        error
      } = await supabase.from("rides").insert([{
        rider_id: userId,
        pickup_location: {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng
        },
        dropoff_location: {
          lat: dropoffLocation.lat,
          lng: dropoffLocation.lng
        },
        pickup_address: pickupLocation.address,
        dropoff_address: dropoffLocation.address,
        vehicle_type: selectedVehicle,
        payment_method: paymentMethod,
        estimated_fare: fareBreakdown?.total_fare || 0,
        distance_km: routeDistance ? Number(routeDistance.toFixed(2)) : null,
        duration_minutes: routeDuration ? Math.round(routeDuration) : null,
        status: "pending"
      } as any]).select().single();
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
        completed_at: ride.completed_at
      });

      // Show waiting screen
      setShowWaitingScreen(true);

      // Trigger ride matching
      await supabase.functions.invoke("match-ride", {
        body: {
          rideId: ride.id
        }
      });
      toast({
        title: "تم إرسال طلبك ✅",
        description: "جاري البحث عن سائق قريب"
      });
    } catch (error: any) {
      console.error("Booking error:", error);
      toast({
        title: "فشل الحجز",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
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
    return <Suspense fallback={<ScreenSkeleton />}>
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      </Suspense>;
  }

  // Show completed screen for rating
  if (showCompletedScreen && completedRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <RideCompletedScreen ride={{
        id: completedRide.id,
        pickup_address: completedRide.pickup_address,
        dropoff_address: completedRide.dropoff_address,
        final_fare: completedRide.final_fare,
        estimated_fare: completedRide.estimated_fare,
        distance_km: completedRide.distance_km,
        duration_minutes: completedRide.duration_minutes,
        driver_id: completedRide.driver_id
      }} driverName={"السائق"} onClose={handleRideCompletion} />
      </Suspense>;
  }

  // Show waiting screen if ride is pending or accepted
  if (showWaitingScreen && activeRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <RideWaitingScreen rideId={activeRide.id} pickupAddress={activeRide.pickup_address || pickupLocation?.address || "موقعي الحالي"} dropoffAddress={activeRide.dropoff_address || dropoffLocation?.address || ""} estimatedFare={activeRide.estimated_fare || fareBreakdown?.total_fare || 0} onCancel={resetBooking} onDriverFound={() => {
        setShowWaitingScreen(false);
        setShowLiveTracker(true);
      }} />
      </Suspense>;
  }

  // Show live tracker if ride is in progress
  if (showLiveTracker && activeRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <LiveRideTracker ride={activeRide} onClose={resetBooking} onRideUpdate={updatedRide => {
        if (updatedRide.status === "completed" || updatedRide.status === "cancelled") {
          resetBooking();
        }
      }} />
      </Suspense>;
  }

  // Booking confirmation screen
  if (isBookingMode && pickupLocation && dropoffLocation) {
    return <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Offline/Online status indicator */}
        {!isOnline && <div className="absolute top-0 left-0 right-0 z-50 bg-destructive/90 backdrop-blur-md px-4 py-2 text-center text-sm font-medium text-destructive-foreground flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>أنت بدون إنترنت - بعض الميزات قد لا تعمل</span>
          </div>}

        {/* Progress indicator - Top */}
        <div className={`absolute left-0 right-0 z-50 px-4 ${!isOnline ? "pt-14" : "pt-2"}`}>
          <div className="flex gap-2">
            <div className="flex-1 h-1 rounded-full bg-primary" />
            <div className="flex-1 h-1 rounded-full bg-accent" />
            <div className="flex-1 h-1 rounded-full bg-primary animate-pulse" />
          </div>
        </div>

        {/* Header - Transparent over map */}
        <div className={`absolute left-0 right-0 z-40 px-4 ${!isOnline ? "top-20" : "top-4"}`}>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setMenuOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-md bg-card/90 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 flex-shrink-0" aria-label="القائمة">
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo and Route info - Combined */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md rounded-md px-4 py-2.5 shadow-lg">
                <img src={logo} alt="RAAN" className="w-7 h-7 rounded-md" />
                <span className="font-bold text-lg">ران</span>
              </div>

              <motion.div initial={{
              y: -20,
              opacity: 0
            }} animate={{
              y: 0,
              opacity: 1
            }} transition={{
              delay: 0.2
            }} className="bg-card/70 backdrop-blur-xl rounded-md px-3 py-2 flex items-center gap-3 shadow-lg border border-white/10">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-bold">
                    {routeDistance ? `${routeDistance.toFixed(1)} كم` : "---"}
                  </span>
                </div>
                <div className="w-px h-4 bg-border/30" />
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent-foreground" />
                  <span className="text-sm font-bold">
                    {routeDuration ? `${Math.round(routeDuration)} د` : "---"}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Status Icons - Right side */}
            <StatusIcons userLocation={pickupLocation ? {
            lat: pickupLocation.lat,
            lng: pickupLocation.lng
          } : null} />

            <button onClick={() => setCurrentMode("dropoff")} className="w-11 h-11 flex items-center justify-center rounded-md bg-gradient-to-br from-primary/90 to-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95 flex-shrink-0" aria-label="رجوع">
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Map - Top Half */}
        <div className="h-[45%] relative">
          <div ref={bookingMapContainer} className="absolute inset-0" />
        </div>

        {/* Details - Bottom Half with rounded top */}
        <div className="h-[55%] bg-background rounded-t-3xl -mt-4 relative z-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.15)]">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/25" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
            {/* Route summary - Modern vertical timeline */}
            <motion.div initial={{
            y: 20,
            opacity: 0
          }} animate={{
            y: 0,
            opacity: 1
          }} className="bg-card rounded-2xl p-4 border border-border/30 shadow-sm">
              <div className="flex gap-3">
                {/* Vertical connecting line */}
                <div className="flex flex-col items-center gap-0">
                  <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
                  <div className="w-0.5 flex-1 min-h-[32px] bg-gradient-to-b from-primary via-muted to-accent" />
                  <div className="w-3 h-3 rounded-full bg-accent ring-4 ring-accent/20" />
                </div>
                
                {/* Locations */}
                <div className="flex-1 space-y-4">
                  {/* Pickup */}
                  <div className="min-h-[32px]">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">
                      موقع الانطلاق
                    </p>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {pickupLocation.address}
                    </p>
                  </div>
                  
                  {/* Dropoff */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-accent-foreground font-bold mb-0.5">
                      الوجهة
                    </p>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {dropoffLocation.address}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Vehicle selector */}
            <motion.div initial={{
            y: 20,
            opacity: 0
          }} animate={{
            y: 0,
            opacity: 1
          }} transition={{
            delay: 0.1
          }}>
              <CompactVehicleSelector selectedVehicle={selectedVehicle} onSelect={setSelectedVehicle} availableDrivers={availableDriversByType} baseFare={fareBreakdown?.total_fare} />
            </motion.div>

            {/* Fare & Payment Row - Enhanced */}
            <motion.div initial={{
            y: 20,
            opacity: 0
          }} animate={{
            y: 0,
            opacity: 1
          }} transition={{
            delay: 0.2
          }} className="flex gap-2">
              {/* Fare summary */}
              {fareBreakdown && <div className="flex-1 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl px-3 py-2.5 border border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      الأجرة
                    </span>
                  </div>
                  <p className="font-bold text-base text-primary">
                    {(fareBreakdown.total_fare || 0).toLocaleString()} <span className="text-xs font-medium">د.ع</span>
                  </p>
                </div>}

              {/* Payment method */}
              <button onClick={() => setPaymentSheetOpen(true)} className="flex-1 bg-card rounded-xl px-3 py-2.5 border border-border/40 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 active:scale-[0.98] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm">💵</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">الدفع</span>
                </div>
                <div className="flex items-center gap-1">
                  <p className="font-bold text-sm">نقداً</p>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            </motion.div>

            {/* Schedule option */}
            <motion.div initial={{
            y: 20,
            opacity: 0
          }} animate={{
            y: 0,
            opacity: 1
          }} transition={{
            delay: 0.3
          }}>
              <ScheduleRideDialog pickup={pickupLocation} dropoff={dropoffLocation} vehicleType={selectedVehicle} paymentMethod={paymentMethod} estimatedFare={fareBreakdown?.total_fare || null} onScheduled={() => {
              toast({
                title: "تم جدولة الرحلة ✅",
                description: "سيتم تذكيرك قبل الموعد"
              });
              resetBooking();
            }} />
            </motion.div>
          </div>

          {/* Book button - Fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/98 backdrop-blur-md border-t border-border/20 safe-area-bottom">
            <div className="max-w-lg mx-auto">
              <Button onClick={handleBookRide} disabled={isBooking || fareLoading} className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-primary via-primary to-primary/90 rounded-xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98] text-primary-foreground">
                {isBooking ? <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الحجز...
                  </span> : <span className="flex items-center gap-3 justify-center">
                    <Navigation className="w-5 h-5" />
                    <span>احجز الآن</span>
                    <span className="bg-black/20 px-2.5 py-0.5 rounded-lg text-sm">
                      {fareBreakdown?.total_fare?.toLocaleString() || "---"} د.ع
                    </span>
                  </span>}
              </Button>
            </div>
          </div>
        </div>

        {/* Payment Method Sheet */}
        <PaymentMethodSheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen} selectedMethod={paymentMethod} onSelect={setPaymentMethod} />
      </motion.div>;
  }

  // Location picker screen
  return <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Progress indicator - Top of screen */}
      <motion.div initial={{
      y: -10,
      opacity: 0
    }} animate={{
      y: 0,
      opacity: 1
    }} className="absolute top-0 left-0 right-0 z-40 px-4 pt-2">
        <div className="flex gap-2">
          <div className={`flex-1 h-1 rounded-full transition-colors ${isPickup || pickupLocation ? "bg-primary" : "bg-muted/30"}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${isDropoff || dropoffLocation ? "bg-accent" : "bg-muted/30"}`} />
        </div>
      </motion.div>

      {/* Header */}
      <motion.div initial={{
      y: -20,
      opacity: 0
    }} animate={{
      y: 0,
      opacity: 1
    }} className="absolute top-4 left-0 right-0 z-30">
        <div className="flex items-center justify-between p-4">
          {/* زر القائمة */}
          <button onClick={() => setMenuOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-xl bg-card/95 backdrop-blur-xl shadow-lg hover:bg-card hover:scale-105 transition-all duration-200 active:scale-95 border border-border/30" aria-label="القائمة الرئيسية">
            <Menu className="w-5 h-5" />
          </button>

          {/* الشعار في المنتصف */}
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur-xl rounded-xl px-4 py-2.5 shadow-lg border border-border/30">
            <img src={logo} alt="RAAN" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-lg">ران</span>
          </div>

          {/* Status Icons - Right side */}
          <StatusIcons userLocation={userLocation} />

          {/* زر الرجوع - فقط في dropoff */}
          {isDropoff ? <button onClick={() => {
          setCurrentMode("pickup");
          setPickupLocation(null);
        }} className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 backdrop-blur-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95" aria-label="رجوع">
              <ArrowRight className="w-5 h-5 text-primary-foreground" />
            </button> : <div className="w-11" />}
        </div>
      </motion.div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {/* Map loading placeholder */}
        {(!mapToken || isLoading) && <div className="absolute inset-0 bg-background flex items-center justify-center z-50">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-foreground text-lg">جاري تحميل الخريطة...</p>
              <p className="text-muted-foreground text-sm">الرجاء الانتظار</p>
            </div>
          </div>}

        <div ref={mapContainer} className="absolute inset-0" />

        {/* Drag instruction */}
        <AnimatePresence>
          {!isDragging && centerAddress && <motion.div initial={{
          y: -20,
          opacity: 0
        }} animate={{
          y: 0,
          opacity: 1
        }} exit={{
          y: -20,
          opacity: 0
        }} className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border/50">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-lg">👆</span>
                  اسحب الخريطة لتغيير الموقع
                </p>
              </div>
            </motion.div>}
        </AnimatePresence>

        {/* Location pin */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <motion.div initial={{
          scale: 0.8,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} className="flex flex-col items-center">
            <motion.div animate={{
            y: isDragging ? -10 : 0
          }} transition={{
            type: "spring",
            stiffness: 300
          }} className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-3 border-white ${isPickup ? "bg-gradient-to-br from-primary/90 to-primary" : "bg-gradient-to-br from-accent to-accent"}`}>
                {isPickup ? <Target className="w-5 h-5 text-primary-foreground" /> : <MapPin className="w-5 h-5 text-accent-foreground" />}
              </div>
              <div className={`w-1 h-8 mx-auto rounded-b-full ${isPickup ? "bg-gradient-to-b from-primary to-primary/80" : "bg-gradient-to-b from-accent to-accent/80"}`} />
              {/* Shadow */}
              <motion.div animate={{
              scale: isDragging ? 0.6 : 1,
              opacity: isDragging ? 0.3 : 0.5
            }} className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-2 bg-black rounded-full blur-sm" />
            </motion.div>
            <motion.div initial={{
            y: 10,
            opacity: 0
          }} animate={{
            y: 0,
            opacity: 1
          }} className="mt-3 px-4 py-2 bg-card/95 backdrop-blur-md rounded-md shadow-lg border border-border/50 max-w-[280px]">
              <p className="text-sm font-semibold text-foreground text-center line-clamp-2">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Loading overlay with static map placeholder */}
        {isLoading && <StaticMapPlaceholder lat={userLocation?.lat || lastLocation?.lat} lng={userLocation?.lng || lastLocation?.lng} zoom={14} message="جاري تحميل الخريطة..." />}

        {/* Network status bar */}
        <NetworkStatusBar />

        {/* Center on user button */}
        {userLocation && <button onClick={centerOnUser} className="absolute bottom-5 left-4 w-12 h-12 bg-card/98 backdrop-blur-xl rounded-xl border border-border/40 shadow-lg flex items-center justify-center hover:bg-accent hover:shadow-xl transition-all duration-200 active:scale-95 z-40 group my-[80px]" aria-label="تحديد موقعي">
            <Navigation className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
          </button>}
      </div>

      {/* Bottom panel - Modern redesign */}
      <motion.div initial={{
      y: 100
    }} animate={{
      y: 0
    }} className="bg-card/98 backdrop-blur-xl border-t border-border/30 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-30 rounded-t-3xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>
        <div className="px-4 pb-4 pt-1 max-w-lg mx-auto">
          {/* Service area warning */}
          {localServiceAreaStatus && !localServiceAreaStatus.in_service && <div className="flex items-center gap-3 p-3 mb-3 rounded-md bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/30">
              <div className="w-8 h-8 rounded-md bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm mb-1">
                  ⚠️ خارج منطقة الخدمة
                </p>
                {localServiceAreaStatus.nearest_region && <p className="text-muted-foreground text-xs">
                    أقرب منطقة: {localServiceAreaStatus.nearest_region.name_ar}{" "}
                    ({localServiceAreaStatus.nearest_region.distance_km} كم)
                  </p>}
              </div>
            </div>}

          {/* Address display - Modern design */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-gradient-to-r from-card to-card/80 border border-border/40 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPickup ? "bg-gradient-to-br from-primary/20 to-primary/10 ring-2 ring-primary/30" : "bg-gradient-to-br from-accent/20 to-accent/10 ring-2 ring-accent/30"}`}>
              {isPickup ? <Target className="w-5 h-5 text-primary" /> : <MapPin className="w-5 h-5 text-accent-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isPickup ? "text-primary" : "text-accent-foreground"}`}>
                {isPickup ? "موقع الانطلاق" : "الوجهة"}
              </p>
              <p className="font-semibold text-foreground text-sm line-clamp-1">
                {centerAddress || "جاري تحديد العنوان..."}
              </p>
            </div>
            {centerAddress && <div className={`w-2 h-2 rounded-full animate-pulse ${isPickup ? "bg-primary" : "bg-accent"}`} />}
          </div>

          {/* Search input - Enhanced */}
          <div className="mb-3">
            <div className="relative">
              <LocationSearchInput ref={searchInputRef} placeholder={isPickup ? "ابحث عن موقع الانطلاق..." : "ابحث عن الوجهة..."} value={searchQuery} onChange={setSearchQuery} onLocationSelect={location => {
              handleSearchSelect(location);
              if (map.current) {
                map.current.flyTo({
                  center: [location.lng, location.lat],
                  zoom: 16,
                  duration: 800
                });
              }
              setCenterAddress(location.address);
              checkServiceArea(location.lat, location.lng);
            }} type={isPickup ? "pickup" : "dropoff"} userLocation={userLocation} className="w-full" />
            </div>
          </div>

          {/* Saved places - Show for both pickup and dropoff */}
          {savedPlaces.length > 0 && <div className="mb-4">
              <p className="text-xs font-bold text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-primary" />
                أماكني المحفوظة
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {loadingSavedPlaces ? <div className="flex gap-2">
                    {[1, 2, 3].map(i => <div key={i} className="w-20 h-20 rounded-xl bg-muted/50 animate-pulse" />)}
                  </div> : savedPlaces.map(place => <button key={place.id} onClick={() => {
              const location = handleSavedPlaceSelect(place);
              if (map.current) {
                map.current.flyTo({
                  center: [location.lng, location.lat],
                  zoom: 16,
                  duration: 800
                });
              }
              setCenterAddress(location.address);
              checkServiceArea(location.lat, location.lng);
            }} className="flex flex-col items-center flex-shrink-0 w-20 p-2.5 rounded-xl border border-border/40 bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all duration-200 active:scale-95">
                      <div className="text-2xl mb-1.5">{place.icon || "📍"}</div>
                      <p className="text-[10px] font-semibold text-center line-clamp-1 text-muted-foreground">
                        {place.name}
                      </p>
                    </button>)}
              </div>
            </div>}

          {/* Confirm button - Enhanced with semantic colors */}
          <Button 
            onClick={handleConfirm} 
            disabled={!centerAddress || isCheckingService || isConfirming} 
            className={`w-full h-12 sm:h-14 text-sm sm:text-base font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-[0.98] ${
              centerAddress 
                ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-primary/25 text-primary-foreground" 
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isCheckingService || isConfirming ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isConfirming ? "جاري التأكيد..." : "جاري التحقق..."}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>تأكيد {isPickup ? "موقع الانطلاق" : "الوجهة"}</span>
                {isPickup ? <Target className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              </div>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Side Menu */}
      <RiderSideMenu user={user} isOpen={menuOpen} onClose={() => setMenuOpen(false)} onLogout={async () => {
      await supabase.auth.signOut();
      navigate("/auth");
    }} />
    </div>;
};
export default GoPage;