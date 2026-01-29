import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { logger } from "@/lib/logger";
import { roundFare } from "@/lib/constants";
import {
  MapPin,
  Clock,
  Wallet,
  X,
  Check,
  Loader2,
  Timer,
  Car,
  Navigation,
  Route,
  Sparkles,
  Zap,
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
}

interface RideRequestCardProps {
  driverId: string;
  vehicleType: string | null;
  isOnline: boolean;
  driverLocation?: { lat: number; lng: number } | null;
  onRideAccepted?: () => void;
  maxPickupRadius?: number;
}

const getVehicleTypeName = (type: string) => {
  const types: Record<string, string> = {
    economy: "اقتصادي",
    comfort: "مريح",
    premium: "فاخر",
    women_only: "نسائي",
  };
  return types[type] || type;
};

const getVehicleIcon = (type: string) => {
  switch (type) {
    case "premium":
      return "🚘";
    case "comfort":
      return "🚗";
    case "women_only":
      return "👩‍💼";
    default:
      return "🚙";
  }
};

// Play notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (frequency: number, duration: number, startTime: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    const now = audioContext.currentTime;
    playTone(880, 0.15, now);
    playTone(1100, 0.15, now + 0.15);
    playTone(1320, 0.2, now + 0.3);
  } catch {
    logger.debug("RideRequestCard", "Audio not supported");
  }
};

