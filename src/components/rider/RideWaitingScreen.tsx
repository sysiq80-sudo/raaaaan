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
  const { toast } = useToast();
  const driverFoundTimeoutRef = useRef<number | null>(null);
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
      const { data, error } = await supabase
        .from("drivers")
        .select("id")
        .eq("is_online", true)
        .eq("is_available", true)
        .eq("status", "approved");
      if (!error && data) {
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
      .single();
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

    if (hasDriver) {
      setShowDriverFoundTransition(true);
      if (driverFoundTimeoutRef.current) {
        window.clearTimeout(driverFoundTimeoutRef.current);
      }
      driverFoundTimeoutRef.current = window.setTimeout(() => {
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
      "[RideWaiting] Setting up fallback subscriptions for ride:",
      rideId,
    );

    // Fallback polling (أبطأ عندما يكون Realtime متصل)
    const pollInterval = setInterval(async () => {
      if (driverFoundInProgress || isConnected) return; // Skip if found or Realtime connected

      try {
        const { data } = await supabase
          .from("rides")
          .select("status, driver_id, reassignment_count")
          .eq("id", rideId)
          .single();

        if (
          data?.status === "accepted" &&
          data?.driver_id &&
          !driverFoundInProgress
        ) {
          console.log(
            "[RideWaiting] ✅ Poll detected driver acceptance (fallback)",
          );
          handleDriverFound(data.driver_id);
        }
        if (data?.status === "cancelled") {
          onCancel();
        }
      } catch (err) {
        console.error("[RideWaiting] Poll error:", err);
      }
    }, 2000);
    return () => {
      clearInterval(pollInterval);
    };
  }, [rideId, driverFoundInProgress, toast, onCancel]);

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
      setShowCancelDialog(false);
      if (cancellationFee > 0) {
        toast({
          title: "تم إلغاء الرحلة",
          description: `تم خصم غرامة إلغاء: ${cancellationFee.toLocaleString()} د.ع`,
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

  // Show driver card if driver accepted
  if (showDriverCard && acceptedDriver) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Progress stepper at top */}
        <div className="bg-card/80 backdrop-blur-xl border-b border-border/30 px-4 py-3 safe-area-top">
          <RideProgressStepper status="accepted" />
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Success Banner - Premium with semantic colors */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl p-4 text-primary-foreground shadow-xl shadow-primary/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center shrink-0 backdrop-blur-sm border border-primary-foreground/20">
                <Car className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  تم قبول طلبك!
                </h2>
                <p className="text-primary-foreground/90 text-sm mt-0.5">
                  السائق في الطريق إليك الآن
                </p>
              </div>
            </div>
          </div>

          {/* Driver Card - Premium Design */}
          <div className="bg-card rounded-2xl border border-border/40 shadow-lg overflow-hidden">
            {/* Driver Info Section */}
            <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/10">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="w-16 h-16 border-3 border-primary/40 shadow-lg shadow-primary/20">
                    <AvatarImage
                      src={acceptedDriver.profile_image_url || ""}
                      alt={acceptedDriver.full_name}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-xl font-bold">
                      {acceptedDriver.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-card flex items-center justify-center">
                    <div className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-foreground truncate">
                    {acceptedDriver.full_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1 text-warning bg-warning/10 px-2 py-1 rounded-lg text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{acceptedDriver.rating?.toFixed(1) || "5.0"}</span>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-2 py-0.5">
                      <Sparkles className="w-3 h-3 ml-1" />
                      سائق موثوق
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Contact Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl bg-card hover:bg-primary/5 border-border/50 transition-all"
                  onClick={() =>
                    window.open(`tel:${acceptedDriver.phone}`, "_self")
                  }
                >
                  <Phone className="w-4 h-4 ml-2 text-primary" />
                  <span className="text-sm font-semibold">اتصال</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl bg-card hover:bg-success/5 border-border/50 transition-all"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${acceptedDriver.phone}`,
                      "_blank",
                    )
                  }
                >
                  <MessageCircle className="w-4 h-4 ml-2 text-success" />
                  <span className="text-sm font-semibold">واتساب</span>
                </Button>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="p-4 border-t border-border/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    المركبة
                  </p>
                  <p className="text-sm font-bold text-foreground truncate">
                    {getVehicleTypeName(acceptedDriver.vehicle_type)}
                    {acceptedDriver.vehicle_model &&
                      ` • ${acceptedDriver.vehicle_model}`}
                  </p>
                  {acceptedDriver.vehicle_color && (
                    <p className="text-xs text-muted-foreground">
                      {acceptedDriver.vehicle_color}
                    </p>
                  )}
                </div>
              </div>

              {acceptedDriver.vehicle_plate && (
                <div className="bg-gradient-to-br from-muted/60 to-muted/30 rounded-xl px-4 py-2 text-center border border-border/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    رقم اللوحة
                  </p>
                  <p className="text-base font-black text-foreground tracking-[0.2em] font-mono">
                    {acceptedDriver.vehicle_plate}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Trip Summary - Compact */}
          <div className="bg-card rounded-2xl border border-border/40 p-4 shadow-sm">
            <div className="flex gap-3">
              {/* Vertical line */}
              <div className="flex flex-col items-center py-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                <div className="w-0.5 flex-1 bg-gradient-to-b from-primary to-accent my-1.5" />
                <div className="w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-accent/20" />
              </div>

              {/* Locations */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-0.5">
                    الانطلاق
                  </p>
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {pickupAddress}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-accent-foreground font-bold uppercase tracking-wider mb-0.5">
                    الوجهة
                  </p>
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {dropoffAddress}
                  </p>
                </div>
              </div>

              {/* Fare */}
              <div className="flex flex-col justify-center items-end border-r border-border/40 pr-4 mr-1">
                <p className="text-[10px] text-muted-foreground">الأجرة</p>
                <p className="text-xl font-bold text-primary">
                  {estimatedFare.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">د.ع</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Button */}
        <div
          className={`p-4 bg-background/98 backdrop-blur-md border-t border-border/30 safe-area-bottom ${bottomNavEnabled ? "pb-24" : ""}`}
        >
          <Button
            size="lg"
            className="w-full h-14 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground rounded-xl shadow-xl shadow-primary/30 text-base font-bold transition-all duration-300 hover:shadow-2xl active:scale-[0.98]"
            onClick={handleContinueToTracking}
          >
            <Navigation className="w-5 h-5 ml-2" />
            تتبع الرحلة على الخريطة
          </Button>
        </div>
      </div>
    );
  }

  // Waiting State - Premium Design
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Progress stepper at top */}
      <div className="bg-card/80 backdrop-blur-xl border-b border-border/30 px-4 py-3 safe-area-top">
        <RideProgressStepper status="pending" />
      </div>

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

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Search Animation - Premium */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 border border-primary/20">
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full -translate-y-1/2 -translate-x-1/2 blur-3xl" />
          <div className="relative flex items-center gap-4">
            {/* Animated search icon */}
            <div className="relative w-16 h-16 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-ping animation-delay-200" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/40 shadow-lg shadow-primary/20">
                <Search className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground mb-1">
                بانتظار سائق
              </h1>
              <p
                className="text-sm text-muted-foreground leading-relaxed"
                key={encouragingMessageIndex}
              >
                {encouragingMessages[encouragingMessageIndex]?.icon}{" "}
                {encouragingMessages[encouragingMessageIndex]?.text ||
                  "نبحث في منطقتك عن سائق متاح..."}
              </p>
              {/* ✅ رسالة إعادة التوجيه */}
              {reassignmentCount > 0 && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {reassignmentCount === 1 &&
                      "السائق ألغى الطلب، جاري البحث عن سائق بديل..."}
                    {reassignmentCount === 2 &&
                      "لا تزال نبحث عن سائق آخر، يرجى الانتظار قليلاً..."}
                    {reassignmentCount >= 3 &&
                      "آخر محاولة للعثور على سائق متاح..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timer & Progress - Premium */}
        <div className="bg-card rounded-2xl border border-border/40 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                وقت الانتظار
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-foreground tabular-nums">
                {formatTime(elapsedTime)}
              </span>
              <span className="text-sm text-muted-foreground">
                / {maxWaitTimeout}:00
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                elapsedTime / 60 >= maxWaitTimeout * warningThreshold
                  ? "bg-gradient-to-r from-destructive/80 to-destructive"
                  : "bg-gradient-to-r from-primary/80 to-primary"
              }`}
              style={{
                width: `${Math.min((elapsedTime / 60 / maxWaitTimeout) * 100, 100)}%`,
              }}
            />
          </div>

          {elapsedTime / 60 >= maxWaitTimeout * warningThreshold &&
            autoCancelEnabled && (
              <p className="text-xs text-destructive text-center mt-3 font-medium animate-pulse flex items-center justify-center gap-1.5 bg-destructive/10 rounded-lg py-2">
                <Sparkles className="w-3.5 h-3.5" />
                {warningMessage}
              </p>
            )}
        </div>

        {/* Trip Details - Premium */}
        <div className="bg-card rounded-2xl border border-border/40 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gradient-to-r from-muted/50 to-muted/20 border-b border-border/30">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              تفاصيل الرحلة
            </h3>
          </div>

          <div className="p-4">
            <div className="flex gap-3">
              {/* Vertical timeline */}
              <div className="flex flex-col items-center py-0.5">
                <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
                <div className="w-0.5 flex-1 bg-gradient-to-b from-primary to-accent my-2" />
                <div className="w-3 h-3 rounded-full bg-accent ring-4 ring-accent/20" />
              </div>

              {/* Locations */}
              <div className="flex-1 space-y-5 min-w-0">
                <div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1">
                    نقطة الانطلاق
                  </p>
                  <p className="text-sm font-semibold text-foreground line-clamp-2">
                    {pickupAddress}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-accent-foreground font-bold uppercase tracking-wider mb-1">
                    الوجهة
                  </p>
                  <p className="text-sm font-semibold text-foreground line-clamp-2">
                    {dropoffAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Fare section */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-sm">💵</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  الأجرة التقديرية
                </span>
              </div>
              <div className="text-left">
                <span className="text-xl font-bold text-primary">
                  {estimatedFare.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground mr-1">د.ع</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info badge */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Heart className="w-4 h-4 text-destructive" />
            <span className="text-xs">نحن نعمل على إيجاد أفضل سائق لك</span>
          </div>
        </div>
      </div>

      {/* Fixed Bottom - Cancel Button - ALWAYS VISIBLE */}
      <div
        className={`p-4 bg-background/98 backdrop-blur-md border-t border-border/30 safe-area-bottom ${bottomNavEnabled ? "pb-24" : ""}`}
      >
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14 rounded-xl border-2 border-destructive/60 text-destructive hover:bg-destructive hover:text-white hover:border-destructive transition-all duration-200 font-bold text-base shadow-lg"
          onClick={handleCancelClick}
          disabled={cancelling}
        >
          {cancelling ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin ml-2" />
              جاري الإلغاء...
            </>
          ) : (
            <>
              <X className="w-5 h-5 ml-2" />
              إلغاء الطلب
            </>
          )}
        </Button>
      </div>

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
