import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import LazyMap from "@/components/LazyMap";
import LocationBottomSheet from "@/components/rider/LocationBottomSheet";
import MapLocationPicker from "@/components/rider/MapLocationPicker";
import RideWaitingScreen from "@/components/rider/RideWaitingScreen";
import LiveRideTracker from "@/components/rider/LiveRideTracker";
import UnifiedSearchOverlay from "@/components/rider/UnifiedSearchOverlay";
import SimplifiedBookingPanel from "@/components/rider/SimplifiedBookingPanel";
import { useRideNotifications } from "@/hooks/useRideNotifications";
import { useActiveRide } from "@/hooks/useActiveRide";
import { useOptimizedNearbyDrivers } from "@/hooks/useOptimizedNearbyDrivers";
import { useFareCalculation } from "@/hooks/useFareCalculation";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import ActiveRideButton from "@/components/rider/ActiveRideButton";
import CompleteProfileScreen, { isValidName } from "@/components/rider/CompleteProfileScreen";
import { requestNotificationPermission } from "@/utils/rideNotificationSounds";
import { useToast } from "@/hooks/use-toast";
import { Car, Menu, X } from "lucide-react";
import { SaveDestinationPrompt } from "@/components/rider/SaveDestinationPrompt";
import RiderBottomNav from "@/components/rider/RiderBottomNav";
import logo from "@/assets/logo.png";

type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';
type PaymentMethod = 'cash' | 'wallet' | 'card' | 'zain_cash' | 'super_key' | 'nas_wallet';

const RiderHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Profile completion state
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [userFullName, setUserFullName] = useState<string | null>(null);

  // Location state
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // UI state
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [activeLocationField, setActiveLocationField] = useState<'pickup' | 'dropoff' | 'pickup_only' | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerType, setMapPickerType] = useState<'pickup' | 'dropoff'>('pickup');
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [showSaveLocationDialog, setShowSaveLocationDialog] = useState(false);

  // Booking state
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('economy');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Use custom hooks
  const { fareBreakdown, fareLoading, setFareBreakdown } = useFareCalculation(
    pickupCoords,
    dropoffCoords,
    selectedVehicle,
    routeDistance
  );

  const { nearbyDriversCount, availableDriversByType, nearbyDriverLocations } = useOptimizedNearbyDrivers(
    pickupCoords || userLocation,
    selectedVehicle,
    { enableRealtime: true, debounceMs: 500, throttleMs: 1000 }
  );

  // Track rider location and update database
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

  // Enable real-time ride notifications
  useRideNotifications(user?.id || null);

  // Auth and location initialization
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

    // Request notification permission
    requestNotificationPermission();

    return () => subscription.unsubscribe();
  }, []);

  // Check if user has a valid name
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

        setUserFullName(currentName);

        if (!isValidName(currentName)) {
          setShowCompleteProfile(true);
        } else {
          setShowCompleteProfile(false);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        if (!isValidName(user.user_metadata?.full_name)) {
          setShowCompleteProfile(true);
        }
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
    navigate("/");
  };

  const handleBookRide = async () => {
    if (!user || !pickupCoords || !dropoffCoords) return;

    setBookingLoading(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .insert([{
          rider_id: user.id,
          pickup_location: { lat: pickupCoords.lat, lng: pickupCoords.lng },
          dropoff_location: { lat: dropoffCoords.lat, lng: dropoffCoords.lng },
          pickup_address: pickup || null,
          dropoff_address: dropoff || null,
          vehicle_type: selectedVehicle,
          estimated_fare: fareBreakdown?.total_fare || null,
          distance_km: routeDistance || null,
          duration_minutes: routeDuration ? Math.round(routeDuration) : null,
          status: 'pending',
          payment_method: selectedPayment
        } as any])
        .select()
        .single();

      if (error) throw error;

      console.log('🔍 بدء مطابقة الرحلة:', data.id);

      supabase.functions.invoke('match-ride', {
        body: { rideId: data.id }
      }).then(({ data: matchData, error: matchError }) => {
        if (matchError) {
          console.error('خطأ في مطابقة الرحلة:', matchError);
        } else {
          console.log('✅ نتيجة المطابقة:', matchData);
        }
      });

      setPendingRideId(data.id);
      setShowWaitingScreen(true);

      toast({
        title: "تم إرسال طلبك! 🚗",
        description: "جاري البحث عن سائق قريب..."
      });

    } catch (error: any) {
      console.error("Booking error:", error);
      toast({
        title: "خطأ في الحجز",
        description: error.message || "حدث خطأ أثناء إرسال الطلب",
        variant: "destructive"
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleRouteCalculated = (distance: number, duration: number) => {
    setRouteDistance(distance);
    setRouteDuration(duration);
  };

  const handleOpenLocationSheet = (field: 'pickup' | 'dropoff' | 'pickup_only') => {
    setActiveLocationField(field);
    setShowLocationSheet(true);
  };

  const handleLocationSelect = async (location: { lat: number; lng: number; address: string }, type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickupCoords({ lat: location.lat, lng: location.lng });
      setPickup(location.address);
      if (!dropoffCoords) {
        setActiveLocationField('dropoff');
      } else {
        setShowLocationSheet(false);
      }
    } else {
      setDropoffCoords({ lat: location.lat, lng: location.lng });
      setDropoff(location.address);
      setShowLocationSheet(false);

      // Auto-set pickup to current location if not set
      if (!pickupCoords && userLocation) {
        setPickupCoords({ lat: userLocation.lat, lng: userLocation.lng });
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${userLocation.lat}&lng=${userLocation.lng}`,
            { headers: { 'Content-Type': 'application/json' } }
          );
          const data = await response.json();
          const address = data.features?.[0]?.place_name || 'موقعي الحالي';
          setPickup(address);

          toast({
            title: "📍 تم تعيين موقع الانطلاق",
            description: "تم تحديد موقعك الحالي كنقطة انطلاق.",
          });
        } catch {
          setPickup('موقعي الحالي');
        }
      }
    }
  };

  const handleDestinationSelect = async (location: { lat: number; lng: number; address: string }) => {
    setDropoffCoords({ lat: location.lat, lng: location.lng });
    setDropoff(location.address);

    // Auto-set pickup to current location
    if (userLocation) {
      setPickupCoords({ lat: userLocation.lat, lng: userLocation.lng });
      try {
        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${userLocation.lat}&lng=${userLocation.lng}`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        const data = await response.json();
        const address = data.features?.[0]?.place_name || 'موقعي الحالي';
        setPickup(address);
      } catch {
        setPickup('موقعي الحالي');
      }
    }
  };

  const handleSwapLocations = () => {
    const tempCoords = pickupCoords;
    setPickupCoords(dropoffCoords);
    setDropoffCoords(tempCoords);

    const tempAddress = pickup;
    setPickup(dropoff);
    setDropoff(tempAddress);

    toast({
      title: "🔄 تم تبديل المواقع",
      description: "تم عكس موقع الانطلاق والوجهة",
    });
  };

  const handleOpenMapPicker = (type: 'pickup' | 'dropoff') => {
    setMapPickerType(type);
    setShowLocationSheet(false);
    setShowMapPicker(true);
  };

  const handleMapPickerConfirm = (location: { lat: number; lng: number; address: string }) => {
    // This is only called for dropoff (pickup uses onPickupConfirmed)
    handleLocationSelect(location, 'dropoff');
    setShowMapPicker(false);
    setMapPickerType('pickup'); // Reset mode for next time
  };

  const handlePickupConfirmed = (location: { lat: number; lng: number; address: string }) => {
    // Save pickup location but don't close - MapLocationPicker will switch to dropoff mode
    setPickupCoords({ lat: location.lat, lng: location.lng });
    setPickup(location.address);
  };

  const handleMarkerDrag = (type: 'pickup' | 'dropoff', location: { lat: number; lng: number; address?: string }) => {
    if (type === 'pickup') {
      setPickupCoords({ lat: location.lat, lng: location.lng });
      setPickup(location.address || '');
    } else {
      setDropoffCoords({ lat: location.lat, lng: location.lng });
      setDropoff(location.address || '');
    }
    toast({
      title: type === 'pickup' ? "تم تحديث موقع الانطلاق" : "تم تحديث الوجهة",
      description: location.address || 'موقع جديد',
    });
  };

  const resetBookingForm = () => {
    setPickup("");
    setDropoff("");
    setPickupCoords(null);
    setDropoffCoords(null);
    setFareBreakdown(null);
    setRouteDistance(null);
    setRouteDuration(null);
    setShowBookingPanel(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src={logo} alt="RAAN" className="w-20 h-20 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Show complete profile screen if user doesn't have a valid name
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

  return (
    <div className="h-screen w-full overflow-hidden bg-background relative flex flex-col">
      {/* Full screen map - ALWAYS visible */}
      <div className="absolute inset-0">
        <LazyMap
          className="h-full w-full"
          fallbackHeight="h-full"
          pickupLocation={pickupCoords}
          dropoffLocation={dropoffCoords}
          nearbyDrivers={nearbyDriverLocations}
          onRouteCalculated={handleRouteCalculated}
          onMarkerDrag={handleMarkerDrag}
          draggableMarkers={pickupCoords !== null && dropoffCoords !== null}
          selectingLocation={null}
        />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />

      {/* Active Ride Floating Button */}
      {activeRide && !showLiveTracker && !showWaitingScreen && (
        <ActiveRideButton
          activeRide={activeRide}
          onClick={() => setShowLiveTracker(true)}
        />
      )}

      {/* Header */}
      <header className="relative z-40 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-12 h-12 bg-card/90 backdrop-blur-md rounded-2xl shadow-lg flex items-center justify-center border border-border/50"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-border/50">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-inner">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">ران</span>
          </div>
          <div className="w-12" />
        </div>
      </header>

      {/* Sidebar Menu */}
      <RiderSideMenu
        user={user}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />

      {/* Unified Search Overlay - shows when no booking in progress */}
      {!showBookingPanel && !activeRide && !showWaitingScreen && !showLiveTracker && (
        <UnifiedSearchOverlay
          userId={user?.id || null}
          userLocation={userLocation}
          onLocationSelect={handleDestinationSelect}
          onOpenMapPicker={() => {
            setMapPickerType('dropoff');
            setShowMapPicker(true);
          }}
          placeholder="إلى أين تريد الذهاب؟"
          nearbyDriversCount={nearbyDriversCount || 0}
          nearbyDriverLocations={nearbyDriverLocations}
        />
      )}

      {/* Simplified Booking Panel */}
      {showBookingPanel && !showWaitingScreen && !showLiveTracker && (
        <div className="relative z-20 mt-auto">
          <SimplifiedBookingPanel
            pickup={pickup}
            dropoff={dropoff}
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            routeDistance={routeDistance}
            routeDuration={routeDuration}
            selectedVehicle={selectedVehicle}
            onVehicleSelect={setSelectedVehicle}
            selectedPayment={selectedPayment}
            onPaymentSelect={setSelectedPayment}
            fareBreakdown={fareBreakdown}
            fareLoading={fareLoading}
            nearbyDriversCount={nearbyDriversCount}
            availableDriversByType={availableDriversByType}
            nearbyDriverLocations={nearbyDriverLocations}
            onBook={handleBookRide}
            bookingLoading={bookingLoading}
            isLoggedIn={!!user}
            onChangePickup={() => handleOpenLocationSheet('pickup')}
            onChangeDropoff={() => handleOpenLocationSheet('dropoff')}
          />
        </div>
      )}

      {/* Location Bottom Sheet */}
      <LocationBottomSheet
        isOpen={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        activeField={activeLocationField}
        pickup={pickup}
        dropoff={dropoff}
        onPickupChange={setPickup}
        onDropoffChange={setDropoff}
        onLocationSelect={handleLocationSelect}
        onOpenMapPicker={handleOpenMapPicker}
        onSwapLocations={handleSwapLocations}
        userLocation={userLocation}
        pickupCoords={pickupCoords}
        dropoffCoords={dropoffCoords}
        userId={user?.id}
      />

      {/* Map Location Picker */}
      <MapLocationPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        type={mapPickerType}
        onConfirm={handleMapPickerConfirm}
        onPickupConfirmed={handlePickupConfirmed}
        initialLocation={mapPickerType === 'pickup' ? pickupCoords : dropoffCoords}
        userLocation={userLocation}
      />

      {/* Ride Waiting Screen */}
      {showWaitingScreen && pendingRideId && (
        <RideWaitingScreen
          rideId={pendingRideId}
          pickupAddress={activeRide?.pickup_address || pickup}
          dropoffAddress={activeRide?.dropoff_address || dropoff}
          estimatedFare={activeRide?.estimated_fare || fareBreakdown?.total_fare || 0}
          onCancel={() => {
            setShowWaitingScreen(false);
            setPendingRideId(null);
            setActiveRide(null);
            resetBookingForm();
          }}
          onDriverFound={async () => {
            setShowWaitingScreen(false);

            const { data: ride } = await supabase
              .from('rides')
              .select('*')
              .eq('id', pendingRideId)
              .single();

            if (ride) {
              const rideData = ride as any;
              setActiveRide({
                id: rideData.id,
                pickup_location: rideData.pickup_location,
                dropoff_location: rideData.dropoff_location,
                pickup_address: rideData.pickup_address,
                dropoff_address: rideData.dropoff_address,
                status: rideData.status,
                estimated_fare: rideData.estimated_fare,
                final_fare: rideData.final_fare,
                distance_km: rideData.distance_km,
                duration_minutes: rideData.duration_minutes,
                vehicle_type: rideData.vehicle_type,
                driver_id: rideData.driver_id,
                created_at: rideData.created_at,
                completed_at: rideData.completed_at,
                driver_rating: rideData.driver_rating
              });
              setShowLiveTracker(true);

              toast({
                title: "تم قبول طلبك! 🚗",
                description: "السائق في طريقه إليك الآن",
              });
            }
          }}
        />
      )}

      <AnimatePresence>
        {showLiveTracker && activeRide && (
          <LiveRideTracker
            ride={activeRide}
            onClose={() => {
              setShowLiveTracker(false);
              if (activeRide.status === 'completed') {
                clearActiveRide();
                resetBookingForm();
              }
            }}
            onRideUpdate={setActiveRide}
          />
        )}
      </AnimatePresence>

      {/* Save Location Dialog */}
      {showSaveLocationDialog && userLocation && user && (
        <SaveDestinationPrompt
          isOpen={showSaveLocationDialog}
          onClose={() => setShowSaveLocationDialog(false)}
          userId={user.id}
          destination={{
            lat: userLocation.lat,
            lng: userLocation.lng,
            address: pickup || 'موقعي الحالي'
          }}
        />
      )}

      {/* Bottom Navigation */}
      <RiderBottomNav />
    </div>
  );
};

export default RiderHome;