export const RideRequestCard = ({
  driverId,
  vehicleType,
  isOnline,
  driverLocation,
  onRideAccepted,
  maxPickupRadius = 10,
}: RideRequestCardProps) => {
  const { toast } = useToast();
  const [pendingRide, setPendingRide] = useState<PendingRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const previousRideIdRef = useRef<string | null>(null);

  // Track active ride to search from dropoff location
  const [activeRideDropoff, setActiveRideDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [searchFromDropoff, setSearchFromDropoff] = useState(false);

  const canDriverServeRide = useCallback(
    (driverType: string | null, rideType: string): boolean => {
      if (!driverType) return true;
      if (driverType === "women_only") return rideType === "women_only";
      if (rideType === "women_only") return driverType === "women_only";
      const typeHierarchy: Record<string, number> = {
        economy: 1,
        comfort: 2,
        premium: 3,
      };
      const d = typeHierarchy[driverType] || 1;
      const r = typeHierarchy[rideType] || 1;
      return d >= r;
    },
    []
  );

  // Monitor active ride to get dropoff location for smart search
  useEffect(() => {
    if (!driverId) return;

    const checkActiveRide = async () => {
      try {
        const { data: activeRide } = await supabase
          .from('rides')
          .select('status, dropoff_location')
          .eq('driver_id', driverId)
          .in('status', ['accepted', 'arrived', 'in_progress'])
          .single();

        if (activeRide && activeRide.dropoff_location) {
          const dropoff = activeRide.dropoff_location as { lat: number; lng: number };
          setActiveRideDropoff(dropoff);
          setSearchFromDropoff(true);
          logger.info('RideRequestCard', '🎯 البحث الذكي مُفعَّل - البحث من موقع الوجهة', dropoff);
        } else {
          setActiveRideDropoff(null);
          setSearchFromDropoff(false);
        }
      } catch (error) {
        logger.error('RideRequestCard', 'Error checking active ride', error);
      }
    };

    checkActiveRide();
    const interval = setInterval(checkActiveRide, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [driverId]);

  const fetchPendingRides = useCallback(async () => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }

    try {
      // Determine search location: dropoff if in active ride, otherwise current location
      const searchLocation = searchFromDropoff && activeRideDropoff ? activeRideDropoff : driverLocation;
      const searchLabel = searchFromDropoff && activeRideDropoff ? 'موقع الوجهة' : 'الموقع الحالي';

      // First try with location-based RPC if we have search location
      if (searchLocation) {
        logger.debug("RideRequestCard", `🔍 البحث من: ${searchLabel}`, {
          search_lat: searchLocation.lat,
          search_lng: searchLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: vehicleType || "economy",
          searching_from_dropoff: searchFromDropoff,
        });

        const { data, error } = await supabase.rpc("get_nearby_pending_rides", {
          driver_lat: searchLocation.lat,
          driver_lng: searchLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: (vehicleType || "economy") as "economy" | "comfort" | "premium" | "women_only",
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
            vehicle_type: ride.vehicle_type || "economy",
            created_at: ride.created_at,
            rider_id: ride.rider_id || "",
          };
          
          // Play sound only for NEW rides
          if (previousRideIdRef.current !== newRide.id) {
            playNotificationSound();
            if ("vibrate" in navigator) {
              navigator.vibrate([300, 100, 300, 100, 400]);
            }
            previousRideIdRef.current = newRide.id;
          }
          
          setPendingRide(newRide);
          setTimeLeft(30);
          return;
        }
      }

      // Fallback: Search for any pending ride that matches vehicle type
      logger.debug("RideRequestCard", "Using fallback query");
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "pending")
        .is("driver_id", null)
        .order("created_at", { ascending: true })
        .limit(1);

      if (!error && data && data.length > 0) {
        const ride = data[0];
        const canServe = canDriverServeRide(vehicleType, ride.vehicle_type || "economy");
        
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
            vehicle_type: ride.vehicle_type || "economy",
            created_at: ride.created_at,
            rider_id: ride.rider_id || "",
          };
          
          // Play sound only for NEW rides
          if (previousRideIdRef.current !== newRide.id) {
            playNotificationSound();
            if ("vibrate" in navigator) {
              navigator.vibrate([300, 100, 300, 100, 400]);
            }
            previousRideIdRef.current = newRide.id;
          }
          
          setPendingRide(newRide);
          setTimeLeft(30);
          return;
        }
      }

      setPendingRide(null);
    } catch (error) {
      logger.error("RideRequestCard", "Error fetching rides", error);
      setPendingRide(null);
    }
  }, [isOnline, vehicleType, driverLocation, maxPickupRadius, canDriverServeRide, searchFromDropoff, activeRideDropoff]);

  // Subscribe to realtime ride insertions
  useEffect(() => {
    if (!isOnline || !driverId) return;

    logger.debug("RideRequestCard", "Setting up realtime subscription");
    
    const channel = supabase
      .channel(`ride-requests-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rides",
          filter: "status=eq.pending",
        },
        (payload) => {
          logger.debug("RideRequestCard", "New ride inserted", payload.new?.id);
          // Immediately fetch to update UI
          fetchPendingRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, driverId, fetchPendingRides]);

  // Initial fetch and polling
  useEffect(() => {
    if (!isOnline) {
      setPendingRide(null);
      return;
    }

    fetchPendingRides();
    const pollInterval = setInterval(fetchPendingRides, 5000);
    return () => clearInterval(pollInterval);
  }, [isOnline, fetchPendingRides]);

  // Countdown timer effect
  useEffect(() => {
    if (!pendingRide) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPendingRide(null);
          previousRideIdRef.current = null;
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
    setActionType("accept");
    try {
      const { error } = await supabase.rpc("accept_ride_safely", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
      });
      if (error) throw error;
      toast({ title: "✅ تم القبول", description: "تم قبول الطلب بنجاح" });
      onRideAccepted?.();
      setPendingRide(null);
      previousRideIdRef.current = null;
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "تم قبول الطلب من سائق آخر",
        variant: "destructive",
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
    setActionType("reject");
    try {
      await supabase.rpc("update_driver_response", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
        p_response: "rejected",
      });
    } catch {}
    setPendingRide(null);
    previousRideIdRef.current = null;
    toast({ title: "تم التخطي", description: "سيتم عرض الطلب التالي" });
    setLoading(false);
    setActionType(null);
    fetchPendingRides();
  };

  // Empty state - searching for rides
  if (!isOnline || !pendingRide) {
    if (isOnline && !pendingRide) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-20 h-20 bg-primary rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary rounded-full blur-3xl animate-pulse delay-1000" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
              >
                <Navigation className="w-8 h-8 text-primary" />
              </motion.div>
              
              <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2 justify-center">
                {searchFromDropoff ? (
                  <>
                    <Sparkles className="w-5 h-5 text-primary" />
                    البحث الذكي من وجهة العميل...
                  </>
                ) : (
                  <>
                    <Navigation className="w-5 h-5 text-primary" />
                    جاري البحث عن الطلبات...
                  </>
                )}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {searchFromDropoff && activeRideDropoff
                  ? `🎯 البحث الذكي: ${maxPickupRadius} كم من وجهة رحلتك الحالية`
                  : driverLocation
                  ? `نطاق البحث: ${maxPickupRadius} كم من موقعك الحالي`
                  : "جاري تحديد موقعك..."}
              </p>
              
              {/* Pulse animation */}
              <div className="mt-4 flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }
    return null;
  }

  // Active ride request card
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="mb-6"
      >
        <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-primary/20 border-2 border-primary">
          {/* Glowing header */}
          <div className="relative bg-gradient-to-r from-primary via-primary to-green-500 px-5 py-4">
            {/* Animated glow effect */}
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
            
            <div className="relative z-10">
              {/* Timer bar */}
              <div className="h-1.5 bg-white/30 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: `${(timeLeft / 30) * 100}%` }}
                  className={`h-full rounded-full ${
                    timeLeft <= 10 ? "bg-red-400" : "bg-white"
                  }`}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5"
                  >
                    <Timer className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-lg">{timeLeft}</span>
                  </motion.div>
                </div>
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 bg-white rounded-full px-4 py-1.5"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-primary font-bold text-sm">طلب جديد!</span>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="bg-card p-5">
            {/* Fare and vehicle type */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-primary/10 to-green-500/10 rounded-2xl p-4 border border-primary/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <span className="text-xs text-muted-foreground">الأجرة</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {roundFare(pendingRide.estimated_fare || 0).toLocaleString()}
                  <span className="text-sm font-normal mr-1">د.ع</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-4 border border-blue-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-5 h-5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">النوع</span>
                </div>
                <div className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>{getVehicleIcon(pendingRide.vehicle_type)}</span>
                  <span>{getVehicleTypeName(pendingRide.vehicle_type)}</span>
                </div>
              </motion.div>
            </div>

            {/* Distance and duration */}
            {(pendingRide.distance_km || pendingRide.duration_minutes) && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-6 mb-4 py-3 bg-muted/50 rounded-xl"
              >
                {pendingRide.distance_km && (
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{pendingRide.distance_km.toFixed(1)} كم</span>
                  </div>
                )}
                {pendingRide.duration_minutes && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{Math.round(pendingRide.duration_minutes)} دقيقة</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Route info */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-muted/30 rounded-2xl p-4 border border-border"
            >
              <div className="flex gap-3">
                <div className="flex flex-col items-center py-1">
                  <div className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-500/20" />
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-green-500 to-red-500 my-2 min-h-[50px]" />
                  <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/20" />
                </div>
                
                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      نقطة الانطلاق
                    </p>
                    <p className="text-sm text-foreground font-medium leading-relaxed">
                      {pendingRide.pickup_address || "موقع غير محدد"}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      الوجهة
                    </p>
                    <p className="text-sm text-foreground font-medium leading-relaxed">
                      {pendingRide.dropoff_address || "موقع غير محدد"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Action buttons */}
          <div className="bg-background px-5 py-4 border-t border-border">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14 text-base border-2 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-xl transition-all duration-200"
                onClick={handleReject}
                disabled={loading}
              >
                {loading && actionType === "reject" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <X className="w-5 h-5 ml-2" />
                    رفض
                  </>
                )}
              </Button>
              
              <Button
                className="flex-[2] h-14 text-base bg-gradient-to-r from-primary to-green-500 hover:from-primary/90 hover:to-green-500/90 text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all duration-200"
                onClick={handleAccept}
                disabled={loading}
              >
                {loading && actionType === "accept" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5 ml-2" />
                    قبول الطلب
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RideRequestCard;
