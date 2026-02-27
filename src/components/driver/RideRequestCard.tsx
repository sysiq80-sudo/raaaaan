import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { logger } from "@/lib/logger";
import { roundFare } from "@/lib/constants";
import { playNotificationSound } from "@/lib/audioContext";
import { stopRideAlert } from "@/lib/loudAlerts";
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
  surge_multiplier?: number;
}

interface RideRequestCardProps {
  driverId: string;
  vehicleType: string | null;
  isOnline: boolean;
  isPaused?: boolean;
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

// صوت الإشعار يتم تشغيله من audioContext.ts المركزي

export const RideRequestCard = ({
  driverId,
  vehicleType,
  isOnline,
  isPaused = false,
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

  // ✨ Cooldown: الرحلات المتخطاة تختفي 60 ثانية
  const skippedRidesRef = useRef<Record<string, number>>({});

  // Track active ride to search from dropoff location
  const [activeRideDropoff, setActiveRideDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [searchFromDropoff, setSearchFromDropoff] = useState(false);

  // Ref لـ fetchPendingRides — يمنع إعادة الاشتراك في Realtime مع كل تغيير موقع
  const fetchPendingRidesRef = useRef<() => void>(() => {});

  // تنظيف الرحلات المتخطاة المنتهية الصلاحية كل 30 ثانية
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const skipped = skippedRidesRef.current;
      let changed = false;
      for (const rideId of Object.keys(skipped)) {
        if (now - skipped[rideId] >= 60000) {
          delete skipped[rideId];
          changed = true;
        }
      }
      if (changed) {
        logger.debug("RideRequestCard", "تنظيف cooldown الرحلات المتخطاة");
      }
    }, 30000);
    return () => clearInterval(cleanupInterval);
  }, []);

  // دالة فحص: هل الرحلة مرئية؟ (ليست في cooldown)
  const isRideVisible = useCallback((rideId: string): boolean => {
    const skippedTime = skippedRidesRef.current[rideId];
    if (!skippedTime) return true;
    if (Date.now() - skippedTime >= 60000) {
      delete skippedRidesRef.current[rideId];
      return true;
    }
    return false;
  }, []);

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
          .maybeSingle();

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
    // لا تبحث عن رحلات إذا كان السائق غير متصل أو في وضع الإيقاف المؤقت
    if (!isOnline || isPaused) {
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
            surge_multiplier: ride.surge_multiplier ?? undefined,
          };
          
          // تخطي الرحلات في cooldown
          if (!isRideVisible(newRide.id)) {
            logger.debug("RideRequestCard", `⛔ Ride ${newRide.id.substring(0, 8)} in cooldown, skipping`);
            setPendingRide(null);
            return;
          }

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
            surge_multiplier: ride.surge_multiplier ?? undefined,
          };

          // تخطي الرحلات في cooldown
          if (!isRideVisible(newRide.id)) {
            logger.debug("RideRequestCard", `⛔ Fallback ride ${newRide.id.substring(0, 8)} in cooldown, skipping`);
            setPendingRide(null);
            return;
          }
          
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
  }, [isOnline, isPaused, vehicleType, driverLocation, maxPickupRadius, canDriverServeRide, searchFromDropoff, activeRideDropoff, isRideVisible]);

  // الـ Ref يتابع دائماً آخر نسخة من fetchPendingRides بدون إعادة الاشتراك
  useEffect(() => {
    fetchPendingRidesRef.current = fetchPendingRides;
  }, [fetchPendingRides]);

  // Subscribe to realtime ride insertions — ONCE (لا يعتمد على الموقع)
  useEffect(() => {
    if (!isOnline || !driverId || isPaused) return;

    logger.debug("RideRequestCard", "Setting up realtime subscription (stable)");
    
    const channel = supabase
      .channel(`ride-requests-${driverId}`)
      // ═══ INSERT: رحلات تُنشأ مباشرة بحالة pending (من التطبيق) ═══
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rides",
          filter: "status=eq.pending",
        },
        (payload) => {
          logger.debug("RideRequestCard", "⚡ New ride INSERT (pending)", payload.new?.id);
          fetchPendingRidesRef.current();
        }
      )
      // ═══ UPDATE: أي تحديث — نفحص الحالة يدوياً (الفلتر غير موثوق على UPDATE) ═══
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
        },
        (payload) => {
          const oldStatus = (payload.old as Record<string, unknown>)?.status;
          const newStatus = (payload.new as Record<string, unknown>)?.status;
          // فقط عندما تتحول الحالة إلى pending
          if (newStatus === 'pending' && oldStatus !== 'pending') {
            logger.debug("RideRequestCard", `⚡ Ride UPDATE to pending (${oldStatus} → ${newStatus})`, payload.new?.id);
            fetchPendingRidesRef.current();
          }
        }
      )
      .subscribe((status) => {
        logger.debug("RideRequestCard", `Realtime subscription: ${status}`);
      });

    // 👁️ Force-poll when tab/app regains visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.debug("RideRequestCard", "👁️ Tab visible — force-polling rides");
        fetchPendingRidesRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      logger.debug("RideRequestCard", "Cleaning up realtime subscription");
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline, driverId, isPaused]); // ← بدون fetchPendingRides

  // Initial fetch and polling — يعتمد على isOnline/isPaused فقط
  useEffect(() => {
    if (!isOnline || isPaused) {
      setPendingRide(null);
      return;
    }

    // Fetch فوري
    fetchPendingRidesRef.current();

    // Polling كل 5 ثواني عبر الـ ref
    const pollInterval = setInterval(() => {
      fetchPendingRidesRef.current();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isOnline, isPaused]); // ← deps ثابتة

  // Countdown timer effect
  useEffect(() => {
    if (!pendingRide) return;
    const currentRideId = pendingRide.id;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // انتهى الوقت — أضف للـ cooldown حتى لا تعود فوراً
          skippedRidesRef.current[currentRideId] = Date.now();
          console.log(`⏰ Ride ${currentRideId.substring(0, 8)} timed out, cooldown 60s`);
          setPendingRide(null);
          previousRideIdRef.current = null;
          fetchPendingRidesRef.current();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRide]);

  const handleAccept = async () => {
    if (!pendingRide || loading) return; // منع الضغط المزدوج
    setLoading(true);
    setActionType("accept");
    try {
      // المحاولة 1: RPC الآمن
      const { error } = await supabase.rpc("accept_ride_safely", {
        p_ride_id: pendingRide.id,
        p_driver_id: driverId,
      });

      if (error) {
        // Fallback: تحديث مباشر عبر REST إذا فشل الـ RPC
        console.warn("accept_ride_safely RPC failed, falling back to direct update:", error.message);
        const { error: directError } = await supabase
          .from('rides')
          .update({
            status: 'accepted',
            driver_id: driverId,
            matched_at: new Date().toISOString(),
          })
          .eq('id', pendingRide.id)
          .eq('status', 'pending') // حماية: فقط إذا لا تزال pending
          .is('driver_id', null);  // حماية: لم يقبلها سائق آخر

        if (directError) throw directError;
      }

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
      fetchPendingRidesRef.current();
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!pendingRide || loading) return; // منع الضغط المزدوج
    setLoading(true);
    setActionType("reject");

    // تخطي محلي + cooldown 60 ثانية
    const rejectedRideId = pendingRide.id;
    skippedRidesRef.current[rejectedRideId] = Date.now();
    console.log(`⛔ Skipping ride ${rejectedRideId.substring(0, 8)} for 60 seconds`);

    setPendingRide(null);
    previousRideIdRef.current = null;

    try {
      await supabase.rpc("update_driver_response", {
        p_ride_id: rejectedRideId,
        p_driver_id: driverId,
        p_response: "rejected",
      });
    } catch {
      // فشل التسجيل — غير مؤثر، الرفض محلي
    }

    toast({ title: "تم التخطي", description: "سيتم عرض الطلب التالي" });
    setLoading(false);
    setActionType(null);
    fetchPendingRidesRef.current();
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
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 relative">
                <span className="text-white/80 text-xs block">الأجرة</span>
                <span className="text-white font-bold text-sm">
                  {roundFare(pendingRide.estimated_fare || 0).toLocaleString()}
                </span>
                {pendingRide.surge_multiplier && pendingRide.surge_multiplier > 1 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg">
                    <Zap className="w-2.5 h-2.5" />
                    x{pendingRide.surge_multiplier.toFixed(1)}
                  </span>
                )}
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

            {/* Action buttons — أزرار كبيرة للمس */}
            <div className="flex gap-3 mt-3 pt-3 border-t border-white/20">
              <Button
                variant="ghost"
                className="flex-1 h-14 text-base font-bold bg-red-500/90 hover:bg-red-600 active:bg-red-700 text-white rounded-xl min-w-[120px] touch-manipulation"
                onClick={() => { stopRideAlert(); handleReject(); }}
                disabled={loading}
              >
                {loading && actionType === "reject" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <X className="w-5 h-5 ml-2" />
                    تخطي
                  </>
                )}
              </Button>

              <Button
                className="flex-[2] h-14 text-base font-bold bg-white text-primary hover:bg-white/90 active:bg-white/80 rounded-xl min-w-[160px] touch-manipulation shadow-lg"
                onClick={() => { stopRideAlert(); handleAccept(); }}
                disabled={loading}
              >
                {loading && actionType === "accept" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5 ml-2" />
                    قبول الرحلة
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
