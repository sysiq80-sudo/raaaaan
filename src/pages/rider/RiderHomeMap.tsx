/**
 * ران - شاشة الراكب مع الخريطة والعروض الترويجية
 * تصميم يجمع الخريطة الحية مع بانرات العروض
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, MapPin, Search, Navigation, Crown, Car, X, Locate } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Components
import LazyMap from '@/components/LazyMap';
import RiderSideMenu from '@/components/rider/RiderSideMenu';
import RiderBottomNav from '@/components/rider/RiderBottomNav';
import LocationBottomSheet from '@/components/rider/LocationBottomSheet';
import MapLocationPicker from '@/components/rider/MapLocationPicker';
import RideWaitingScreen from '@/components/rider/RideWaitingScreen';
import LiveRideTracker from '@/components/rider/LiveRideTracker';
import CompleteProfileScreen, { isValidName } from '@/components/rider/CompleteProfileScreen';
import ScrollablePromoBanners from '@/components/rider/ScrollablePromoBanners';
import SimplifiedBookingPanel from '@/components/rider/SimplifiedBookingPanel';

// Hooks
import { useFareCalculation } from '@/hooks/useFareCalculation';
import { useOptimizedNearbyDrivers } from '@/hooks/useOptimizedNearbyDrivers';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { useActiveRide } from '@/hooks/useActiveRide';
import { useRideNotifications } from '@/hooks/useRideNotifications';
import { requestNotificationPermission } from '@/utils/rideNotificationSounds';

import logo from '@/assets/logo.png';

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';
type PaymentMethodType = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';

const RiderHomeMap: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth & Profile State
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [userFullName, setUserFullName] = useState('');

  // Location State
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Booking State
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('economy');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('wallet');
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);

  // UI State
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [locationSheetField, setLocationSheetField] = useState<'pickup' | 'dropoff' | 'pickup_only' | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [isBooking, setIsBooking] = useState(false);

  // Hooks
  const { fareBreakdown, fareLoading, setFareBreakdown } = useFareCalculation(
    pickupCoords,
    dropoffCoords,
    selectedVehicle,
    routeDistance
  );
  
  const { nearbyDriversCount, nearbyDriverLocations, availableDriversByType } = useOptimizedNearbyDrivers(
    pickupCoords || userLocation,
    selectedVehicle
  );

  useRiderLocation({ enabled: !!user, updateInterval: 30000 });

  const {
    activeRide,
    setActiveRide,
    pendingRideId,
    setPendingRideId,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    clearActiveRide
  } = useActiveRide(user?.id || null);

  useRideNotifications(user?.id || null);

  // Auth initialization
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Geolocation error:', error)
      );
    }

    requestNotificationPermission();

    return () => subscription.unsubscribe();
  }, []);

  // Check user profile
  useEffect(() => {
    const checkUserProfile = async () => {
      if (!user) {
        setShowCompleteProfile(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();

        const nameFromProfile = profile?.full_name;
        const nameFromAuth = user.user_metadata?.full_name;
        const currentName = nameFromProfile || nameFromAuth;

        setUserFullName(currentName || '');

        if (!isValidName(currentName)) {
          setShowCompleteProfile(true);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
      }
    };

    checkUserProfile();
  }, [user]);

  // Show booking panel when both locations are set
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      setShowBookingPanel(true);
    }
  }, [pickupCoords, dropoffCoords]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleLocationSelect = async (location: { lat: number; lng: number; address: string }, type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickupCoords({ lat: location.lat, lng: location.lng });
      setPickup(location.address);
    } else {
      setDropoffCoords({ lat: location.lat, lng: location.lng });
      setDropoff(location.address);

      // Auto-set pickup to current location if not set
      if (!pickupCoords && userLocation) {
        setPickupCoords({ lat: userLocation.lat, lng: userLocation.lng });
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${userLocation.lat}&lng=${userLocation.lng}`,
            { headers: { 'Content-Type': 'application/json' } }
          );
          const data = await response.json();
          setPickup(data.features?.[0]?.place_name || 'موقعي الحالي');
        } catch {
          setPickup('موقعي الحالي');
        }
      }
    }
    setShowLocationSheet(false);
  };

  const handleBookRide = async () => {
    if (!user || !pickupCoords || !dropoffCoords) return;

    setIsBooking(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .insert([{
          rider_id: user.id,
          pickup_location: pickupCoords,
          dropoff_location: dropoffCoords,
          pickup_address: pickup || null,
          dropoff_address: dropoff || null,
          vehicle_type: selectedVehicle,
          estimated_fare: fareBreakdown?.total_fare || null,
          distance_km: routeDistance || null,
          duration_minutes: routeDuration ? Math.round(routeDuration) : null,
          status: 'pending',
          payment_method: paymentMethod
        } as any])
        .select()
        .single();

      if (error) throw error;

      supabase.functions.invoke('match-ride', { body: { rideId: data.id } });

      setPendingRideId(data.id);
      setShowWaitingScreen(true);

      toast({
        title: 'تم إرسال طلبك! 🚗',
        description: 'جاري البحث عن سائق قريب...'
      });

    } catch (error: any) {
      toast({
        title: 'خطأ في الحجز',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsBooking(false);
    }
  };

  const handleRouteCalculated = (distance: number, duration: number) => {
    setRouteDistance(distance);
    setRouteDuration(duration);
  };

  const resetBooking = () => {
    setPickup('');
    setDropoff('');
    setPickupCoords(null);
    setDropoffCoords(null);
    setRouteDistance(null);
    setRouteDuration(null);
    setShowBookingPanel(false);
    setFareBreakdown(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src={logo} alt="ران" className="w-20 h-20 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (user && showCompleteProfile) {
    return (
      <CompleteProfileScreen
        userId={user.id}
        currentName={userFullName}
        onComplete={(newName) => {
          setUserFullName(newName);
          setShowCompleteProfile(false);
        }}
      />
    );
  }

  // Waiting Screen
  if (showWaitingScreen && pendingRideId) {
    return (
      <RideWaitingScreen
        rideId={pendingRideId}
        pickupAddress={pickup}
        dropoffAddress={dropoff}
        estimatedFare={fareBreakdown?.total_fare || 0}
        onCancel={() => {
          setShowWaitingScreen(false);
          setPendingRideId(null);
          resetBooking();
        }}
        onDriverFound={() => {
          // Will be handled by useActiveRide hook
        }}
      />
    );
  }

  // Live Tracker
  if (showLiveTracker && activeRide) {
    return (
      <LiveRideTracker
        ride={activeRide}
        onClose={() => {
          setShowLiveTracker(false);
          clearActiveRide();
          resetBooking();
        }}
        onRideUpdate={(updatedRide) => {
          setActiveRide(updatedRide);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background relative flex flex-col">
      {/* Full screen map */}
      <div className="absolute inset-0">
        <LazyMap
          className="h-full w-full"
          fallbackHeight="h-full"
          pickupLocation={pickupCoords}
          dropoffLocation={dropoffCoords}
          nearbyDrivers={nearbyDriverLocations}
          onRouteCalculated={handleRouteCalculated}
          draggableMarkers={false}
          selectingLocation={null}
        />
      </div>

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-10" />

      {/* Header */}
      <header className="relative z-40 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowSideMenu(true)}
            className="w-12 h-12 bg-card/90 backdrop-blur-md rounded-2xl shadow-lg flex items-center justify-center border border-border/50"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-border/50">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-inner">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ران</span>
          </div>

          <Badge variant="outline" className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/30 text-primary px-3 py-1.5 text-sm font-bold">
            <Crown className="w-4 h-4 ml-1" />
            RAAN+
          </Badge>
        </div>
      </header>

      {/* Side Menu */}
      <RiderSideMenu
        user={user}
        isOpen={showSideMenu}
        onClose={() => setShowSideMenu(false)}
        onLogout={handleLogout}
      />

      {/* Bottom Content */}
      <div className="relative z-20 mt-auto">
        <div className="px-4 pb-4 space-y-4">
          {/* Promo Banners */}
          {!showBookingPanel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <ScrollablePromoBanners regionId={fareBreakdown?.region_id} />
            </motion.div>
          )}

          {/* Search Box */}
          {!showBookingPanel && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                setLocationSheetField('dropoff');
                setShowLocationSheet(true);
              }}
              className="w-full p-4 bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border/50 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-lg">إلى أين تريد الذهاب؟</p>
                <p className="text-sm text-muted-foreground">ابحث عن وجهتك</p>
              </div>
              <MapPin className="w-6 h-6 text-muted-foreground" />
            </motion.button>
          )}

          {/* Quick Actions */}
          {!showBookingPanel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3"
            >
              <button
                onClick={() => {
                  setMapPickerMode('dropoff');
                  setShowMapPicker(true);
                }}
                className="flex-1 p-3 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 flex items-center justify-center gap-2"
              >
                <MapPin className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">اختر من الخريطة</span>
              </button>
              <button
                onClick={() => {
                  if (userLocation) {
                    setPickupCoords(userLocation);
                    setPickup('موقعي الحالي');
                    setLocationSheetField('dropoff');
                    setShowLocationSheet(true);
                  }
                }}
                className="flex-1 p-3 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 flex items-center justify-center gap-2"
              >
                <Locate className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">موقعي الحالي</span>
              </button>
            </motion.div>
          )}

          {/* Booking Panel */}
          {showBookingPanel && (
            <SimplifiedBookingPanel
              pickup={pickup}
              dropoff={dropoff}
              pickupCoords={pickupCoords}
              dropoffCoords={dropoffCoords}
              routeDistance={routeDistance}
              routeDuration={routeDuration}
              selectedVehicle={selectedVehicle}
              onVehicleSelect={setSelectedVehicle}
              selectedPayment={paymentMethod}
              onPaymentSelect={setPaymentMethod}
              fareBreakdown={fareBreakdown}
              fareLoading={fareLoading}
              nearbyDriversCount={nearbyDriversCount}
              availableDriversByType={availableDriversByType}
              nearbyDriverLocations={nearbyDriverLocations}
              onBook={handleBookRide}
              bookingLoading={isBooking}
              isLoggedIn={!!user}
              onChangePickup={() => {
                setLocationSheetField('pickup');
                setShowLocationSheet(true);
              }}
              onChangeDropoff={() => {
                setLocationSheetField('dropoff');
                setShowLocationSheet(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Location Sheet */}
      <LocationBottomSheet
        isOpen={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        activeField={locationSheetField}
        pickup={pickup}
        dropoff={dropoff}
        onPickupChange={setPickup}
        onDropoffChange={setDropoff}
        onLocationSelect={handleLocationSelect}
        onOpenMapPicker={(type) => {
          setMapPickerMode(type);
          setShowLocationSheet(false);
          setShowMapPicker(true);
        }}
        userLocation={userLocation}
        userId={user?.id || null}
      />

      {/* Map Picker */}
      <AnimatePresence>
        {showMapPicker && (
          <MapLocationPicker
            isOpen={showMapPicker}
            type={mapPickerMode}
            initialLocation={
              mapPickerMode === 'pickup' 
                ? pickupCoords || userLocation 
                : dropoffCoords || userLocation
            }
            userLocation={userLocation}
            onConfirm={(location) => {
              // This is only called for dropoff (pickup uses onPickupConfirmed)
              handleLocationSelect(location, 'dropoff');
              setShowMapPicker(false);
              setMapPickerMode('pickup'); // Reset mode for next time
            }}
            onPickupConfirmed={(location) => {
              // Save pickup but don't close - MapLocationPicker will switch to dropoff mode
              handleLocationSelect(location, 'pickup');
            }}
            onClose={() => setShowMapPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <RiderBottomNav />
    </div>
  );
};

export default RiderHomeMap;
