
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { logger } from "@/lib/logger";
import { cleanArabicAddress } from "@/utils/addressCleaner";
import { roundFare } from "@/lib/constants";
import { stopRideAlert } from "@/lib/loudAlerts";
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
import { useAutoAccept } from "@/stores/driverStore";
import { useVehicleTypes } from "@/hooks/useVehicleTypes";
import { calculateLocalDistance } from "@/lib/mapUtils";

export interface PendingRide {
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
  onRideRequestChange?: (ride: PendingRide | null) => void;
  onMinimizedChange?: (minimized: boolean) => void;
  maxPickupRadius?: number;
  highlightRideId?: string | null;
  onDeepLinkResolved?: (rideId: string, found: boolean) => void;
}

// أسماء أنواع السيارات وأيقوناتها تأتي ديناميكياً من قاعدة البيانات عبر useVehicleTypes
// Fallback للحالات التي تكون فيها البيانات غير محملة بعد
// مثل: economy -> اقتصادي | premium -> فاخر
const VEHICLE_NAME_FALLBACK: Record<string, string> = {
  economy: "اقتصادي",
  comfort: "مريح",
  premium: "فاخر",
  women_only: "نسائي",
};

const VEHICLE_ICON_FALLBACK: Record<string, string> = {
  economy: "🚙",
  comfort: "🚗",
  premium: "🚘",
  women_only: "👩‍💼",
};

// صوت الإشعار يتم تشغيله من audioContext.ts المركزي

