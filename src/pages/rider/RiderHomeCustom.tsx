import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, MapPin, Search, Navigation, X, ArrowLeft, Locate, Wallet, CreditCard, Banknote, ChevronDown, Clock, Star, Sparkles, Gift, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Lazy loaded components for better performance
const LazyMap = lazy(() => import('@/components/LazyMap'));
const RiderSideMenu = lazy(() => import('@/components/rider/RiderSideMenu'));
const LocationBottomSheet = lazy(() => import('@/components/rider/LocationBottomSheet'));
const MapLocationPicker = lazy(() => import('@/components/rider/MapLocationPicker'));
const RideWaitingScreen = lazy(() => import('@/components/rider/RideWaitingScreen'));
const LiveRideTracker = lazy(() => import('@/components/rider/LiveRideTracker'));
const CompleteProfileScreen = lazy(() => import('@/components/rider/CompleteProfileScreen'));
const PaymentMethodSheet = lazy(() => import('@/components/rider/PaymentMethodSheet'));

// Direct imports for critical path components
import RiderBottomNav from '@/components/rider/RiderBottomNav';
import MultiStopSelector from '@/components/rider/MultiStopSelector';
import RoundTripSelector from '@/components/rider/RoundTripSelector';
import SavedPlacesQuickIcons from '@/components/rider/SavedPlacesQuickIcons';
import CompactVehicleSelector from '@/components/rider/CompactVehicleSelector';
import { PaymentMethodBadge } from '@/components/rider/PaymentMethodSelector';
import SupportButton from '@/components/rider/SupportButton';
import ScrollablePromoBanners from '@/components/rider/ScrollablePromoBanners';
import LocationInputCard from '@/components/rider/LocationInputCard';
import TripInfoSummary from '@/components/rider/TripInfoSummary';
import RecentDestinations from '@/components/rider/RecentDestinations';

// Hooks
import { useFareCalculation } from '@/hooks/useFareCalculation';
import { useOptimizedNearbyDrivers } from '@/hooks/useOptimizedNearbyDrivers';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { useActiveRide, ActiveRide } from '@/hooks/useActiveRide';
import { useRiderInitialization } from '@/hooks/useRiderInitialization';
import { getMapboxToken } from '@/hooks/useMapboxToken';

// Loading Skeletons
const MapSkeleton = () => <div className="h-full w-full bg-gradient-to-b from-secondary to-background animate-pulse flex items-center justify-center">
    <div className="text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-primary/20 mx-auto flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
    </div>
  </div>;
const ScreenSkeleton = () => <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-primary/20 mx-auto flex items-center justify-center animate-pulse-glow">
        <MapPin className="w-8 h-8 text-primary" />
      </div>
      <p className="text-muted-foreground font-medium">جاري التحميل...</p>
    </div>
  </div>;
