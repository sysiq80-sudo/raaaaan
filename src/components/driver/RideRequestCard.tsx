import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Clock, 
  Wallet,
  User,
  X,
  Check,
  Navigation,
  Loader2
} from "lucide-react";

interface PendingRide {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  created_at: string;
  rider_id: string;
  distance_to_pickup?: number; // Distance from driver to pickup
  eta_to_pickup?: number; // ETA in minutes
}

interface RideRequestCardProps {
  driverId: string;
  vehicleType: string | null;
  isOnline: boolean;
  driverLocation?: { lat: number; lng: number } | null;
  onRideAccepted?: () => void;
}

const getLocationString = (location: unknown): string => {
  if (typeof location === 'object' && location !== null && 'lat' in location && 'lng' in location) {
    const loc = location as { lat: number; lng: number };
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  }
  return '';
};

const getVehicleTypeName = (type: string) => {
  const types: Record<string, string> = {
    economy: 'اقتصادي',
    comfort: 'مريح',
    premium: 'فاخر',
    women_only: 'نسائي'
  };
  return types[type] || type;
};

export const RideRequestCard = ({ driverId, vehicleType, isOnline, driverLocation, onRideAccepted }: RideRequestCardProps) => {
  const { toast } = useToast();
  const [pendingRide, setPendingRide] = useState<PendingRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxSearchRadius, setMaxSearchRadius] = useState<number>(10);
  const [distanceToPickup, setDistanceToPickup] = useState<number | null>(null);
  const [etaToPickup, setEtaToPickup] = useState<number | null>(null);

  // دالة للتحقق من مطابقة نوع السيارة (السائق الأعلى يخدم الطلبات الأدنى)
  const canDriverServeRide = useCallback((driverType: string | null, rideType: string): boolean => {
    if (!driverType) return true;
    
    // حالة خاصة: التكسي النسائي
    if (driverType === 'women_only') return rideType === 'women_only';
    if (rideType === 'women_only') return driverType === 'women_only';
    
    const typeHierarchy: Record<string, number> = { 'economy': 1, 'comfort': 2, 'premium': 3 };
    const driverLevel = typeHierarchy[driverType] || 1;
    const rideLevel = typeHierarchy[rideType] || 1;
    
    return rideLevel <= driverLevel;
  }, []);

  // Calculate distance to pickup when ride and driver location are available
  const calculateDistanceToPickup = useCallback(async (
    pickupLat: number, 
    pickupLng: number
  ) => {
    if (!driverLocation) return;

    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=directions&start=${driverLocation.lng},${driverLocation.lat}&end=${pickupLng},${pickupLat}`
      );
      const data = await response.json();
      
      if (data.routes?.[0]) {
        const route = data.routes[0];
        setDistanceToPickup(parseFloat((route.distance / 1000).toFixed(1)));
        setEtaToPickup(Math.round(route.duration / 60));
      }
    } catch (error) {
      console.error('Error calculating distance to pickup:', error);
    }
  }, [driverLocation]);

  // Fetch max search radius from settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'max_search_radius')
        .single();
      
      if (data?.value) {
        const value = typeof data.value === 'number' ? data.value : 
                      typeof data.value === 'string' ? parseInt(data.value as string) : 10;
        setMaxSearchRadius(value || 10);
      }
    };
    fetchSettings();
  }, []);

  // Fetch pending rides with geographical filtering
  const fetchPendingRides = useCallback(async () => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }

    try {
      // If driver has location, use geographical filtering
      if (driverLocation) {
        const { data, error } = await supabase.rpc('get_nearby_pending_rides', {
          driver_lat: driverLocation.lat,
          driver_lng: driverLocation.lng,
          max_radius_km: maxSearchRadius,
          driver_vehicle_type: (vehicleType || 'economy') as 'economy' | 'comfort' | 'premium' | 'women_only'
        });

        if (!error && data && data.length > 0) {
          const ride = data[0];
          const newRide: PendingRide = {
            id: ride.id,
            pickup_location: ride.pickup_location as { lat: number; lng: number },
            dropoff_location: ride.dropoff_location as { lat: number; lng: number },
            pickup_address: ride.pickup_address,
            dropoff_address: ride.dropoff_address,
            estimated_fare: ride.estimated_fare,
            distance_km: ride.distance_km ? Number(ride.distance_km) : null,
            duration_minutes: ride.duration_minutes,
            vehicle_type: ride.vehicle_type || 'economy',
            created_at: ride.created_at,
            rider_id: ride.rider_id || ''
          };
          setPendingRide(newRide);
          setTimeLeft(30);
          
          // Calculate distance to pickup
          const pickupLoc = ride.pickup_location as { lat: number; lng: number };
          calculateDistanceToPickup(pickupLoc.lat, pickupLoc.lng);
          return;
        }
      } else {
        // Fallback to old method if no location
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("status", "pending")
          .is("driver_id", null)
          .order("created_at", { ascending: true })
          .limit(1);

        if (!error && data && data.length > 0) {
          const ride = data[0];
          // منطق مطابقة نوع السيارة المحسّن
          const canServe = canDriverServeRide(vehicleType, ride.vehicle_type || 'economy');
          
          if (canServe) {
            const newRide: PendingRide = {
              id: ride.id,
              pickup_location: ride.pickup_location as { lat: number; lng: number },
              dropoff_location: ride.dropoff_location as { lat: number; lng: number },
              pickup_address: ride.pickup_address,
              dropoff_address: ride.dropoff_address,
              estimated_fare: ride.estimated_fare,
              distance_km: ride.distance_km ? Number(ride.distance_km) : null,
              duration_minutes: ride.duration_minutes,
              vehicle_type: ride.vehicle_type || 'economy',
              created_at: ride.created_at,
              rider_id: ride.rider_id || ''
            };
            setPendingRide(newRide);
            setTimeLeft(30);
            
            // Calculate distance to pickup
            const pickupLoc = ride.pickup_location as { lat: number; lng: number };
            calculateDistanceToPickup(pickupLoc.lat, pickupLoc.lng);
            return;
          }
        }
      }
      
      setPendingRide(null);
      setDistanceToPickup(null);
      setEtaToPickup(null);
    } catch (error) {
      console.error("Error fetching rides:", error);
      setPendingRide(null);
    }
  }, [isOnline, vehicleType, driverLocation, maxSearchRadius, calculateDistanceToPickup]);

  // Play notification sound when new ride arrives
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (frequency: number, duration: number, startTime: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      playTone(523.25, 0.15, now);
      playTone(659.25, 0.15, now + 0.15);
      playTone(783.99, 0.3, now + 0.3);
    } catch (e) {
      console.log('Audio not supported');
    }

    // Vibrate
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  // Listen for new rides with INSTANT realtime
  useEffect(() => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }

    // Fetch immediately on mount
    fetchPendingRides();

    // Setup realtime subscription for INSTANT updates
    const channel = supabase
      .channel('driver-pending-rides-instant')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('⚡ NEW RIDE INSERTED:', payload.new?.id);
          playNotificationSound();
          // Fetch immediately - don't wait
          fetchPendingRides();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides'
        },
        (payload) => {
          // If current ride was taken by another driver, fetch next
          if (pendingRide && payload.new?.id === pendingRide.id) {
            if (payload.new?.status !== 'pending' || payload.new?.driver_id) {
              console.log('Current ride taken, fetching next...');
              setPendingRide(null);
              fetchPendingRides();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔴 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connected - will receive instant ride updates');
        }
      });

    // Also poll every 5 seconds as backup (reduced from default)
    const pollInterval = setInterval(() => {
      if (!pendingRide) {
        fetchPendingRides();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [isOnline, fetchPendingRides, playNotificationSound, pendingRide]);

  // Countdown timer
  useEffect(() => {
    if (!pendingRide) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-skip after timeout
          setPendingRide(null);
          fetchPendingRides();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingRide, fetchPendingRides]);

  const handleAccept = async () => {
    if (!pendingRide) return;

    setLoading(true);
    setActionType('accept');

    try {
      // استخدام الدالة الآمنة لقبول الرحلة (تمنع Race Condition)
      const { data: result, error } = await supabase.rpc('accept_ride_safely', {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId
      });

      if (error) throw error;

      // التحقق من نجاح العملية
      const response = result as { success: boolean; error?: string; message?: string };
      
      if (!response.success) {
        toast({
          title: "لم يتم قبول الطلب",
          description: response.error || "تم قبول الطلب من سائق آخر",
          variant: "destructive"
        });
        fetchPendingRides();
        return;
      }

      // ⚡ INSTANT: إرسال إشعار broadcast للراكب بأن السائق قبل الطلب
      try {
        const commChannel = supabase.channel(`ride-comm-${pendingRide.id}`, {
          config: { broadcast: { self: false } }
        });
        
        // Subscribe and wait for confirmation before sending
        await new Promise<void>((resolve) => {
          commChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
        });
        
        // Send acceptance broadcast
        await commChannel.send({
          type: 'broadcast',
          event: 'ride_accepted',
          payload: { 
            driverId, 
            message: 'تم قبول طلبك! السائق في الطريق إليك',
            timestamp: new Date().toISOString()
          }
        });
        
        console.log('[Driver] ⚡ INSTANT: Sent ride_accepted broadcast to rider');
        
        // Small delay to ensure message is delivered before removing channel
        await new Promise(resolve => setTimeout(resolve, 200));
        supabase.removeChannel(commChannel);
      } catch (broadcastError) {
        console.error('Error sending acceptance broadcast:', broadcastError);
      }

      toast({
        title: "تم قبول الطلب! ✅",
        description: "توجه إلى موقع العميل"
      });

      // إعلام المكون الأب بأنه تم قبول الرحلة
      if (onRideAccepted) {
        onRideAccepted();
      }

      setPendingRide(null);
    } catch (error: any) {
      console.error("Accept error:", error);
      toast({
        title: "خطأ",
        description: "تم قبول الطلب من سائق آخر",
        variant: "destructive"
      });
      fetchPendingRides();
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!pendingRide) return;
    
    setLoading(true);
    setActionType('reject');

    try {
      // تسجيل رفض السائق في matching log
      await supabase.rpc('update_driver_response', {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
        p_response: 'rejected'
      });
    } catch (error) {
      console.error('Error logging rejection:', error);
    }

    // تخطي الطلب محلياً
    setTimeout(() => {
      setPendingRide(null);
      setLoading(false);
      setActionType(null);
      toast({
        title: "تم تخطي الطلب",
        description: "سيظهر لك الطلب التالي"
      });
      fetchPendingRides();
    }, 500);
  };

  if (!isOnline || !pendingRide) return null;

  return (
    <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden shadow-lg shadow-primary/20 animate-bounce-subtle">
      <CardContent className="p-0">
        {/* Animated timer bar */}
        <div className="h-2 bg-secondary relative overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-1000"
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>

        <div className="p-4 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">طلب رحلة جديد!</p>
                <p className="text-xs text-muted-foreground">{getVehicleTypeName(pendingRide.vehicle_type)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-mono">{timeLeft}ث</span>
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 mt-1.5 rounded-full bg-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">نقطة الانطلاق</p>
                <p className="text-sm text-foreground">
                  {pendingRide.pickup_address || getLocationString(pendingRide.pickup_location)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 mt-1.5 rounded-full bg-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">الوجهة</p>
                <p className="text-sm text-foreground">
                  {pendingRide.dropoff_address || getLocationString(pendingRide.dropoff_location)}
                </p>
              </div>
            </div>
          </div>

          {/* Driver to Pickup Distance */}
          {(distanceToPickup !== null || etaToPickup !== null) && (
            <div className="flex items-center justify-center gap-4 py-2 px-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-foreground">بُعدك عن العميل:</span>
              </div>
              {distanceToPickup !== null && (
                <span className="font-bold text-blue-500">{distanceToPickup} كم</span>
              )}
              {etaToPickup !== null && (
                <span className="text-sm text-muted-foreground">≈ {etaToPickup} د</span>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between py-3 px-4 bg-secondary/50 rounded-xl mb-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">مسافة الرحلة</p>
              <p className="font-bold text-foreground">{pendingRide.distance_km || '?'} كم</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">مدة الرحلة</p>
              <p className="font-bold text-foreground">{pendingRide.duration_minutes || '?'} د</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <Wallet className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-bold text-primary">
                {(pendingRide.estimated_fare || 0).toLocaleString()} د.ع
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleReject}
              disabled={loading}
            >
              {loading && actionType === 'reject' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <X className="w-5 h-5 ml-2" />
                  رفض
                </>
              )}
            </Button>
            <Button 
              className="flex-1 h-12 shadow-glow"
              onClick={handleAccept}
              disabled={loading}
            >
              {loading && actionType === 'accept' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 ml-2" />
                  قبول
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RideRequestCard;