export const RideRequestCard = ({
  driverId,
  vehicleType,
  isOnline,
  isPaused = false,
  driverLocation = null,
  onRideAccepted,
  onRideRequestVisible,
  onRideRequestChange,
  onMinimizedChange,
  maxPickupRadius = 10,
  highlightRideId = null,
  onDeepLinkResolved,
}: RideRequestCardProps) => {
  const { toast } = useToast();
  const autoAccept = useAutoAccept();
  // ═══ أنواع السيارات الديناميكية من قاعدة البيانات ═══
  const { getVehicleTypeName, getVehicleTypeIcon } = useVehicleTypes();
  const getVehicleName = (type: string) =>
    getVehicleTypeName(type) || VEHICLE_NAME_FALLBACK[type] || type;
  const getVehicleIcon = (type: string) =>
    getVehicleTypeIcon(type) || VEHICLE_ICON_FALLBACK[type] || "🚗";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // الرحلة الحالية المعروضة
  const pendingRide = pendingRides[currentIndex] ?? null;

  useEffect(() => {
    onRideRequestChange?.(pendingRide);
  }, [pendingRide, onRideRequestChange]);

  useEffect(() => {
    setIsExpanded(false);
    setIsMinimized(false);
    onMinimizedChange?.(false);
  }, [pendingRide?.id, onMinimizedChange]);

  // حساب الوقت المتبقي من created_at بدلاً من إعادة العد من 30
  const calcTimeLeft = useCallback((createdAt: string): number => {
    const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, TIMER_DURATION - elapsed);
  }, []);

  // ✨ Cooldown: الرحلات المتخطاة تختفي 60 ثانية (محفوظة في localStorage)
  const skippedRidesRef = useRef<Record<string, number>>((() => {
    try {
      const stored = localStorage.getItem('raan_skipped_rides');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        // تنظيف المنتهية الصلاحية عند التحميل
        const valid: Record<string, number> = {};
        for (const [id, time] of Object.entries(parsed)) {
          if (now - (time as number) < 60000) valid[id] = time as number;
        }
        return valid;
      }
    } catch {}
    return {};
  })());

  // Track active ride to search from dropoff location
  const [activeRideDropoff, setActiveRideDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [searchFromDropoff, setSearchFromDropoff] = useState(false);
  // عداد الاستعلامات الفارغة المتتالية — لتوسيع الفاصل الزمني (adaptive backoff)
  const emptyPollCountRef = useRef(0);
  const hasActiveRideRef = useRef(false);

  // Ref لـ fetchPendingRides — يمنع إعادة الاشتراك في Realtime مع كل تغيير موقع
  const fetchPendingRidesRef = useRef<() => void>(() => {});
  // Refs لتتبع آخر موقع ونطاق السائق داخل الـ Realtime handler (بدون إعادة اشتراك)
  const driverLocationRef = useRef(driverLocation);
  const maxPickupRadiusRef = useRef(maxPickupRadius);
  // Refs لإدارة الاشتراك بالـ debounce
  const setupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  // تجنب استدعاء onRideRequestVisible بنفس القيمة مراراً (يمنع re-render الأب)
  const lastVisibleStateRef = useRef<boolean | null>(null);
  const stableOnRideRequestVisible = useCallback((visible: boolean) => {
    if (lastVisibleStateRef.current === visible) return;
    lastVisibleStateRef.current = visible;
    onRideRequestVisible?.(visible);
  }, [onRideRequestVisible]);

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
        try { localStorage.setItem('raan_skipped_rides', JSON.stringify(skipped)); } catch {}
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
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeRide && activeRide.dropoff_location) {
          const dropoff = activeRide.dropoff_location as { lat: number; lng: number };
          setActiveRideDropoff(dropoff);
          setSearchFromDropoff(true);
          hasActiveRideRef.current = true;
          // 🛡️ إخفاء بطاقات الطلبات فوراً عند وجود رحلة نشطة
          setPendingRides([]);
          stableOnRideRequestVisible(false);
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
    // فحص الرحلة النشطة كل 30 ثانية (كان 15) — لتقليل Disk IO
    const interval = setInterval(checkActiveRide, 30000);

    return () => clearInterval(interval);
  }, [driverId, isOnline]);

  const fetchPendingRides = useCallback(async () => {
    if (actionInProgressRef.current) return;
    if (!isOnline || isPaused) {
      setPendingRides([]);
      return;
    }

    if (!driverId) {
      setPendingRides([]);
      stableOnRideRequestVisible(false);
      return;
    }

    // 🛡️ لا تبحث عن طلبات جديدة إذا السائق لديه رحلة نشطة بالفعل
    if (hasActiveRideRef.current) {
      setPendingRides([]);
      stableOnRideRequestVisible(false);
      return;
    }

    try {
      const searchLocation = searchFromDropoff && activeRideDropoff ? activeRideDropoff : driverLocation;
      const searchLabel = searchFromDropoff && activeRideDropoff ? 'موقع الوجهة' : 'الموقع الحالي';
      const collected: PendingRide[] = [];

      let rpcRanSuccessfully = false;

      // ═══ 1. RPC مع الموقع (يُعيد حتى 5 رحلات مرتبة بالمسافة) ═══
      if (searchLocation?.lat && searchLocation?.lng) {
        logger.debug("RideRequestCard", `🔍 البحث من: ${searchLabel}`, {
          search_lat: searchLocation.lat,
          search_lng: searchLocation.lng,
          max_radius_km: maxPickupRadius,
          driver_vehicle_type: vehicleType || "economy",
        });

        try {
          const { data, error } = await supabase.rpc("get_nearby_pending_rides_geospatial", {
            p_driver_id: driverId,
            p_radius_meters: maxPickupRadius * 1000,
            p_limit: 5,
          });

          if (error) {
            logger.warn("RideRequestCard", "Geospatial RPC failed, using fallback", error);
          } else {
            rpcRanSuccessfully = true;
            if (data && data.length > 0) {
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
          }
        } catch (rpcError) {
          logger.warn("RideRequestCard", "Geospatial RPC failed, using fallback", rpcError);
        }
      }

      // ═══ 2. Fallback عام إذا لم تُعد النتائج — يشمل: لا GPS، أو RPC فشل ═══
      if (collected.length === 0 && !rpcRanSuccessfully) {
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
            // 🗺️ فلتر جغرافي للـ fallback: تجاهل إذا الرحلة خارج نطاق السائق (إذا توفر الموقع)
            if (searchLocation?.lat && searchLocation?.lng) {
              const pickup = ride.pickup_location as { lat: number; lng: number } | null;
              if (pickup?.lat && pickup?.lng) {
                const distKm = calculateLocalDistance(searchLocation, pickup);
                if (distKm > maxPickupRadius) {
                  logger.debug("RideRequestCard", `🗺️ فلتر fallback: تجاهل ${ride.id} — ${distKm.toFixed(1)}km > ${maxPickupRadius}km`);
                  continue;
                }
              }
            }
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

      // ═══ دعم Deep Link: جلب الطلب الهدف مباشرة حتى لو لم يظهر ضمن أول 5 نتائج ═══
      if (highlightRideId && !collected.some((ride) => ride.id === highlightRideId)) {
        const { data: targetedRide, error: targetedRideError } = await supabase
          .from("rides")
          .select("*")
          .eq("id", highlightRideId)
          .eq("status", "pending")
          .is("driver_id", null)
          .maybeSingle();

        if (!targetedRideError && targetedRide) {
          const targetedRideVehicleType = targetedRide.vehicle_type || "economy";
          if (canDriverServeRide(vehicleType, targetedRideVehicleType)) {
            const mappedTargetRide: PendingRide = {
              id: targetedRide.id,
              pickup_location: targetedRide.pickup_location as { lat: number; lng: number },
              dropoff_location: targetedRide.dropoff_location as { lat: number; lng: number },
              pickup_address: targetedRide.pickup_address,
              dropoff_address: targetedRide.dropoff_address,
              estimated_fare: targetedRide.estimated_fare,
              distance_km: targetedRide.distance_km ? Number(targetedRide.distance_km) : null,
              duration_minutes: targetedRide.duration_minutes,
              vehicle_type: targetedRideVehicleType,
              created_at: targetedRide.created_at,
              rider_id: targetedRide.rider_id || "",
              surge_multiplier: (targetedRide as any).surge_multiplier ?? undefined,
            };

            collected.unshift(mappedTargetRide);
            if (collected.length > 5) {
              collected.length = 5;
            }
          }
        }
      }

      // ═══ تحديث الحالة ═══
      if (collected.length > 0) {
        // إعادة تعيين العداد عند وجود نتائج
        emptyPollCountRef.current = 0;
        const firstId = collected[0].id;
        if (previousRideIdRef.current !== firstId) {
          previousRideIdRef.current = firstId;
        }
        setPendingRides(prev => {
          const prevIds = prev.map(r => r.id).join();
          const newIds = collected.map(r => r.id).join();
          const targetIndex = highlightRideId ? collected.findIndex((ride) => ride.id === highlightRideId) : -1;
          if (targetIndex >= 0) {
            setCurrentIndex(targetIndex);
          } else if (prevIds !== newIds) {
            setCurrentIndex(0);
          }
          // تجنب إعادة الرسم إذا نفس الرحلات (يمنع الوميض)
          if (prevIds === newIds && targetIndex < 0) return prev;
          return collected;
        });
        setTimeLeft(calcTimeLeft(collected[0].created_at));
        stableOnRideRequestVisible(true);
      } else {
        // زيادة عداد الاستعلامات الفارغة (يُستخدم في adaptive backoff)
        emptyPollCountRef.current = Math.min(emptyPollCountRef.current + 1, 10);
        setPendingRides([]);
        previousRideIdRef.current = null;
        stableOnRideRequestVisible(false);
      }
    } catch (error) {
      logger.error("RideRequestCard", "Error fetching rides", error);
      setPendingRides([]);
      stableOnRideRequestVisible(false);
    }
  }, [isOnline, isPaused, vehicleType, driverLocation, maxPickupRadius, canDriverServeRide, searchFromDropoff, activeRideDropoff, isRideVisible, calcTimeLeft, highlightRideId]);

  useEffect(() => {
    if (!highlightRideId) return;

    const targetIndex = pendingRides.findIndex((ride) => ride.id === highlightRideId);
    if (targetIndex >= 0) {
      setCurrentIndex(targetIndex);
      onDeepLinkResolved?.(highlightRideId, true);
      return;
    }

    if (pendingRides.length > 0) {
      onDeepLinkResolved?.(highlightRideId, false);
    }
  }, [highlightRideId, pendingRides, onDeepLinkResolved]);

  // الـ Ref يتابع دائماً آخر نسخة من fetchPendingRides بدون إعادة الاشتراك
  useEffect(() => {
    fetchPendingRidesRef.current = fetchPendingRides;
  }, [fetchPendingRides]);

  // تحديث refs الموقع والنطاق فوراً مع كل تغيير (بدون إعادة الاشتراك)
  useEffect(() => { driverLocationRef.current = driverLocation; }, [driverLocation]);
  useEffect(() => { maxPickupRadiusRef.current = maxPickupRadius; }, [maxPickupRadius]);

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
            // 🛡️ تجاهل الطلبات الجديدة إذا السائق لديه رحلة نشطة
            if (hasActiveRideRef.current) return;
            const rideData = payload.new;
            logger.debug("RideRequestCard", "⚡ New ride INSERT (pending)", rideData?.id);
            if (rideData && rideData.id && rideData.status === 'pending' && !rideData.driver_id) {
              // 🗺️ فلتر جغرافي: تجاهل الرحلة إذا كانت خارج نطاق السائق
              const loc = driverLocationRef.current;
              const radius = maxPickupRadiusRef.current;
              const pickupLoc = rideData.pickup_location as { lat: number; lng: number } | null;
              if (loc?.lat && loc?.lng && pickupLoc?.lat && pickupLoc?.lng) {
                const distKm = calculateLocalDistance(loc, pickupLoc);
                if (distKm > radius) {
                  logger.debug("RideRequestCard", `🗺️ تجاهل الرحلة ${rideData.id} — خارج النطاق (${distKm.toFixed(1)}km > ${radius}km)`);
                  return;
                }
              }
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
                  previousRideIdRef.current = directRide.id;
                }
                setPendingRides(prev => {
                  const alreadyIn = prev.some(r => r.id === directRide.id);
                  if (alreadyIn) return prev;
                  return [directRide, ...prev].slice(0, 5);
                });
                const elapsed = Math.floor((Date.now() - new Date(directRide.created_at).getTime()) / 1000);
                setTimeLeft(Math.max(0, 30 - elapsed));
                stableOnRideRequestVisible(true);
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
            // 🛡️ تجاهل الطلبات الجديدة إذا السائق لديه رحلة نشطة
            if (hasActiveRideRef.current) return;
            const oldStatus = (payload.old as Record<string, unknown>)?.status;
            const newStatus = (payload.new as Record<string, unknown>)?.status;
            const rideData = payload.new;
            if (newStatus === 'pending' && oldStatus !== 'pending' && rideData) {
              logger.debug("RideRequestCard", `⚡ Ride UPDATE to pending (${oldStatus} → ${newStatus})`, rideData.id);
              if (rideData.id && !rideData.driver_id) {
                // 🗺️ فلتر جغرافي: تجاهل الرحلة إذا كانت خارج نطاق السائق
                const loc = driverLocationRef.current;
                const radius = maxPickupRadiusRef.current;
                const pickupLoc = rideData.pickup_location as { lat: number; lng: number } | null;
                if (loc?.lat && loc?.lng && pickupLoc?.lat && pickupLoc?.lng) {
                  const distKm = calculateLocalDistance(loc, pickupLoc);
                  if (distKm > radius) {
                    logger.debug("RideRequestCard", `🗺️ تجاهل الرحلة ${rideData.id} (UPDATE→pending) — خارج النطاق (${distKm.toFixed(1)}km > ${radius}km)`);
                    return;
                  }
                }
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
                    previousRideIdRef.current = directRide.id;
                  }
                  setPendingRides(prev => {
                    const alreadyIn = prev.some(r => r.id === directRide.id);
                    if (alreadyIn) return prev;
                    return [directRide, ...prev].slice(0, 5);
                  });
                  const elapsed = Math.floor((Date.now() - new Date(directRide.created_at).getTime()) / 1000);
                  setTimeLeft(Math.max(0, 30 - elapsed));
                  stableOnRideRequestVisible(true);
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

      // 👁️ Force-poll when tab/app regains visibility (مع debounce لمنع الوميض)
      let lastVisibilityPoll = 0;
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const now = Date.now();
          // تجاهل إذا آخر poll كان قبل أقل من 3 ثوانٍ
          if (now - lastVisibilityPoll < 3000) return;
          lastVisibilityPoll = now;
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
      stableOnRideRequestVisible(false);
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
        // 🛡️ لا polling إذا السائق لديه رحلة نشطة
        if (!hasActiveRideRef.current) {
          fetchPendingRidesRef.current();
        }
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

  // 🛡️ Reset loading state when ride changes — prevents stuck buttons between rides
  useEffect(() => {
    actionInProgressRef.current = false;
    setLoading(false);
    setActionType(null);
  }, [pendingRide?.id]);

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

    // 🛡️ تحقق مزدوج: لا تقبل رحلة جديدة إذا السائق لديه رحلة نشطة
    if (hasActiveRideRef.current) {
      console.warn("[RideRequestCard] ⚠️ handleAccept blocked — driver already has active ride");
      toast({ title: "تنبيه", description: "لديك رحلة نشطة حالياً", variant: "destructive" });
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

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Prefer': 'return=representation',
        'X-Client-Info': 'raan-captain-app',
      };

      let acceptSucceeded = false;

      // ═══ 2. محاولة RPC عبر raw fetch (تتجاوز مكتبة Supabase JS تماماً) ═══
      // يستخدم accept_ride_safely RPC الذي يقفل الصف بـ SELECT FOR UPDATE SKIP LOCKED
      // لمنع قبول سائقين لنفس الرحلة (race condition)
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
        console.warn("[RideRequestCard] RPC attempt 1 failed:", isAbort ? 'TIMEOUT (12s)' : rpcErr);
      }

      // ═══ 3. إعادة محاولة RPC بمهلة أطول (بدلاً من PATCH مباشر غير آمن) ═══
      if (!acceptSucceeded) {
        console.log("[RideRequestCard] 🔷 [RAW FETCH] Retrying RPC accept_ride_safely (attempt 2)...");
        try {
          await new Promise(r => setTimeout(r, 1000));
          const rpcRes2 = await fetchWithTimeout(
            `${baseUrl}/rest/v1/rpc/accept_ride_safely`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({ p_ride_id: rideId, p_driver_id: driverId }),
            },
            15000
          );

          if (!rpcRes2.ok) {
            const errBody = await rpcRes2.text();
            console.error("[RideRequestCard] RPC retry HTTP error:", rpcRes2.status, errBody);
            throw new Error(`RPC retry HTTP ${rpcRes2.status}: ${errBody}`);
          }

          const rpcResult2 = await rpcRes2.json();
          console.log("[RideRequestCard] RPC retry result:", rpcResult2);

          if (rpcResult2?.success) {
            acceptSucceeded = true;
            console.log("[RideRequestCard] ✅ RPC retry succeeded");
          } else {
            throw new Error(rpcResult2?.error || 'RPC retry returned failure');
          }
        } catch (retryErr) {
          const isAbort = retryErr instanceof DOMException && retryErr.name === 'AbortError';
          console.error("[RideRequestCard] RPC attempt 2 failed:", isAbort ? 'TIMEOUT (15s)' : retryErr);
          throw retryErr;
        }
      }

      // ═══ تحقق نهائي ═══
      if (!acceptSucceeded) {
        throw new Error('All RPC attempts failed');
      }

      console.log("[RideRequestCard] ✅ Accept completed successfully");
      onRideAccepted?.();
      setPendingRides([]);
      setCurrentIndex(0);
      previousRideIdRef.current = null;
      stableOnRideRequestVisible(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[RideRequestCard] ❌ Accept failed:", msg);

      // ═══ تحقق نهائي من DB — ربما نجح الطلب فعلاً لكن الاستجابة تأخرت ═══
      let silentSuccess = false;
      try {
        const { data: rideState } = await supabase
          .from('rides')
          .select('status, driver_id')
          .eq('id', rideId)
          .maybeSingle();

        if (rideState?.status === 'accepted' && rideState?.driver_id === driverId) {
          console.log("[RideRequestCard] ✅ Ride accepted silently — showing success");
          silentSuccess = true;
          onRideAccepted?.();
          setPendingRides([]);
          setCurrentIndex(0);
          previousRideIdRef.current = null;
          stableOnRideRequestVisible(false);
          // ❗ لا نستخدم return هنا لضمان تنفيذ finally
        }
      } catch (verifyErr) {
        console.warn("[RideRequestCard] DB verification also failed:", verifyErr);
      }

      if (!silentSuccess) {
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
        stableOnRideRequestVisible(false);
      }
    } finally {
      // ⚡ ضمان إعادة تعيين الحالة دائماً — ينفذ حتى بعد silentSuccess
      console.log("[RideRequestCard] 🏁 handleAccept finally — resetting state");
      actionInProgressRef.current = false;
      setLoading(false);
      setActionType(null);
    }
  };

  // 🚀 ميزة القبول التلقائي الفعلي
  useEffect(() => {
    if (autoAccept && pendingRide && !loading && !actionInProgressRef.current) {
      console.log("[RideRequestCard] ⚡ Auto-accept triggered for ride:", pendingRide.id);
      toast({ title: "قبول تلقائي ⚡", description: "جاري قبول الطلب تلقائياً..." });
      handleAccept();
    }
  }, [autoAccept, pendingRide?.id, loading]);

  const handleReject = async () => {
    if (!pendingRide || loading || actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    setLoading(true);
    setActionType("reject");

    const rejectedRideId = pendingRide.id;
    const wasLastRide = pendingRides.length <= 1;
    skippedRidesRef.current[rejectedRideId] = Date.now();
    try { localStorage.setItem('raan_skipped_rides', JSON.stringify(skippedRidesRef.current)); } catch {}

    // احذف الرحلة الحالية من المصفوفة وانتقل للتالية
    setPendingRides(prev => {
      const next = prev.filter(r => r.id !== rejectedRideId);
      setCurrentIndex(i => Math.min(i, Math.max(0, next.length - 1)));
      if (next.length > 0) setTimeLeft(calcTimeLeft(next[Math.min(currentIndex, next.length - 1)].created_at));
      return next;
    });
    // إذا كانت هذه آخر رحلة → أبلغ الأب الفوري
    if (wasLastRide) stableOnRideRequestVisible(false);

    try {
      await supabase.rpc("update_driver_response", {
        p_ride_id: rejectedRideId,
        p_driver_id: driverId,
        p_response: "rejected",
      });
    } catch { /* غير مؤثر */ }

    toast({ title: "تم التخطي", description: !wasLastRide ? `تبقى ${pendingRides.length - 1} طلب` : "سيتم البحث عن طلبات جديدة" });
    actionInProgressRef.current = false;
    setLoading(false);
    setActionType(null);
    // تأخير البحث عن طلبات جديدة لمنع الوميض (يتيح استقرار الحالة)
    if (wasLastRide) setTimeout(() => fetchPendingRidesRef.current(), 800);
  };

  const handleAcceptClick = () => {
    // 🛡️ حماية من الضغط المزدوج — فحص متزامن (synchronous) قبل الـ async handleAccept
    if (loading || actionInProgressRef.current) {
      console.log("[RideRequestCard] 🛡️ Double-tap blocked");
      return;
    }
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
  const pickupDistanceKm = driverLocation && pendingRide.pickup_location
    ? calculateLocalDistance(driverLocation, pendingRide.pickup_location)
    : null;

  const setRequestMinimized = (minimized: boolean) => {
    setIsMinimized(minimized);
    onMinimizedChange?.(minimized);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pendingRide.id}
        initial={{ y: "100%", height: "auto" }}
        animate={{ y: 0, height: isExpanded ? "80dvh" : "auto" }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto flex flex-col"
        dir="rtl"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, { offset, velocity }) => {
          if (offset.y < -40 || velocity.y < -400) {
            if (isMinimized) {
              setRequestMinimized(false);
              setIsExpanded(false);
            } else {
              setRequestMinimized(false);
              setIsExpanded(true);
            }
          } else if (offset.y > 40 || velocity.y > 400) {
            if (isExpanded) {
              setIsExpanded(false);
              setRequestMinimized(false);
            } else {
              setIsExpanded(false);
              setRequestMinimized(true);
            }
          }
        }}
      >
        {/* ═══ Bottom Sheet — Dark Luxury ═══ */}
        <div
          className="bg-[#0b1326] rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.4)] border-t border-slate-700/30 relative flex flex-col w-full h-full"
        >
          {/* Subtle Glow at top */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#5bdda6]/30 to-transparent blur-sm pointer-events-none" />

          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing w-full">
            <div className="w-12 h-1.5 rounded-full bg-slate-700" />
          </div>

          <div className="px-5 pt-3 pb-2 space-y-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
            {isMinimized ? (
              <div className="shrink-0 rounded-lg border border-slate-700/30 bg-[#171f33] px-3 py-3">
                <div className="flex items-center gap-3 min-w-0">

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#5bdda6]" style={{ fontFamily: "Cairo, sans-serif" }}>طلب جديد</p>
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {cleanArabicAddress(pendingRide.pickup_address || "موقع العميل")}
                    </p>
                  </div>
                  <div className="shrink-0 text-left" style={{ fontFamily: "Cairo, sans-serif" }}>
                    <div className="text-base font-black text-[#5bdda6] tabular-nums">
                      {roundFare(pendingRide.estimated_fare || 0).toLocaleString('en-US')} د.ع
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      {pickupDistanceKm !== null ? `${pickupDistanceKm.toFixed(1)} كم` : "المسافة غير متاحة"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* هيدر: العنوان */}
                <div className="flex items-center justify-center shrink-0">
                  <span className="font-extrabold text-xl text-white tracking-wide" style={{ fontFamily: "Cairo, sans-serif" }}>طلب جديد</span>
                </div>

                {/* الأجرة + الإحصائيات (Bento Layout) */}
                <div className="flex flex-col gap-3 shrink-0">
                  {/* الصف الأول: السعر والنوع */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* بطاقة السعر */}
                    <div className="bg-[#171f33] rounded-2xl p-4 border border-slate-700/30 flex flex-col justify-center items-center relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-b from-[#5bdda6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center gap-1.5 mb-1.5">
                       <Wallet className="w-4 h-4 text-[#5bdda6]/70" />
                       <span className="text-xs font-semibold text-slate-400">الأجرة المقدرة</span>
                      </div>
                      <div className="flex items-baseline gap-1.5" style={{ fontFamily: "Cairo, sans-serif" }}>
                        <span className="text-3xl font-black text-[#5bdda6] tabular-nums tracking-tight">
                          {roundFare(pendingRide.estimated_fare || 0).toLocaleString('en-US')}
                        </span>
                        <span className="text-sm text-[#5bdda6]/70 font-semibold">د.ع</span>
                      </div>
                      {pendingRide.surge_multiplier && pendingRide.surge_multiplier > 1 && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          x{pendingRide.surge_multiplier.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* بطاقة النوع */}
                    <div className="bg-[#171f33] rounded-2xl p-4 border border-slate-700/30 flex flex-col justify-center items-center relative overflow-hidden">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Car className="w-4 h-4 text-[#5bdda6]/70" />
                        <span className="text-xs font-semibold text-slate-400">نوع السيارة</span>
                      </div>

                      <span className="text-xl font-black text-[#5bdda6] tracking-wide mt-0.5" style={{ fontFamily: "Cairo, sans-serif" }}>
                        {getVehicleName(pendingRide.vehicle_type)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* العناوين — Timeline */}
                <div className="bg-[#171f33] rounded-2xl p-4 border border-slate-700/30 relative shrink-0">
                  <div className="flex gap-4">
                    {/* Timeline Dots */}
                    <div className="flex flex-col items-center pt-2 pb-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#5bdda6] shadow-[0_0_8px_rgba(91,221,166,0.6)]" />
                      <div className="w-0.5 flex-1 bg-gradient-to-b from-[#5bdda6]/50 to-blue-500/50 my-1 min-h-[32px]" />
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    </div>
                    
                    {/* Locations */}
                    <div className="flex-1 flex flex-col justify-between gap-4 min-w-0 py-0.5">
                      <div>
                        <p className="text-xs text-[#5bdda6] font-bold mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>نقطة الانطلاق</p>
                        <p className="text-base font-semibold text-slate-200 line-clamp-1 leading-snug">{cleanArabicAddress(pendingRide.pickup_address || "موقع الانطلاق")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-400 font-bold mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>الوجهة</p>
                        <p className="text-base font-semibold text-slate-200 line-clamp-1 leading-snug">{cleanArabicAddress(pendingRide.dropoff_address || "الوجهة")}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* تنقل بين الطلبات (إذا كان هناك أكثر من طلب) */}
                {total > 1 && (
                  <div className="flex items-center justify-between px-2 bg-[#171f33] rounded-xl p-2 border border-slate-700/30 shrink-0 mt-auto">
                    <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-4 h-4" />السابق
                    </button>
                    <div className="flex gap-1.5">
                      {pendingRides.map((_, i) => (
                        <button key={i} onClick={() => setCurrentIndex(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-[#5bdda6] w-5" : "bg-slate-700 w-1.5"}`}
                        />
                      ))}
                    </div>
                    <button onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))} disabled={currentIndex === total - 1}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
                      التالي<ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* Expanded spacer to push actions down if expanded */}
                {isExpanded && <div className="flex-1" />}
              </>
            )}
          </div>

          {/* ═══ أزرار الإجراءات ═══ */}
          <div className="flex w-full mt-auto shrink-0 bg-[#163d30]" style={{ zIndex: 10 }}>
            {/* تخطي — Style Dark Luxury Secondary */}
            <Button
              variant="outline"
              className="flex-1 max-w-[120px] rounded-none flex items-center justify-center text-[18px] font-black text-emerald-300 bg-[#0f2922] hover:bg-[#163d30] transition-colors disabled:opacity-50 touch-manipulation border-none border-t border-l border-emerald-500/20"
              onClick={handleRejectClick}
              disabled={loading}
              style={{
                fontFamily: "Cairo, sans-serif",
                paddingTop: "26px",
                paddingBottom: "calc(26px + var(--safe-area-bottom, 0px))"
              }}
            >
              {loading && actionType === "reject" ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <div className="flex items-center gap-1">
                  <X className="w-4 h-4" />
                  <span>تخطي</span>
                </div>
              )}
            </Button>

            {/* قبول — Emerald Glow */}
            <div className="flex-auto rounded-none">
              <Button
                className="relative overflow-hidden w-full text-[18px] font-black text-emerald-950 rounded-none border-none transition-all active:scale-[0.98] bg-[#5bdda6] hover:bg-[#34d399]"
                onClick={handleAcceptClick}
                disabled={loading}
                style={{
                  fontFamily: "Cairo, sans-serif",
                  paddingTop: "26px",
                  paddingBottom: "calc(26px + var(--safe-area-bottom, 0px))"
                }}
              >
                {/* المحتوى والنصوص */}
                <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none">
                  {loading && actionType === "accept" ? (
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-950" />
                  ) : (
                    <div className="flex items-center justify-center gap-2 shadow-black/20 text-emerald-950">
                      <span>قبول الرحلة</span>
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                  )}
                </div>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
