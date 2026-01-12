/**
 * ران - صفحة الترحيب للراكب مع اختيار الموقع على الخريطة
 * الصفحة الرئيسية للراكب مع واجهة اختيار الموقع
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Settings, MapPin, Navigation, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Components
import LazyMap from '@/components/LazyMap';
import RiderSideMenu from '@/components/rider/RiderSideMenu';
import MapLocationPicker from '@/components/rider/MapLocationPicker';
import SupportButton from '@/components/rider/SupportButton';

// Hooks
import { useRiderLocation } from '@/hooks/useRiderLocation';

const RiderHomeWelcome: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // UI State
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(true);
  const [mapPickerMode, setMapPickerMode] = useState<'pickup' | 'dropoff'>('pickup');

  // Location State
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickup, setPickup] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Get user location
  const { location: userLocation, error: locationError } = useRiderLocation();

  // Get current location function
  const getCurrentLocation = async () => {
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
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setPickupCoords(coords);
        setPickup('موقعك الحالي');
        setIsLocating(false);
        
        toast({
          title: "تم تحديد موقعك",
          description: "موقعك الحالي"
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        toast({
          title: "⚠️ تعذر تحديد الموقع",
          description: "السماح بالوصول للموقع مطلوب",
          variant: "locationError" as any,
          duration: 3000
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle location confirmation from map picker
  const handleLocationConfirm = (location: { lat: number; lng: number; address: string; inService?: boolean }) => {
    setPickupCoords({ lat: location.lat, lng: location.lng });
    setPickup(location.address);
    setShowMapPicker(false);

    // Navigate to the main rider page with the selected location
    navigate('/rider-main', {
      state: {
        pickupCoords: { lat: location.lat, lng: location.lng },
        pickup: location.address
      }
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden flex flex-col bg-background">
      {/* Top Header - Fixed at top with transparent background */}
      <div className="absolute top-0 left-0 right-0 z-30 safe-area-top">
        <div className="p-4 flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            className="bg-background/80 backdrop-blur-md shadow-lg border-border/30 hover:bg-background/90"
            onClick={() => setShowSideMenu(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <h1 className="text-2xl font-bold text-foreground drop-shadow-md">ران</h1>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-md shadow-lg border-border/30 hover:bg-background/90">
              <Bell className="w-5 h-5" />
            </Button>
            <SupportButton />
            <Button
              variant="outline"
              size="icon"
              className="bg-background/80 backdrop-blur-md shadow-lg border-border/30 hover:bg-background/90"
              onClick={() => navigate('/rider/settings')}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Full Screen Map */}
      <div className="h-full w-full relative z-0">
        <Suspense fallback={
          <div className="h-full w-full flex items-center justify-center bg-muted">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
            </div>
          </div>
        }>
          <LazyMap
            className="h-full w-full rounded-none"
            fallbackHeight="h-full"
            pickupLocation={pickupCoords}
            dropoffLocation={null}
            nearbyDrivers={[]}
            onRouteCalculated={() => {}}
            selectingLocation={showMapPicker ? mapPickerMode : null}
            onLocationSelect={() => {}}
            userLocation={pickupCoords}
          />
        </Suspense>
      </div>

      {/* Current Location Button - Near map center pin */}
      <button
        onClick={getCurrentLocation}
        disabled={isLocating}
        className="absolute top-1/2 left-1/2 z-50 w-14 h-14 bg-card/95 backdrop-blur-md rounded-2xl border border-border/50 shadow-2xl flex items-center justify-center hover:bg-accent transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ transform: 'translate(-140%, -50%)' }}
        aria-label="تحديد موقعي الحالي"
      >
        {isLocating ? (
          <div className="animate-spin rounded-full h-6 w-6 border-3 border-primary border-t-transparent" />
        ) : (
          <Navigation className="w-6 h-6 text-primary" />
        )}
      </button>

      {/* Welcome Overlay */}
      <AnimatePresence>
        {showMapPicker && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-0 left-0 right-0 z-20 p-6"
          >
            <div className="bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-border/20">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">مرحباً بك في ران</h2>
                <p className="text-muted-foreground">اختر موقع الانطلاق للبدء</p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <Button
                  onClick={() => setMapPickerMode('pickup')}
                  className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  حدد موقع الانطلاق على الخريطة
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    if (userLocation) {
                      setPickupCoords(userLocation);
                      setPickup('موقعك الحالي');
                      setShowMapPicker(false);
                      navigate('/rider-main', {
                        state: {
                          pickupCoords: userLocation,
                          pickup: 'موقعك الحالي'
                        }
                      });
                    }
                  }}
                  className="w-full h-12"
                  disabled={!userLocation}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  استخدم موقعي الحالي
                </Button>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-muted/50 rounded-xl">
                <p className="text-sm text-muted-foreground text-center">
                  📍 حرك الخريطة لتحديد موقعك بدقة
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Location Picker */}
      <AnimatePresence>
        {showMapPicker && (
          <MapLocationPicker
            isOpen={showMapPicker}
            onClose={() => setShowMapPicker(false)}
            type={mapPickerMode}
            onConfirm={handleLocationConfirm}
            initialLocation={pickupCoords}
            userLocation={userLocation}
          />
        )}
      </AnimatePresence>

      {/* Side Menu */}
      <AnimatePresence>
        {showSideMenu && (
          <RiderSideMenu
            isOpen={showSideMenu}
            onClose={() => setShowSideMenu(false)}
            user={user}
            onLogout={() => {
              setShowSideMenu(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RiderHomeWelcome;