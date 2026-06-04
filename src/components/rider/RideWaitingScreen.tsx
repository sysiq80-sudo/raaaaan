import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import RideProgressStepper from "@/components/rider/RideProgressStepper";
import CancellationReasonDialog from "@/components/rider/CancellationReasonDialog";
import { useRiderWaitSettings } from "@/hooks/useRiderWaitSettings";
import { useRiderStore } from "@/stores/riderStore";
import { useOptimizedRealtime } from "@/hooks/useOptimizedRealtime";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Car,
  MapPin,
  Clock,
  X,
  Users,
  Search,
  Star,
  User,
  ArrowLeft,
  Sparkles,
  Heart,
  Phone,
  MessageCircle,
  Navigation,
  Rocket,
} from "lucide-react";
import {
  playSound,
  vibrate,
  VibrationPatterns,
  showNotification,
} from "@/utils/rideNotificationSounds";
import { cleanArabicAddress } from "@/utils/addressCleaner";
import { getDriverDocumentUrl } from "@/utils/driverDocumentUrl";

// ═══════════════════════════════════════════════════════════════════
// 🚧 FEATURE FLAG: Waiting Timer Display (عداد وقت الانتظار)
// ═══════════════════════════════════════════════════════════════════
// الحالة: معطّل مؤقتاً (DISABLED)
// السبب: قد يزيد من قلق الزبون عند رؤية الوقت يزيد، خاصة في أوقات الذروة
// الخطة: إخفاء العداد لتحسين تجربة المستخدم وتقليل القلق
// البديل: عرض رسائل تشجيعية فقط بدون العداد المرئي
// للتفعيل: غيّر SHOW_WAITING_TIMER إلى true
// ═══════════════════════════════════════════════════════════════════
const SHOW_WAITING_TIMER = false;

interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  profile_image_url: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
  rating: number | null;
}

interface RideWaitingScreenProps {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  onCancel: () => void;
  onDriverFound: () => void;
}

