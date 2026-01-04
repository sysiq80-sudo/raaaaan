import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Map from '@/components/Map';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Navigation, 
  Phone, 
  MessageCircle, 
  MapPin,
  Clock,
  User,
  Car,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LiveRideTrackerProps {
  rideId: string;
  userType: 'rider' | 'driver';
  onRideComplete?: () => void;
}

interface RideData {
  id: string;
  status: string;
  driver_id: string | null;
  rider_id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  started_at: string | null;
  driver?: {
    id: string;
    full_name: string;
    phone: string;
    vehicle_model: string | null;
    vehicle_color: string | null;
    vehicle_plate: string | null;
    rating: number;
    current_location: { lat: number; lng: number } | null;
  };
}

export const LiveRideTracker = ({ rideId, userType, onRideComplete }: LiveRideTrackerProps) => {
  const { toast } = useToast();
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const channelRef = useRef<any>(null);

  // جلب بيانات الرحلة
  useEffect(() => {
    fetchRideData();
  }, [rideId]);

  // الاشتراك في تحديثات الموقع الحية
  useEffect(() => {
    if (!ride?.driver_id) return;

    console.log('🔴 Subscribing to driver location updates:', ride.driver_id);

    // الاشتراك في تحديثات موقع السائق
    const channel = supabase
      .channel(`driver-location-${ride.driver_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${ride.driver_id}`
        },
        (payload) => {
          console.log('📍 Driver location updated:', payload.new.current_location);
          const newLocation = payload.new.current_location as { lat: number; lng: number };
          if (newLocation) {
            setDriverLocation(newLocation);
            calculateETA(newLocation);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`
        },
        (payload) => {
          console.log('🚗 Ride status updated:', payload.new.status);
          const newStatus = payload.new.status as string;
          
          // تحديث حالة الرحلة
          setRide(prev => prev ? { ...prev, status: newStatus } : null);
          
          // إشعارات حسب الحالة
          if (newStatus === 'arrived') {
            toast({
              title: "السائق وصل! 🎯",
              description: "السائق في موقع الانطلاق"
            });
            playArrivalSound();
          } else if (newStatus === 'in_progress') {
            toast({
              title: "الرحلة بدأت! 🚗",
              description: "أنت الآن في الطريق"
            });
          } else if (newStatus === 'completed') {
            toast({
              title: "وصلت بسلامة! ✅",
              description: "تم إكمال الرحلة بنجاح"
            });
            if (onRideComplete) {
              onRideComplete();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('🔴 Unsubscribing from location updates');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ride?.driver_id, rideId]);

  const fetchRideData = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          driver:drivers(
            id,
            full_name,
            phone,
            vehicle_model,
            vehicle_color,
            vehicle_plate,
            rating,
            current_location
          )
        `)
        .eq('id', rideId)
        .single();

      if (error) throw error;

      setRide(data as unknown as RideData);
      
      // تعيين موقع السائق الحالي
      if (data.driver?.current_location) {
        const location = data.driver.current_location as { lat: number; lng: number };
        setDriverLocation(location);
        calculateETA(location);
      }

    } catch (error) {
      console.error('Error fetching ride:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل بيانات الرحلة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateETA = async (driverLoc: { lat: number; lng: number }) => {
    if (!ride) return;

    try {
      // تحديد الوجهة بناءً على حالة الرحلة
      const destination = ride.status === 'accepted' || ride.status === 'arrived'
        ? ride.pickup_location
        : ride.dropoff_location;

      // استخدام Mapbox Directions API
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${driverLoc.lng},${driverLoc.lat}&end=${destination.lng},${destination.lat}`
      );
      
      const data = await response.json();
      
      if (data.routes?.[0]) {
        const route = data.routes[0];
        setDistance(parseFloat((route.distance / 1000).toFixed(1)));
        setEta(Math.round(route.duration / 60));
      }
    } catch (error) {
      console.error('Error calculating ETA:', error);
    }
  };

  const playArrivalSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.log('Audio not supported');
    }

    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'في انتظار سائق',
      accepted: 'السائق في الطريق إليك',
      arrived: 'السائق وصل',
      in_progress: 'جارية',
      completed: 'مكتملة',
      cancelled: 'ملغية'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'bg-amber-500',
      accepted: 'bg-blue-500',
      arrived: 'bg-green-500',
      in_progress: 'bg-primary',
      completed: 'bg-green-600',
      cancelled: 'bg-destructive'
    };
    return colorMap[status] || 'bg-muted';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">جاري تحميل بيانات الرحلة...</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">الرحلة غير موجودة</h3>
            <p className="text-muted-foreground">لم نتمكن من العثور على هذه الرحلة</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* الخريطة */}
      <div className="absolute inset-0">
        <Map
          className="h-full"
          pickupLocation={ride.pickup_location}
          dropoffLocation={ride.dropoff_location}
          driverLocation={driverLocation}
          showRoute={true}
          centerOnDriver={ride.status === 'accepted' || ride.status === 'arrived'}
        />
      </div>

      {/* شريط الحالة العلوي */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(ride.status)} animate-pulse`} />
                <div>
                  <p className="font-bold text-foreground">{getStatusText(ride.status)}</p>
                  {eta !== null && distance !== null && (
                    <p className="text-sm text-muted-foreground">
                      {distance} كم • حوالي {eta} دقيقة
                    </p>
                  )}
                </div>
              </div>
              {ride.status === 'in_progress' && (
                <div className="flex items-center gap-2 text-primary">
                  <Navigation className="w-5 h-5 animate-pulse" />
                  <span className="text-sm font-medium">في الطريق</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* معلومات السائق (للراكب فقط) */}
      {userType === 'rider' && ride.driver && (
        <div className="absolute bottom-0 left-0 right-0 z-40 p-4">
          <Card className="border-0 shadow-2xl">
            <CardContent className="p-4 space-y-4">
              {/* معلومات السائق */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  👤
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">{ride.driver.full_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Car className="w-4 h-4" />
                    <span>
                      {ride.driver.vehicle_color} {ride.driver.vehicle_model}
                    </span>
                  </div>
                  {ride.driver.vehicle_plate && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {ride.driver.vehicle_plate}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl">⭐</span>
                    <span className="text-lg font-bold">{ride.driver.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* أزرار الاتصال */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`tel:${ride.driver?.phone}`)}
                >
                  <Phone className="w-4 h-4 ml-2" />
                  اتصال
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`sms:${ride.driver?.phone}`)}
                >
                  <MessageCircle className="w-4 h-4 ml-2" />
                  رسالة
                </Button>
              </div>

              {/* معلومات الرحلة */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">من</p>
                    <p className="text-sm text-foreground">{ride.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-destructive shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">إلى</p>
                    <p className="text-sm text-foreground">{ride.dropoff_address}</p>
                  </div>
                </div>
              </div>

              {/* السعر */}
              {ride.estimated_fare && (
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-sm text-muted-foreground">السعر المتوقع</span>
                  <span className="text-lg font-bold text-primary">
                    {ride.estimated_fare.toLocaleString()} د.ع
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* معلومات الراكب (للسائق فقط) */}
      {userType === 'driver' && (
        <div className="absolute bottom-0 left-0 right-0 z-40 p-4">
          <Card className="border-0 shadow-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">راكب</p>
                  <p className="text-sm text-muted-foreground">
                    {ride.status === 'accepted' ? 'في انتظارك' : 'في الرحلة'}
                  </p>
                </div>
              </div>

              {/* الوجهة */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">الوجهة</p>
                    <p className="text-sm font-medium text-foreground">{ride.dropoff_address}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LiveRideTracker;