type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';
type PaymentMethodType = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';
interface Stop {
  id: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  } | null;
  estimatedTime?: number;
  distanceFromPrevious?: number;
}
const RiderHomeCustom: React.FC = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Use optimized initialization hook
  const {
    user,
    session,
    profile,
    isLoading: authLoading,
    isProfileComplete,
    updateProfile
  } = useRiderInitialization();

  // Location State
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Multi-stop & Round Trip State
  const [intermediateStops, setIntermediateStops] = useState<Stop[]>([]);
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way');
  const [returnTime, setReturnTime] = useState<Date | undefined>();
  const [selectingStopId, setSelectingStopId] = useState<string | null>(null);

  // Booking State
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('economy');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);

  // UI State
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(true);
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [locationSheetField, setLocationSheetField] = useState<'pickup' | 'dropoff' | 'pickup_only' | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [isBooking, setIsBooking] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff' | 'both'>('both');

  // Bottom Sheet Drag State
  const [sheetHeight, setSheetHeight] = useState<'collapsed' | 'half' | 'full'>('half');
  const [dragStartY, setDragStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  // Hooks - only enable when needed
  const {
    fareBreakdown,
    fareLoading
  } = useFareCalculation(pickupCoords, dropoffCoords, selectedVehicle, routeDistance);

  // Only fetch drivers when pickup is set
  const {
    nearbyDriversCount,
    nearbyDriverLocations,
    availableDriversByType,
    isLoading: driversLoading
  } = useOptimizedNearbyDrivers(pickupCoords, selectedVehicle, {
    debounceMs: 1000,
    enableRealtime: !!pickupCoords
  });
  useRiderLocation({
    enabled: !!user
  });
  const {
    activeRide,
    setActiveRide,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker
  } = useActiveRide(user?.id || null);

  // Fetch address from coordinates using cached token
  const fetchAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const token = getMapboxToken();
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=ar&types=address,poi,neighborhood,locality`);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].place_name_ar || data.features[0].place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      }
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  // Get user location and address with improved error handling
  const getCurrentLocation = useCallback(async (retryCount = 0) => {
    if (!navigator.geolocation) {
      toast({
        title: "خطأ",
        description: "المتصفح لا يدعم تحديد الموقع",
        variant: "destructive"
      });
      return;
    }
    setIsLocating(true);

    // Try with high accuracy first, then fallback to lower accuracy
    const options = retryCount === 0 ? {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    } : {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000 // Accept cached location up to 1 minute old
    };
    navigator.geolocation.getCurrentPosition(async position => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      setUserLocation(coords);
      setPickupCoords(coords);
      const address = await fetchAddressFromCoords(coords.lat, coords.lng);
      setPickup(address);
      setIsLocating(false);
      // عند تحديد الموقع الحالي، ننتقل لاختيار الوجهة
      if (!dropoffCoords) {
        setActiveField('dropoff');
      }
      toast({
        title: "تم تحديد موقعك ✓",
        description: address
      });
    }, error => {
      console.error('Geolocation error:', error);

      // Retry with lower accuracy if first attempt failed
      if (retryCount === 0 && error.code === error.TIMEOUT) {
        console.log('Retrying with lower accuracy...');
        getCurrentLocation(1);
        return;
      }
      setIsLocating(false);
      let errorMessage = "الرجاء السماح بالوصول للموقع";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "تم رفض الوصول للموقع. يرجى تفعيل الموقع من إعدادات المتصفح";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "معلومات الموقع غير متاحة حاليًا";
          break;
        case error.TIMEOUT:
          errorMessage = "انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى";
          break;
      }
      toast({
        title: "خطأ في تحديد الموقع",
        description: errorMessage,
        variant: "destructive"
      });
    }, options);
  }, [fetchAddressFromCoords, toast]);

  // Initial location fetch (only once)
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Monitor location changes
  useEffect(() => {
    if (pickupCoords) {
      console.log('🗺️ Pickup coords updated:', pickupCoords);
    }
    if (dropoffCoords) {
      console.log('🗺️ Dropoff coords updated:', dropoffCoords);
    }
  }, [pickupCoords, dropoffCoords]);

  // Handle route calculation
  const handleRouteCalculated = useCallback((distance: number, duration: number) => {
    setRouteDistance(distance);
    setRouteDuration(duration);
  }, []);

  // Handle destination selection
  const handleDestinationSelect = useCallback((address: string, coords: {
    lat: number;
    lng: number;
  }) => {
    console.log('🎯 Destination selected:', {
      address,
      coords
    });
    if (selectingStopId) {
      const updatedStops = intermediateStops.map(stop => stop.id === selectingStopId ? {
        ...stop,
        address,
        location: coords
      } : stop);
      setIntermediateStops(updatedStops);
      setSelectingStopId(null);
    } else {
      setDropoff(address);
      setDropoffCoords(coords);
      console.log('✅ Dropoff set:', {
        address,
        coords
      });
      // عند اختيار الوجهة، إذا لم يكن موقع الانطلاق محدداً، نشط حقل الانطلاق
      if (!pickupCoords) {
        setActiveField('pickup');
      }
    }
    // Keep search overlay visible with new design
    setShowLocationSheet(false);
    // Don't auto-show booking panel - user will click continue button
  }, [selectingStopId, intermediateStops, pickupCoords]);

  // Handle pickup selection
  const handlePickupSelect = useCallback((address: string, coords: {
    lat: number;
    lng: number;
  }) => {
    console.log('📍 Pickup selected:', {
      address,
      coords
    });
    setPickup(address);
    setPickupCoords(coords);
    console.log('✅ Pickup set:', {
      address,
      coords
    });
    // عند اختيار موقع الانطلاق، إذا لم تكن الوجهة محددة، نشط حقل الوجهة
    if (!dropoffCoords) {
      setActiveField('dropoff');
    }
    setShowLocationSheet(false);
  }, [dropoffCoords]);

  // Handle location select from bottom sheet
  const handleLocationSheetSelect = useCallback((location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }, type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      handlePickupSelect(location.address, {
        lat: location.lat,
        lng: location.lng
      });
    } else {
      handleDestinationSelect(location.address, {
        lat: location.lat,
        lng: location.lng
      });
    }
  }, [handlePickupSelect, handleDestinationSelect]);

  // Handle map picker confirm
  const handleMapPickerConfirm = useCallback((location: {
    lat: number;
    lng: number;
    address: string;
    inService?: boolean;
  }) => {
    if (mapPickerMode === 'pickup') {
      handlePickupSelect(location.address, {
        lat: location.lat,
        lng: location.lng
      });
    } else {
      handleDestinationSelect(location.address, {
        lat: location.lat,
        lng: location.lng
      });
    }
    setShowMapPicker(false);
  }, [mapPickerMode, handlePickupSelect, handleDestinationSelect]);

  // Handle marker drag on the map
  const handleMarkerDrag = useCallback((type: 'pickup' | 'dropoff', location: {
    lat: number;
    lng: number;
    address?: string;
  }) => {
    if (type === 'pickup') {
      setPickupCoords({
        lat: location.lat,
        lng: location.lng
      });
      setPickup(location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    } else {
      setDropoffCoords({
        lat: location.lat,
        lng: location.lng
      });
      setDropoff(location.address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    }
  }, []);

  // Handle map movement in crosshair mode
  const handleMapMove = useCallback((location: {
    lat: number;
    lng: number;
    address?: string;
  }) => {
    if (!showMapPicker) return;
    if (mapPickerMode === 'pickup') {
      setPickupCoords({
        lat: location.lat,
        lng: location.lng
      });
      if (location.address) {
        setPickup(location.address);
      }
    } else {
      setDropoffCoords({
        lat: location.lat,
        lng: location.lng
      });
      if (location.address) {
        setDropoff(location.address);
      }
    }
  }, [showMapPicker, mapPickerMode]);

  // Open location sheet
  const openLocationSheet = useCallback((mode: 'pickup' | 'dropoff' | 'pickup_only') => {
    setLocationSheetField(mode);
    setShowLocationSheet(true);
  }, []);

  // Bottom Sheet Drag Handlers
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setIsDraggingSheet(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    setCurrentY(clientY);
  }, []);
  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingSheet) return;
    e.preventDefault(); // Prevent scrolling while dragging
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCurrentY(clientY);
  }, [isDraggingSheet]);
  const handleDragEnd = useCallback(() => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    const dragDistance = currentY - dragStartY;
    const threshold = 80;
    if (Math.abs(dragDistance) < 10) {
      // Just a tap/click, don't change state
      return;
    }
    if (dragDistance > threshold) {
      // Dragged down
      if (sheetHeight === 'full') setSheetHeight('half');else if (sheetHeight === 'half') setSheetHeight('collapsed');
    } else if (dragDistance < -threshold) {
      // Dragged up
      if (sheetHeight === 'collapsed') setSheetHeight('half');else if (sheetHeight === 'half') setSheetHeight('full');
    }

    // Reset drag state
    setDragStartY(0);
    setCurrentY(0);
  }, [isDraggingSheet, currentY, dragStartY, sheetHeight]);

  // Book ride
  const handleBookRide = async () => {
    if (!user) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول للحجز",
        variant: "destructive"
      });
      navigate('/auth?redirect=/rider-1custom');
      return;
    }
    if (!pickupCoords || !dropoffCoords) {
      toast({
        title: "معلومات ناقصة",
        description: "الرجاء تحديد نقطة الانطلاق والوجهة",
        variant: "destructive"
      });
      return;
    }
    setIsBooking(true);
    try {
      const {
        data: ride,
        error
      } = await supabase.from('rides').insert([{
        rider_id: user.id,
        pickup_location: pickupCoords,
        dropoff_location: dropoffCoords,
        pickup_address: pickup || 'موقعي الحالي',
        dropoff_address: dropoff,
        vehicle_type: selectedVehicle,
        payment_method: paymentMethod,
        estimated_fare: fareBreakdown?.total_fare || 0,
        distance_km: routeDistance ? Number(routeDistance.toFixed(2)) : null,
        duration_minutes: routeDuration ? Math.round(routeDuration) : null,
        status: 'pending'
      } as any]).select().single();
      if (error) throw error;
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
      setShowBookingPanel(false);
      setShowWaitingScreen(true);

      // Trigger ride matching
      await supabase.functions.invoke('match-ride', {
        body: {
          rideId: ride.id
        }
      });
      toast({
        title: "تم إرسال طلبك ✅",
        description: "جاري البحث عن سائق قريب"
      });
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "فشل الحجز",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      setIsBooking(false);
    }
  };

  // Reset booking
  const resetBooking = useCallback(() => {
    setDropoff('');
    setDropoffCoords(null);
    setIntermediateStops([]);
    setTripType('one_way');
    setReturnTime(undefined);
    setRouteDistance(null);
    setRouteDuration(null);
    setShowBookingPanel(false);
    setShowSearchOverlay(true);
    setShowWaitingScreen(false);
    setShowLiveTracker(false);
    setActiveRide(null);
    setActiveField('both');
  }, [setActiveRide, setShowLiveTracker, setShowWaitingScreen]);

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Loading state
  if (authLoading) {
    return <ScreenSkeleton />;
  }

  // Complete profile screen
  if (!isProfileComplete && user) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <CompleteProfileScreen userId={user.id} onComplete={name => {
        updateProfile({
          full_name: name
        });
      }} />
      </Suspense>;
  }

  // Active ride tracker
  if (showLiveTracker && activeRide && activeRide.status !== 'pending') {
    return <Suspense fallback={<ScreenSkeleton />}>
        <LiveRideTracker ride={{
        id: activeRide.id,
        pickup_location: activeRide.pickup_location,
        dropoff_location: activeRide.dropoff_location,
        pickup_address: activeRide.pickup_address,
        dropoff_address: activeRide.dropoff_address,
        status: activeRide.status,
        estimated_fare: activeRide.estimated_fare,
        final_fare: activeRide.final_fare,
        distance_km: activeRide.distance_km,
        duration_minutes: activeRide.duration_minutes,
        vehicle_type: activeRide.vehicle_type,
        driver_id: activeRide.driver_id,
        created_at: activeRide.created_at,
        completed_at: activeRide.completed_at
      }} onClose={() => setShowLiveTracker(false)} onRideUpdate={updatedRide => {
        setActiveRide({
          ...activeRide,
          ...updatedRide
        });
        if (updatedRide.status === 'completed' || updatedRide.status === 'cancelled') {
          resetBooking();
        }
      }} />
      </Suspense>;
  }

  // Waiting screen
  if (showWaitingScreen && activeRide) {
    return <Suspense fallback={<ScreenSkeleton />}>
        <RideWaitingScreen rideId={activeRide.id} pickupAddress={activeRide.pickup_address || pickup || 'موقعي الحالي'} dropoffAddress={activeRide.dropoff_address || dropoff} estimatedFare={activeRide.estimated_fare || fareBreakdown?.total_fare || 0} onCancel={resetBooking} onDriverFound={() => {
        setShowWaitingScreen(false);
        setShowLiveTracker(true);
      }} />
      </Suspense>;
  }
  return <div className="h-screen w-full relative overflow-hidden bg-background">
      {/* Full Screen Map */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<MapSkeleton />}>
          <LazyMap className="h-full w-full rounded-none" fallbackHeight="h-full" pickupLocation={pickupCoords} dropoffLocation={dropoffCoords} nearbyDrivers={nearbyDriverLocations} onRouteCalculated={handleRouteCalculated} selectingLocation={showMapPicker ? mapPickerMode : null} useCrosshairMode={showMapPicker} onMapMove={handleMapMove} showCenterMarker={false} onLocationSelect={() => {}} draggableMarkers={false} isLocating={isLocating} onReloadLocation={getCurrentLocation} hidePickupMarker={false} />
        </Suspense>
      </div>

      {/* Top Header - Premium Design */}
      <div className="absolute top-0 left-0 right-0 z-20 safe-area-top">
        <div className="p-4">
          <div className="flex items-center justify-between">
            {/* Menu Button */}
            <motion.button whileHover={{
            scale: 1.05
          }} whileTap={{
            scale: 0.95
          }} className="w-12 h-12 rounded-2xl bg-card/95 backdrop-blur-xl shadow-lg border border-border/50 flex items-center justify-center group hover:border-primary/30 transition-all" onClick={() => setShowSideMenu(true)}>
              <Menu className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
            </motion.button>

            {/* Logo with Locate Button */}
            <div className="flex items-center gap-3">
              {/* Reload Location Button - Always visible */}
              <motion.button whileHover={{
              scale: 1.05
            }} whileTap={{
              scale: 0.95
            }} onClick={() => getCurrentLocation()} disabled={isLocating} className={cn("w-10 h-10 rounded-xl bg-card/95 backdrop-blur-xl shadow-lg border border-border/50 flex items-center justify-center transition-all", isLocating ? "cursor-wait" : "hover:border-primary/30 group")} title="إعادة تحديد الموقع">
                <Locate className={cn("w-5 h-5 transition-colors", isLocating ? "text-primary animate-pulse" : "text-muted-foreground group-hover:text-primary")} />
              </motion.button>
              
              {/* Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-glow-sm">
                <span className="text-lg font-bold text-primary-foreground">ر</span>
              </div>
              <h1 className="text-xl font-bold text-gradient">ران</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <SupportButton />
              <motion.button whileHover={{
              scale: 1.05
            }} whileTap={{
              scale: 0.95
            }} className="relative w-12 h-12 rounded-2xl bg-card/95 backdrop-blur-xl shadow-lg border border-border/50 flex items-center justify-center group hover:border-primary/30 transition-all">
                <Bell className="w-5 h-5 text-foreground group-hover:text-primary transition-colors" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold flex items-center justify-center">
                  3
                </span>
              </motion.button>
            </div>
          </div>

          {/* Drivers Count Badge - Always visible */}
          <motion.div initial={{
          opacity: 0,
          y: -10
        }} animate={{
          opacity: 1,
          y: 0
        }} className="mt-3 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/95 backdrop-blur-xl border border-primary/20 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium">{nearbyDriversCount > 0 ? `${nearbyDriversCount} سائق متاح قريب منك` : 'جاري البحث عن السائقين...'}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Search Overlay - Premium Design - Hide when booking panel is open */}
      <AnimatePresence>
        {showSearchOverlay && !showBookingPanel && <motion.div initial={{
        opacity: 0,
        y: 50
      }} animate={{
        opacity: 1,
        y: 0,
        height: sheetHeight === 'collapsed' ? '180px' : sheetHeight === 'half' ? '55%' : '90%'
      }} exit={{
        opacity: 0,
        y: 50
      }} transition={{
        type: 'spring',
        damping: 25,
        stiffness: 250
      }} drag="y" dragConstraints={{
        top: 0,
        bottom: 0
      }} dragElastic={0.1} onDragEnd={(e, info) => {
        const threshold = 80;
        if (info.offset.y > threshold) {
          // Dragged down
          if (sheetHeight === 'full') setSheetHeight('half');else if (sheetHeight === 'half') setSheetHeight('collapsed');
        } else if (info.offset.y < -threshold) {
          // Dragged up
          if (sheetHeight === 'collapsed') setSheetHeight('half');else if (sheetHeight === 'half') setSheetHeight('full');
        }
      }} className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto overflow-hidden">
            <div className="bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-xl rounded-t-[2.5rem] shadow-[0_-8px_40px_rgba(0,0,0,0.15)] pb-24 pt-3 border-t border-primary/10 h-full overflow-y-auto">
              {/* Drag Handle - Interactive */}
              <div className="flex justify-center mb-2 cursor-grab active:cursor-grabbing py-2 -mt-2 select-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors" />
                  {/* Height indicators */}
                  <div className="flex gap-1.5">
                    <button onClick={() => setSheetHeight('collapsed')} className={cn("w-1.5 h-1.5 rounded-full transition-all hover:scale-125", sheetHeight === 'collapsed' ? "bg-primary w-3" : "bg-muted-foreground/30")} aria-label="إخفاء" />
                    <button onClick={() => setSheetHeight('half')} className={cn("w-1.5 h-1.5 rounded-full transition-all hover:scale-125", sheetHeight === 'half' ? "bg-primary w-3" : "bg-muted-foreground/30")} aria-label="متوسط" />
                    <button onClick={() => setSheetHeight('full')} className={cn("w-1.5 h-1.5 rounded-full transition-all hover:scale-125", sheetHeight === 'full' ? "bg-primary w-3" : "bg-muted-foreground/30")} aria-label="توسيع" />
                  </div>
                </div>
              </div>

              {/* رسالة ترحيبية في البداية */}
              {activeField === 'both' && !pickupCoords && !dropoffCoords && <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} className="px-4 mb-4">
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl p-6 border border-primary/20 text-center">
                    
                    
                    <p className="text-sm text-muted-foreground">اختر وجهتك للبدء</p>
                  </div>
                </motion.div>}

              {/* Promo Banners - Hide when dropoff is selected for cleaner UX */}
              {!dropoffCoords && pickupCoords && activeField !== 'pickup' && <div className="px-4 mb-4">
                  <ScrollablePromoBanners regionId={null} />
                </div>}

              {/* رسالة توجيهية عند اختيار موقع الانطلاق */}
              {activeField === 'pickup' && !pickupCoords && dropoffCoords && <motion.div initial={{
            opacity: 0,
            scale: 0.95
          }} animate={{
            opacity: 1,
            scale: 1
          }} className="px-4 mb-4">
                  <div className="bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 border-2 border-emerald-500/30 rounded-2xl p-5 text-center">
                    <motion.div animate={{
                scale: [1, 1.1, 1]
              }} transition={{
                duration: 1.5,
                repeat: Infinity
              }} className="text-3xl mb-2">
                      📍
                    </motion.div>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      حدد موقع انطلاقك
                    </p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                      اضغط على الزر أعلاه أو استخدم GPS
                    </p>
                  </div>
                </motion.div>}

              {/* رسالة توجيهية عند اختيار الوجهة */}
              {activeField === 'dropoff' && !dropoffCoords && pickupCoords && <motion.div initial={{
            opacity: 0,
            scale: 0.95
          }} animate={{
            opacity: 1,
            scale: 1
          }} className="px-4 mb-4">
                  <div className="bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30 rounded-2xl p-5 text-center">
                    <motion.div animate={{
                rotate: [0, 10, -10, 0]
              }} transition={{
                duration: 2,
                repeat: Infinity
              }} className="text-3xl mb-2">
                      🎯
                    </motion.div>
                    <p className="text-base font-bold text-primary mb-1">
                      إلى أين تريد الذهاب؟
                    </p>
                    <p className="text-xs text-primary/70">
                      اختر من المفضلة أو ابحث عن مكان جديد
                    </p>
                  </div>
                </motion.div>}

              {/* Location Input Cards - Professional Design */}
              <div className="px-4 space-y-3 mb-4">
                {/* Pickup Card - يظهر دائماً إلا إذا كان محدداً والوجهة غير محددة */}
                {(activeField === 'pickup' || activeField === 'both' || pickupCoords) && <LocationInputCard type="pickup" value={pickup} placeholder="من أين تريد الانطلاق؟" isLocating={isLocating} onGetLocation={getCurrentLocation} onClick={() => {
              setActiveField('pickup');
              openLocationSheet('pickup_only');
            }} onClear={() => {
              setPickup('');
              setPickupCoords(null);
              setActiveField('both');
            }} showClear={!!pickup} />}

                {/* Dropoff Card - يظهر إذا كان الحقل النشط هو dropoff أو both أو إذا كان محدداً */}
                {(activeField === 'dropoff' || activeField === 'both' || dropoffCoords) && <LocationInputCard type="dropoff" value={dropoff} placeholder="إلى أين تريد الذهاب؟" onClick={() => {
              setActiveField('dropoff');
              openLocationSheet('dropoff');
            }} onClear={() => {
              setDropoff('');
              setDropoffCoords(null);
              setRouteDistance(null);
              setRouteDuration(null);
              setActiveField('both');
            }} showClear={!!dropoff} />}

                {/* زر لإظهار الحقل الآخر */}
                {activeField === 'pickup' && pickupCoords && !dropoffCoords && <button onClick={() => setActiveField('dropoff')} className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-l from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 border border-primary/20 rounded-2xl transition-all">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">إضافة وجهة</span>
                  </button>}
                
                {activeField === 'dropoff' && dropoffCoords && !pickupCoords && <button onClick={() => setActiveField('pickup')} className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-l from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 border border-primary/20 rounded-2xl transition-all">
                    <Navigation className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">إضافة موقع الانطلاق</span>
                  </button>}
              </div>

              {/* Quick Booking Section - Enhanced */}
              {pickupCoords && dropoffCoords && routeDistance && !showBookingPanel && <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} className="px-4 mb-4 space-y-4">
                  {/* Trip Summary Card */}
                  <TripInfoSummary distance={routeDistance} duration={routeDuration} estimatedFare={fareBreakdown?.total_fare} vehicleType={selectedVehicle} compact={true} />
                  
                  {/* Driver Count Badge */}
                  {nearbyDriversCount > 0 && <motion.div initial={{
              opacity: 0,
              scale: 0.9
            }} animate={{
              opacity: 1,
              scale: 1
            }} className="flex items-center justify-center gap-2 py-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {nearbyDriversCount} سائق متاح الآن
                      </span>
                    </motion.div>}
                  
                  {/* Large Booking Button */}
                  <motion.div whileHover={{
              scale: 1.01
            }} whileTap={{
              scale: 0.99
            }}>
                    <Button onClick={() => setShowBookingPanel(true)} className="w-full h-16 text-lg font-bold rounded-2xl shadow-xl bg-gradient-to-l from-primary to-primary/90 hover:from-primary/90 hover:to-primary group">
                      <span className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                        احجز الآن
                        {fareBreakdown?.total_fare && <span className="text-primary-foreground/80">• {fareBreakdown.total_fare.toLocaleString('ar-IQ')} د.ع</span>}
                      </span>
                    </Button>
                  </motion.div>
                </motion.div>}

              {/* Saved Places Quick Icons - Show when selecting destination */}
              {!dropoffCoords && (activeField === 'dropoff' || activeField === 'both') && <div className="px-4 py-4">
                  <SavedPlacesQuickIcons userId={user?.id || null} onSelect={({
              lat,
              lng,
              address
            }) => {
              handleDestinationSelect(address, {
                lat,
                lng
              });
            }} onAddNew={() => navigate('/rider/saved-places')} />
                </div>}

              {/* Recent Destinations - Show when selecting destination */}
              {!dropoffCoords && (activeField === 'dropoff' || activeField === 'both') && <div className="mb-4">
                  <RecentDestinations userId={user?.id} onSelect={({
              address,
              lat,
              lng
            }) => {
              handleDestinationSelect(address, {
                lat,
                lng
              });
            }} />
                </div>}
            </div>
          </motion.div>}
      </AnimatePresence>

      {/* Booking Panel - Enhanced */}
      <AnimatePresence>
        {showBookingPanel && dropoffCoords && <motion.div initial={{
        opacity: 0,
        y: 100
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: 100
      }} className="absolute bottom-0 left-0 right-0 z-40">
            <div className="bg-card rounded-t-[2.5rem] shadow-[0_-8px_40px_rgba(0,0,0,0.2)] border-t border-primary/10 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-card z-10 px-4 py-4 border-b border-border/30">
                <div className="flex items-center gap-4">
                  <motion.button whileHover={{
                scale: 1.1
              }} whileTap={{
                scale: 0.9
              }} onClick={resetBooking} className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                  <div className="flex-1">
                    <h2 className="font-bold text-lg">تفاصيل الرحلة</h2>
                    {routeDistance && <p className="text-sm text-muted-foreground">
                        {routeDistance.toFixed(1)} كم • {routeDuration ? Math.round(routeDuration) : '--'} دقيقة
                      </p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                  setActiveField('pickup');
                  openLocationSheet('pickup_only');
                }} className="text-primary font-bold hover:bg-primary/10">
                      <Navigation className="w-3 h-3 ml-1" />
                      انطلاق
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                  setActiveField('dropoff');
                  openLocationSheet('dropoff');
                }} className="text-primary font-bold hover:bg-primary/10">
                      <MapPin className="w-3 h-3 ml-1" />
                      وجهة
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-5">
                {/* Route Summary - Compact display */}
                <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-2 pt-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                      <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 to-rose-500" />
                      <div className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">من</p>
                        <p className="text-sm font-medium">{pickup || 'موقعي الحالي'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">إلى</p>
                        <p className="text-sm font-medium">{dropoff}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehicle Selector */}
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    اختر نوع السيارة
                  </p>
                  <CompactVehicleSelector selectedVehicle={selectedVehicle} onSelect={setSelectedVehicle} baseFare={fareBreakdown?.total_fare} availableDrivers={availableDriversByType} />
                </div>

                {/* Payment Method */}
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">طريقة الدفع</p>
                  <PaymentMethodBadge method={paymentMethod} onClick={() => setShowPaymentSheet(true)} />
                </div>

                {/* Book Button */}
                <motion.div whileHover={{
              scale: 1.01
            }} whileTap={{
              scale: 0.99
            }}>
                  <Button className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-l from-primary to-primary-dark shadow-glow hover:shadow-glow-lg transition-all" size="lg" onClick={handleBookRide} disabled={isBooking || fareLoading}>
                    {isBooking ? <span className="flex items-center gap-3">
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        جاري الحجز...
                      </span> : <span className="flex items-center gap-3">
                        <Navigation className="w-5 h-5" />
                        احجز الآن {fareBreakdown?.total_fare ? `• ${fareBreakdown.total_fare.toLocaleString('ar-IQ')} د.ع` : ''}
                      </span>}
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>}
      </AnimatePresence>

      {/* Location Bottom Sheet */}
      {showLocationSheet && <Suspense fallback={null}>
          <LocationBottomSheet isOpen={showLocationSheet} onClose={() => setShowLocationSheet(false)} activeField={locationSheetField} pickup={pickup} dropoff={dropoff} onPickupChange={setPickup} onDropoffChange={setDropoff} onLocationSelect={handleLocationSheetSelect} onOpenMapPicker={type => {
        setShowLocationSheet(false);
        setMapPickerMode(type);
        setShowMapPicker(true);
      }} userLocation={userLocation} pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} userId={user?.id} />
        </Suspense>}

      {/* Map Location Picker - Now handled by crosshair mode in main map */}
      {/* Confirm button for crosshair mode - Only show when map picker is active */}
      {showMapPicker && <motion.div initial={{
      opacity: 0,
      y: 50
    }} animate={{
      opacity: 1,
      y: 0
    }} exit={{
      opacity: 0,
      y: 50
    }} className="absolute bottom-0 left-0 right-0 z-30 pb-8 px-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl p-4 shadow-2xl border border-border/50">
          <div className="flex gap-3">
            {/* Cancel Button */}
            <Button onClick={() => setShowMapPicker(false)} variant="outline" size="lg" className="flex-1 h-14 rounded-2xl text-base font-bold border-2">
              <X className="w-5 h-5 ml-2" />
              إلغاء
            </Button>
            
            {/* Confirm Button */}
            <Button onClick={() => {
            if (mapPickerMode === 'pickup' && pickupCoords) {
              handleMapPickerConfirm({
                lat: pickupCoords.lat,
                lng: pickupCoords.lng,
                address: pickup || `${pickupCoords.lat.toFixed(5)}, ${pickupCoords.lng.toFixed(5)}`,
                inService: true
              });
            } else if (mapPickerMode === 'dropoff' && dropoffCoords) {
              handleMapPickerConfirm({
                lat: dropoffCoords.lat,
                lng: dropoffCoords.lng,
                address: dropoff || `${dropoffCoords.lat.toFixed(5)}, ${dropoffCoords.lng.toFixed(5)}`,
                inService: true
              });
            }
          }} size="lg" className="flex-1 h-14 rounded-2xl text-base font-bold bg-gradient-to-l from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
              تأكيد الموقع
              <Target className="w-5 h-5 mr-2" />
            </Button>
          </div>
        </div>
      </motion.div>}
      
      {/* Keeping old MapLocationPicker as fallback but not showing */}
      {false && showMapPicker && <Suspense fallback={<MapSkeleton />}>
          <MapLocationPicker isOpen={showMapPicker} onClose={() => setShowMapPicker(false)} type={mapPickerMode} onConfirm={handleMapPickerConfirm} initialLocation={mapPickerMode === 'pickup' ? pickupCoords : dropoffCoords} userLocation={userLocation} />
        </Suspense>}

      {/* Payment Method Sheet */}
      {showPaymentSheet && <Suspense fallback={null}>
          <PaymentMethodSheet open={showPaymentSheet} onOpenChange={setShowPaymentSheet} selectedMethod={paymentMethod} onSelect={setPaymentMethod} />
        </Suspense>}

      {/* Side Menu */}
      {showSideMenu && <Suspense fallback={null}>
          <RiderSideMenu user={user} isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} onLogout={handleLogout} />
        </Suspense>}

      {/* Bottom Navigation - Always visible */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <RiderBottomNav />
      </div>
    </div>;
};
export default RiderHomeCustom;