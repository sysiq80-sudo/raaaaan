import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, MapPin, Search, Navigation, X, ArrowLeft, Locate, Wallet, CreditCard, Banknote } from 'lucide-react';
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

// Hooks
import { useFareCalculation } from '@/hooks/useFareCalculation';
import { useOptimizedNearbyDrivers } from '@/hooks/useOptimizedNearbyDrivers';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { useActiveRide, ActiveRide } from '@/hooks/useActiveRide';
import { useRiderInitialization } from '@/hooks/useRiderInitialization';
import { getMapboxToken } from '@/hooks/useMapboxToken';

// Loading Skeletons
const MapSkeleton = () => (
  <div className="h-full w-full bg-muted animate-pulse flex items-center justify-center">
    <div className="text-center space-y-2">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
    </div>
  </div>
);

const ScreenSkeleton = () => (
  <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>
);

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
  const { toast } = useToast();

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
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  // Hooks - only enable when needed
  const { fareBreakdown, fareLoading } = useFareCalculation(
    pickupCoords, 
    dropoffCoords, 
    selectedVehicle, 
    routeDistance
  );
  
  // Only fetch drivers when pickup is set
  const { 
    nearbyDriversCount, 
    nearbyDriverLocations, 
    availableDriversByType, 
    isLoading: driversLoading 
  } = useOptimizedNearbyDrivers(pickupCoords, selectedVehicle, {
    debounceMs: 1000, // Increased debounce
    enableRealtime: !!pickupCoords // Only enable when pickup is set
  });
  
  useRiderLocation({ enabled: !!user });
  
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
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=ar&types=address,poi,neighborhood,locality`
      );
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
    navigator.geolocation.getCurrentPosition(
      async position => {
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
      },
      error => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        toast({
          title: "خطأ في تحديد الموقع",
          description: "الرجاء السماح بالوصول للموقع",
          variant: "destructive"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
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
  const handleDestinationSelect = useCallback((address: string, coords: { lat: number; lng: number }) => {
    if (selectingStopId) {
      const updatedStops = intermediateStops.map(stop =>
        stop.id === selectingStopId ? { ...stop, address, location: coords } : stop
      );
      setIntermediateStops(updatedStops);
      setSelectingStopId(null);
    } else {
      setDropoff(address);
      setDropoffCoords(coords);
    }
    setShowSearchOverlay(false);
    setShowLocationSheet(false);
    setShowBookingPanel(true);
  }, [selectingStopId, intermediateStops]);

  // Handle pickup selection
  const handlePickupSelect = useCallback((address: string, coords: { lat: number; lng: number }) => {
    setPickup(address);
    setPickupCoords(coords);
    setShowLocationSheet(false);
  }, []);

  // Handle location select from bottom sheet
  const handleLocationSheetSelect = useCallback((
    location: { lat: number; lng: number; address: string; inService?: boolean },
    type: 'pickup' | 'dropoff'
  ) => {
    if (type === 'pickup') {
      handlePickupSelect(location.address, { lat: location.lat, lng: location.lng });
    } else {
      handleDestinationSelect(location.address, { lat: location.lat, lng: location.lng });
    }
  }, [handlePickupSelect, handleDestinationSelect]);

  // Handle map picker confirm
  const handleMapPickerConfirm = useCallback((location: { lat: number; lng: number; address: string; inService?: boolean }) => {
    if (mapPickerMode === 'pickup') {
      handlePickupSelect(location.address, { lat: location.lat, lng: location.lng });
    } else {
      handleDestinationSelect(location.address, { lat: location.lat, lng: location.lng });
    }
    setShowMapPicker(false);
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
      const { data: ride, error } = await supabase
        .from('rides')
        .insert([{
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
        } as any])
        .select()
        .single();

      if (error) throw error;

      const pickupLoc = ride.pickup_location as unknown as { lat: number; lng: number };
      const dropoffLoc = ride.dropoff_location as unknown as { lat: number; lng: number };

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
        body: { ride_id: ride.id }
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
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <CompleteProfileScreen 
          userId={user.id} 
          onComplete={name => {
            updateProfile({ full_name: name });
          }} 
        />
      </Suspense>
    );
  }

  // Active ride tracker
  if (showLiveTracker && activeRide && activeRide.status !== 'pending') {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <LiveRideTracker 
          ride={{
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
          }} 
          onClose={() => setShowLiveTracker(false)} 
          onRideUpdate={updatedRide => {
            setActiveRide({ ...activeRide, ...updatedRide });
            if (updatedRide.status === 'completed' || updatedRide.status === 'cancelled') {
              resetBooking();
            }
          }} 
        />
      </Suspense>
    );
  }

  // Waiting screen
  if (showWaitingScreen && activeRide) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <RideWaitingScreen 
          rideId={activeRide.id} 
          pickupAddress={activeRide.pickup_address || pickup || 'موقعي الحالي'} 
          dropoffAddress={activeRide.dropoff_address || dropoff} 
          estimatedFare={activeRide.estimated_fare || fareBreakdown?.total_fare || 0} 
          onCancel={resetBooking} 
          onDriverFound={() => {
            setShowWaitingScreen(false);
            setShowLiveTracker(true);
          }} 
        />
      </Suspense>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden">
      {/* Full Screen Map */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<MapSkeleton />}>
          <LazyMap 
            className="h-full w-full rounded-none" 
            fallbackHeight="h-full" 
            pickupLocation={pickupCoords} 
            dropoffLocation={dropoffCoords} 
            nearbyDrivers={nearbyDriverLocations} 
            onRouteCalculated={handleRouteCalculated} 
            selectingLocation={showMapPicker ? mapPickerMode : null} 
            onLocationSelect={() => {}} 
          />
        </Suspense>
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-20 safe-area-top">
        <div className="p-4 flex items-center justify-between">
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-background/95 backdrop-blur-sm shadow-lg border-border/50" 
            onClick={() => setShowSideMenu(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <h1 className="text-lg font-bold">ران</h1>

          <div className="flex items-center gap-2">
            <SupportButton />
            <Button variant="outline" size="icon" className="bg-background/95 backdrop-blur-sm shadow-lg border-border/50">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {showSearchOverlay && !showBookingPanel && !showWaitingScreen && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }} 
            className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto"
          >
            <div className="bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-lg rounded-t-[2rem] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] pb-24 pt-2">
              {/* Current Location Display */}
              <div className="p-4 flex items-center gap-3 border-b border-border/20">
                <button 
                  onClick={getCurrentLocation} 
                  disabled={isLocating} 
                  className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <Locate className={cn("w-5 h-5 text-primary", isLocating && "animate-pulse")} />
                </button>
                <div className="flex-1 text-right">
                  <p className="text-xs text-warning-foreground">انطلق من موقعك الحالي</p>
                  <p className="font-medium truncate text-base">
                    {isLocating ? 'جاري تحديد الموقع...' : pickup || 'اضغط على الأيقونة لتحديد موقعك'}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-primary" 
                  onClick={() => openLocationSheet('pickup_only')}
                >
                  تغيير
                </Button>
              </div>

              {/* Search Input */}
              <div 
                className="w-full p-4 flex items-center gap-3 border-b border-border/20"
              >
                <div className="w-10 h-10 bg-primary/10 items-center justify-center flex rounded-full">
                  <Search className="text-primary h-5 w-5" />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-bold text-foreground text-base">إلى أين تريد الذهاب؟</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-primary" 
                  onClick={() => openLocationSheet('dropoff')}
                >
                  تغيير
                </Button>
              </div>

              {/* Saved Places Quick Icons */}
              <div className="px-4 py-3 border-b border-border/20">
                <SavedPlacesQuickIcons 
                  userId={user?.id || null} 
                  onSelect={({ lat, lng, address }) => {
                    handleDestinationSelect(address, { lat, lng });
                  }} 
                  onAddNew={() => navigate('/rider/saved-places')} 
                />
              </div>

              {/* Payment Method */}
              <button 
                className="w-full px-4 py-3 flex items-center justify-between" 
                onClick={() => setShowPaymentSheet(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {paymentMethod === 'wallet' ? <Wallet className="w-5 h-5 text-primary" /> : 
                     paymentMethod === 'cash' ? <Banknote className="w-5 h-5 text-primary" /> : 
                     <CreditCard className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-base">
                      {paymentMethod === 'wallet' ? 'المحفظة' : 
                       paymentMethod === 'cash' ? 'نقداً' : 
                       paymentMethod === 'card' ? 'بطاقة' : 
                       paymentMethod === 'zain_cash' ? 'زين كاش' : 
                       paymentMethod === 'nas_wallet' ? 'ناس' : 'الدفع'}
                    </p>
                    <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto">
                  تغيير
                </Button>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Panel */}
      <AnimatePresence>
        {showBookingPanel && dropoffCoords && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 100 }} 
            className="absolute bottom-0 left-0 right-0 z-30"
          >
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
                <MultiStopSelector 
                  pickup={{ address: pickup || 'موقعي الحالي', location: pickupCoords }} 
                  dropoff={{ address: dropoff, location: dropoffCoords }} 
                  intermediateStops={intermediateStops} 
                  onStopsChange={setIntermediateStops} 
                  onStopSelect={stopId => {
                    setSelectingStopId(stopId);
                    openLocationSheet('dropoff');
                  }} 
                />

                {/* Round Trip Selector */}
                <RoundTripSelector 
                  tripType={tripType} 
                  onTripTypeChange={setTripType} 
                  returnTime={returnTime} 
                  onReturnTimeChange={setReturnTime} 
                  oneWayFare={fareBreakdown?.total_fare || 0} 
                  roundTripDiscount={15} 
                  distanceKm={routeDistance || 0} 
                />

                {/* Vehicle Selector */}
                <CompactVehicleSelector 
                  selectedVehicle={selectedVehicle} 
                  onSelect={setSelectedVehicle} 
                  availableDrivers={availableDriversByType} 
                />

                {/* Payment Method */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">طريقة الدفع</p>
                  <PaymentMethodBadge method={paymentMethod} onClick={() => setShowPaymentSheet(true)} />
                </div>

                {/* Book Button */}
                <Button 
                  className="w-full h-14 text-lg font-bold" 
                  size="lg" 
                  onClick={handleBookRide} 
                  disabled={isBooking || fareLoading}
                >
                  {isBooking ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الحجز...
                    </span>
                  ) : (
                    <span>احجز الآن • {fareBreakdown?.total_fare?.toLocaleString() || '---'} د.ع</span>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Bottom Sheet */}
      {showLocationSheet && (
        <Suspense fallback={null}>
          <LocationBottomSheet 
            isOpen={showLocationSheet} 
            onClose={() => setShowLocationSheet(false)} 
            activeField={locationSheetField} 
            pickup={pickup} 
            dropoff={dropoff} 
            onPickupChange={setPickup} 
            onDropoffChange={setDropoff} 
            onLocationSelect={handleLocationSheetSelect} 
            onOpenMapPicker={type => {
              setShowLocationSheet(false);
              setMapPickerMode(type);
              setShowMapPicker(true);
            }} 
            userLocation={userLocation} 
            pickupCoords={pickupCoords} 
            dropoffCoords={dropoffCoords} 
            userId={user?.id} 
          />
        </Suspense>
      )}

      {/* Map Location Picker */}
      {showMapPicker && (
        <Suspense fallback={<MapSkeleton />}>
          <MapLocationPicker 
            isOpen={showMapPicker} 
            onClose={() => setShowMapPicker(false)} 
            type={mapPickerMode} 
            onConfirm={handleMapPickerConfirm} 
            initialLocation={mapPickerMode === 'pickup' ? pickupCoords : dropoffCoords} 
            userLocation={userLocation} 
          />
        </Suspense>
      )}

      {/* Payment Method Sheet */}
      {showPaymentSheet && (
        <Suspense fallback={null}>
          <PaymentMethodSheet 
            open={showPaymentSheet} 
            onOpenChange={setShowPaymentSheet} 
            selectedMethod={paymentMethod} 
            onSelect={setPaymentMethod} 
          />
        </Suspense>
      )}

      {/* Side Menu */}
      {showSideMenu && (
        <Suspense fallback={null}>
          <RiderSideMenu 
            user={user} 
            isOpen={showSideMenu} 
            onClose={() => setShowSideMenu(false)} 
            onLogout={handleLogout} 
          />
        </Suspense>
      )}

      {/* Bottom Navigation */}
      {!showBookingPanel && !showWaitingScreen && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <RiderBottomNav />
        </div>
      )}
    </div>
  );
};

export default RiderHomeCustom;
