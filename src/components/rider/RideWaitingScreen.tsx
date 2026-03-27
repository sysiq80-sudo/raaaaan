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

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    const { error } = await supabase
      .from("rides")
      .update({
        status: "cancelled",
        cancelled_by: "rider",
        cancellation_reason: reason,
        cancellation_fee: cancellationFee,
        cancellation_fee_paid: cancellationFee > 0,
      })
      .eq("id", rideId);
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
              await supabase
                .from("profiles")
                .update({ wallet_balance: newBalance })
                .eq("id", profile.id);

              await (supabase as any).from("wallet_transactions").insert({
                user_id: user.id,
                amount: -cancellationFee,
                type: "cancellation_fee",
                description: `غرامة إلغاء رحلة #${rideId.substring(0, 8)}`,
                reference_id: rideId,
                balance_after: newBalance,
              });
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

  // ═══ شاشة السائق المقبول ═══
  if (showDriverCard && acceptedDriver) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">

        {/* المحتوى */}
        <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">

          {/* بانر النجاح — حواف حادة */}
          <div className="shrink-0 bg-primary p-3 flex items-center gap-3 text-primary-foreground">
            <div className="w-9 h-9 bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">تم قبول طلبك!</p>
              <p className="text-xs text-primary-foreground/80">السائق في الطريق إليك الآن</p>
            </div>
          </div>

          {/* بطاقة السائق — حواف حادة */}
          <div className="shrink-0 bg-card border border-border/40 overflow-hidden">
            <div className="p-3 flex items-center gap-3">
              <Avatar className="w-14 h-14 border-2 border-primary/30 shrink-0">
                <AvatarImage src={acceptedDriver.profile_image_url || ""} alt={acceptedDriver.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                  {acceptedDriver.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground truncate">{acceptedDriver.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-warning text-xs font-bold bg-warning/10 px-2 py-0.5">
                    <Star className="w-3 h-3 fill-current" />
                    {acceptedDriver.rating?.toFixed(1) || '5.0'}
                  </span>
                  {acceptedDriver.vehicle_plate && (
                    <span className="text-xs font-mono font-black text-foreground bg-muted px-2 py-0.5">
                      {acceptedDriver.vehicle_plate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* معلومات المركبة */}
            <div className="px-3 pb-3 border-t border-border/30 pt-2 flex items-center gap-2">
              <Car className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                {getVehicleTypeName(acceptedDriver.vehicle_type)}
                {acceptedDriver.vehicle_model && ` • ${acceptedDriver.vehicle_model}`}
                {acceptedDriver.vehicle_color && ` • ${acceptedDriver.vehicle_color}`}
              </span>
            </div>

            {/* أزرار التواصل — دون حواف */}
            <div className="grid grid-cols-2 border-t border-border/30">
              <button
                onClick={() => window.open(`tel:${acceptedDriver.phone}`, '_self')}
                className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors border-l border-border/30"
              >
                <Phone className="w-4 h-4" /> اتصال
              </button>
              <button
                onClick={() => window.open(`https://wa.me/${acceptedDriver.phone}`, '_blank')}
                className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-green-600 hover:bg-green-500/5 transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> واتساب
              </button>
            </div>
          </div>

          {/* خط السير — حواف حادة */}
          <div className="shrink-0 bg-card border border-border/40 overflow-hidden">
            {/* نقطة الانطلاق */}
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="w-8 h-8 bg-primary flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider">الانطلاق</p>
                <p className="text-sm font-semibold text-foreground truncate">{pickupAddress}</p>
              </div>
            </div>

            {/* خط فاصل مع نقطتين */}
            <div className="flex items-center gap-3 px-3">
              <div className="w-8 flex justify-center">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-2 bg-border/60" />
                  <div className="w-1 h-1 bg-muted-foreground/40 rounded-full" />
                  <div className="w-0.5 h-2 bg-border/60" />
                </div>
              </div>
              <div className="flex-1 border-t border-dashed border-border/40" />
            </div>

            {/* الوجهة */}
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="w-8 h-8 bg-orange-500 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">الوجهة</p>
                <p className="text-sm font-semibold text-foreground truncate">{dropoffAddress}</p>
              </div>
              <div className="text-left shrink-0 border-r border-border/30 pr-3 mr-1">
                <p className="text-[10px] text-muted-foreground">الأجرة</p>
                <p className="text-lg font-black text-primary">{estimatedFare.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">د.ع</p>
              </div>
            </div>
          </div>

          <div className="flex-1" />
        </div>

        {/* زر تتبع الرحلة — حواف حادة */}
        <button
          onClick={handleContinueToTracking}
          className="w-full h-14 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-base font-bold shrink-0 active:brightness-90 transition-all"
          style={{ borderRadius: 0 }}
        >
          <Navigation className="w-5 h-5" />
          تتبع الرحلة على الخريطة
        </button>
      </div>
    );
  }

  // Waiting State - Premium Design
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">

      <AnimatePresence>
        {showDriverFoundTransition && acceptedDriver && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="bg-card rounded-2xl border border-primary/20 shadow-2xl p-6 text-center max-w-xs"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">
                تم العثور على سائق!
              </h2>
              <p className="text-sm text-muted-foreground">
                {acceptedDriver.full_name} في الطريق إليك الآن
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* المحتوى — بدون سكرول */}
      <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">

        {/* بانر البحث — حواف حادة */}
        <div className="shrink-0 bg-primary/8 border border-primary/20 p-3 flex items-center gap-3">
          <div className="relative w-12 h-12 shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
            <div className="relative w-full h-full rounded-full bg-primary/15 flex items-center justify-center border border-primary/30">
              <Search className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground">بانتظار سائق</h1>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {encouragingMessages[encouragingMessageIndex]?.icon}{" "}
              {encouragingMessages[encouragingMessageIndex]?.text || "نبحث في منطقتك عن سائق متاح..."}
            </p>
          </div>
        </div>

        {/* مؤقت التقدم — حواف حادة */}
        <div className="shrink-0 bg-card border border-border/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> وقت الانتظار
            </span>
            <span className="text-xl font-bold font-mono text-foreground tabular-nums">
              {formatTime(elapsedTime)}
              <span className="text-xs text-muted-foreground font-normal mr-1">/ {maxWaitTimeout}:00</span>
            </span>
          </div>
          <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                elapsedTime / 60 >= maxWaitTimeout * warningThreshold
                  ? "bg-destructive"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.min((elapsedTime / 60 / maxWaitTimeout) * 100, 100)}%` }}
            />
          </div>
          {elapsedTime / 60 >= maxWaitTimeout * warningThreshold && autoCancelEnabled && (
            <p className="text-xs text-destructive text-center mt-2 font-medium animate-pulse">
              {warningMessage}
            </p>
          )}
        </div>

        {/* خط سير الرحلة — حواف حادة + أيقونات */}
        <div className="shrink-0 bg-card border border-border/40 overflow-hidden">
          {/* نقطة الانطلاق */}
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-8 h-8 bg-primary flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider">الانطلاق</p>
              <p className="text-sm font-semibold text-foreground truncate">{pickupAddress}</p>
            </div>
          </div>

          {/* خط فاصل متحرك */}
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 flex justify-center">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-0.5 h-1.5 bg-muted-foreground/30" />
                <div className="w-1 h-1 bg-muted-foreground/40 rounded-full" />
                <div className="w-0.5 h-1.5 bg-muted-foreground/30" />
              </div>
            </div>
            <div className="flex-1 border-t border-dashed border-border/40" />
          </div>

          {/* الوجهة */}
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-8 h-8 bg-orange-500 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">الوجهة</p>
              <p className="text-sm font-semibold text-foreground truncate">{dropoffAddress}</p>
            </div>
            {/* الأجرة */}
            <div className="text-left shrink-0 border-r border-border/30 pr-3 mr-1">
              <p className="text-[10px] text-muted-foreground">الأجرة</p>
              <p className="text-lg font-black text-primary">{estimatedFare.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">د.ع</p>
            </div>
          </div>
        </div>

        {/* رسائل إضافية حادة */}
        {(reassignmentCount > 0 || isReMatching) && (
          <div className="shrink-0 bg-amber-500/8 border border-amber-500/20 p-2.5 flex items-center gap-2">
            {isReMatching
              ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
              : <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            }
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              {isReMatching
                ? "توسيع نطاق البحث..."
                : reassignmentCount === 1 ? "جاري البحث عن سائق بديل..."
                : reassignmentCount >= 3 ? "آخر محاولة للعثور على سائق متاح..."
                : "لا تزال النبحث عن سائق..."}
            </p>
          </div>
        )}

        <div className="flex-1" />
      </div>

      {/* زر الإلغاء — حواف حادة */}
      <button
        onClick={handleCancelClick}
        disabled={cancelling}
        className="w-full h-14 flex items-center justify-center gap-2 bg-destructive/10 text-destructive text-base font-bold disabled:opacity-50 border-t-2 border-destructive/40 shrink-0 active:bg-destructive/20 transition-all"
        style={{ borderRadius: 0 }}
      >
        {cancelling ? (
          <><Loader2 className="w-5 h-5 animate-spin" />جاري الإلغاء...</>
        ) : (
          <><X className="w-5 h-5" />إلغاء الطلب</>
        )}
      </button>

      {/* Cancellation Reason Dialog */}
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
