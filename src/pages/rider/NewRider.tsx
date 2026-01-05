/**
 * NewRider - صفحة حجز الراكب الجديدة
 * تدفق حقيقي من الانطلاق إلى الوصول
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
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useRiderStore } from '@/stores/riderStore';
import { SmartSearchBar } from '@/components/rider/SmartSearchBar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// أنواع البيانات
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
  | 'idle' 
  | 'pickup_selected' 
  | 'dropoff_selected' 
  | 'route_calculated'
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
  const [step, setStep] = useState<BookingStep>('idle');
  const [pickupLocation, setPickupLocation] = useState<LocationResult | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationResult | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('economy');
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  // الخريطة
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Store
  const { setPickupLocation: setStorePickup, setDropoffLocation: setStoreDropoff } = useRiderStore();

  // تهيئة الخريطة
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // جلب token من mapbox-proxy
    const initMap = async () => {
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
            center: [43.2954, 33.4262], // بغداد
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
        toast.error('خطأ في تحميل الخريطة');
      }
    };

    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // جلب موقع GPS
  const handleGPSClick = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('الموقع غير متاح في هذا المتصفح');
      return;
    }

    setIsLocatingGPS(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        // تحريك الخريطة
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: 16,
          duration: 1500
        });

        // إضافة/تحديث علامة الانطلاق
        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLngLat([longitude, latitude]);
        } else {
          const el = document.createElement('div');
          el.className = 'pickup-marker';
          el.innerHTML = `
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
          pickupMarkerRef.current = new mapboxgl.Marker(el)
            .setLngLat([longitude, latitude])
            .addTo(mapRef.current!);
        }

        // عكس الترميز للحصول على العنوان
        try {
          const response = await fetch(
            `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=${latitude}&lng=${longitude}`,
            {
              headers: {
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo`
              }
            }
          );
          const data = await response.json();
          
          const address = data.address || 'موقعك الحالي';
          setPickupAddress(address);
          
          const location: LocationResult = {
            id: 'current_location',
            type: 'current',
            name: address,
            lat: latitude,
            lng: longitude,
            in_service: true
          };
          
          setPickupLocation(location);
          setStorePickup({ lat: latitude, lng: longitude, address });
          setStep('pickup_selected');
          
          toast.success('تم تحديد موقعك بنجاح');
        } catch (error) {
          console.error('Reverse geocode error:', error);
          setPickupAddress('موقعك الحالي');
        }

        setIsLocatingGPS(false);
      },
      (error) => {
        console.error('GPS Error:', error);
        toast.error('فشل في الحصول على الموقع');
        setIsLocatingGPS(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [setStorePickup]);

  // اختيار موقع الانطلاق
  const handlePickupSelect = (location: LocationResult) => {
    setPickupLocation(location);
    setPickupAddress(location.name);
    setStorePickup({ lat: location.lat, lng: location.lng, address: location.name });
    
    // تحريك الخريطة
    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: 15,
      duration: 1000
    });

    // إضافة علامة
    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLngLat([location.lng, location.lat]);
    } else if (mapRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
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
      pickupMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current);
    }

    setStep('pickup_selected');
  };

  // اختيار موقع الوصول
  const handleDropoffSelect = async (location: LocationResult) => {
    setDropoffLocation(location);
    setDropoffAddress(location.name);
    setStoreDropoff({ lat: location.lat, lng: location.lng, address: location.name });
    
    // إضافة علامة الوصول
    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.setLngLat([location.lng, location.lat]);
    } else if (mapRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
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
      dropoffMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current);
    }

    setStep('dropoff_selected');

    // حساب المسار
    if (pickupLocation) {
      await calculateRoute(pickupLocation, location);
    }
  };

  // حساب المسار والسعر
  const calculateRoute = async (pickup: LocationResult, dropoff: LocationResult) => {
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
        
        setStep('route_calculated');
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
          pickup_address: pickupAddress,
          dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          dropoff_address: dropoffAddress,
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
              setStep('idle');
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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
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

      {/* لوحة الحجز */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: showPanel ? 0 : 'calc(100% - 60px)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-xl rounded-t-3xl border-t border-border/50 shadow-2xl"
        style={{ maxHeight: '70vh' }}
      >
        {/* مقبض السحب */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="w-full flex justify-center py-2"
        >
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </button>

        <div className="px-4 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>
          {/* حالة الانتظار */}
          {(step === 'waiting' || step === 'booking') && renderWaitingState()}

          {/* حالة الحجز العادية */}
          {!['waiting', 'booking', 'accepted', 'arrived', 'in_progress', 'completed'].includes(step) && (
            <>
              {/* شريط بحث الانطلاق */}
              <div className="mb-3">
                <SmartSearchBar
                  type="pickup"
                  value={pickupAddress}
                  placeholder="ابحث عن مكان الانطلاق..."
                  userLocation={userLocation}
                  onLocationSelect={handlePickupSelect}
                  onGPSClick={handleGPSClick}
                  isLocating={isLocatingGPS}
                />
              </div>

              {/* شريط بحث الوصول */}
              <div className="mb-4">
                <SmartSearchBar
                  type="dropoff"
                  value={dropoffAddress}
                  placeholder="ابحث عن مكان الوصول..."
                  userLocation={userLocation}
                  onLocationSelect={handleDropoffSelect}
                  disabled={!pickupLocation}
                />
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
              <AnimatePresence>
                {(step === 'route_calculated' || step === 'vehicle_selected') && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mb-4"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* السعر وزر الحجز */}
              <AnimatePresence>
                {estimatedFare && step !== 'idle' && step !== 'pickup_selected' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
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
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NewRider;