export const RideWaitingScreen = ({
  rideId,
  pickupAddress,
  dropoffAddress,
  estimatedFare,
  onCancel,
  onDriverFound,
}: RideWaitingScreenProps) => {
  const { data: waitSettings } = useRiderWaitSettings();
  const bottomNavEnabled = useRiderStore((state) => state.bottomNavEnabled);
  const [elapsedTime, setElapsedTime] = useState(0);
  const rideStartTimeRef = useRef<number | null>(null); // توقيت إنشاء الرحلة من DB
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const [searchPhase, setSearchPhase] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [acceptedDriver, setAcceptedDriver] = useState<Driver | null>(null);
  const [showDriverCard, setShowDriverCard] = useState(false);
  const [showDriverFoundTransition, setShowDriverFoundTransition] =
    useState(false);
  const [rideStatus, setRideStatus] = useState<string>("pending");
  const [encouragingMessageIndex, setEncouragingMessageIndex] = useState(0);
  const [maxWaitTimeout, setMaxWaitTimeout] = useState(10); // Default 10 minutes
  const [reassignmentCount, setReassignmentCount] = useState(0); // ✅ عداد إعادة التوجيه
  const [dhikrCounts, setDhikrCounts] = useState({
    istighfar: 0,
    tasbih: 0,
    tahmid: 0,
  });
  const [lastTappedDhikr, setLastTappedDhikr] = useState<string | null>(null);
  const [reMatchCount, setReMatchCount] = useState(0); // عدد مرات إعادة المطابقة
  const [isReMatching, setIsReMatching] = useState(false); // حالة إعادة المطابقة
  const [currentRadiusBonus, setCurrentRadiusBonus] = useState(0); // توسيع نطاق البحث الفعلي بالكم
  const { toast } = useToast();
  const driverFoundTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true); // ✅ FIX: تتبع حالة المكون
  const driverFoundInProgress = showDriverCard || showDriverFoundTransition;

  // Use settings from database or defaults
  const encouragingMessages = waitSettings?.search_messages || [];
  const warningMessage =
    waitSettings?.warning_message || "⚠️ سيتم الإلغاء التلقائي قريباً";
  const warningThreshold = waitSettings?.warning_threshold || 0.8;
  const autoCancelEnabled = waitSettings?.auto_cancel_enabled ?? true;
  const autoCancelMessage =
    waitSettings?.auto_cancel_message ||
    "لم يتم العثور على سائق متاح خلال الوقت المحدد";

  // ✅ FIX: تحميل عداد الأذكار من localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('raan_dhikr_counts');
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedDate = parsed._date;
        const today = new Date().toDateString();
        if (savedDate === today) {
          setDhikrCounts({ istighfar: parsed.istighfar || 0, tasbih: parsed.tasbih || 0, tahmid: parsed.tahmid || 0 });
        }
      }
    } catch {}
  }, []);

  // ✅ FIX: حفظ عداد الأذكار عند التغيير
  useEffect(() => {
    if (dhikrCounts.istighfar || dhikrCounts.tasbih || dhikrCounts.tahmid) {
      try {
        localStorage.setItem('raan_dhikr_counts', JSON.stringify({
          ...dhikrCounts,
          _date: new Date().toDateString()
        }));
      } catch {}
    }
  }, [dhikrCounts]);

  // ✅ FIX: تنظيف mountedRef عند إزالة المكون
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Handle dhikr tap with haptic feedback
  const handleDhikrTap = (type: "istighfar" | "tasbih" | "tahmid") => {
    setDhikrCounts((prev) => ({
      ...prev,
      [type]: prev[type] + 1,
    }));
    setLastTappedDhikr(type);
    setTimeout(() => setLastTappedDhikr(null), 300);

    // Light haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };
  const totalDhikr =
    dhikrCounts.istighfar + dhikrCounts.tasbih + dhikrCounts.tahmid;

  // Calculate estimated wait time based on nearby drivers
  const getEstimatedWaitTime = () => {
    if (nearbyDrivers === 0) return "5-10";
    if (nearbyDrivers === 1) return "3-6";
    if (nearbyDrivers <= 3) return "2-5";
    if (nearbyDrivers <= 5) return "1-3";
    return "1-2";
  };
  const getVehicleTypeName = (type: string | null) => {
    switch (type) {
      case "economy":
        return "اقتصادي";
      case "comfort":
        return "مريح";
      case "premium":
        return "فاخر";
      case "women_only":
        return "نسائي";
      default:
        return "عادي";
    }
  };

  // State to prevent duplicate auto-cancellation
  const [hasAutoCancelled, setHasAutoCancelled] = useState(false);

  // جلب created_at وحساب وقت البدء الحقيقي + تشغيل التايمر
  useEffect(() => {
    const initTimer = async () => {
      // جلب وقت إنشاء الرحلة من قاعدة البيانات
      const { data } = await supabase
        .from("rides")
        .select("created_at")
        .eq("id", rideId)
        .single();

      if (data?.created_at) {
        // حساب الثواني المنقضية منذ إنشاء الرحلة
        const startMs = new Date(data.created_at).getTime();
        rideStartTimeRef.current = startMs;
        const initialElapsed = Math.floor((Date.now() - startMs) / 1000);
        setElapsedTime(Math.max(0, initialElapsed));
      }
    };

    initTimer();

    // تحديث كل ثانية باستخدام توقيت البدء الحقيقي
    const timer = setInterval(() => {
      if (rideStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - rideStartTimeRef.current) / 1000);
        setElapsedTime(elapsed);
      } else {
        setElapsedTime((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [rideId]);

  // Auto-cancel ride when timeout is reached
  useEffect(() => {
    if (!autoCancelEnabled) return; // Skip if auto-cancel is disabled

    const elapsedMinutes = elapsedTime / 60;
    const timeoutWithGrace = maxWaitTimeout + 0.1; // 6 seconds grace period

    // Only auto-cancel if:
    // 1. Time exceeded timeout
    // 2. Ride is still pending
    // 3. No driver accepted yet
    // 4. Haven't already auto-cancelled
    if (
      elapsedMinutes >= timeoutWithGrace &&
      rideStatus === "pending" &&
      !acceptedDriver &&
      !hasAutoCancelled
    ) {
      console.log("[RideWaiting] Timeout reached, auto-cancelling ride");
      setHasAutoCancelled(true);
      const autoCancelRide = async () => {
        const { error } = await supabase
          .from("rides")
          .update({
            status: "cancelled",
            cancelled_by: "system",
            cancellation_reason: autoCancelMessage,
          })
          .eq("id", rideId)
          .eq("status", "pending");
        if (!error) {
          toast({
            title: "تم إلغاء الطلب تلقائياً",
            description: autoCancelMessage,
            variant: "destructive",
          });
          onCancel();
        } else {
          console.error("[RideWaiting] Auto-cancel failed:", error);
          setHasAutoCancelled(false); // Allow retry
        }
      };
      autoCancelRide();
    }
  }, [
    elapsedTime,
    maxWaitTimeout,
    rideId,
    rideStatus,
    acceptedDriver,
    hasAutoCancelled,
    autoCancelEnabled,
    autoCancelMessage,
    toast,
    onCancel,
  ]);

  // Animate search phases
  useEffect(() => {
    const phaseTimer = setInterval(() => {
      setSearchPhase((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(phaseTimer);
  }, []);

  // Rotate encouraging messages
  useEffect(() => {
    if (encouragingMessages.length === 0) return;

    const messageTimer = setInterval(() => {
      setEncouragingMessageIndex(
        (prev) => (prev + 1) % encouragingMessages.length,
      );
    }, 5000); // Changed to 5 seconds
    return () => clearInterval(messageTimer);
  }, [encouragingMessages]);

  // Fetch ride timeout and nearby drivers count
  useEffect(() => {
    const fetchRideData = async () => {
      // Use global settings first, then check region-specific
      if (waitSettings) {
        setMaxWaitTimeout(waitSettings.max_wait_minutes);
      }

      // Get ride's region to determine timeout (override if region has specific timeout)
      const { data: rideData } = await supabase
        .from("rides")
        .select("region_id")
        .eq("id", rideId)
        .single();
      if (rideData?.region_id) {
        const { data: regionData } = await supabase
          .from("regions")
          .select("wait_timeout_minutes, weekend_wait_timeout_minutes")
          .eq("id", rideData.region_id)
          .single();
        if (regionData) {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
          const timeout = isWeekend
            ? regionData.weekend_wait_timeout_minutes ||
              waitSettings?.max_wait_minutes ||
              15
            : regionData.wait_timeout_minutes ||
              waitSettings?.max_wait_minutes ||
              10;
          setMaxWaitTimeout(timeout);
        }
      }
    };
    const fetchNearbyDrivers = async () => {
      // ✅ استخدام PostGIS RPC بدل full table scan — يقلل IO بـ 80%
      const { data: rideInfo } = await supabase
        .from("rides")
        .select("pickup_location")
        .eq("id", rideId)
        .single();
      const pickupLoc = rideInfo?.pickup_location as { lat: number; lng: number } | null;

      if (pickupLoc?.lat && pickupLoc?.lng) {
        const { data, error } = await supabase.rpc("get_nearby_drivers", {
          p_lat: pickupLoc.lat,
          p_lng: pickupLoc.lng,
          p_radius_km: 5,
        });
        if (!error && data) {
          setNearbyDrivers(data.length);
        }
      } else {
        // Fallback إذا لم يتوفر موقع الرحلة
        const { data, error } = await supabase
          .from("drivers")
          .select("id")
          .eq("is_online", true)
          .eq("is_available", true)
          .eq("status", "approved");
        if (!error && data) {
          setNearbyDrivers(data.length);
        }
      }
    };
    fetchRideData();
    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, 30000); // 30 ثانية — Realtime يغطي قبول السائق فوراً
    return () => clearInterval(interval);
  }, [rideId, waitSettings]);

  // Fetch driver info when accepted
  const fetchDriverInfo = async (driverId: string) => {
    console.log("[RideWaiting] 👨‍✈️ Fetching driver info:", driverId);
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id, full_name, phone, profile_image_url, vehicle_model, vehicle_plate, vehicle_color, vehicle_type, rating",
      )
      .eq("id", driverId)
      .maybeSingle();
    if (!error && data) {
      console.log("[RideWaiting] \u2705 Driver info received");
      const driverData = data as Driver;
      // \u062a\u062d\u0648\u064a\u0644 \u0645\u0633\u0627\u0631 \u0627\u0644\u062a\u062e\u0632\u064a\u0646 \u0625\u0644\u0649 signed URL (bucket \u062e\u0627\u0635)
      if (driverData.profile_image_url) {
        getDriverDocumentUrl(driverData.profile_image_url, 7200).then(url => {
          if (url) {
            setAcceptedDriver({ ...driverData, profile_image_url: url });
          } else {
            setAcceptedDriver({ ...driverData, profile_image_url: null });
          }
        });
      } else {
        setAcceptedDriver(driverData);
      }
      return true;
    } else {
      console.error("[RideWaiting] ❌ Driver fetch error:", error);
      return false;
    }
  };

  // Handle driver found - trigger notifications
  const handleDriverFound = async (driverId: string) => {
    console.log("[RideWaiting] Driver found! Playing celebration");

    // Fetch driver info first
    const hasDriver = await fetchDriverInfo(driverId);

    // ✅ FIX: فحص إذا المكون لا يزال موجوداً بعد الانتظار
    if (!mountedRef.current) return;

    if (hasDriver) {
      setShowDriverFoundTransition(true);
      if (driverFoundTimeoutRef.current) {
        window.clearTimeout(driverFoundTimeoutRef.current);
      }
      driverFoundTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return; // ✅ FIX: فحص داخل المؤقت
        setShowDriverFoundTransition(false);
        setShowDriverCard(true);
      }, 1200);
    }

    // Play sound + vibrate
    playSound("driverFound");
    vibrate(VibrationPatterns.driverFound);

    // Show toast
    toast({
      title: "🎉 تم العثور على سائق!",
      description: "سائق قبل طلبك وفي الطريق إليك الآن",
      duration: 5000,
    });

    // Browser notification
    showNotification("🎉 تم قبول طلبك!", "سائق قبل طلبك وفي الطريق إليك الآن", {
      tag: "driver-found",
      duration: 8000,
    });
  };

  useEffect(() => {
    return () => {
      if (driverFoundTimeoutRef.current) {
        window.clearTimeout(driverFoundTimeoutRef.current);
      }
    };
  }, []);

  // Continue to tracking after seeing driver info
  const handleContinueToTracking = () => {
    onDriverFound();
  };
  // استخدم Realtime المحسّن بدلاً من Polling التقليدي
  const { isConnected, lastUpdate } = useOptimizedRealtime(rideId, {
    enabled: true,
    batchInterval: 300,
    enableCrossTabs: true,
    maxEventsPerMinute: 60,
  });

  // الاستماع لتحديثات الرحلة من Realtime
  useEffect(() => {
    if (!lastUpdate) return;

    const updatedRide = lastUpdate as any;

    // تحقق من قبول السائق
    if (
      updatedRide.status === "accepted" &&
      updatedRide.driver_id &&
      !driverFoundInProgress
    ) {
      console.log("[RideWaiting] ✅ Driver found via Realtime!");
      setRideStatus("accepted");
      handleDriverFound(updatedRide.driver_id);
    }

    // تحقق من إلغاء الرحلة
    if (updatedRide.status === "cancelled") {
      console.log("[RideWaiting] ❌ Ride cancelled");
      toast({
        title: "تم إلغاء الرحلة",
        description: updatedRide.cancellation_reason || "تم إلغاء الطلب",
        variant: "destructive",
      });
      onCancel();
    }

    // تحديث عداد إعادة التوجيه
    if (updatedRide.reassignment_count !== undefined) {
      setReassignmentCount(updatedRide.reassignment_count);
    }
  }, [lastUpdate, driverFoundInProgress, onCancel, toast]);

  // Listen for ride updates - fallback with slower polling when Realtime unavailable
  useEffect(() => {
    console.log(
      "[RideWaiting] Fallback subscriptions: useActiveRide handles polling, skipping redundant interval",
      rideId,
    );

    // ✅ FIX: تمت إزالة Polling المكرر كل 2 ثانية
    // useOptimizedRealtime (أعلاه) + useActiveRide (في GoPage) يتوليان التتبع
    // لا حاجة لطبقة ثالثة من الاستعلامات

    return () => {};
  }, [rideId, driverFoundInProgress, toast, onCancel]);

  // ═══ إعادة المطابقة الدورية — استدعاء match-ride كل 60 ثانية ═══
  // يبقي الطلب فعالاً حتى لو رفض كل السائقين
  useEffect(() => {
    // لا تعيد المطابقة إذا تم قبول السائق أو إلغاء أو انتهاء المهلة
    if (rideStatus !== "pending" || driverFoundInProgress || hasAutoCancelled) return;

    const RE_MATCH_INTERVAL_MS = 60_000; // 60 ثانية
    const INITIAL_DELAY_MS = 45_000; // تأخير أولي 45 ثانية لإعطاء الجولات الأولى فرصتها
    const RADIUS_EXPANSION_STEP_KM = 3; // زيادة النطاق بـ 3 كم كل جولة
    const MAX_RADIUS_BONUS_KM = 12;     // الحد الأقصى للتوسيع +12 كم (4 جولات)

    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;

    const triggerReMatch = async () => {
      if (!mountedRef.current) return;
      // تحقق أن الرحلة لا تزال pending
      try {
        const { data: currentRide } = await supabase
          .from("rides")
          .select("status, metadata")
          .eq("id", rideId)
          .single();

        if (currentRide?.status !== "pending") {
          console.log("[RideWaiting] ⏭️ Re-match skipped — ride is now", currentRide?.status);
          return;
        }

        // ═══ توسيع نطاق البحث الفعلي قبل استدعاء match-ride ═══
        const prevBonus = (currentRide.metadata as any)?.radius_bonus_km || 0;
        const newBonus = Math.min(prevBonus + RADIUS_EXPANSION_STEP_KM, MAX_RADIUS_BONUS_KM);
        await supabase
          .from("rides")
          .update({
            metadata: {
              ...((currentRide.metadata as object) || {}),
              radius_bonus_km: newBonus,
            },
          })
          .eq("id", rideId);
        setCurrentRadiusBonus(newBonus);

        console.log(`[RideWaiting] 🔄 Triggering re-match for ride ${rideId} — radius +${newBonus}km`);
        setIsReMatching(true);
        setReMatchCount(prev => prev + 1);

        // استدعاء match-ride مع flag إعادة المطابقة
        await supabase.functions.invoke("match-ride", {
          body: { rideId, re_match: true },
        });

        console.log(`[RideWaiting] ✅ Re-match invoked (radius_bonus=${newBonus}km)`);
      } catch (err) {
        console.warn("[RideWaiting] ⚠️ Re-match error (non-blocking):", err);
      } finally {
        if (mountedRef.current) {
          setIsReMatching(false);
        }
      }
    };

    // تأخير أولي ثم تكرار كل 60 ثانية
    timeoutId = setTimeout(() => {
      triggerReMatch(); // أول إعادة مطابقة
      intervalId = setInterval(triggerReMatch, RE_MATCH_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [rideId, rideStatus, driverFoundInProgress, hasAutoCancelled]);

  // Handle cancel button click - show dialog
  const handleCancelClick = () => {
    console.log("[RideWaiting] ❌ Cancel button clicked - opening dialog");
    setShowCancelDialog(true);
  };

  // Handle actual cancellation with reason — via atomic RPC
  const handleConfirmCancel = async (reason: string, category: string) => {
    console.log("[RideWaiting] 🗑️ Confirming cancellation:", {
      reason,
      category,
      rideId,
    });
    setCancelling(true);

    try {
      // جلب user_id الحالي
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log("[RideWaiting] 👤 Current user:", currentUser?.id);
      
      if (!currentUser) {
        console.error("[RideWaiting] ❌ No user found");
        toast({
          title: "خطأ",
          description: "يرجى تسجيل الدخول مرة أخرى",
          variant: "destructive",
        });
        setCancelling(false);
        setShowCancelDialog(false);
        return;
      }

      // ═══ استدعاء RPC الذري — يتولى التحقق + الغرامة + الخصم + التحديث ═══
      console.log("[RideWaiting] 📞 Calling cancel_ride_by_rider RPC...");
      const { data: cancelResult, error } = await supabase.rpc(
        'cancel_ride_by_rider' as any,
        {
          p_ride_id: rideId,
          p_rider_user_id: currentUser.id,
          p_reason: reason,
        }
      );

      console.log("[RideWaiting] 📥 RPC Response:", { cancelResult, error });

      // ═══ FALLBACK: إذا فشل RPC (404/not found)، استخدم update مباشر ═══
      if (error && (error.message?.includes('Could not find') || error.message?.includes('not found') || error.code === '42883')) {
        console.warn("[RideWaiting] ⚠️ RPC not available, using fallback direct update...");
        
        const { error: updateError } = await supabase
          .from('rides')
          .update({
            status: 'cancelled' as any,
            cancelled_by: 'rider',
            cancellation_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rideId)
          .eq('rider_id', currentUser.id);

        if (updateError) {
          console.error("[RideWaiting] ❌ Fallback update error:", updateError);
          toast({
            title: "خطأ في الإلغاء",
            description: updateError.message || "حدث خطأ أثناء إلغاء الرحلة",
            variant: "destructive",
          });
          setCancelling(false);
          setShowCancelDialog(false);
          return;
        }

        console.log("[RideWaiting] ✅ Fallback cancellation successful!");
        setShowCancelDialog(false);
        toast({
          title: "تم إلغاء الرحلة",
          description: "نأمل أن نراك مرة أخرى قريباً",
        });
        setCancelling(false);
        onCancel();
        return;
      }

      if (error) {
        console.error("[RideWaiting] ❌ Cancel RPC error:", error);
        toast({
          title: "خطأ في الإلغاء",
          description: error.message || "حدث خطأ أثناء إلغاء الرحلة",
          variant: "destructive",
        });
        setCancelling(false);
        setShowCancelDialog(false);
        return;
      }

      const result = cancelResult as { success: boolean; penalty_amount?: number; penalty_paid?: boolean; error?: string; code?: string } | null;

      console.log("[RideWaiting] ✅ Result parsed:", result);

      if (result?.success) {
        console.log("[RideWaiting] ✅ Cancellation successful!");
        setShowCancelDialog(false);
        const penaltyAmount = result.penalty_amount || 0;
        if (penaltyAmount > 0 && result.penalty_paid) {
          toast({
            title: "تم إلغاء الرحلة",
            description: `تم خصم غرامة إلغاء: ${penaltyAmount.toLocaleString('en-US')} د.ع من محفظتك`,
            variant: "destructive",
          });
        } else if (penaltyAmount > 0 && !result.penalty_paid) {
          toast({
            title: "تم إلغاء الرحلة",
            description: `غرامة إلغاء: ${penaltyAmount.toLocaleString('en-US')} د.ع (لم يتم الخصم من المحفظة)`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "تم إلغاء الرحلة",
            description: "نأمل أن نراك مرة أخرى قريباً",
          });
        }
        
        // إغلاق المكون والعودة
        console.log("[RideWaiting] 🔄 Calling onCancel callback...");
        setCancelling(false);
        onCancel();
      } else {
        console.error("[RideWaiting] ❌ Cancellation failed:", result?.error, result?.code);
        toast({
          title: "خطأ",
          description: result?.error || "لا يمكن إلغاء الرحلة في هذه المرحلة",
          variant: "destructive",
        });
        setCancelling(false);
        setShowCancelDialog(false);
      }
    } catch (err) {
      console.error("[RideWaiting] ❌ Cancel exception:", err);
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع أثناء الإلغاء",
        variant: "destructive",
      });
      setCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSearchMessage = () => {
    const messages = [
      "جاري البحث عن سائق قريب...",
      "نبحث عن أفضل سائق لك...",
      "سيتم إعلامك فور قبول السائق...",
      "يرجى الانتظار لحظات...",
    ];
    return messages[searchPhase];
  };

  // ═══ شاشة السائق المقبول — Dark Luxury ═══
  if (showDriverCard && acceptedDriver) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background max-w-[480px] mx-auto" dir="rtl">

        {/* هيدر النجاح */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 bg-card/85 backdrop-blur-xl border-b border-border/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-ring/10 border border-ring/20">
              <Sparkles className="w-5 h-5 text-ring" />
            </div>
            <div>
              <h1 className="text-[18px] font-black text-foreground leading-tight">تم قبول طلبك! 🎉</h1>
              <p className="text-[12px] mt-0.5 text-ring">السائق في الطريق إليك الآن</p>
            </div>
          </div>
        </motion.div>

        {/* المحتوى */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* بطاقة السائق */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden bg-[#1a2333] border border-slate-800/40 shadow-lg"
          >
            <div className="p-4 flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar className="w-16 h-16 border-2 border-[#00B3B0]/30">
                  <AvatarImage src={acceptedDriver.profile_image_url || ""} alt={acceptedDriver.full_name} />
                  <AvatarFallback className="text-xl font-black bg-[#00B3B0]/10 text-[#00B3B0]">
                    {acceptedDriver.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center bg-[#00B3B0] border-2 border-[#1a2333]">
                  <User className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-black text-slate-100 truncate">{acceptedDriver.full_name}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Star className="w-3 h-3 fill-current" />
                    {acceptedDriver.rating?.toFixed(1) || '5.0'}
                  </span>
                  {acceptedDriver.vehicle_plate && (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-700/50" style={{ direction: "ltr" }}>
                      {acceptedDriver.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* معلومات المركبة */}
            <div className="px-4 py-3 flex items-center gap-2 border-t border-slate-800/40">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#00B3B0]/10">
                <Car className="w-4 h-4 text-[#00B3B0]" />
              </div>
              <span className="text-[13px] text-slate-400">
                {getVehicleTypeName(acceptedDriver.vehicle_type)}
                {acceptedDriver.vehicle_model && ` • ${acceptedDriver.vehicle_model}`}
                {acceptedDriver.vehicle_color && ` • ${acceptedDriver.vehicle_color}`}
              </span>
            </div>

            {/* أزرار التواصل */}
            <div className="grid grid-cols-2 border-t border-slate-800/40">
              <button
                onClick={() => window.open(`tel:${acceptedDriver.phone}`, '_self')}
                className="flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold transition-all active:opacity-70 text-[#00B3B0] border-l border-slate-800/40"
              >
                <Phone className="w-4 h-4" /> اتصال
              </button>
              <button
                onClick={() => window.open(`https://wa.me/${acceptedDriver.phone}`, '_blank')}
                className="flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold transition-all active:opacity-70 text-[#25d366]"
              >
                <MessageCircle className="w-4 h-4" /> واتساب
              </button>
            </div>
          </motion.div>

          {/* خط السير - تصميم نظيف بدون تداخل */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[#141c2e] border border-white/[0.06] shadow-lg overflow-hidden"
          >
            {/* الأجرة المقدرة — شريط علوي */}
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/[0.06] border-b border-white/[0.04]">
              <span className="text-[11px] font-bold text-slate-400">الأجرة المقدرة</span>
              <span className="text-[18px] font-black text-emerald-400 tabular-nums">{estimatedFare.toLocaleString('en-US')}</span>
              <span className="text-[11px] font-bold text-slate-500">د.ع</span>
            </div>

            {/* المسار */}
            <div className="p-4 flex gap-3">
              {/* خط المسار العمودي */}
              <div className="flex flex-col items-center pt-1 shrink-0">
                <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#141c2e] shadow-[0_0_0_2px_rgba(52,211,153,0.2)]" />
                <div className="w-0.5 flex-1 my-1.5 bg-gradient-to-b from-emerald-500/40 via-slate-700/20 to-blue-500/40 rounded-full min-h-[24px]" />
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-[#141c2e] shadow-[0_0_0_2px_rgba(59,130,246,0.2)]" />
              </div>

              {/* العناوين */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-emerald-400 mb-0.5 uppercase">موقع الانطلاق</p>
                  <p className="text-[14px] font-bold text-white truncate">{cleanArabicAddress(pickupAddress)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-wider text-blue-400 mb-0.5 uppercase">الوجهة المقصودة</p>
                  <p className="text-[14px] font-bold text-white truncate">{cleanArabicAddress(dropoffAddress)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* زر تتبع الرحلة */}
        <div className="shrink-0 px-4 bg-card border-t border-border/30" style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), 16px)', zIndex: 10 }}>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleContinueToTracking}
            whileTap={{ scale: 0.97 }}
            className="w-full min-h-[48px] rounded-2xl flex items-center justify-center gap-2 text-base font-bold transition-all shadow-lg touch-manipulation bg-ring text-primary-foreground hover:bg-ring/90"
          >
            <Navigation className="w-5 h-5 ml-1" />
            تتبع الرحلة على الخريطة
          </motion.button>
        </div>
      </div>
    );
  }

  // Waiting State — Dark Luxury
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b1326] max-w-[480px] mx-auto" dir="rtl">

      {/* طبقة انتقال السائق */}
      <AnimatePresence>
        {showDriverFoundTransition && acceptedDriver && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a0f1c]/95 backdrop-blur-[16px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="rounded-3xl p-7 text-center mx-6 bg-[#1a2333] border border-slate-800/40 shadow-xl"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-emerald-500/10">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-[20px] font-black text-white mb-2">تم العثور على سائق!</h2>
              <p className="text-[13px] text-slate-400">{acceptedDriver.full_name} في الطريق إليك الآن</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* هيدر البحث */}
      <div
        className="shrink-0 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 bg-gradient-to-b from-[#0d1a2e]/95 to-[#0b1326]/95 backdrop-blur-lg border-b border-slate-800/40 relative overflow-hidden"
      >
        {/* Subtle decorative glow in header background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative flex flex-col items-center gap-3 text-center">
          {/* أيقونة البحث - رادار متوهج ثلاثي الأبعاد دائري بالكامل */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            {/* Pulsing glow rings */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse" />
            <div className="absolute w-12 h-12 rounded-full border border-emerald-500/20 animate-ping opacity-60" style={{ animationDuration: '3s' }} />
            <div className="absolute w-8 h-8 rounded-full border border-emerald-400/10 animate-ping opacity-45" style={{ animationDuration: '1.5s' }} />
            
            {/* Glassmorphic glowing center button */}
            <div className="relative w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-tr from-emerald-500/20 to-emerald-400/5 border border-emerald-500/40 shadow-glow-sm shadow-emerald-500/10">
              <Search className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* النصوص */}
          <div className="space-y-1">
            <h1 className="text-[19px] font-black text-white leading-tight font-cairo tracking-tight">بانتظار سائق 🔍</h1>
            <p className="text-[13px] font-medium text-slate-400 flex items-center justify-center gap-1.5 font-tajawal">
              <span>{encouragingMessages[encouragingMessageIndex]?.icon || "⏳"}</span>
              <span>{encouragingMessages[encouragingMessageIndex]?.text ? encouragingMessages[encouragingMessageIndex].text.replace(/كابتن/g, "سائق") : "لحظات قليلة وسيتم إيجاد سائق..."}</span>
            </p>
          </div>

          {/* عداد السائقين */}
          {nearbyDrivers > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 shadow-glow-sm shadow-emerald-500/5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[12px] font-bold text-emerald-400 font-cairo">
                {nearbyDrivers} سائق متاح بالقرب منك
              </span>
            </div>
          )}
        </div>
      </div>

      {/* المحتوى */}
      <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">

        {/* ══════════════════════════════════════════════════════════════
            شريط التقدم والعداد - معطّل مؤقتاً (SHOW_WAITING_TIMER = false)
            السبب: تقليل قلق الزبون عند رؤية الوقت يزيد
            ══════════════════════════════════════════════════════════════ */}
        {SHOW_WAITING_TIMER && (
          <div className="shrink-0 rounded-2xl p-4 bg-[#1a2333] border border-slate-800/40 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                وقت الانتظار
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[28px] font-black font-mono text-white tabular-nums leading-none">{formatTime(elapsedTime)}</span>
                <span className="text-[13px] text-slate-400 font-medium">/ {maxWaitTimeout}:00</span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-slate-700/50">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  background: elapsedTime / 60 >= maxWaitTimeout * warningThreshold
                    ? "linear-gradient(90deg, #ef4444, #dc2626)"
                    : "linear-gradient(90deg, #34d399, #10b981)",
                  width: `${Math.min((elapsedTime / 60 / maxWaitTimeout) * 100, 100)}%`,
                }}
              />
            </div>
            {elapsedTime / 60 >= maxWaitTimeout * warningThreshold && autoCancelEnabled && (
              <p className="text-[13px] text-center mt-2 font-semibold animate-pulse text-[#F04438]">
                {warningMessage}
              </p>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
              <span className="text-[13px] text-slate-400">وقت الوصول المتوقع</span>
              <span className="text-[15px] font-black text-emerald-400">{getEstimatedWaitTime()} دقيقة</span>
            </div>
          </div>
        )}

        {/* خط سير الرحلة - تصميم نظيف بدون تداخل */}
        <div className="shrink-0 rounded-2xl bg-[#141c2e] border border-white/[0.06] shadow-lg overflow-hidden">

          {/* الأجرة المقدرة — شريط علوي */}
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/[0.06] border-b border-white/[0.04]">
            <span className="text-[12px] font-bold text-slate-400">الأجرة المقدرة</span>
            <span className="text-[20px] font-black text-emerald-400 tabular-nums">{estimatedFare.toLocaleString('en-US')}</span>
            <span className="text-[12px] font-bold text-slate-500">د.ع</span>
          </div>

          {/* المسار */}
          <div className="p-4 flex gap-3">
            {/* خط المسار العمودي */}
            <div className="flex flex-col items-center pt-1 shrink-0">
              <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#141c2e] shadow-[0_0_0_2px_rgba(52,211,153,0.2)]" />
              <div className="w-0.5 flex-1 my-1.5 bg-gradient-to-b from-emerald-500/40 via-slate-700/20 to-blue-500/40 rounded-full min-h-[24px]" />
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-[#141c2e] shadow-[0_0_0_2px_rgba(59,130,246,0.2)]" />
            </div>

            {/* العناوين */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {/* الانطلاق */}
              <div className="min-w-0">
                <p className="text-[12px] font-bold tracking-wider text-emerald-400 mb-0.5 uppercase">موقع الانطلاق</p>
                <p className="text-[15px] font-extrabold text-white truncate">{cleanArabicAddress(pickupAddress)}</p>
              </div>

              {/* الوجهة */}
              <div className="min-w-0">
                <p className="text-[12px] font-bold tracking-wider text-blue-400 mb-0.5 uppercase">الوجهة المقصودة</p>
                <p className="text-[15px] font-extrabold text-white truncate">{cleanArabicAddress(dropoffAddress)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* رسائل إعادة المطابقة */}
        {(reassignmentCount > 0 || isReMatching) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="shrink-0 rounded-2xl p-3 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20"
          >
            {isReMatching
              ? <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
              : <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            }
            <p className="text-[12px] text-amber-300 font-medium">
              {isReMatching
                ? `توسيع نطاق البحث +${currentRadiusBonus}كم...`
                : reassignmentCount === 1 ? "جاري البحث عن سائق بديل..."
                : reassignmentCount >= 3 ? "آخر محاولة للعثور على سائق متاح..."
                : `البحث مستمر — نطاق +${currentRadiusBonus}كم`}
            </p>
          </motion.div>
        )}

        {/* ═══ بطاقة الأذكار الإسلامية ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="shrink-0 rounded-xl overflow-hidden bg-[#1a2333] border border-slate-800/40 shadow-sm"
        >
          {/* رأس البطاقة */}
          <div className="flex items-center justify-center gap-3 px-3 py-2 border-b border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">📿</span>
              <span className="text-[11px] font-semibold text-white">اجعل انتظارك ذكراً</span>
            </div>
            {totalDhikr > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              >
                {totalDhikr} ذكر اليوم
              </span>
            )}
          </div>

          {/* أزرار الأذكار */}
          <div className="grid grid-cols-3 divide-x divide-slate-700/50" style={{ direction: 'ltr' }}>
            {/* سبحان الله */}
            <button
              onClick={() => handleDhikrTap("tasbih")}
              className="bg-[#1a2333] flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95"
              style={{
                backgroundColor: lastTappedDhikr === "tasbih" ? "rgba(52,211,153,0.08)" : undefined,
              }}
            >
              <span className="text-[16px] leading-none">🌿</span>
              <span className="text-[10px] font-bold text-white">سبحان الله</span>
              <span
                className="text-[16px] font-black tabular-nums leading-none text-emerald-400"
              >
                {dhikrCounts.tasbih}
              </span>
            </button>

            {/* الحمد لله */}
            <button
              onClick={() => handleDhikrTap("tahmid")}
              className="bg-[#1a2333] flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95"
              style={{
                backgroundColor: lastTappedDhikr === "tahmid" ? "rgba(251,191,36,0.08)" : undefined,
              }}
            >
              <span className="text-[16px] leading-none">☀️</span>
              <span className="text-[10px] font-bold text-white">الحمد لله</span>
              <span
                className="text-[16px] font-black tabular-nums leading-none text-amber-400"
              >
                {dhikrCounts.tahmid}
              </span>
            </button>

            {/* أستغفر الله */}
            <button
              onClick={() => handleDhikrTap("istighfar")}
              className="bg-[#1a2333] flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95"
              style={{
                backgroundColor: lastTappedDhikr === "istighfar" ? "rgba(147,51,234,0.06)" : undefined,
              }}
            >
              <span className="text-[16px] leading-none">🤲</span>
              <span className="text-[10px] font-bold text-white">أستغفر الله</span>
              <span
                className="text-[16px] font-black tabular-nums leading-none text-purple-400"
              >
                {dhikrCounts.istighfar}
              </span>
            </button>
          </div>

          {/* ذيل البطاقة */}
          <div className="px-3 py-1.5 flex items-center justify-center border-t border-slate-700/50">
            <p className="text-[9px] text-slate-400 text-center">
              انقر على كل ذكر لتسجيله • يُحفظ تلقائياً
            </p>
          </div>
        </motion.div>
      </div>

      {/* زر الإلغاء — ملاصق للأسفل */}
      <div className="shrink-0 bg-[#0b1326]" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)', zIndex: 10 }}>
        <button
          onClick={handleCancelClick}
          disabled={cancelling}
          style={{ fontFamily: "Cairo, sans-serif" }}
          className="w-full h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-black bg-[#F04438] hover:bg-[#D92D20] active:bg-[#B42318] text-white transition-all disabled:opacity-50 touch-manipulation pointer-events-auto active:scale-[0.98] border-t border-[#F04438]/30"
        >
          {cancelling ? (
            <><Loader2 className="w-5 h-5 animate-spin" />جاري الإلغاء...</>
          ) : (
            <><X className="w-5 h-5" />إلغاء الطلب</>
          )}
        </button>
      </div>

      {/* ديالوج سبب الإلغاء */}
      <CancellationReasonDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleConfirmCancel}
        isLoading={cancelling}
        rideStatus={rideStatus}
        estimatedFare={estimatedFare}
      />
    </div>
  );
};

export default RideWaitingScreen;
