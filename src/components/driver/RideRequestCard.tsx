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
  onRideRequestVisible?: (visible: boolean) => void;
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
  onRideRequestVisible,
  maxPickupRadius = 10,
}: RideRequestCardProps) => {
  const { toast } = useToast();
  const [pendingRide, setPendingRide] = useState<PendingRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(null);
  const TIMER_DURATION = 30; // ثانية
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const previousRideIdRef = useRef<string | null>(null);
  // قفل لمنع التداخل أثناء القبول/الرفض
  const actionInProgressRef = useRef(false);

  // حساب الوقت المتبقي من created_at بدلاً من إعادة العد من 30
  const calcTimeLeft = useCallback((createdAt: string): number => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, TIMER_DURATION - elapsed);
  }, []);

  // إبلاغ الأب عند ظهور/إخفاء بطاقة الطلب
  useEffect(() => {
    onRideRequestVisible?.(!!pendingRide);
  }, [pendingRide, onRideRequestVisible]);

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
    // لا تبحث أثناء القبول/الرفض — منع التداخل
    if (actionInProgressRef.current) {
      logger.debug("RideRequestCard", "⏳ Action in progress — skipping fetch");
      return;
    }
    // لا تبحث عن رحلات إذا كان السائق غير متصل أو في وضع الإيقاف المؤقت
    if (!isOnline || isPaused) {
      setPendingRide(null);
      return;
    }

    try {
      // Determine search location: dropoff if in active ride, otherwise current location
      const searchLocation = searchFromDropoff && activeRideDropoff ? activeRideDropoff : driverLocation;
      const searchLabel = searchFromDropoff && activeRideDropoff ? 'موقع الوجهة' : 'الموقع الحالي';

      // Try with location-based RPC ONLY if we have a valid location
      if (searchLocation && searchLocation.lat && searchLocation.lng) {
        logger.debug("RideRequestCard", `🔍 البحث من: ${searchLabel}`, {
          search_lat: searchLocation.lat,
          search_lng: searchLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: vehicleType || "economy",
          searching_from_dropoff: searchFromDropoff,
        });

        try {
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
              surge_multiplier: (ride as any).surge_multiplier ?? undefined,
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
            setTimeLeft(calcTimeLeft(newRide.created_at));
            return;
          }
        } catch (rpcError) {
          logger.error("RideRequestCard", "RPC error, falling through to fallback", rpcError);
        }
      } else {
        logger.debug("RideRequestCard", "📍 الموقع غير متاح — استخدام البحث العام");
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
            surge_multiplier: (ride as any).surge_multiplier ?? undefined,
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
          setTimeLeft(calcTimeLeft(newRide.created_at));
          return;
        }
      }

      setPendingRide(null);
    } catch (error) {
      logger.error("RideRequestCard", "Error fetching rides", error);
      setPendingRide(null);
    }
  }, [isOnline, isPaused, vehicleType, driverLocation, maxPickupRadius, canDriverServeRide, searchFromDropoff, activeRideDropoff, isRideVisible, calcTimeLeft]);

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
          // لا تتدخل أثناء عملية قبول/رفض
          if (actionInProgressRef.current) return;
          
          const rideData = payload.new;
          logger.debug("RideRequestCard", "⚡ New ride INSERT (pending)", rideData?.id);
          
          // بناء الرحلة مباشرة من البيانات الواردة لعرضها فوراً
          if (rideData && rideData.id && rideData.status === 'pending' && !rideData.driver_id) {
            const directRide: PendingRide = {
              id: rideData.id,
              pickup_location: rideData.pickup_location as { lat: number; lng: number },
              dropoff_location: rideData.dropoff_location as { lat: number; lng: number },
              pickup_address: rideData.pickup_address || '',
              dropoff_address: rideData.dropoff_address || '',
              estimated_fare: rideData.estimated_fare || 0,
              distance_km: rideData.distance_km ? Number(rideData.distance_km) : null,
              duration_minutes: rideData.duration_minutes || null,
              vehicle_type: rideData.vehicle_type || "economy",
              created_at: rideData.created_at || new Date().toISOString(),
              rider_id: rideData.rider_id || "",
              surge_multiplier: rideData.surge_multiplier ?? undefined,
            };
            
            // فحص cooldown
            const skippedTime = skippedRidesRef.current[directRide.id];
            const inCooldown = skippedTime && (Date.now() - skippedTime < 60000);
            
            if (!inCooldown) {
              logger.debug("RideRequestCard", "✅ عرض الطلب فوراً من الـ Realtime payload");
              
              // تشغيل الصوت
              if (previousRideIdRef.current !== directRide.id) {
                playNotificationSound();
                if ("vibrate" in navigator) {
                  navigator.vibrate([300, 100, 300, 100, 400]);
                }
                previousRideIdRef.current = directRide.id;
              }
              
              setPendingRide(directRide);
              const elapsed = Math.floor((Date.now() - new Date(directRide.created_at).getTime()) / 1000);
              setTimeLeft(Math.max(0, 30 - elapsed));
              return;
            }
          }
          
          // Fallback — جلب من قاعدة البيانات
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
          // لا تتدخل أثناء عملية قبول/رفض
          if (actionInProgressRef.current) return;
          
          const oldStatus = (payload.old as Record<string, unknown>)?.status;
          const newStatus = (payload.new as Record<string, unknown>)?.status;
          const rideData = payload.new;

          // عندما تتحول الحالة إلى pending — عرض فوري
          if (newStatus === 'pending' && oldStatus !== 'pending' && rideData) {
            logger.debug("RideRequestCard", `⚡ Ride UPDATE to pending (${oldStatus} → ${newStatus})`, rideData.id);
            
            if (rideData.id && !rideData.driver_id) {
              const directRide: PendingRide = {
                id: rideData.id as string,
                pickup_location: rideData.pickup_location as { lat: number; lng: number },
                dropoff_location: rideData.dropoff_location as { lat: number; lng: number },
                pickup_address: (rideData.pickup_address as string) || '',
                dropoff_address: (rideData.dropoff_address as string) || '',
                estimated_fare: (rideData.estimated_fare as number) || 0,
                distance_km: rideData.distance_km ? Number(rideData.distance_km) : null,
                duration_minutes: (rideData.duration_minutes as number) || null,
                vehicle_type: (rideData.vehicle_type as string) || "economy",
                created_at: (rideData.created_at as string) || new Date().toISOString(),
                rider_id: (rideData.rider_id as string) || "",
                surge_multiplier: (rideData as Record<string, unknown>).surge_multiplier as number ?? undefined,
              };
              
              const skippedTime = skippedRidesRef.current[directRide.id];
              const inCooldown = skippedTime && (Date.now() - skippedTime < 60000);
              
              if (!inCooldown) {
                if (previousRideIdRef.current !== directRide.id) {
                  playNotificationSound();
                  if ("vibrate" in navigator) {
                    navigator.vibrate([300, 100, 300, 100, 400]);
                  }
                  previousRideIdRef.current = directRide.id;
                }
                setPendingRide(directRide);
                const elapsed = Math.floor((Date.now() - new Date(directRide.created_at).getTime()) / 1000);
                setTimeLeft(Math.max(0, 30 - elapsed));
                return;
              }
            }
            
            fetchPendingRidesRef.current();
          }
          
          // عندما تتغير الحالة من pending لأي شيء آخر — إزالة البطاقة
          if (oldStatus === 'pending' && newStatus !== 'pending') {
            logger.debug("RideRequestCard", `🔄 Ride no longer pending (${oldStatus} → ${newStatus})`);
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

  // Countdown timer effect — visual only, لا يخفي البطاقة
  useEffect(() => {
    if (!pendingRide) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          // انتهى الوقت — يبقى الطلب ظاهراً حتى يتخذ السائق إجراء أو يُلغي الراكب
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRide]);

  const handleAccept = async () => {
    if (!pendingRide || loading || actionInProgressRef.current) return; // منع الضغط المزدوج
    actionInProgressRef.current = true;
    setLoading(true);
    setActionType("accept");

    // Safety timeout — لا يبقى بحالة loading أكثر من 15 ثانية
    const safetyTimer = setTimeout(() => {
      console.error("[RideRequestCard] ⚠️ Accept safety timeout — resetting loading state");
      actionInProgressRef.current = false;
      setLoading(false);
      setActionType(null);
      toast({
        title: "انتهت المهلة",
        description: "حاول مرة أخرى",
        variant: "destructive",
      });
    }, 15000);

    try {
      // المحاولة 1: RPC الآمن مع timeout
      let rpcSucceeded = false;
      try {
        const rpcPromise = supabase.rpc("accept_ride_safely", {
          p_ride_id: pendingRide.id,
          p_driver_id: driverId,
        });

        // Timeout 10 ثواني للـ RPC
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("RPC timeout")), 10000)
        );

        const { error } = await Promise.race([rpcPromise, timeoutPromise]) as { error: any };

        if (!error) {
          rpcSucceeded = true;
        } else {
          console.warn("accept_ride_safely RPC failed:", error.message);
        }
      } catch (rpcErr: any) {
        console.warn("accept_ride_safely RPC error/timeout:", rpcErr?.message);
      }

      // المحاولة 2: Fallback — تحديث مباشر عبر REST
      if (!rpcSucceeded) {
        console.log("[RideRequestCard] Trying direct update fallback...");
        const { error: directError } = await supabase
          .from('rides')
          .update({
            status: 'accepted',
            driver_id: driverId,
            matched_at: new Date().toISOString(),
          })
          .eq('id', pendingRide.id)
          .eq('status', 'pending')
          .is('driver_id', null);

        if (directError) {
          throw directError;
        }
      }

      clearTimeout(safetyTimer);
      toast({ title: "✅ تم القبول", description: "تم قبول الطلب بنجاح" });
      onRideAccepted?.();
      setPendingRide(null);
      previousRideIdRef.current = null;
    } catch (e: any) {
      clearTimeout(safetyTimer);
      console.error("[RideRequestCard] Accept error:", e);
      toast({
        title: "خطأ",
        description: e?.message || "تم قبول الطلب من سائق آخر",
        variant: "destructive",
      });
      fetchPendingRidesRef.current();
    } finally {
      clearTimeout(safetyTimer);
      actionInProgressRef.current = false;
      setLoading(false);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!pendingRide || loading || actionInProgressRef.current) return; // منع الضغط المزدوج
    actionInProgressRef.current = true;
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
    actionInProgressRef.current = false;
    setLoading(false);
    setActionType(null);
    fetchPendingRidesRef.current();
  };

  // Empty state - searching for rides
  if (!isOnline || isPaused || !pendingRide) {
    if (isOnline && !isPaused && !pendingRide) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card/95 backdrop-blur-md p-4 border border-border/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Navigation className="w-5 h-5 text-primary" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {searchFromDropoff ? '🎯 بحث ذكي من الوجهة' : 'جاري البحث عن الطلبات'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {driverLocation ? `📍 نطاق: ${maxPickupRadius} كم` : 'جاري تحديد الموقع...'}
                  </p>
                </div>
              </div>

              {/* Pulse dots */}
              <div className="flex items-center gap-1.5 mr-2">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-emerald-500"
                />
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  className="w-2 h-2 rounded-full bg-emerald-500"
                />
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                  className="w-2 h-2 rounded-full bg-emerald-500"
                />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }
    return null;
  }

  const timerPercent = (timeLeft / 30) * 100;
  const isUrgent = timeLeft <= 10;

  // Active ride request card — Premium Design
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full"
      >
        <div className="relative overflow-hidden rounded-2xl bg-card shadow-2xl border border-border/40">

          {/* ═══ Timer Progress Bar — Top ═══ */}
          <div className="h-1 bg-muted/30">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: `${timerPercent}%` }}
              transition={{ duration: 0.5, ease: "linear" }}
              className={`h-full rounded-full transition-colors duration-300 ${
                isUrgent
                  ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                  : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]"
              }`}
            />
          </div>

          <div className="p-4 space-y-3">

            {/* ═══ Header: "طلب جديد" + Timer Badge ═══ */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </motion.div>
                <span className="font-bold text-base text-foreground">طلب جديد!</span>
              </div>

              <motion.div
                animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                  isUrgent
                    ? "bg-red-500/15 text-red-500 border border-red-500/30"
                    : "bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-border/50"
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{timeLeft > 0 ? `${timeLeft}ث` : 'بانتظار'}</span>
              </motion.div>
            </div>

            {/* ═══ Hero: Fare + Stats ═══ */}
            <div className="flex items-center gap-3">
              {/* الأجرة — العنصر الرئيسي */}
              <div className="flex-1 relative bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 border border-emerald-200/50 dark:border-emerald-800/30">
                <div className="flex items-baseline gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 self-center" />
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                    {roundFare(pendingRide.estimated_fare || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-medium">د.ع</span>
                </div>
                {pendingRide.surge_multiplier && pendingRide.surge_multiplier > 1 && (
                  <span className="absolute -top-2 -left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg shadow-amber-500/30">
                    <Zap className="w-2.5 h-2.5" />
                    x{pendingRide.surge_multiplier.toFixed(1)}
                  </span>
                )}
              </div>

              {/* المسافة + المدة + النوع */}
              <div className="flex flex-col gap-1.5">
                {pendingRide.distance_km && (
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                    <Route className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{pendingRide.distance_km.toFixed(1)} كم</span>
                  </div>
                )}
                {pendingRide.duration_minutes && (
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{pendingRide.duration_minutes} دقيقة</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                  <Car className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {getVehicleIcon(pendingRide.vehicle_type)} {getVehicleTypeName(pendingRide.vehicle_type)}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ Route Line: Pickup → Dropoff ═══ */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-border/30">
              <div className="flex gap-3">
                {/* Vertical Route Line */}
                <div className="flex flex-col items-center pt-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-200 dark:border-emerald-800 shadow-sm" />
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-emerald-400 to-red-400 my-1 min-h-[20px]" />
                  <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-200 dark:border-red-800 shadow-sm" />
                </div>

                {/* Addresses */}
                <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
                  <div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-0.5">نقطة الانطلاق</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                      {pendingRide.pickup_address || "موقع الانطلاق"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold uppercase tracking-wider mb-0.5">الوجهة</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                      {pendingRide.dropoff_address || "الوجهة"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Action Buttons ═══ */}
            <div className="flex gap-3 pt-1">
              {/* زر التخطي — ثانوي */}
              <Button
                variant="outline"
                className="h-14 px-5 text-sm font-semibold text-slate-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl border-border/50 transition-all duration-200 touch-manipulation"
                onClick={() => { stopRideAlert(); handleReject(); }}
                disabled={loading}
              >
                {loading && actionType === "reject" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <X className="w-5 h-5 ml-1.5" />
                    تخطي
                  </>
                )}
              </Button>

              {/* زر القبول — Hero */}
              <motion.div
                animate={{ boxShadow: ["0 0 0 0 rgba(16,185,129,0)", "0 0 0 8px rgba(16,185,129,0.15)", "0 0 0 0 rgba(16,185,129,0)"] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex-1 rounded-xl"
              >
                <Button
                  className="w-full h-14 text-base font-black bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200 touch-manipulation active:scale-[0.97]"
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
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RideRequestCard;
