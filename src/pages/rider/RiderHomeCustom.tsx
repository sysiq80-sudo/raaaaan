import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, MapPin, Search, Navigation, X, ArrowLeft, Locate, Wallet, CreditCard, Banknote, Settings } from 'lucide-react';
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
import LocationSearchInput from '@/components/LocationSearchInput';

// New Smart Components
import DynamicBubbles from '@/components/rider/DynamicBubbles';
import SmartSideBar from '@/components/rider/SmartSideBar';
import AnimatedCards from '@/components/rider/AnimatedCards';
import SmartMapSuggestions from '@/components/rider/SmartMapSuggestions';
import { SmartDarkModeProvider, SmartDarkModeIndicator, SmartDarkModeOverlay } from '@/components/rider/SmartDarkMode';
import SmartNotifications, { useSmartNotifications } from '@/components/rider/SmartNotifications';
import { CustomizationProvider, CustomizationPanel, useCustomization } from '@/components/rider/CustomizationPanel';
import QuickGestures from '@/components/rider/QuickGestures';

// Hooks
import { useFareCalculation } from '@/hooks/useFareCalculation';
import { useOptimizedNearbyDrivers } from '@/hooks/useOptimizedNearbyDrivers';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { useActiveRide, ActiveRide } from '@/hooks/useActiveRide';
import { useRiderInitialization } from '@/hooks/useRiderInitialization';
import { getMapboxToken } from '@/hooks/useMapboxToken';

// Loading Skeletons
const MapSkeleton = () => <div className="h-full w-full bg-muted animate-pulse flex items-center justify-center">
    <div className="text-center space-y-2">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
    </div>
  </div>;
