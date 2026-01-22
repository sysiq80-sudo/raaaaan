import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import RideProgressStepper from "@/components/rider/RideProgressStepper";
import CancellationReasonDialog from "@/components/rider/CancellationReasonDialog";
import { useRiderWaitSettings } from "@/hooks/useRiderWaitSettings";
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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState(0);
  const [searchPhase, setSearchPhase] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [acceptedDriver, setAcceptedDriver] = useState<Driver | null>(null);
  const [showDriverCard, setShowDriverCard] = useState(false);
  const [rideStatus, setRideStatus] = useState<string>("pending");
  const [encouragingMessageIndex, setEncouragingMessageIndex] = useState(0);
  const [maxWaitTimeout, setMaxWaitTimeout] = useState(10); // Default 10 minutes
  const [dhikrCounts, setDhikrCounts] = useState({
    istighfar: 0,
    tasbih: 0,
    tahmid: 0,
  });
  const [lastTappedDhikr, setLastTappedDhikr] = useState<string | null>(null);
  const { toast } = useToast();

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
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id, full_name, phone, profile_image_url, vehicle_model, vehicle_plate, vehicle_color, vehicle_type, rating",
      )
      .eq("id", driverId)
      .single();
    if (!error && data) {
      setAcceptedDriver(data as Driver);
      setShowDriverCard(true);
    }
  };

  // Handle driver found - trigger notifications
  const handleDriverFound = async (driverId: string) => {
    console.log("[RideWaiting] Driver found! Playing celebration");

    // Fetch driver info first
    await fetchDriverInfo(driverId);

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

  // Continue to tracking after seeing driver info
  const handleContinueToTracking = () => {
    onDriverFound();
  };

  // Listen for ride updates via realtime + broadcast + polling
  useEffect(() => {
    console.log(
      "[RideWaiting] Setting up realtime subscriptions for ride:",
      rideId,
    );

    // Database realtime subscription
    const dbChannel = supabase
      .channel(`ride-waiting-db-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          console.log("[RideWaiting] 📡 DB update received:", payload.new);
          const updatedRide = payload.new as any;
          if (
            updatedRide.status === "accepted" &&
            updatedRide.driver_id &&
            !showDriverCard
          ) {
            console.log("[RideWaiting] ✅ Driver found via DB subscription!");
            setRideStatus("accepted");
            handleDriverFound(updatedRide.driver_id);
          }
          if (updatedRide.status === "cancelled") {
            console.log("[RideWaiting] ❌ Ride cancelled");
            toast({
              title: "تم إلغاء الرحلة",
              description: updatedRide.cancellation_reason || "تم إلغاء الطلب",
              variant: "destructive",
            });
            onCancel();
          }
        },
      )
      .subscribe((status) => {
        console.log("[RideWaiting] DB subscription status:", status);
      });

    // Broadcast channel for instant updates
    const broadcastChannel = supabase.channel(`ride-comm-${rideId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });
    broadcastChannel
      .on(
        "broadcast",
        {
          event: "ride_accepted",
        },
        (payload: any) => {
          console.log("[RideWaiting] ⚡ Broadcast: ride_accepted received");
          if (!showDriverCard && payload.payload?.driverId) {
            setRideStatus("accepted");
            handleDriverFound(payload.payload.driverId);
          }
        },
      )
      .subscribe((status) => {
        console.log("[RideWaiting] Broadcast subscription status:", status);
      });

    // Faster polling every 2 seconds as fallback
    const pollInterval = setInterval(async () => {
      if (showDriverCard) return; // Skip if already found

      try {
        const { data } = await supabase
          .from("rides")
          .select("status, driver_id")
          .eq("id", rideId)
          .single();
        if (data?.status === "accepted" && data?.driver_id && !showDriverCard) {
          console.log("[RideWaiting] ✅ Poll detected driver acceptance");
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
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(pollInterval);
    };
  }, [rideId, showDriverCard, toast, onCancel]);

  // Handle cancel button click - show dialog
  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  // Handle actual cancellation with reason
  const handleConfirmCancel = async (reason: string, category: string) => {
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
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none">
        {/* The sheet card */}
        <div className="bg-background rounded-t-lg shadow-2xl border-t border-border/20 pointer-events-auto w-full max-w-md mx-auto max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 px-4 py-2 sticky top-0 z-10">
            <RideProgressStepper status="accepted" />
          </div>

          <div className="p-4 space-y-3 pb-8">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-md p-3 text-white shadow-lg shadow-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold">🎉 تم قبول طلبك!</h2>
                  <p className="text-white/90 text-xs">السائق في الطريق إليك</p>
                </div>
              </div>
            </div>

            {/* Driver Card */}
            <div className="bg-card rounded-md border border-border/50 shadow-sm overflow-hidden">
              {/* Driver Info */}
              <div className="p-3 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="w-14 h-14 border-2 border-green-500/30">
                      <AvatarImage
                        src={acceptedDriver.profile_image_url || ""}
                        alt={acceptedDriver.full_name}
                      />
                      <AvatarFallback className="bg-green-500/10 text-green-600">
                        <User className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-card animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground truncate">
                      {acceptedDriver.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs font-medium">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {acceptedDriver.rating?.toFixed(1) || "5.0"}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0.5 font-normal"
                      >
                        معتمد
                      </Badge>
                    </div>
                  </div>
                  {/* Contact Buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-10 h-10 rounded-md hover:bg-primary/10 hover:text-primary transition-colors hover:scale-105"
                      onClick={() =>
                        window.open(`tel:${acceptedDriver.phone}`, "_self")
                      }
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-10 h-10 rounded-md hover:bg-green-500/10 hover:text-green-600 transition-colors hover:scale-105"
                      onClick={() =>
                        window.open(
                          `https://wa.me/${acceptedDriver.phone}`,
                          "_blank",
                        )
                      }
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Vehicle Info */}
              <div className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">المركبة</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {getVehicleTypeName(acceptedDriver.vehicle_type)}
                      {acceptedDriver.vehicle_model &&
                        ` - ${acceptedDriver.vehicle_model}`}
                    </p>
                  </div>
                </div>

                {acceptedDriver.vehicle_plate && (
                  <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-center border border-border/50 min-w-[80px]">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      رقم اللوحة
                    </p>
                    <p className="text-sm font-black text-foreground tracking-widest font-mono">
                      {acceptedDriver.vehicle_plate}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Trip Summary */}
            <div className="bg-card rounded-md border border-border/50 p-3 shadow-sm">
              <div className="flex gap-3">
                <div className="flex flex-col items-center py-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-green-500 to-blue-500 my-1 opacity-50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      نقطة الانطلاق
                    </p>
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {pickupAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      الوجهة
                    </p>
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {dropoffAddress}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col justify-center items-end border-r border-border/50 pr-3 mr-1">
                  <p className="text-[10px] text-muted-foreground">التكلفة</p>
                  <p className="text-lg font-bold text-primary">
                    {estimatedFare.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">د.ع</p>
                </div>
              </div>
            </div>

            {/* Track Button */}
            <Button
              size="lg"
              className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-md shadow-lg shadow-green-500/25 text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleContinueToTracking}
            >
              <Navigation className="w-5 h-5 ml-2 animate-pulse" />
              تتبع الرحلة على الخريطة
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting State
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none">
      <div className="bg-background rounded-t-lg shadow-2xl border-t border-border/20 pointer-events-auto w-full max-w-md mx-auto max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 px-4 py-2 sticky top-0 z-10">
          <RideProgressStepper status="pending" />
        </div>

        <div className="p-4 space-y-3 pb-8">
          {/* Search Animation */}
          <div className="flex items-center gap-4 bg-primary/5 rounded-md p-3 border border-primary/10">
            <div className="relative w-12 h-12 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              <div className="relative w-full h-full rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
                <Search className="w-5 h-5 text-primary animate-pulse" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground">
                بانتظار سائق
              </h1>
              <p
                className="text-xs text-muted-foreground truncate animate-pulse"
                key={encouragingMessageIndex}
              >
                {encouragingMessages[encouragingMessageIndex]?.icon}{" "}
                {encouragingMessages[encouragingMessageIndex]?.text ||
                  "جاري البحث عن أفضل سائق..."}
              </p>
            </div>
          </div>

          {/* Timer & Progress */}
          <div className="bg-card rounded-md border border-border/50 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  وقت الانتظار المتوقع
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono text-foreground">
                  {formatTime(elapsedTime)}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {maxWaitTimeout}:00
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  elapsedTime / 60 >= maxWaitTimeout * warningThreshold
                    ? "bg-destructive"
                    : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(
                    (elapsedTime / 60 / maxWaitTimeout) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
            {elapsedTime / 60 >= maxWaitTimeout * warningThreshold &&
              autoCancelEnabled && (
                <p className="text-[10px] text-destructive text-center mt-2 font-medium animate-pulse flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {warningMessage}
                </p>
              )}
          </div>

          {/* Trip Details */}
          <div className="bg-card rounded-md border border-border/50 overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-muted/50 border-b border-border/50 border-dashed">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                تفاصيل الرحلة
              </h3>
            </div>

            <div className="p-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center py-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                  <div className="w-0.5 flex-1 bg-gradient-to-b from-green-500 to-blue-500 my-1 opacity-50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      نقطة الانطلاق
                    </p>
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {pickupAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      الوجهة
                    </p>
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {dropoffAddress}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 border-dashed">
                <span className="text-xs text-muted-foreground">
                  الأجرة التقديرية (دفع نقدي)
                </span>
                <span className="text-lg font-bold text-primary">
                  {estimatedFare.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    د.ع
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Cancel Button */}
          <Button
            variant="outline"
            className="w-full h-12 border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all rounded-md hover:scale-[1.01] active:scale-[0.99]"
            onClick={handleCancelClick}
            disabled={cancelling}
          >
            {cancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                جاري الإلغاء...
              </>
            ) : (
              <>
                <X className="w-4 h-4 ml-2" />
                إلغاء الطلب
              </>
            )}
          </Button>

          {/* Info text */}
          <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1.5 opacity-70">
            <Heart className="w-3 h-3 text-rose-400" />
            نحن نعمل على إيجاد أفضل سائق لك
          </p>
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
    </div>
  );
};

export default RideWaitingScreen;
