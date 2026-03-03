import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { logger } from "@/lib/logger";
import { roundFare } from "@/lib/constants";
import { playNotificationSound } from "@/lib/audioContext";
import { stopRideAlert } from "@/lib/loudAlerts";
import { safeVibrate } from "@/lib/userGestureTracker";
import {
  Clock,
  Wallet,
  X,
  Check,
  Loader2,
  Timer,
  Car,
  Route,
  Sparkles,
  Zap,
  ChevronRight,
  ChevronLeft,
  Layers,
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
  // ═══ Multi-ride state ═══
  const [pendingRides, setPendingRides] = useState<PendingRide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "reject" | null>(null);
  const TIMER_DURATION = 30; // ثانية
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const previousRideIdRef = useRef<string | null>(null);
  // قفل لمنع التداخل أثناء القبول/الرفض
  const actionInProgressRef = useRef(false);
  // الرحلة الحالية المعروضة
  const pendingRide = pendingRides[currentIndex] ?? null;

  // حساب الوقت المتبقي من created_at بدلاً من إعادة العد من 30
  const calcTimeLeft = useCallback((createdAt: string): number => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, TIMER_DURATION - elapsed);
  }, []);

  // ✨ Cooldown: الرحلات المتخطاة تختفي 60 ثانية
  const skippedRidesRef = useRef<Record<string, number>>({});

  // Track active ride to search from dropoff location
  const [activeRideDropoff, setActiveRideDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [searchFromDropoff, setSearchFromDropoff] = useState(false);
  // عداد الاستعلامات الفارغة المتتالية — لتوسيع الفاصل الزمني (adaptive backoff)
  const emptyPollCountRef = useRef(0);
  const hasActiveRideRef = useRef(false);

  // Ref لـ fetchPendingRides — يمنع إعادة الاشتراك في Realtime مع كل تغيير موقع
  const fetchPendingRidesRef = useRef<() => void>(() => {});
  // Refs لإدارة الاشتراك بالـ debounce
  const setupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

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
    if (!driverId || !isOnline) return;

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
          hasActiveRideRef.current = true;
          logger.info('RideRequestCard', '🎯 البحث الذكي مُفعَّل - البحث من موقع الوجهة', dropoff);
        } else {
          setActiveRideDropoff(null);
          setSearchFromDropoff(false);
          hasActiveRideRef.current = false;
        }
      } catch (error) {
        logger.error('RideRequestCard', 'Error checking active ride', error);
      }
    };

    checkActiveRide();
    // فحص الرحلة النشطة كل 15 ثانية فقط (بدل 10) — لتقليل حمل قاعدة البيانات
    const interval = setInterval(checkActiveRide, 15000);

    return () => clearInterval(interval);
  }, [driverId, isOnline]);

  const fetchPendingRides = useCallback(async () => {
    if (actionInProgressRef.current) return;
    if (!isOnline || isPaused) {
      setPendingRides([]);
      return;
    }

    try {
      const searchLocation = searchFromDropoff && activeRideDropoff ? activeRideDropoff : driverLocation;
      const searchLabel = searchFromDropoff && activeRideDropoff ? 'موقع الوجهة' : 'الموقع الحالي';
      const collected: PendingRide[] = [];

      // ═══ 1. RPC مع الموقع (يُعيد حتى 5 رحلات مرتبة بالمسافة) ═══
      if (searchLocation?.lat && searchLocation?.lng) {
        logger.debug("RideRequestCard", `🔍 البحث من: ${searchLabel}`, {
          search_lat: searchLocation.lat,
          search_lng: searchLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: vehicleType || "economy",
        });

        try {
          const { data, error } = await supabase.rpc("get_nearby_pending_rides", {
            driver_lat: searchLocation.lat,
            driver_lng: searchLocation.lng,
            max_radius_km: maxPickupRadius,
            driver_vehicle_type: (vehicleType || "economy") as "economy" | "comfort" | "premium" | "women_only",
          });

          if (!error && data && data.length > 0) {
            for (const ride of data.slice(0, 5)) {
              if (!isRideVisible(ride.id)) continue;
              collected.push({
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
              });
            }
          }
        } catch (rpcError) {
          logger.error("RideRequestCard", "RPC error, falling to fallback", rpcError);
        }
      }

      // ═══ 2. Fallback عام إذا لم تُعد النتائج — يشمل: لا GPS، RPC رجع فارغ، أو RPC فشل ═══
      if (collected.length === 0) {
        logger.debug("RideRequestCard", "Using fallback query");
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("status", "pending")
          .is("driver_id", null)
          .order("created_at", { ascending: true })
          .limit(5);

        if (!error && data) {
          for (const ride of data) {
            if (!canDriverServeRide(vehicleType, ride.vehicle_type || "economy")) continue;
            if (!isRideVisible(ride.id)) continue;
            collected.push({
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
            });
          }
        }
      }

      // ═══ تحديث الحالة ═══
      if (collected.length > 0) {
        // إعادة تعيين العداد عند وجود نتائج
        emptyPollCountRef.current = 0;
        const firstId = collected[0].id;
        if (previousRideIdRef.current !== firstId) {
          playNotificationSound();
          safeVibrate([300, 100, 300, 100, 400]);
          previousRideIdRef.current = firstId;
        }
        setPendingRides(prev => {
          const prevIds = prev.map(r => r.id).join();
          const newIds = collected.map(r => r.id).join();
          if (prevIds !== newIds) setCurrentIndex(0);
          return collected;
        });
        setTimeLeft(calcTimeLeft(collected[0].created_at));
        onRideRequestVisible?.(true);
      } else {
        // زيادة عداد الاستعلامات الفارغة (يُستخدم في adaptive backoff)
        emptyPollCountRef.current = Math.min(emptyPollCountRef.current + 1, 10);
        setPendingRides([]);
        previousRideIdRef.current = null;
        onRideRequestVisible?.(false);
      }
    } catch (error) {
      logger.error("RideRequestCard", "Error fetching rides", error);
      setPendingRides([]);
      onRideRequestVisible?.(false);
    }
  }, [isOnline, isPaused, vehicleType, driverLocation, maxPickupRadius, canDriverServeRide, searchFromDropoff, activeRideDropoff, isRideVisible, calcTimeLeft]);

  // الـ Ref يتابع دائماً آخر نسخة من fetchPendingRides بدون إعادة الاشتراك
  useEffect(() => {
    fetchPendingRidesRef.current = fetchPendingRides;
  }, [fetchPendingRides]);

  // Subscribe to realtime ride insertions — مع debounce لمنع الدورات السريعة عند الـ init
  useEffect(() => {
    // دالة تنظيف مركزية
    const cleanupSubscription = () => {
      if (setupTimerRef.current) {
        clearTimeout(setupTimerRef.current);
        setupTimerRef.current = null;
      }
      if (activeChannelRef.current) {
        logger.debug("RideRequestCard", "Cleaning up realtime subscription");
        supabase.removeChannel(activeChannelRef.current);
        activeChannelRef.current = null;
      }
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
    };

    // إلغاء أي timer معلق فوراً
    if (setupTimerRef.current) {
      clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
    }

    if (!isOnline || !driverId || isPaused) {
      cleanupSubscription();
      return;
    }

    // ⏱️ debounce 300ms — يمنع React StrictMode وتغييرات الـ init من إنشاء اشتراكات متعددة
    setupTimerRef.current = setTimeout(() => {
      // تنظيف أي اشتراك قديم قبل الإنشاء
      if (activeChannelRef.current) {
        supabase.removeChannel(activeChannelRef.current);
        activeChannelRef.current = null;
      }

      logger.debug("RideRequestCard", "Setting up realtime subscription (stable)");

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
            if (actionInProgressRef.current) return;
            const rideData = payload.new;
            logger.debug("RideRequestCard", "⚡ New ride INSERT (pending)", rideData?.id);
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
              const skippedTime = skippedRidesRef.current[directRide.id];
              const inCooldown = skippedTime && (Date.now() - skippedTime < 60000);
              if (!inCooldown) {
                logger.debug("RideRequestCard", "✅ عرض الطلب فوراً من الـ Realtime payload");
                if (previousRideIdRef.current !== directRide.id) {
                  playNotificationSound();
                  safeVibrate([300, 100, 300, 100, 400]);
                  previousRideIdRef.current = directRide.id;
                }
                setPendingRides(prev => {
                  const alreadyIn = prev.some(r => r.id === directRide.id);
                  if (alreadyIn) return prev;
                  return [directRide, ...prev].slice(0, 5);
                });
                const elapsed = Math.floor((Date.now() - new Date(directRide.created_at).getTime()) / 1000);
                setTimeLeft(Math.max(0, 30 - elapsed));
                onRideRequestVisible?.(true);
                return;
              }
            }
            fetchPendingRidesRef.current();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rides" },
          (payload) => {
            if (actionInProgressRef.current) return;
            const oldStatus = (payload.old as Record<string, unknown>)?.status;
            const newStatus = (payload.new as Record<string, unknown>)?.status;
            const rideData = payload.new;
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
                    safeVibrate([300, 100, 300, 100, 400]);
                    previousRideIdRef.current = directRide.id;
                  }
                  setPendingRides(prev => {
                    const alreadyIn = prev.some(r => r.id === directRide.id);
                    if (alreadyIn) return prev;
                    return [directRide, ...prev].slice(0, 5);
                  });
                  const elapsed = Math.floor((Date.now() - new Date(directRide.created_at).getTime()) / 1000);
                  setTimeLeft(Math.max(0, 30 - elapsed));
                  onRideRequestVisible?.(true);
                  return;
                }
              }
              fetchPendingRidesRef.current();
            }
            if (oldStatus === 'pending' && newStatus !== 'pending') {
              logger.debug("RideRequestCard", `🔄 Ride no longer pending (${oldStatus} → ${newStatus})`);
              fetchPendingRidesRef.current();
            }
          }
        )
        .subscribe((status) => {
          logger.debug("RideRequestCard", `Realtime subscription: ${status}`);
        });

      activeChannelRef.current = channel;

      // 👁️ Force-poll when tab/app regains visibility
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          logger.debug("RideRequestCard", "👁️ Tab visible — force-polling rides");
          fetchPendingRidesRef.current();
        }
      };
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);

      setupTimerRef.current = null;
    }, 300); // ⏱️ 300ms debounce

    return cleanupSubscription;
  }, [isOnline, driverId, isPaused]); // ← بدون fetchPendingRides

  // Initial fetch and polling — يعتمد على isOnline/isPaused فقط
  useEffect(() => {
    if (!isOnline || isPaused) {
      setPendingRides([]);
      onRideRequestVisible?.(false);
      return;
    }

    // Fetch فوري
    fetchPendingRidesRef.current();

    // ═══ Adaptive Polling: 15s عادي → 30s إذا لا طلبات لفترة ═══
    // Realtime يغطي الطلبات الجديدة فوراً — الـ polling احتياطي فقط
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      // إذا 3+ استعلامات فارغة متتالية → وسّع الفاصل إلى 30 ثانية
      const interval = emptyPollCountRef.current >= 3 ? 30000 : 15000;
      pollTimer = setTimeout(() => {
        fetchPendingRidesRef.current();
        schedulePoll(); // جدولة الاستعلام التالي
      }, interval);
    };
    schedulePoll();

    return () => {
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [isOnline, isPaused]); // ← deps ثابتة

  // Countdown timer — يعتمد على الرحلة الحالية
  useEffect(() => {
    if (!pendingRide) return;
    setTimeLeft(calcTimeLeft(pendingRide.created_at));
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRide?.id, calcTimeLeft]);

  // 🛡️ Safety timeout — إذا بقي loading لأكثر من 20 ثانية، أعد الضبط تلقائياً
  useEffect(() => {
    if (!loading) return;
    const safetyTimer = setTimeout(() => {
      console.error("[RideRequestCard] ⚠️ Loading safety timeout (20s) — force-resetting");
      actionInProgressRef.current = false;
      setLoading(false);
      setActionType(null);
      // إعادة تمكين الأزرار
      toast({ title: "تحذير", description: "انتهت مهلة العملية، يمكنك المحاولة مرة أخرى", variant: "destructive" });
    }, 20000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  const handleAccept = async () => {
    // 🛡️ حماية إضافية: إعادة تعيين الحالة إذا كانت معلقة
    if (loading && actionInProgressRef.current) {
      console.warn("[RideRequestCard] ⚠️ Force resetting stuck loading state");
      actionInProgressRef.current = false;
      setLoading(false);
      setActionType(null);
      return;
    }

    if (!pendingRide || loading || actionInProgressRef.current) return;

    // 🛡️ التحقق من وجود driverId قبل المتابعة
    if (!driverId) {
      console.warn("[RideRequestCard] ⛔ handleAccept blocked — driverId is null");
      toast({ title: "خطأ", description: "لم يتم تحميل بيانات السائق بعد، حاول مرة أخرى", variant: "destructive" });
      return;
    }

    actionInProgressRef.current = true;
    setLoading(true);
    setActionType("accept");
    console.log("[RideRequestCard] 🚀 handleAccept started", { rideId: pendingRide.id, driverId });

    const rideId = pendingRide.id;

    // ═══ Helper: raw fetch مع AbortController (يلغي الطلب فعلياً عند timeout) ═══
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    try {
      // ═══ 1. الحصول على token المصادقة ═══
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('لا توجد جلسة نشطة — يرجى إعادة تسجيل الدخول');
      }

      const baseUrl = "https://wgolkcztdrwdphwjvqxt.supabase.co";
      const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo";
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Prefer': 'return=representation',
        'X-Client-Info': 'raan-captain-app',
      };

      let acceptSucceeded = false;

      // ═══ 2. محاولة RPC عبر raw fetch (تتجاوز مكتبة Supabase JS تماماً) ═══
      console.log("[RideRequestCard] 🔷 [RAW FETCH] Trying RPC accept_ride_safely...");
      try {
        const rpcRes = await fetchWithTimeout(
          `${baseUrl}/rest/v1/rpc/accept_ride_safely`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_ride_id: rideId, p_driver_id: driverId }),
          },
          12000
        );

        if (!rpcRes.ok) {
          const errBody = await rpcRes.text();
          console.warn("[RideRequestCard] RPC HTTP error:", rpcRes.status, errBody);
          throw new Error(`RPC HTTP ${rpcRes.status}: ${errBody}`);
        }

        const rpcResult = await rpcRes.json();
        console.log("[RideRequestCard] RPC result:", rpcResult);

        if (rpcResult?.success) {
          acceptSucceeded = true;
          console.log("[RideRequestCard] ✅ RPC succeeded");
        } else {
          console.warn("[RideRequestCard] RPC returned failure:", rpcResult?.error);
          throw new Error(rpcResult?.error || 'RPC returned failure');
        }
      } catch (rpcErr) {
        const isAbort = rpcErr instanceof DOMException && rpcErr.name === 'AbortError';
        console.warn("[RideRequestCard] RPC failed:", isAbort ? 'TIMEOUT (12s)' : rpcErr);
      }

      // ═══ 3. محاولة PATCH مباشر عبر raw fetch ═══
      if (!acceptSucceeded) {
        console.log("[RideRequestCard] 🔶 [RAW FETCH] Trying direct PATCH...");
        try {
          const patchRes = await fetchWithTimeout(
            `${baseUrl}/rest/v1/rides?id=eq.${rideId}&status=eq.pending`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                status: 'accepted',
                driver_id: driverId,
                matched_at: new Date().toISOString(),
              }),
            },
            12000
          );

          if (!patchRes.ok) {
            const errBody = await patchRes.text();
            console.error("[RideRequestCard] PATCH HTTP error:", patchRes.status, errBody);
            throw new Error(`PATCH HTTP ${patchRes.status}: ${errBody}`);
          }

          const rows = await patchRes.json();
          console.log("[RideRequestCard] PATCH result:", rows);

          if (Array.isArray(rows) && rows.length > 0 && rows[0].status === 'accepted') {
            acceptSucceeded = true;
            console.log("[RideRequestCard] ✅ Direct PATCH succeeded");
          } else {
            throw new Error('PATCH: no matching rows updated');
          }
        } catch (patchErr) {
          const isAbort = patchErr instanceof DOMException && patchErr.name === 'AbortError';
          console.error("[RideRequestCard] Direct PATCH failed:", isAbort ? 'TIMEOUT (12s)' : patchErr);
          throw patchErr;
        }
      }

      // ═══ تحقق نهائي ═══
      if (!acceptSucceeded) {
        throw new Error('All attempts failed');
      }

      console.log("[RideRequestCard] ✅ Accept completed successfully");
      toast({ title: "✅ تم القبول", description: "تم قبول الطلب بنجاح" });
      onRideAccepted?.();
      setPendingRides([]);
      setCurrentIndex(0);
      previousRideIdRef.current = null;
      onRideRequestVisible?.(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[RideRequestCard] ❌ Accept failed:", msg);

      // ═══ تحقق نهائي من DB — ربما نجح الطلب فعلاً لكن الاستجابة تأخرت ═══
      try {
        const { data: rideState } = await supabase
          .from('rides')
          .select('status, driver_id')
          .eq('id', rideId)
          .maybeSingle();

        if (rideState?.status === 'accepted' && rideState?.driver_id === driverId) {
          console.log("[RideRequestCard] ✅ Ride accepted silently — showing success");
          toast({ title: "✅ تم القبول", description: "تم قبول الطلب بنجاح" });
          onRideAccepted?.();
          setPendingRides([]);
          setCurrentIndex(0);
          previousRideIdRef.current = null;
          onRideRequestVisible?.(false);
          return;
        }
      } catch (verifyErr) {
        console.warn("[RideRequestCard] DB verification also failed:", verifyErr);
      }

      // ═══ فشل حقيقي ═══
      const isTaken = /already|taken|assigned|No rows|آخر|متاحة/i.test(msg);
      toast({
        title: isTaken ? "سبق قبول الطلب" : "خطأ في القبول",
        description: isTaken ? "تم قبول الطلب من سائق آخر" : "تعذّر قبول الطلب، حاول مرة أخرى",
        variant: "destructive",
      });
      setPendingRides([]);
      setCurrentIndex(0);
      previousRideIdRef.current = null;
      onRideRequestVisible?.(false);
    } finally {
      // 🛡️ ضمان إعادة تعيين الحالة دائمًا
      console.log("[RideRequestCard] 🏁 handleAccept finally — resetting state");
      actionInProgressRef.current = false;
      setLoading(false);
      setActionType(null);
    }
  };


  const handleReject = async () => {
    if (!pendingRide || loading || actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    setLoading(true);
    setActionType("reject");

    const rejectedRideId = pendingRide.id;
    skippedRidesRef.current[rejectedRideId] = Date.now();

    // احذف الرحلة الحالية من المصفوفة وانتقل للتالية
    setPendingRides(prev => {
      const next = prev.filter(r => r.id !== rejectedRideId);
      setCurrentIndex(i => Math.min(i, Math.max(0, next.length - 1)));
      if (next.length > 0) setTimeLeft(calcTimeLeft(next[Math.min(currentIndex, next.length - 1)].created_at));
      return next;
    });
    // إذا كانت هذه آخر رحلة → أبلغ الأب الفوري
    if (pendingRides.length <= 1) onRideRequestVisible?.(false);

    try {
      await supabase.rpc("update_driver_response", {
        p_ride_id: rejectedRideId,
        p_driver_id: driverId,
        p_response: "rejected",
      });
    } catch { /* غير مؤثر */ }

    toast({ title: "تم التخطي", description: pendingRides.length > 1 ? `تبقى ${pendingRides.length - 1} طلب` : "سيتم البحث عن طلبات جديدة" });
    actionInProgressRef.current = false;
    setLoading(false);
    setActionType(null);
    if (pendingRides.length <= 1) fetchPendingRidesRef.current();
  };

  const handleAcceptClick = () => {
    try {
      stopRideAlert();
    } catch (error) {
      logger.warn("RideRequestCard", "stopRideAlert failed on accept", error);
    }
    void handleAccept();
  };

  const handleRejectClick = () => {
    try {
      stopRideAlert();
    } catch (error) {
      logger.warn("RideRequestCard", "stopRideAlert failed on reject", error);
    }
    void handleReject();
  };

  // Empty state — لا شيء يظهر
  if (pendingRides.length === 0 || !pendingRide) return null;

  const timerPercent = (timeLeft / 30) * 100;
  const isUrgent = timeLeft <= 10;
  const total = pendingRides.length;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pendingRide.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed inset-0 z-50 flex flex-col pointer-events-none"
        dir="rtl"
      >
        {/* ════════════════════════════════════════════
             الجزء ١: كارد البيانات — وسط الشاشة
             ════════════════════════════════════════════ */}
        <div className="flex-1 flex items-center justify-center px-4 pointer-events-none">
          <div className="w-full max-w-sm bg-slate-900/95 backdrop-blur-lg rounded-3xl shadow-2xl shadow-black/40 border border-slate-700/50 pointer-events-auto overflow-hidden">

            {/* Timer Progress Bar */}
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mx-5 mt-3">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: `${timerPercent}%` }}
                transition={{ duration: 0.5, ease: "linear" }}
                className={`h-full rounded-full ${isUrgent ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]"}`}
              />
            </div>

            <div className="px-5 pt-4 pb-4 space-y-3">
              {/* هيدر */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}>
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </motion.div>
                  <span className="font-bold text-base text-white">طلب جديد!</span>
                  {total > 1 && (
                    <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 rounded-full px-2 py-0.5">
                      <Layers className="w-3 h-3 text-blue-400" />
                      <span className="text-xs font-bold text-blue-400">{currentIndex + 1}/{total}</span>
                    </div>
                  )}
                </div>
                <motion.div
                  animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    isUrgent ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-slate-800 text-slate-300 border border-slate-600/50"
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">{timeLeft > 0 ? `${timeLeft}ث` : 'بانتظار'}</span>
                </motion.div>
              </div>

              {/* الأجرة + الإحصائيات */}
              <div className="flex items-center gap-3">
                <div className="flex-1 relative bg-emerald-950/40 rounded-xl p-3 border border-emerald-700/30">
                  <div className="flex items-baseline gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-400 self-center" />
                    <span className="text-2xl font-black text-emerald-400 tabular-nums tracking-tight">
                      {roundFare(pendingRide.estimated_fare || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-400/70 font-medium">د.ع</span>
                  </div>
                  {pendingRide.surge_multiplier && pendingRide.surge_multiplier > 1 && (
                    <span className="absolute -top-2 -left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg shadow-amber-500/30">
                      <Zap className="w-2.5 h-2.5" />
                      x{pendingRide.surge_multiplier.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {pendingRide.distance_km && (
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5">
                      <Route className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-bold text-blue-300">{pendingRide.distance_km.toFixed(1)} كم</span>
                    </div>
                  )}
                  {pendingRide.duration_minutes && (
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-300">{pendingRide.duration_minutes} دقيقة</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">
                      {getVehicleIcon(pendingRide.vehicle_type)} {getVehicleTypeName(pendingRide.vehicle_type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* العناوين — Timeline عمودي */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/30">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-800 shadow-sm" />
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-emerald-400 to-red-400 my-1 min-h-[20px]" />
                    <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-800 shadow-sm" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
                    <div>
                      <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-0.5">نقطة الانطلاق</p>
                      <p className="text-sm font-medium text-slate-200 line-clamp-1">{pendingRide.pickup_address || "موقع الانطلاق"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-0.5">الوجهة</p>
                      <p className="text-sm font-medium text-slate-200 line-clamp-1">{pendingRide.dropoff_address || "الوجهة"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* تنقل بين الطلبات */}
              {total > 1 && (
                <div className="flex items-center justify-between px-1">
                  <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}
                    className="flex items-center gap-1 text-xs text-slate-400 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors" title="الطلب السابق">
                    <ChevronRight className="w-4 h-4" />السابق
                  </button>
                  <div className="flex gap-1.5">
                    {pendingRides.map((_, i) => (
                      <button key={i} onClick={() => setCurrentIndex(i)} title={`طلب ${i + 1}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${i === currentIndex ? "bg-emerald-500 w-4" : "bg-slate-600"}`}
                      />
                    ))}
                  </div>
                  <button onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))} disabled={currentIndex === total - 1}
                    className="flex items-center gap-1 text-xs text-slate-400 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors" title="الطلب التالي">
                    التالي<ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════
             الجزء ٢: أزرار الإجراءات — ملاصقة لأسفل الشاشة
             ════════════════════════════════════════════ */}
        <div className="pointer-events-auto bg-slate-900/98 backdrop-blur-lg border-t border-slate-700/50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex">
            {/* تخطي — 30% */}
            <Button
              variant="outline"
              className="flex-[0.3] h-16 rounded-none text-base font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 border-0 border-r border-slate-700 bg-slate-800 transition-all duration-200 touch-manipulation active:opacity-80"
              onClick={handleRejectClick}
              disabled={loading}
            >
              {loading && actionType === "reject" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><X className="w-5 h-5 ml-1.5" />تخطي</>
              )}
            </Button>

            {/* قبول — 70% */}
            <motion.div
              animate={{ boxShadow: ["0 0 0 0 rgba(16,185,129,0)", "0 0 0 10px rgba(16,185,129,0.15)", "0 0 0 0 rgba(16,185,129,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex-[0.7] rounded-none"
            >
              <Button
                className="w-full h-16 text-lg font-black bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-none transition-all duration-200 touch-manipulation active:opacity-90"
                onClick={handleAcceptClick}
                disabled={loading}
              >
                {loading && actionType === "accept" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <><Check className="w-5 h-5 ml-2" />قبول الرحلة</>
                )}
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