const ScreenSkeleton = () => <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
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

  // Smart Notifications Hook
  const {
    notifications,
    showDriverArrived,
    showPromo,
    showWeatherWarning
  } = useSmartNotifications();

  // Customization Hook
  const {
    settings
  } = useCustomization();

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

  // Search State
  const [pickupSearch, setPickupSearch] = useState('');
  const [dropoffSearch, setDropoffSearch] = useState('');

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

  // Smart Features State
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

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
    // Increased debounce
    enableRealtime: !!pickupCoords // Only enable when pickup is set
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

  // Update current hour for smart suggestions
  useEffect(() => {
    const updateHour = () => setCurrentHour(new Date().getHours());
    const interval = setInterval(updateHour, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Smart Features Handlers
  const handleQuickBook = useCallback(() => {
    if (nearbyDriversCount > 0) {
      setShowBookingPanel(true);
      setShowSearchOverlay(false);
      toast({
        title: "حجز سريع",
        description: `تم العثور على ${nearbyDriversCount} سائق قريب`
      });
    } else {
      toast({
        title: "لا يوجد سائقون",
        description: "لا يوجد سائقون متاحون في المنطقة حالياً",
        variant: "destructive"
      });
    }
  }, [nearbyDriversCount, toast]);
  const handleEmergency = useCallback(() => {
    // Emergency contact logic
    toast({
      title: "الاتصال بالطوارئ",
      description: "جاري الاتصال بخدمة الطوارئ...",
      variant: "destructive"
    });
  }, [toast]);
  const handleBubbleClick = useCallback((type: string, data?: any) => {
    switch (type) {
      case 'drivers':
        handleQuickBook();
        break;
      case 'promo':
        showPromo(data?.discount || 'خصم', '24 ساعة');
        break;
      case 'time':
        toast({
          title: "وقت الوصول المقدر",
          description: `${data?.minutes || 0} دقيقة`
        });
        break;
      default:
        break;
    }
  }, [handleQuickBook, showPromo, toast]);
  const handleCardClick = useCallback((type: string) => {
    switch (type) {
      case 'drivers':
        handleQuickBook();
        break;
      case 'promo':
        showPromo('25%', '48 ساعة');
        break;
      case 'traffic':
        showWeatherWarning('ازدحام مروري متوسط');
        break;
      default:
        break;
    }
  }, [handleQuickBook, showPromo, showWeatherWarning]);

  // Fetch address from coordinates using cached token
  const fetchAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const token = getMapboxToken();
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=ar&types=address,poi,neighborhood,locality`);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].place_name_ar || data.features[0].place_name || 'موقع محدد';
        }
      }
      return 'موقع محدد';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'موقع محدد';
    }
  }, []);

  // Get user location and address
  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({
        title: "خطأ",
        description: "المتصفح لا يدعم تحديد الموقع",
        variant: "destructive"
      });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async position => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      setUserLocation(coords);
      setPickupCoords(coords);

      // Fetch address for the coordinates
      const address = await fetchAddressFromCoords(coords.lat, coords.lng);
      setPickup(address);
      setIsLocating(false);
      toast({
        title: "تم تحديد موقعك",
        description: address
      });
    }, error => {
      console.error('Geolocation error:', error);
      setIsLocating(false);
      toast({
        title: "خطأ في تحديد الموقع",
        description: "الرجاء السماح بالوصول للموقع",
        variant: "destructive"
      });
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  }, [fetchAddressFromCoords, toast]);

  // Initial location fetch (only once)
  useEffect(() => {
    getCurrentLocation();
  }, []);

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
      setDropoffSearch(address);
    }
    setShowSearchOverlay(false);
    setShowLocationSheet(false);
    setShowBookingPanel(true);
  }, [selectingStopId, intermediateStops]);

  // Handle pickup selection from saved places
  const handlePickupSelectFromSaved = useCallback((address: string, coords: {
    lat: number;
    lng: number;
  }) => {
    setPickup(address);
    setPickupCoords(coords);
    setPickupSearch(address);
    setShowLocationSheet(false);
  }, []);

  // Handle pickup selection
  const handlePickupSelect = useCallback((address: string, coords: {
    lat: number;
    lng: number;
  }) => {
    setPickup(address);
    setPickupCoords(coords);
    setShowLocationSheet(false);
  }, []);

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
      // After confirming pickup, close map picker and focus on dropoff field
      setShowMapPicker(false);
      setTimeout(() => {
        // Focus on dropoff input if available
        const dropoffInput = document.querySelector('[data-field="dropoff"] input') as HTMLInputElement;
        if (dropoffInput) {
          dropoffInput.focus();
        }
      }, 100);
    } else {
      handleDestinationSelect(location.address, {
        lat: location.lat,
        lng: location.lng
      });
      // After confirming dropoff, close the picker
      setShowMapPicker(false);
    }
  }, [mapPickerMode, handlePickupSelect, handleDestinationSelect]);

  // Open location sheet
  const openLocationSheet = useCallback((mode: 'pickup' | 'dropoff' | 'pickup_only') => {
    setLocationSheetField(mode);
    setShowLocationSheet(true);
  }, []);

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
          ride_id: ride.id
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
  return <div className="h-screen w-full relative overflow-hidden flex flex-col">
      {/* Map Section - Top Half */}
      <div className="h-1/2 w-full relative z-0">
        <Suspense fallback={<MapSkeleton />}>
          <LazyMap className="h-full w-full rounded-none" fallbackHeight="h-full" pickupLocation={pickupCoords} dropoffLocation={dropoffCoords} nearbyDrivers={nearbyDriverLocations} onRouteCalculated={handleRouteCalculated} selectingLocation={showMapPicker ? mapPickerMode : null} onLocationSelect={() => {}} />
        </Suspense>
      </div>

      {/* Options Section - Bottom Half */}
      <div className="h-1/2 w-full bg-background relative z-10 overflow-y-auto">
        {/* Top Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 safe-area-top">
          <div className="p-4 flex items-center justify-between">
            <Button variant="outline" size="icon" className="bg-background/95 backdrop-blur-sm shadow-lg border-border/50" onClick={() => setShowSideMenu(true)}>
              <Menu className="w-5 h-5" />
            </Button>

            <h1 className="text-lg font-bold">ران</h1>

            <div className="flex items-center gap-2">
              <SupportButton />
              <Button variant="outline" size="icon" className="bg-background/95 backdrop-blur-sm shadow-lg border-border/50">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="icon" className="bg-background/95 backdrop-blur-sm shadow-lg border-border/50" onClick={() => setShowCustomizationPanel(true)}>
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search Overlay */}
        <AnimatePresence>
          {showSearchOverlay && !showBookingPanel && !showWaitingScreen && <motion.div initial={{
          opacity: 0,
          y: 50
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: 50
        }} className="px-4 py-4">
              <div className="bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-lg rounded-2xl shadow-lg p-4">
                {/* Pickup Location Search */}
                <div className="mb-4">
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <LocationSearchInput placeholder="ابحث عن موقع الانطلاق..." value={pickupSearch} onChange={setPickupSearch} onLocationSelect={location => {
                    setPickup(location.address);
                    setPickupCoords({
                      lat: location.lat,
                      lng: location.lng
                    });
                    setPickupSearch(location.address);
                  }} type="pickup" userLocation={userLocation} className="w-full" />
                    </div>
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => openLocationSheet('pickup_only')}>
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Dropoff Location Search */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">إلى أين تريد الذهاب؟</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <LocationSearchInput placeholder="ابحث عن الوجهة..." value={dropoffSearch} onChange={setDropoffSearch} onLocationSelect={location => {
                    setDropoff(location.address);
                    setDropoffCoords({
                      lat: location.lat,
                      lng: location.lng
                    });
                    setDropoffSearch(location.address);
                    setShowBookingPanel(true);
                    setShowSearchOverlay(false);
                  }} type="dropoff" userLocation={userLocation} className="w-full" />
                    </div>
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => openLocationSheet('dropoff')}>
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Saved Places Quick Icons */}
                <div className="border-t border-border/20 pt-4">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">الأماكن المحفوظة للانطلاق</p>
                    <SavedPlacesQuickIcons userId={user?.id || null} onSelect={({
                  lat,
                  lng,
                  address
                }) => {
                  handlePickupSelectFromSaved(address, {
                    lat,
                    lng
                  });
                }} onAddNew={() => navigate('/rider/saved-places')} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">الأماكن المحفوظة للوجهة</p>
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
                  </div>
                </div>

                {/* Payment Method */}
                <div className="border-t border-border/20 pt-4">
                  <button className="w-full flex items-center justify-between" onClick={() => setShowPaymentSheet(true)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {paymentMethod === 'wallet' ? <Wallet className="w-5 h-5 text-primary" /> : paymentMethod === 'cash' ? <Banknote className="w-5 h-5 text-primary" /> : <CreditCard className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-base">
                          {paymentMethod === 'wallet' ? 'المحفظة' : paymentMethod === 'cash' ? 'نقداً' : paymentMethod === 'card' ? 'بطاقة' : paymentMethod === 'zain_cash' ? 'زين كاش' : paymentMethod === 'nas_wallet' ? 'ناس' : 'الدفع'}
                        </p>
                        <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto">
                      تغيير
                    </Button>
                  </button>
                </div>
              </div>
            </motion.div>}
        </AnimatePresence>

        {/* Booking Panel */}
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
        }} className="px-4 py-4">
            <div className="bg-background rounded-t-3xl shadow-2xl border-t border-border/50 max-h-[80vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-background z-10 p-4 border-b border-border/50 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={resetBooking}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h2 className="font-semibold flex-1">تفاصيل الرحلة</h2>
                <Button variant="ghost" size="sm" onClick={() => openLocationSheet('dropoff')}>
                  تعديل
                </Button>
              </div>

              <div className="p-4 space-y-4">
                {/* Multi-Stop Selector */}
                <MultiStopSelector pickup={{
                address: pickup || 'موقعي الحالي',
                location: pickupCoords
              }} dropoff={{
                address: dropoff,
                location: dropoffCoords
              }} intermediateStops={intermediateStops} onStopsChange={setIntermediateStops} onStopSelect={stopId => {
                setSelectingStopId(stopId);
                openLocationSheet('dropoff');
              }} />

                {/* Round Trip Selector */}
                <RoundTripSelector tripType={tripType} onTripTypeChange={setTripType} returnTime={returnTime} onReturnTimeChange={setReturnTime} oneWayFare={fareBreakdown?.total_fare || 0} roundTripDiscount={15} distanceKm={routeDistance || 0} />

                {/* Vehicle Selector */}
                <CompactVehicleSelector selectedVehicle={selectedVehicle} onSelect={setSelectedVehicle} availableDrivers={availableDriversByType} />

                {/* Payment Method */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">طريقة الدفع</p>
                  <PaymentMethodBadge method={paymentMethod} onClick={() => setShowPaymentSheet(true)} />
                </div>

                {/* Book Button */}
                <Button className="w-full h-14 text-lg font-bold" size="lg" onClick={handleBookRide} disabled={isBooking || fareLoading}>
                  {isBooking ? <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الحجز...
                    </span> : <span>احجز الآن • {fareBreakdown?.total_fare?.toLocaleString() || '---'} د.ع</span>}
                </Button>
              </div>
            </div>
          </motion.div>}
      </AnimatePresence>
      </div>
      {/* Location Bottom Sheet */}
      {showLocationSheet && <Suspense fallback={null}>
          <LocationBottomSheet isOpen={showLocationSheet} onClose={() => setShowLocationSheet(false)} activeField={locationSheetField} pickup={pickup} dropoff={dropoff} onPickupChange={setPickup} onDropoffChange={setDropoff} onLocationSelect={handleLocationSheetSelect} onOpenMapPicker={type => {
        setShowLocationSheet(false);
        setMapPickerMode(type);
        setShowMapPicker(true);
      }} userLocation={userLocation} pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} userId={user?.id} />
        </Suspense>}

      {/* Quick Gestures */}
      <QuickGestures onSwipeUp={handleQuickBook} onDoubleTap={handleEmergency} onLongPress={() => setShowCustomizationPanel(true)} enabled={settings.gestures.swipe_book || settings.gestures.double_tap_emergency || settings.gestures.long_press_menu} />

      {/* Smart Features Components */}

      {/* Dynamic Bubbles on Map */}
      <DynamicBubbles driverLocations={nearbyDriverLocations} nearbyDriversCount={nearbyDriversCount} userLocation={userLocation} pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} estimatedTime={routeDuration} onBubbleClick={handleBubbleClick} />

      {/* Smart Side Bar */}
      <SmartSideBar isVisible={!showBookingPanel && !showWaitingScreen} onQuickBook={handleQuickBook} onFavoriteDrivers={() => navigate('/rider/favorites')} onPromotions={() => showPromo('30%', '72 ساعة')} onSavedPlaces={() => navigate('/rider/saved-places')} onEmergency={handleEmergency} nearbyDriversCount={nearbyDriversCount} hasActivePromotions={true} />

      {/* Smart Map Suggestions */}
      <SmartMapSuggestions userLocation={userLocation} currentHour={currentHour} userHistory={[]} // TODO: Add user ride history
    onSuggestionSelect={(address, coords) => {
      setDropoff(address);
      setDropoffCoords(coords);
      setDropoffSearch(address);
      setShowBookingPanel(true);
      setShowSearchOverlay(false);
    }} isVisible={showSearchOverlay && !showBookingPanel} />

      {/* Animated Cards */}
      {!showSearchOverlay && !showBookingPanel && !showWaitingScreen && <AnimatedCards nearbyDriversCount={nearbyDriversCount} estimatedTime={routeDuration} currentFare={fareBreakdown?.total_fare} averageRating={4.5} trafficLevel="low" monthlySavings={15000} onCardClick={handleCardClick} isLoading={fareLoading} />}

      {/* Smart Notifications */}
      <SmartNotifications notifications={notifications} onNotificationAction={(id, action) => {
      console.log('Notification action:', id, action);
    }} onNotificationDismiss={id => {
      console.log('Notification dismissed:', id);
    }} position="top" maxVisible={3} />

      {/* Customization Panel */}
      <CustomizationPanel isOpen={showCustomizationPanel} onClose={() => setShowCustomizationPanel(false)} />

      {/* Map Location Picker */}
      {showMapPicker && <Suspense fallback={<MapSkeleton />}>
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

      {/* Bottom Navigation - Hidden in split screen layout */}
      {/* {!showBookingPanel && !showWaitingScreen && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <RiderBottomNav />
        </div>
       )} */}
    </div>;
};
const RiderHomeWithProviders: React.FC = () => {
  return <CustomizationProvider>
      <SmartDarkModeProvider>
        <SmartDarkModeOverlay>
          <RiderHomeCustom />
          <SmartDarkModeIndicator />
        </SmartDarkModeOverlay>
      </SmartDarkModeProvider>
    </CustomizationProvider>;
};
export default RiderHomeWithProviders;