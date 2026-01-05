/**
 * NewRider - صفحة حجز الراكب الجديدة
 * تدفق حقيقي من الانطلاق إلى الوصول مع شاشة إعداد الرحلة
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, 
  MapPin, 
  Car, 
  CreditCard, 
  Loader2, 
  ArrowRight,
  Clock,
  Route,
  ChevronUp,
  ChevronDown,
  Phone,
  MessageCircle,
  Star,
  X,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useRiderStore } from '@/stores/riderStore';
import RideSetupScreen from '@/components/rider/RideSetupScreen';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// أنواع البيانات
interface Location {
  lat: number;
  lng: number;
  address: string;
  name?: string;
  inService?: boolean;
}

interface LocationResult {
  id: string;
  type: 'landmark' | 'region' | 'address' | 'current';
  name: string;
  name_secondary?: string;
  category?: string;
  lat: number;
  lng: number;
  full_address?: string;
  icon?: string;
  distance_km?: number;
  in_service?: boolean;
  region_name?: string;
}

type BookingStep = 
  | 'setup'      // شاشة إعداد الرحلة
  | 'route_confirmed'  // تم تأكيد المسار
  | 'vehicle_selected'
  | 'booking'
  | 'waiting'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed';

interface VehicleOption {
  id: string;
  name: string;
  icon: string;
  multiplier: number;
  eta: string;
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  { id: 'economy', name: 'اقتصادي', icon: '🚗', multiplier: 1, eta: '3-5 دقائق' },
  { id: 'comfort', name: 'مريح', icon: '🚙', multiplier: 1.3, eta: '5-8 دقائق' },
  { id: 'premium', name: 'فاخر', icon: '🚘', multiplier: 1.8, eta: '8-12 دقيقة' },
  { id: 'women_only', name: 'سيدات فقط', icon: '👩', multiplier: 1.2, eta: '5-10 دقائق' },
];

const NewRider = () => {
  // الحالات
  const [step, setStep] = useState<BookingStep>('setup');
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('economy');
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // الخريطة
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Store
  const { setPickupLocation: setStorePickup, setDropoffLocation: setStoreDropoff } = useRiderStore();

  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // تنظيف الخريطة عند الخروج
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // معالجة تأكيد المسار من شاشة الإعداد
  const handleConfirmRoute = async (pickup: Location, dropoff: Location) => {
    setPickupLocation(pickup);
    setDropoffLocation(dropoff);
    setStorePickup({ lat: pickup.lat, lng: pickup.lng, address: pickup.address });
    setStoreDropoff({ lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address });
    setStep('route_confirmed');
    
    // تهيئة الخريطة إذا لم تكن موجودة
    if (!mapRef.current && mapContainerRef.current) {
      await initializeMap();
    }

    // حساب المسار
    await calculateRoute(pickup, dropoff);
  };

  // تهيئة الخريطة
  const initializeMap = async () => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const response = await fetch(
        'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token',
        {
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo`
          }
        }
      );
      const data = await response.json();
      
      if (data.token) {
        mapboxgl.accessToken = data.token;
        
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [43.2954, 33.4262],
          zoom: 12,
          attributionControl: false
        });

        mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-left');

        mapRef.current.on('load', () => {
          setMapLoaded(true);
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  // إضافة علامات على الخريطة
  const addMarkersToMap = useCallback(() => {
    if (!mapRef.current || !pickupLocation || !dropoffLocation) return;

    // علامة الانطلاق
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
    }
    const pickupEl = document.createElement('div');
    pickupEl.innerHTML = `
      <div style="
        width: 40px; 
        height: 40px; 
        background: linear-gradient(135deg, #10b981, #059669);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        border: 3px solid white;
      ">
        <span style="font-size: 18px;">📍</span>
      </div>
    `;
    pickupMarkerRef.current = new mapboxgl.Marker(pickupEl)
      .setLngLat([pickupLocation.lng, pickupLocation.lat])
      .addTo(mapRef.current);

    // علامة الوصول
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
    }
    const dropoffEl = document.createElement('div');
    dropoffEl.innerHTML = `
      <div style="
        width: 40px; 
        height: 40px; 
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        border: 3px solid white;
      ">
        <span style="font-size: 18px;">🎯</span>
      </div>
    `;
    dropoffMarkerRef.current = new mapboxgl.Marker(dropoffEl)
      .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
      .addTo(mapRef.current);

    // ضبط حدود الخريطة
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([pickupLocation.lng, pickupLocation.lat]);
    bounds.extend([dropoffLocation.lng, dropoffLocation.lat]);
    mapRef.current.fitBounds(bounds, { padding: 80 });
  }, [pickupLocation, dropoffLocation]);

  // إضافة العلامات عند تحميل الخريطة
  useEffect(() => {
    if (mapLoaded && pickupLocation && dropoffLocation) {
      addMarkersToMap();
    }
  }, [mapLoaded, addMarkersToMap]);

  // حساب المسار والسعر
  const calculateRoute = async (pickup: Location, dropoff: Location) => {
    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start_lng=${pickup.lng}&start_lat=${pickup.lat}&end_lng=${dropoff.lng}&end_lat=${dropoff.lat}`,
        {
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo`
          }
        }
      );
      const data = await response.json();
      
      if (data.distance && data.duration) {
        setRouteInfo({
          distance: data.distance,
          duration: data.duration
        });

        // رسم المسار على الخريطة
        if (data.route && mapRef.current) {
          const routeId = 'route-line';
          
          if (mapRef.current.getSource(routeId)) {
            (mapRef.current.getSource(routeId) as mapboxgl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: data.route
            });
          } else {
            mapRef.current.addSource(routeId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: data.route
              }
            });

            mapRef.current.addLayer({
              id: routeId,
              type: 'line',
              source: routeId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#6366f1',
                'line-width': 5,
                'line-opacity': 0.8
              }
            });
          }

          // ضبط حدود الخريطة
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([pickup.lng, pickup.lat]);
          bounds.extend([dropoff.lng, dropoff.lat]);
          mapRef.current.fitBounds(bounds, { padding: 80 });
        }

        // حساب السعر التقديري
        const baseFare = 2000;
        const perKmFare = 500;
        const vehicle = VEHICLE_OPTIONS.find(v => v.id === selectedVehicle);
        const fare = Math.round((baseFare + (data.distance * perKmFare)) * (vehicle?.multiplier || 1));
        setEstimatedFare(fare);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      toast.error('خطأ في حساب المسار');
    }
  };

  // اختيار نوع المركبة
  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    
    if (routeInfo) {
      const vehicle = VEHICLE_OPTIONS.find(v => v.id === vehicleId);
      const baseFare = 2000;
      const perKmFare = 500;
      const fare = Math.round((baseFare + (routeInfo.distance * perKmFare)) * (vehicle?.multiplier || 1));
      setEstimatedFare(fare);
    }
    
    setStep('vehicle_selected');
  };

  // تأكيد الحجز
  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      toast.error('يرجى تحديد موقع الانطلاق والوصول');
      return;
    }

    setIsBooking(true);
    setStep('booking');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        setIsBooking(false);
        setStep('vehicle_selected');
        return;
      }

      // إنشاء الرحلة
      const { data: ride, error } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          pickup_location: { lat: pickupLocation.lat, lng: pickupLocation.lng },
          pickup_address: pickupLocation.address,
          dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          dropoff_address: dropoffLocation.address,
          distance_km: routeInfo?.distance || 0,
          duration_minutes: routeInfo?.duration || 0,
          estimated_fare: estimatedFare,
          payment_method: 'cash',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('تم إرسال طلب الحجز');
      setStep('waiting');

      // الاستماع لتحديثات الرحلة
      const channel = supabase
        .channel(`ride-${ride.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rides',
            filter: `id=eq.${ride.id}`
          },
          (payload) => {
            const newStatus = payload.new.status;
            if (newStatus === 'accepted') {
              setStep('accepted');
              toast.success('تم قبول رحلتك! السائق في الطريق');
            } else if (newStatus === 'arrived') {
              setStep('arrived');
              toast.info('السائق وصل إلى موقعك');
            } else if (newStatus === 'in_progress') {
              setStep('in_progress');
            } else if (newStatus === 'completed') {
              setStep('completed');
              toast.success('تمت الرحلة بنجاح!');
            } else if (newStatus === 'cancelled') {
              setStep('setup');
              toast.error('تم إلغاء الرحلة');
            }
          }
        )
        .subscribe();

      // استدعاء مطابقة السائق
      await supabase.functions.invoke('match-ride', {
        body: { ride_id: ride.id }
      });

    } catch (error) {
      console.error('Booking error:', error);
      toast.error('حدث خطأ أثناء الحجز');
      setStep('vehicle_selected');
    } finally {
      setIsBooking(false);
    }
  };

  // العودة لشاشة الإعداد
  const handleBackToSetup = () => {
    setStep('setup');
    setPickupLocation(null);
    setDropoffLocation(null);
    setRouteInfo(null);
    setEstimatedFare(null);
  };

  // عرض حالة الانتظار
  const renderWaitingState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-8"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-primary to-primary/60 flex items-center justify-center"
      >
        <Car className="h-10 w-10 text-white" />
      </motion.div>
      <h3 className="text-xl font-bold mb-2">جاري البحث عن سائق...</h3>
      <p className="text-muted-foreground">يرجى الانتظار</p>
    </motion.div>
  );

  // شاشة إعداد الرحلة
  if (step === 'setup') {
    return <RideSetupScreen onConfirmRoute={handleConfirmRoute} userId={userId} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background" dir="rtl">
      {/* الخريطة */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 z-0"
      />

      {/* تحميل الخريطة */}
      {!mapLoaded && (
        <div className="absolute inset-0 z-10 bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
          </div>
        </div>
      )}

      {/* زر العودة */}
      <div className="absolute top-4 right-4 z-30">
        <Button
          variant="outline"
          size="icon"
          onClick={handleBackToSetup}
          className="rounded-full bg-background/95 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* لوحة الحجز */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-xl rounded-t-3xl border-t border-border/50 shadow-2xl"
        style={{ maxHeight: '70vh' }}
      >
        {/* مقبض السحب */}
        <div className="w-full flex justify-center py-2">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-4 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>
          {/* حالة الانتظار */}
          {(step === 'waiting' || step === 'booking') && renderWaitingState()}

          {/* حالة تأكيد المسار واختيار المركبة */}
          {(step === 'route_confirmed' || step === 'vehicle_selected') && (
            <>
              {/* ملخص المسار */}
              <div className="mb-4">
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="space-y-3">
                    {/* الانطلاق */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Navigation className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">الانطلاق</p>
                        <p className="text-sm font-medium truncate">{pickupLocation?.address}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center">
                        <div className="w-0.5 h-4 bg-border" />
                      </div>
                    </div>

                    {/* الوصول */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">الوصول</p>
                        <p className="text-sm font-medium truncate">{dropoffLocation?.address}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* معلومات المسار */}
              <AnimatePresence>
                {routeInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <Card className="p-3 bg-muted/30">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-primary" />
                          <span>{routeInfo.distance.toFixed(1)} كم</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>{Math.round(routeInfo.duration)} دقيقة</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* اختيار نوع المركبة */}
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">اختر نوع المركبة</h3>
                <div className="grid grid-cols-2 gap-2">
                  {VEHICLE_OPTIONS.map((vehicle) => (
                    <motion.button
                      key={vehicle.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleVehicleSelect(vehicle.id)}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all text-right",
                        selectedVehicle === vehicle.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{vehicle.icon}</span>
                        <span className="font-medium">{vehicle.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{vehicle.eta}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* السعر وزر الحجز */}
              {estimatedFare && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-between mb-3 p-3 rounded-xl bg-muted/30">
                    <span className="text-muted-foreground">السعر التقديري</span>
                    <span className="text-2xl font-bold text-primary">
                      {estimatedFare.toLocaleString()} د.ع
                    </span>
                  </div>

                  <Button
                    onClick={handleBookRide}
                    disabled={isBooking || !pickupLocation || !dropoffLocation}
                    className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    {isBooking ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        جاري الحجز...
                      </>
                    ) : (
                      <>
                        <Car className="h-5 w-5 ml-2" />
                        احجز الآن
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NewRider;
