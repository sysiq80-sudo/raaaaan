import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import {
  playSound,
  vibrate,
  VibrationPatterns,
} from "@/utils/rideNotificationSounds";
import { cacheActiveRide, getCachedActiveRide } from "@/hooks/useOfflineMode";
import { EventDeduplicator } from "@/lib/eventDeduplication";
import type { RideEvent } from "@/lib/eventDeduplication";

const LOG_CONTEXT = "useActiveRide";

export interface ActiveRide {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  status: string;
  estimated_fare: number | null;
  final_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  driver_id: string | null;
  created_at: string;
  completed_at: string | null;
  driver_rating?: number | null;
  driver_name?: string | null;
  payment_method?: string | null;
}

export const useActiveRide = (userId: string | null) => {
  const { toast } = useToast();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [showWaitingScreen, setShowWaitingScreen] = useState(false);
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [completedRide, setCompletedRide] = useState<ActiveRide | null>(null);
  const [showCompletedScreen, setShowCompletedScreen] = useState(false);
  const previousStatusRef = useRef<string | null>(null);
  const activeRideIdRef = useRef<string | null>(null);

  /**
   * ignorePolling: يُفعّل عند بدء حجز من التطبيق (GoPage) لتجنب سباق مع استعلامات التتبع.
   * يُلغى عند ظهور الرحلة (Realtime/INSERT) أو عند إلغاء الحجز.
   * لا تغيّر ترتيب استدعاء setIgnorePolling(true) قبل insert و setIgnorePolling(false) بعد ظهور الرحلة
   * وإلا قد لا تتحدث واجهة الراكب. انظر useRideTracking و GoPage.
   */
  const ignorePollingRef = useRef(false);
  const setIgnorePolling = useCallback((v: boolean) => {
    ignorePollingRef.current = v;
  }, []);

  // EventDeduplicator: منع معالجة أحداث Realtime المكررة
  const dedupRef = useRef(new EventDeduplicator());

  // Helper to parse ride data
  const parseRideData = useCallback(
    (rideData: any): ActiveRide => ({
      id: rideData.id,
      pickup_location: rideData.pickup_location,
      dropoff_location: rideData.dropoff_location,
      pickup_address: rideData.pickup_address,
      dropoff_address: rideData.dropoff_address,
      status: rideData.status,
      estimated_fare: rideData.estimated_fare,
      final_fare: rideData.final_fare,
      distance_km: rideData.distance_km,
      duration_minutes: rideData.duration_minutes,
      vehicle_type: rideData.vehicle_type,
      driver_id: rideData.driver_id,
      created_at: rideData.created_at,
      completed_at: rideData.completed_at,
      driver_rating: rideData.driver_rating,
      payment_method: rideData.payment_method,
    }),
    []
  );

  // Handle ride status change with notifications
  const handleStatusChange = useCallback(
    (newStatus: string, previousStatus: string | null, updatedRide: any) => {
      logger.debug(LOG_CONTEXT, "Status changed", { previousStatus, newStatus });

      if (newStatus === "cancelled" || newStatus === "completed") {
        // حفظ الرحلة المكتملة قبل مسحها لعرض شاشة التقييم
        if (newStatus === "completed") {
          const completedRideData = parseRideData(updatedRide);
          
          // ✅ تحسين: التحقق الدقيق من حالة الطوارئ
          const isEmergency = updatedRide.emergency_completed === true;
          
          if (isEmergency) {
            logger.debug(LOG_CONTEXT, "Emergency completed - skipping rating screen");
            setCompletedRide(null);
            setShowCompletedScreen(false);
          } else {
            logger.debug(LOG_CONTEXT, "Setting completed ride data for rating screen");
            
            // ✅ FIX: جلب اسم السائق الحقيقي
            if (updatedRide.driver_id) {
              supabase
                .from("drivers")
                .select("full_name")
                .eq("id", updatedRide.driver_id)
                .maybeSingle()
                .then(({ data: driverData }) => {
                  if (driverData?.full_name) {
                    setCompletedRide({ ...completedRideData, driver_name: driverData.full_name });
                  }
                })
                .then(undefined, () => {});
            }
            
            setCompletedRide(completedRideData);
            
            // ✅ عرض شاشة التقييم فوراً — queueMicrotask أسرع من setTimeout
            queueMicrotask(() => {
              setShowCompletedScreen(true);
              playSound("completed");
              vibrate(VibrationPatterns.inProgress);
              toast({
                title: "🎉 تمت الرحلة بنجاح!",
                description: "شكراً لاستخدامك ران - يرجى تقييم السائق",
                duration: 5000,
              });
            });
          }
        }

        // ✅ مسح الحالة بعد تأخير مخفض لمنع race condition
        setTimeout(() => {
          setActiveRide(null);
          setShowLiveTracker(false);
          setShowWaitingScreen(false);
          setPendingRideId(null);
        }, newStatus === "completed" && updatedRide.emergency_completed !== true ? 50 : 0);

        if (newStatus === "cancelled") {
          // تجاهل الإلغاءات الصامتة من النظام (للرحلات القديمة)
          const isSilentCancel = updatedRide.silent_cancel === true || 
                                  updatedRide.cancellation_reason === "إلغاء تلقائي - رحلة جديدة" ||
                                  updatedRide.cancelled_by === "system";
          
          if (!isSilentCancel) {
            // إلغاء من قبل المستخدم - إظهار الإشعار
            playSound("cancelled");
            vibrate(VibrationPatterns.cancelled);
            toast({
              title: "تم إلغاء الرحلة ❌",
              description: updatedRide.cancellation_reason || "تم إلغاء الرحلة",
              variant: "destructive",
            });
          } else {
            logger.debug(LOG_CONTEXT, "Silent system cancellation - no notification");
          }
        }
        return;
      }

      // Handle accepted status
      if (newStatus === "accepted" && previousStatus === "pending") {
        logger.debug(LOG_CONTEXT, "Driver accepted - switching to live tracker");

        playSound("accepted");
        vibrate(VibrationPatterns.accepted);

        toast({
          title: "🎉 تم قبول طلبك!",
          description: "السائق في الطريق إليك الآن",
          duration: 8000,
        });

        // Switch screens immediately
        setShowWaitingScreen(false);
        setShowLiveTracker(true);
        setPendingRideId(null);
      }

      // Handle arrived status
      if (newStatus === "arrived" && previousStatus !== "arrived") {
        playSound("arrived");
        vibrate(VibrationPatterns.arrived);

        toast({
          title: "🔔 السائق وصل!",
          description: "اخرج الآن - السائق في انتظارك",
          duration: 10000,
        });

      }

      // Handle in_progress status
      if (newStatus === "in_progress" && previousStatus !== "in_progress") {
        playSound("inProgress");
        vibrate(VibrationPatterns.inProgress);

        toast({
          title: "🛣️ انطلقت الرحلة!",
          description: "أنت في الطريق للوجهة - رحلة موفقة",
          duration: 5000,
        });
      }

      // Update ride state
      const parsedRide = parseRideData(updatedRide);
      setActiveRide(parsedRide);
    },
    [toast, parseRideData]
  );

  // Check for active ride on mount and continuously
  const checkActiveRide = useCallback(async () => {
    if (!userId) {
      // لا يوجد مستخدم - تخطي الفحص بالكامل
      return;
    }

    // Skip if external booking flow wants to disable polling (prevents race)
    if (ignorePollingRef.current) {
      logger.debug(LOG_CONTEXT, "Skipping checkActiveRide - ignorePolling is set");
      return;
    }

    logger.debug(LOG_CONTEXT, "Checking for active ride");

    const { data: rides, error } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", userId)
      .in("status", ["pending", "accepted", "arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    // استرجاع من الكاش عند فشل الاتصال
    if (error && !navigator.onLine) {
      logger.debug(LOG_CONTEXT, "Offline - loading cached active ride");
      const cached = getCachedActiveRide();
      if (cached?.ride) {
        const parsedRide = parseRideData(cached.ride);
        setActiveRide(parsedRide);
        previousStatusRef.current = parsedRide.status;
        if (parsedRide.status === "pending") {
          setPendingRideId(parsedRide.id);
          setShowWaitingScreen(true);
          setShowLiveTracker(false);
        } else {
          setShowWaitingScreen(false);
          setShowLiveTracker(true);
        }
      }
      return;
    }

    if (!error && rides && rides.length > 0) {
      const rideData = rides[0] as any;
      const parsedRide = parseRideData(rideData);

      setActiveRide(parsedRide);
      previousStatusRef.current = rideData.status;

      // حفظ الرحلة النشطة للعمل دون اتصال
      cacheActiveRide(rideData);

      if (rideData.status === "pending") {
        setPendingRideId(rideData.id);
        setShowWaitingScreen(true);
        setShowLiveTracker(false);
      } else {
        setPendingRideId(null);
        setShowWaitingScreen(false);
        setShowLiveTracker(true);
      }
    } else {
      // If an external flow (booking) asked us to ignore polling, don't clear UI
      if (ignorePollingRef.current) {
        logger.debug(LOG_CONTEXT, "Found no ride but skipping clear - ignorePolling is set");
        return;
      }

      logger.debug(LOG_CONTEXT, "No active ride found - clearing state");
      setActiveRide(null);
      setShowLiveTracker(false);
      setShowWaitingScreen(false);
      setPendingRideId(null);
      previousStatusRef.current = null;
      cacheActiveRide(null);
    }
  }, [userId, parseRideData]);

  // ✅ FIX: تحديث ref بدون إعادة إنشاء الاشتراك
  useEffect(() => {
    activeRideIdRef.current = activeRide?.id ?? null;
  }, [activeRide?.id]);

  useEffect(() => {
    if (!userId) {
      // لا يوجد مستخدم - لا تشترك في التحديثات ولا تنشئ polling
      return;
    }

    // Initial check
    checkActiveRide();

    // Setup realtime subscription with better event handling
    const channel = supabase
      .channel(`rider-ride-updates-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events including INSERT and UPDATE
          schema: "public",
          table: "rides",
          filter: `rider_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug(LOG_CONTEXT, "Realtime update received", payload);

          if (payload.eventType === "INSERT") {
            const newRide = payload.new as any;
            if (newRide.status === "pending") {
              // EventDeduplicator: تجنب معالجة INSERT مكرر (مثل Realtime reconnect)
              const insertEventId = `insert-${newRide.id}`;
              const rideEvent: RideEvent = {
                eventId: insertEventId,
                lamportTimestamp: Date.now(),
                eventType: 'ride-accepted',
                source: 'system',
                destination: 'rider',
                rideId: newRide.id,
                payload: { status: newRide.status },
                timestamp: Date.now(),
              };
              dedupRef.current.processEvent(rideEvent).then((result) => {
                if (!result) {
                  logger.debug(LOG_CONTEXT, "Duplicate INSERT filtered by EventDeduplicator", insertEventId);
                  return;
                }
                setActiveRide(parseRideData(newRide));
                setPendingRideId(newRide.id);
                setShowWaitingScreen(true);
                previousStatusRef.current = "pending";
              });
            }
          }

          if (payload.eventType === "UPDATE") {
            const updatedRide = payload.new as any;
            const newStatus = updatedRide.status;
            const prevStatus = previousStatusRef.current;

            // تجاهل تحديثات الإلغاء للرحلات القديمة (ليست الرحلة النشطة الحالية)
            if (newStatus === "cancelled" && activeRideIdRef.current && updatedRide.id !== activeRideIdRef.current) {
              logger.debug(LOG_CONTEXT, "Ignoring cancellation update for non-active ride", updatedRide.id);
              return;
            }

            // EventDeduplicator: تجنب معالجة UPDATE مكرر
            // eventId فريد لكل تحولة حالة واحدة في دورة حياة الرحلة
            const statusToEventType = (s: string): RideEvent['eventType'] => {
              if (s === 'accepted') return 'ride-accepted';
              if (s === 'completed') return 'ride-completed';
              if (s === 'cancelled') return 'ride-cancelled';
              if (s === 'arrived') return 'driver-arrived';
              return 'ride-accepted'; // fallback for pending/in_progress
            };

            const updateEventId = `${updatedRide.id}-${newStatus}`;
            const rideEvent: RideEvent = {
              eventId: updateEventId,
              lamportTimestamp: Date.now(),
              eventType: statusToEventType(newStatus),
              source: 'system',
              destination: 'rider',
              rideId: updatedRide.id,
              payload: { status: newStatus, prevStatus },
              timestamp: Date.now(),
            };

            dedupRef.current.processEvent(rideEvent).then((result) => {
              if (!result) {
                logger.debug(LOG_CONTEXT, "Duplicate UPDATE filtered by EventDeduplicator", updateEventId);
                return;
              }

              // Update previous status ref
              previousStatusRef.current = newStatus;

              // Handle the status change
              handleStatusChange(newStatus, prevStatus, updatedRide);

              // تنظيف الذاكرة عند انتهاء الرحلة
              if (newStatus === 'completed' || newStatus === 'cancelled') {
                setTimeout(() => dedupRef.current.clearRideEvents(updatedRide.id), 5000);
              }
            });
          }
        }
      )
      .subscribe((status) => {
        logger.debug(LOG_CONTEXT, "Subscription status", status);
      });

    // Fallback polling - smart interval:
    // 10s when no active ride (just checking for new ones)
    // 15s when tracking an active ride (Realtime is primary source; poll is fallback only)
    const getPollingInterval = () => activeRideIdRef.current ? 15000 : 10000;
    let pollTimer: ReturnType<typeof setTimeout>;

    const schedulePoll = () => {
      pollTimer = setTimeout(async () => {
        if (!activeRideIdRef.current) {
          // لا توجد رحلة نشطة - فحص خفيف كل 15 ثانية
          checkActiveRide();
        } else {
          const { data } = await supabase
            .from("rides")
            .select("status, driver_id, emergency_completed")
            .eq("id", activeRideIdRef.current)
            .single();

          if (data && data.status !== previousStatusRef.current) {
            logger.debug(LOG_CONTEXT, "Poll detected status change", {
              previous: previousStatusRef.current,
              new: data.status,
              emergency: data.emergency_completed,
            });
            checkActiveRide();
          }
        }
        schedulePoll(); // Schedule next poll
      }, getPollingInterval());
    };

    schedulePoll();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(pollTimer);
    };
  }, [
    userId,
    checkActiveRide,
    handleStatusChange,
    parseRideData,
  ]);

  const clearActiveRide = useCallback(() => {
    setActiveRide(null);
    setShowLiveTracker(false);
    setShowWaitingScreen(false);
    setPendingRideId(null);
    previousStatusRef.current = null;
  }, []);

  // Function لإغلاق شاشة التقييم بعد إتمام التقييم
  const clearCompletedRide = useCallback(() => {
    setCompletedRide(null);
    setShowCompletedScreen(false);
  }, []);

  return {
    activeRide,
    setActiveRide,
    pendingRideId,
    setPendingRideId,
    showWaitingScreen,
    setShowWaitingScreen,
    showLiveTracker,
    setShowLiveTracker,
    completedRide,
    showCompletedScreen,
    setShowCompletedScreen,
    clearCompletedRide,
    clearActiveRide,
    refreshRide: checkActiveRide,
    // Allow external flows to temporarily disable polling/clearing
    setIgnorePolling,
  };
};
