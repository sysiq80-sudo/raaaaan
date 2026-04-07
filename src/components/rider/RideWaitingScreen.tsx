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
      // ✅ FIX: جلب موقع الرحلة لفلترة السائقين القريبين فعلاً
      const { data: rideInfo } = await supabase
        .from("rides")
        .select("pickup_location")
        .eq("id", rideId)
        .single();
      const pickupLoc = rideInfo?.pickup_location as { lat: number; lng: number } | null;

      const { data, error } = await supabase
        .from("drivers")
        .select("id, current_location")
        .eq("is_online", true)
        .eq("is_available", true)
        .eq("status", "approved");
      if (!error && data && pickupLoc) {
        // فلترة بالمسافة (5 كم) باستخدام haversine مبسط
        const nearby = data.filter((d: any) => {
          const loc = d.current_location as { lat: number; lng: number } | null;
          if (!loc?.lat || !loc?.lng) return false;
          const R = 6371;
          const dLat = (loc.lat - pickupLoc.lat) * Math.PI / 180;
          const dLng = (loc.lng - pickupLoc.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(pickupLoc.lat * Math.PI/180) * Math.cos(loc.lat * Math.PI/180) * Math.sin(dLng/2)**2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return dist <= 5; // 5 كم
        });
        setNearbyDrivers(nearby.length);
      } else if (!error && data) {
        setNearbyDrivers(data.length);
      }
    };
    fetchRideData();
    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, 10000);
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
      console.log("[RideWaiting] ✅ Driver info received");
      setAcceptedDriver(data as Driver);
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

    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;

    const triggerReMatch = async () => {
      if (!mountedRef.current) return;
      // تحقق أن الرحلة لا تزال pending
      try {
        const { data: currentRide } = await supabase
          .from("rides")
          .select("status")
          .eq("id", rideId)
          .single();

        if (currentRide?.status !== "pending") {
          console.log("[RideWaiting] ⏭️ Re-match skipped — ride is now", currentRide?.status);
          return;
        }

        console.log("[RideWaiting] 🔄 Triggering re-match for ride", rideId);
        setIsReMatching(true);
        setReMatchCount(prev => prev + 1);

        // استدعاء match-ride مع flag إعادة المطابقة
        await supabase.functions.invoke("match-ride", {
          body: { rideId, re_match: true },
        });

        console.log("[RideWaiting] ✅ Re-match invoked successfully");
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

  // Handle actual cancellation with reason
  const handleConfirmCancel = async (reason: string, category: string) => {
    console.log("[RideWaiting] 🗑️ Confirming cancellation:", {
      reason,
      category,
    });
    setCancelling(true);

    // Check if driver already accepted - apply cancellation fee
    let cancellationFee = 0;
    if (rideStatus === "accepted" || rideStatus === "arrived") {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "cancellation_fee")
        .single();
      if (settings?.value) {
        const feeSettings = settings.value as {
          amount: number;
          enabled: boolean;
          applies_after_acceptance: boolean;
        };
        if (feeSettings.enabled && feeSettings.applies_after_acceptance) {
          cancellationFee = feeSettings.amount;
        }
      }
    }
    // فلترة بالحالات التي يُسمح للراكب بإلغائها فقط
    const cancellableStatuses = ["pending", "accepted", "arrived"];
    const { error, count } = await supabase
      .from("rides")
      .update({
        status: "cancelled",
        cancelled_by: "rider",
        cancellation_reason: reason,
        cancellation_fee: cancellationFee,
        cancellation_fee_paid: cancellationFee > 0,
      })
      .eq("id", rideId)
      .in("status", cancellableStatuses);
    if (!error) {
      // خصم غرامة الإلغاء من محفظة الراكب إن وُجدت
      if (cancellationFee > 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, wallet_balance")
              .eq("user_id", user.id)
              .single();

            if (profile && (profile.wallet_balance || 0) >= cancellationFee) {
              const newBalance = (profile.wallet_balance || 0) - cancellationFee;
              // تحديث المحفظة بشرط أن الرصيد لم يتغير (حماية من race condition)
              const { error: walletErr } = await supabase
                .from("profiles")
                .update({ wallet_balance: newBalance })
                .eq("id", profile.id)
                .gte("wallet_balance", cancellationFee);

              if (!walletErr) {
                await (supabase as any).from("wallet_transactions").insert({
                  user_id: user.id,
                  amount: -cancellationFee,
                  type: "cancellation_fee",
                  description: `غرامة إلغاء رحلة #${rideId.substring(0, 8)}`,
                  reference_id: rideId,
                  balance_after: newBalance,
                });
              } else {
                console.warn("[RideWaiting] Wallet deduction skipped — balance changed:", walletErr);
              }
            }
          }
        } catch (feeError) {
          console.error("[RideWaiting] Failed to deduct cancellation fee:", feeError);
        }
      }

      setShowCancelDialog(false);
      if (cancellationFee > 0) {
        toast({
          title: "تم إلغاء الرحلة",
          description: `تم خصم غرامة إلغاء: ${cancellationFee.toLocaleString()} د.ع من محفظتك`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "تم إلغاء الرحلة",
          description: "نأمل أن نراك مرة أخرى قريباً",
        });
      }
      onCancel();
    } else {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إلغاء الرحلة",
        variant: "destructive",
      });
    }
    setCancelling(false);
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
      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: "#0b1326" }} dir="rtl">

        {/* هيدر النجاح */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4"
          style={{ background: "linear-gradient(135deg, #0d1f14 0%, #0b1f16 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(91,221,166,0.15)", border: "1px solid rgba(91,221,166,0.3)" }}>
              <Sparkles className="w-5 h-5" style={{ color: "#5bdda6" }} />
            </div>
            <div>
              <h1 className="text-[18px] font-black text-white leading-tight">تم قبول طلبك! 🎉</h1>
              <p className="text-[12px] mt-0.5" style={{ color: "rgba(91,221,166,0.7)" }}>السائق في الطريق إليك الآن</p>
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
            className="rounded-2xl overflow-hidden"
            style={{ background: "#171f33", border: "1px solid rgba(91,221,166,0.12)" }}
          >
            <div className="p-4 flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar className="w-16 h-16" style={{ border: "2px solid rgba(91,221,166,0.4)" }}>
                  <AvatarImage src={acceptedDriver.profile_image_url || ""} alt={acceptedDriver.full_name} />
                  <AvatarFallback className="text-xl font-black" style={{ background: "rgba(91,221,166,0.12)", color: "#5bdda6" }}>
                    {acceptedDriver.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#5bdda6", border: "2px solid #0b1326" }}>
                  <User className="w-2.5 h-2.5" style={{ color: "#0b1326" }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-black text-white truncate">{acceptedDriver.full_name}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                    <Star className="w-3 h-3 fill-current" />
                    {acceptedDriver.rating?.toFixed(1) || '5.0'}
                  </span>
                  {acceptedDriver.vehicle_plate && (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)", direction: "ltr" }}>
                      {acceptedDriver.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* معلومات المركبة */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(91,221,166,0.1)" }}>
                <Car className="w-4 h-4" style={{ color: "#5bdda6" }} />
              </div>
              <span className="text-[13px] text-slate-400">
                {getVehicleTypeName(acceptedDriver.vehicle_type)}
                {acceptedDriver.vehicle_model && ` • ${acceptedDriver.vehicle_model}`}
                {acceptedDriver.vehicle_color && ` • ${acceptedDriver.vehicle_color}`}
              </span>
            </div>

            {/* أزرار التواصل */}
            <div className="grid grid-cols-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => window.open(`tel:${acceptedDriver.phone}`, '_self')}
                className="flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold transition-all active:opacity-70"
                style={{ color: "#5bdda6", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Phone className="w-4 h-4" /> اتصال
              </button>
              <button
                onClick={() => window.open(`https://wa.me/${acceptedDriver.phone}`, '_blank')}
                className="flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold transition-all active:opacity-70"
                style={{ color: "#25d366" }}
              >
                <MessageCircle className="w-4 h-4" /> واتساب
              </button>
            </div>
          </motion.div>

          {/* خط السير */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "#171f33", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* الانطلاق */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(91,221,166,0.15)", border: "1px solid rgba(91,221,166,0.25)" }}>
                <Rocket className="w-4 h-4" style={{ color: "#5bdda6" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-widest mb-0.5" style={{ color: "#5bdda6" }}>الانطلاق</p>
                <p className="text-[13px] font-semibold text-white truncate">{pickupAddress}</p>
              </div>
            </div>

            {/* فاصل */}
            <div className="flex items-center gap-3 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-9 flex justify-center">
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <div className="w-px h-2 bg-slate-600" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <div className="w-px h-2 bg-slate-600" />
                </div>
              </div>
            </div>

            {/* الوجهة + الأجرة */}
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}>
                <Navigation className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-widest text-orange-400 mb-0.5">الوجهة</p>
                <p className="text-[13px] font-semibold text-white truncate">{dropoffAddress}</p>
              </div>
              <div className="shrink-0 text-left" style={{ borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: "0.75rem", marginRight: "0.25rem" }}>
                <p className="text-[10px] text-slate-500 mb-0.5">الأجرة</p>
                <p className="text-[18px] font-black" style={{ color: "#5bdda6" }}>{estimatedFare.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">د.ع</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* زر تتبع الرحلة */}
        <div className="flex w-full mt-auto shrink-0 bg-[#0b1326]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)', zIndex: 10 }}>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleContinueToTracking}
            whileTap={{ scale: 0.97 }}
            className="flex-auto h-[72px] rounded-none border-t border-[#5bdda6]/30 flex items-center justify-center gap-2 text-[18px] font-black transition-all shadow-[0_-4px_24px_rgba(91,221,166,0.25)] touch-manipulation"
            style={{ background: "#5bdda6", color: "#0b1326" }}
          >
            <Navigation className="w-6 h-6 ml-1" />
            تتبع الرحلة على الخريطة
          </motion.button>
        </div>
      </div>
    );
  }

  // Waiting State — Dark Luxury
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0b1326" }} dir="rtl">

      {/* طبقة انتقال السائق */}
      <AnimatePresence>
        {showDriverFoundTransition && acceptedDriver && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{ background: "rgba(11,19,38,0.9)", backdropFilter: "blur(16px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="rounded-3xl p-7 text-center mx-6"
              style={{ background: "#171f33", border: "1px solid rgba(91,221,166,0.3)", boxShadow: "0 0 60px rgba(91,221,166,0.15)" }}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(91,221,166,0.15)" }}>
                <Sparkles className="w-8 h-8" style={{ color: "#5bdda6" }} />
              </div>
              <h2 className="text-[20px] font-black text-white mb-2">تم العثور على سائق!</h2>
              <p className="text-[13px] text-slate-400">{acceptedDriver.full_name} في الطريق إليك الآن</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* هيدر البحث */}
      <div
        className="shrink-0 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3"
        style={{ background: "linear-gradient(180deg, #0d1a2e 0%, #0b1326 100%)", borderBottom: "1px solid rgba(91,221,166,0.08)" }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          {/* أيقونة البحث */}
          <div className="relative w-11 h-11 shrink-0">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ border: "2px solid rgba(91,221,166,0.3)" }} />
            <div className="relative w-full h-full rounded-xl flex items-center justify-center" style={{ background: "rgba(91,221,166,0.12)", border: "1px solid rgba(91,221,166,0.2)" }}>
              <Search className="w-5 h-5" style={{ color: "#5bdda6" }} />
            </div>
          </div>
          {/* النصوص */}
          <div>
            <h1 className="text-[16px] font-black text-white leading-tight">بانتظار سائق 🔍</h1>
            <p className="text-[12px] mt-1" style={{ color: "rgba(91,221,166,0.65)" }}>
              {encouragingMessages[encouragingMessageIndex]?.icon}{" "}
              {encouragingMessages[encouragingMessageIndex]?.text || "جاري البحث عن أفضل سائق لك..."}
            </p>
          </div>
          {/* عداد السائقين */}
          {nearbyDrivers > 0 && (
            <div className="text-center px-4 py-1.5 rounded-xl" style={{ background: "rgba(91,221,166,0.1)", border: "1px solid rgba(91,221,166,0.2)" }}>
              <span className="text-[13px] font-bold" style={{ color: "#5bdda6" }}>{nearbyDrivers} سائق متاح قريب منك</span>
            </div>
          )}
        </div>
      </div>

      {/* المحتوى */}
      <div className="flex-1 flex flex-col px-4 py-2 gap-2 overflow-hidden">

        {/* شريط التقدم */}
        <div className="shrink-0 rounded-2xl p-3" style={{ background: "#171f33", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4" style={{ color: "#5bdda6" }} />
              وقت الانتظار
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-black font-mono text-white tabular-nums leading-none">{formatTime(elapsedTime)}</span>
              <span className="text-[13px] text-slate-500 font-medium">/ {maxWaitTimeout}:00</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                background: elapsedTime / 60 >= maxWaitTimeout * warningThreshold
                  ? "linear-gradient(90deg, #ef4444, #dc2626)"
                  : "linear-gradient(90deg, #5bdda6, #3db886)",
                width: `${Math.min((elapsedTime / 60 / maxWaitTimeout) * 100, 100)}%`,
              }}
            />
          </div>
          {elapsedTime / 60 >= maxWaitTimeout * warningThreshold && autoCancelEnabled && (
            <p className="text-[13px] text-center mt-1.5 font-semibold animate-pulse" style={{ color: "#f87171" }}>
              {warningMessage}
            </p>
          )}
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[13px] text-slate-400">وقت الوصول المتوقع</span>
            <span className="text-[15px] font-black" style={{ color: "#5bdda6" }}>{getEstimatedWaitTime()} دقيقة</span>
          </div>
        </div>

        {/* خط سير الرحلة */}
        <div className="shrink-0 rounded-2xl overflow-hidden" style={{ background: "#171f33", border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* الانطلاق */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(91,221,166,0.12)", border: "1px solid rgba(91,221,166,0.2)" }}>
              <Rocket className="w-3.5 h-3.5" style={{ color: "#5bdda6" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-widest" style={{ color: "#5bdda6" }}>الانطلاق</p>
              <p className="text-[14px] font-semibold text-white truncate">{pickupAddress}</p>
            </div>
          </div>

          {/* فاصل */}
          <div className="flex items-center gap-2.5 px-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="w-8 flex justify-center">
              <div className="flex flex-col items-center gap-0.5 py-0.5">
                <div className="w-px h-1.5 bg-slate-700" />
                <div className="w-1 h-1 rounded-full bg-slate-600" />
                <div className="w-px h-1.5 bg-slate-700" />
              </div>
            </div>
          </div>

          {/* الوجهة + الأجرة */}
          <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <Navigation className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-widest text-orange-400">الوجهة</p>
              <p className="text-[14px] font-semibold text-white truncate">{dropoffAddress}</p>
            </div>
            <div className="shrink-0 text-left" style={{ borderRight: "1px solid rgba(255,255,255,0.07)", paddingRight: "0.5rem", marginRight: "0.25rem" }}>
              <p className="text-[18px] font-black leading-tight" style={{ color: "#5bdda6" }}>{estimatedFare.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500">د.ع</p>
            </div>
          </div>
        </div>

        {/* رسائل إعادة المطابقة */}
        {(reassignmentCount > 0 || isReMatching) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="shrink-0 rounded-2xl p-3 flex items-center gap-3"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            {isReMatching
              ? <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: "#5bdda6" }} />
              : <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            }
            <p className="text-[12px] text-amber-300 font-medium">
              {isReMatching
                ? "توسيع نطاق البحث..."
                : reassignmentCount === 1 ? "جاري البحث عن سائق بديل..."
                : reassignmentCount >= 3 ? "آخر محاولة للعثور على سائق متاح..."
                : "لا تزال البحث مستمراً..."}
            </p>
          </motion.div>
        )}

        {/* ═══ بطاقة الأذكار الإسلامية ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="shrink-0 rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0f1f14 0%, #111d2c 100%)",
            border: "1px solid rgba(91,221,166,0.15)",
          }}
        >
          {/* رأس البطاقة */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">📿</span>
              <span className="text-[11px] font-semibold text-white">اجعل انتظارك ذكراً</span>
            </div>
            {totalDhikr > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(91,221,166,0.12)", color: "#5bdda6", border: "1px solid rgba(91,221,166,0.2)" }}
              >
                {totalDhikr} ذكر اليوم
              </span>
            )}
          </div>

          {/* أزرار الأذكار */}
          <div className="grid grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.04)" }}>
            {/* سبحان الله */}
            <button
              onClick={() => handleDhikrTap("tasbih")}
              className="flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95"
              style={{
                background: lastTappedDhikr === "tasbih" ? "rgba(91,221,166,0.12)" : "#0f1f14",
              }}
            >
              <span className="text-[16px] leading-none">🌿</span>
              <span className="text-[10px] font-bold text-white">سبحان الله</span>
              <span
                className="text-[16px] font-black tabular-nums leading-none"
                style={{ color: "#5bdda6" }}
              >
                {dhikrCounts.tasbih}
              </span>
            </button>

            {/* الحمد لله */}
            <button
              onClick={() => handleDhikrTap("tahmid")}
              className="flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95"
              style={{
                background: lastTappedDhikr === "tahmid" ? "rgba(251,191,36,0.1)" : "#0f1f14",
                borderRight: "1px solid rgba(255,255,255,0.04)",
                borderLeft: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <span className="text-[16px] leading-none">☀️</span>
              <span className="text-[10px] font-bold text-white">الحمد لله</span>
              <span
                className="text-[16px] font-black tabular-nums leading-none"
                style={{ color: "#fbbf24" }}
              >
                {dhikrCounts.tahmid}
              </span>
            </button>

            {/* أستغفر الله */}
            <button
              onClick={() => handleDhikrTap("istighfar")}
              className="flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95"
              style={{
                background: lastTappedDhikr === "istighfar" ? "rgba(147,51,234,0.1)" : "#0f1f14",
              }}
            >
              <span className="text-[16px] leading-none">🤲</span>
              <span className="text-[10px] font-bold text-white">أستغفر الله</span>
              <span
                className="text-[16px] font-black tabular-nums leading-none"
                style={{ color: "#c084fc" }}
              >
                {dhikrCounts.istighfar}
              </span>
            </button>
          </div>

          {/* ذيل البطاقة */}
          <div className="px-3 py-1.5 flex items-center justify-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[9px] text-slate-500 text-center">
              انقر على كل ذكر لتسجيله • يُحفظ تلقائياً
            </p>
          </div>
        </motion.div>
      </div>

      {/* زر الإلغاء */}
      <div className="flex w-full mt-auto shrink-0 bg-[#163d30]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 32px), 32px)', zIndex: 10 }}>
        <button
          onClick={handleCancelClick}
          disabled={cancelling}
          className="flex-auto h-[72px] rounded-none flex items-center justify-center gap-2 text-lg font-bold text-emerald-300 bg-[#0f2922] hover:bg-[#163d30] transition-colors disabled:opacity-50 touch-manipulation border-t border-emerald-500/20 active:scale-[0.98]"
        >
          {cancelling ? (
            <><Loader2 className="w-6 h-6 animate-spin ml-1 text-emerald-400" />جاري الإلغاء...</>
          ) : (
            <><X className="w-5 h-5 ml-1 text-emerald-400" />إلغاء الطلب</>
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
