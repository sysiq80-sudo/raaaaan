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
          className="w-full"
        >
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 p-4 border border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Navigation className="w-5 h-5 text-primary" />
                </motion.div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {searchFromDropoff ? 'بحث ذكي من الوجهة' : 'جاري البحث عن الطلبات'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {driverLocation ? `نطاق: ${maxPickupRadius} كم` : 'جاري تحديد الموقع'}
                  </p>
                </div>
              </div>
              
              {/* Pulse dots */}
              <div className="flex items-center gap-1.5 ml-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }
    return null;
  }

  // Active ride request card - Compact
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full"
      >
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary/90 to-green-500 shadow-lg border border-primary">
          {/* Timer bar */}
          <div className="h-0.5 bg-white/30 absolute top-0 inset-x-0">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / 30) * 100}%` }}
              className={`h-full ${timeLeft <= 10 ? "bg-red-400" : "bg-white"}`}
            />
          </div>

          {/* Content */}
          <div className="p-3 space-y-2">
            {/* Header with timer */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">طلب جديد!</span>
              </div>
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1"
              >
                <Timer className="w-3.5 h-3.5 text-white" />
                <span className="text-white font-bold text-xs">{timeLeft}ث</span>
              </motion.div>
            </div>

            {/* Fare + Vehicle Type */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                <span className="text-white/80 text-xs block">الأجرة</span>
                <span className="text-white font-bold text-sm">
                  {roundFare(pendingRide.estimated_fare || 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                <span className="text-white/80 text-xs block">النوع</span>
                <span className="text-white font-bold text-sm flex items-center gap-1">
                  {getVehicleIcon(pendingRide.vehicle_type)}
                  {getVehicleTypeName(pendingRide.vehicle_type)}
                </span>
              </div>
            </div>

            {/* Distance + Duration */}
            {(pendingRide.distance_km || pendingRide.duration_minutes) && (
              <div className="flex gap-2 text-xs text-white/90 justify-center">
                {pendingRide.distance_km && (
                  <span className="flex items-center gap-1">
                    <Route className="w-3 h-3" />
                    {pendingRide.distance_km.toFixed(1)} كم
                  </span>
                )}
                {pendingRide.duration_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {pendingRide.duration_minutes} د
                  </span>
                )}
              </div>
            )}

            {/* Pickup & Dropoff Compact */}
            <div className="space-y-1.5 mt-2 pt-2 border-t border-white/20">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/90 line-clamp-1">
                  {pendingRide.pickup_address || "موقع الانطلاق"}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/90 line-clamp-1">
                  {pendingRide.dropoff_address || "الوجهة"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-3 pt-2 border-t border-white/20">
              <Button
                variant="ghost"
                className="flex-1 h-8 text-xs bg-red-400 hover:bg-red-500 text-white rounded-lg"
                onClick={handleReject}
                disabled={loading}
              >
                {loading && actionType === "reject" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <X className="w-3 h-3 mr-1" />
                    تخطي
                  </>
                )}
              </Button>

              <Button
                className="flex-1 h-8 text-xs bg-white text-primary hover:bg-white/90 rounded-lg font-bold"
                onClick={handleAccept}
                disabled={loading}
              >
                {loading && actionType === "accept" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    قبول
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
