import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { NavigationButton } from "./NavigationButton";
import { DriverRideCompleted } from "./DriverRideCompleted";
import { ChatButton } from "@/components/ride/RideChat";
import { DriverEmergencyButton } from "./DriverEmergencyButton";
import { logger } from "@/lib/logger";
import { roundFare } from "@/lib/constants";
import FareBreakdownCard from "@/components/driver/FareBreakdownCard";
import {
  playSound,
  vibrate,
  VibrationPatterns,
  showNotification,
} from "@/utils/rideNotificationSounds";
import {
  validateDriverAtPickup,
  validateDriverAtDropoff,
  getCurrentLocationHighAccuracy,
} from "@/lib/gpsValidation";
import {
  MapPin,
  Clock,
  Wallet,
  User,
  Phone,
  Navigation,
  Loader2,
  CheckCircle,
  Flag,
  Car,
  Timer,
  AlertTriangle,
  MessageCircle,
  Star,
} from "lucide-react";

interface ActiveRide {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  vehicle_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
  scheduled_at?: string | null;
  rider_id: string;
  payment_method: string | null;
}

interface RiderInfo {
  full_name: string | null;
  phone: string | null;
  rating?: number | null;
}

interface ActiveRideCardProps {
  driverId: string;
  driverLocation?: { lat: number; lng: number } | null;
  onMinimize?: () => void;
  onNavigationClick?: (lat: number, lng: number, label: string) => void;
  refreshTrigger?: number;
}

const getLocationString = (location: unknown): string => {
  if (
    typeof location === "object" &&
    location !== null &&
    "lat" in location &&
    "lng" in location
  ) {
    const loc = location as { lat: number; lng: number };
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
  }
  return "";
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  accepted: {
    label: "متجه للعميل",
    color: "bg-blue-500",
    icon: <Navigation className="w-4 h-4" />,
  },
  arrived: {
    label: "في انتظار العميل",
    color: "bg-amber-500",
    icon: <Clock className="w-4 h-4" />,
  },
  in_progress: {
    label: "الرحلة جارية",
    color: "bg-primary",
    icon: <Car className="w-4 h-4" />,
  },
};

// Calculate remaining time from max waiting
const getRemainingWaitingTime = (elapsed: number) => {
  const remaining = MAX_WAITING_SECONDS - elapsed;
  return remaining > 0 ? remaining : 0;
};

// Maximum waiting time in seconds (5 minutes)
const MAX_WAITING_SECONDS = 300;
// Warning thresholds in seconds
const WAITING_WARNING_THRESHOLD = 240; // 4 minutes (1 min before max)
const WAITING_CRITICAL_THRESHOLD = 270; // 4.5 minutes (30 sec before max)

// Cancellation data for compensation notification
interface CancellationInfo {
  reason: string | null;
  fee: number;
  riderId: string | null;
}

export const ActiveRideCard = ({
  driverId,
  driverLocation,
  onMinimize,
  onNavigationClick,
  refreshTrigger,
}: ActiveRideCardProps) => {
  const { toast } = useToast();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [riderInfo, setRiderInfo] = useState<RiderInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [waitingTime, setWaitingTime] = useState(0);
  const [waitingWarningShown, setWaitingWarningShown] = useState(false);
  const [waitingCriticalShown, setWaitingCriticalShown] = useState(false);
  const [showCompletedScreen, setShowCompletedScreen] = useState(false);
  const [showCancellationNotice, setShowCancellationNotice] = useState(false);
  const [cancellationInfo, setCancellationInfo] =
    useState<CancellationInfo | null>(null);
  const [fareBreakdown, setFareBreakdown] = useState<{
    base_fare: number;
    per_km_rate: number;
    waiting_rate_per_min: number;
    vehicle_multiplier: number;
    total_fare: number;
  } | null>(null);
  const [completedRideData, setCompletedRideData] = useState<{
    id: string;
    final_fare: number;
    distance_km: number | null;
    duration_minutes: number | null;
    rider_id: string;
  } | null>(null);

  // Broadcast channel for driver-rider communication
  const broadcastChannel = useRef<any>(null);

  // ═══ GPS Tracking for Hybrid Pricing ═══
  const trackingPointsRef = useRef<Array<{ lat: number; lng: number; recorded_at: string; speed?: number; heading?: number; accuracy?: number }>>([]);
  const lastTrackingTimeRef = useRef<number>(0);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRiderInfo = useCallback(async (riderId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", riderId)
      .single();

    if (data) {
      setRiderInfo({ ...data, rating: null });
    }
  }, []);

  const fetchActiveRide = useCallback(async () => {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", driverId)
      .in("status", ["accepted", "arrived", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const ride = data[0];
      setActiveRide({
        id: ride.id,
        pickup_location: ride.pickup_location as { lat: number; lng: number },
        dropoff_location: ride.dropoff_location as { lat: number; lng: number },
        pickup_address: ride.pickup_address,
        dropoff_address: ride.dropoff_address,
        estimated_fare: ride.estimated_fare,
        distance_km: ride.distance_km,
        duration_minutes: ride.duration_minutes,
        vehicle_type: ride.vehicle_type || "economy",
        status: ride.status || "accepted",
        created_at: ride.created_at,
        started_at: ride.started_at,
        rider_id: ride.rider_id || "",
        payment_method: ride.payment_method,
      });

      // Fetch rider info
      if (ride.rider_id) {
        fetchRiderInfo(ride.rider_id);
      }
    } else {
      setActiveRide(null);
      setRiderInfo(null);
    }
  }, [driverId, fetchRiderInfo]);

  // Fetch active ride on mount and setup realtime subscription
  useEffect(() => {
    if (!driverId) return;

    // Fetch immediately
    fetchActiveRide();

    // Setup realtime subscription for ride updates - listen to ALL events
    const channel = supabase
      .channel(`driver-active-ride-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "rides",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          logger.debug("ActiveRideCard", "Ride update via realtime", {
            eventType: payload.eventType,
            ride: payload.new,
          });

          // Immediately update state for faster response
          if (payload.eventType === "UPDATE") {
            const updatedRide = payload.new as any;

            // Handle completed/cancelled - clear ride immediately
            if (
              updatedRide.status === "completed" ||
              updatedRide.status === "cancelled"
            ) {
              logger.info("ActiveRideCard", "Ride ended", updatedRide.status);

              if (updatedRide.status === "completed") {
                // Show completed screen
                setCompletedRideData({
                  id: updatedRide.id,
                  final_fare:
                    updatedRide.final_fare || updatedRide.estimated_fare || 0,
                  distance_km: updatedRide.distance_km,
                  duration_minutes: updatedRide.duration_minutes,
                  rider_id: updatedRide.rider_id,
                });
                setShowCompletedScreen(true);
              }

              // Handle cancellation by rider - show compensation notice
              if (
                updatedRide.status === "cancelled" &&
                updatedRide.cancelled_by === "rider"
              ) {
                const fee = updatedRide.cancellation_fee || 0;
                setCancellationInfo({
                  reason: updatedRide.cancellation_reason,
                  fee: fee,
                  riderId: updatedRide.rider_id,
                });
                setShowCancellationNotice(true);

                // Play cancellation sound and vibrate
                playSound("cancelled");
                vibrate(VibrationPatterns.cancelled);

                // Show notification
                showNotification(
                  "❌ العميل ألغى الرحلة",
                  fee > 0
                    ? `ستحصل على تعويض مالي بقيمة ${fee.toLocaleString()} د.ع`
                    : "تم إلغاء الرحلة",
                  { tag: "ride-cancelled", requireInteraction: true },
                );

                toast({
                  title: "❌ تم إلغاء الرحلة من العميل",
                  description:
                    fee > 0
                      ? `ستحصل على تعويض: ${fee.toLocaleString()} د.ع`
                      : updatedRide.cancellation_reason || "تم إلغاء الطلب",
                  duration: 10000,
                });
              }

              setActiveRide(null);
              setRiderInfo(null);
              return;
            }

            // Update active ride state immediately
            setActiveRide((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                status: updatedRide.status,
                started_at: updatedRide.started_at,
              };
            });
          }

          // Also re-fetch for complete data
          fetchActiveRide();
        },
      )
      .subscribe((status) => {
        logger.debug("ActiveRideCard", "Subscription status", status);
        if (status === "CHANNEL_ERROR") {
          logger.error(
            "ActiveRideCard",
            "Channel error - setting up polling fallback",
          );
        }
      });

    // Fallback polling every 3 seconds
    const pollInterval = setInterval(() => {
      fetchActiveRide();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [driverId, fetchActiveRide]);

  // ✅ إعادة جلب الرحلة عند قبول طلب جديد (من RideRequestCard)
  useEffect(() => {
    if (!refreshTrigger || refreshTrigger <= 0) return;
    // تأخير بسيط لضمان اكتمال كتابة قاعدة البيانات
    const timer = setTimeout(() => {
      logger.info("ActiveRideCard", "🔄 refreshTrigger fired — re-fetching active ride");
      fetchActiveRide();
    }, 500);
    // محاولة ثانية بعد 1.5 ثانية لضمان الاستجابة
    const retryTimer = setTimeout(() => {
      fetchActiveRide();
    }, 1500);
    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [refreshTrigger, fetchActiveRide]);

  useEffect(() => {
    if (!activeRide) return;
    if (!activeRide.pickup_location || !activeRide.dropoff_location) return;

    const fetchFareBreakdown = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "calculate-fare",
          {
            body: {
              pickup_lat: activeRide.pickup_location.lat,
              pickup_lng: activeRide.pickup_location.lng,
              dropoff_lat: activeRide.dropoff_location.lat,
              dropoff_lng: activeRide.dropoff_location.lng,
              distance_km: activeRide.distance_km || 0,
              vehicle_type: activeRide.vehicle_type || "economy",
              waiting_minutes: 0,
            },
          },
        );

        if (error) throw error;

        if (data?.fare_breakdown) {
          setFareBreakdown(data.fare_breakdown);
        } else if (data?.fareBreakdown) {
          setFareBreakdown(data.fareBreakdown);
        } else if (data) {
          setFareBreakdown(data);
        }
      } catch (error) {
        logger.warn("ActiveRideCard", "Fare breakdown fetch failed", error);
      }
    };

    fetchFareBreakdown();
  }, [activeRide?.id]);

  // Setup broadcast channel for communication with rider - with proper subscription
  useEffect(() => {
    if (!activeRide) return;

    logger.debug(
      "ActiveRideCard",
      "Setting up broadcast channel for ride",
      activeRide.id,
    );

    const channel = supabase.channel(`ride-comm-${activeRide.id}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: `driver-${activeRide.id}` },
      },
    });

    channel.subscribe((status) => {
      logger.debug("ActiveRideCard", "Broadcast channel status", status);
      if (status === "SUBSCRIBED") {
        broadcastChannel.current = channel;
        logger.info(
          "ActiveRideCard",
          "Channel ready for instant communication",
        );

        // Send initial location immediately when channel is ready
        if (driverLocation) {
          channel.send({
            type: "broadcast",
            event: "driver_location_update",
            payload: {
              location: driverLocation,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    });

    return () => {
      logger.debug("ActiveRideCard", "Cleaning up broadcast channel");
      supabase.removeChannel(channel);
      broadcastChannel.current = null;
    };
  }, [activeRide?.id]);

  // Send broadcast to rider - with retry logic
  const notifyRider = async (
    event: string,
    message: string,
    extraPayload?: Record<string, any>,
  ) => {
    if (broadcastChannel.current) {
      try {
        await broadcastChannel.current.send({
          type: "broadcast",
          event: event,
          payload: {
            message,
            timestamp: new Date().toISOString(),
            ...extraPayload,
          },
        });
        logger.debug("ActiveRideCard", `Sent broadcast: ${event}`);
      } catch (error) {
        logger.error(
          "ActiveRideCard",
          `Failed to send broadcast ${event}`,
          error,
        );
      }
    } else {
      logger.warn(
        "ActiveRideCard",
        `Broadcast channel not ready, event queued: ${event}`,
      );
    }
  };

  // ⚡ Broadcast driver location updates to rider for instant tracking (every location change)
  useEffect(() => {
    if (!activeRide || !driverLocation || !broadcastChannel.current) return;

    // Send location update via broadcast for instant rider tracking
    broadcastChannel.current
      .send({
        type: "broadcast",
        event: "driver_location_update",
        payload: {
          location: driverLocation,
          timestamp: new Date().toISOString(),
        },
      })
      .catch((err) =>
        logger.error("ActiveRideCard", "Location broadcast error", err),
      );
  }, [driverLocation?.lat, driverLocation?.lng, activeRide?.id]);

  // 📍 Accumulate GPS tracking points every 30 seconds during in_progress
  useEffect(() => {
    if (activeRide?.status !== "in_progress") {
      // Clear interval when not in_progress
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      return;
    }

    // Reset tracking points when ride enters in_progress
    if (trackingPointsRef.current.length === 0 && driverLocation) {
      trackingPointsRef.current.push({
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        recorded_at: new Date().toISOString(),
      });
    }

    trackingIntervalRef.current = setInterval(() => {
      if (driverLocation) {
        const now = Date.now();
        // Only record if at least 25s since last point (debounce)
        if (now - lastTrackingTimeRef.current >= 25000) {
          trackingPointsRef.current.push({
            lat: driverLocation.lat,
            lng: driverLocation.lng,
            recorded_at: new Date().toISOString(),
          });
          lastTrackingTimeRef.current = now;
          logger.debug("ActiveRideCard", `Tracking point #${trackingPointsRef.current.length} recorded`);
        }
      }
    }, 30000);

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [activeRide?.status, activeRide?.id, driverLocation]);

  // Send quick message to rider
  const sendQuickMessageToRider = (
    event: string,
    message: string,
    confirmTitle: string,
  ) => {
    notifyRider(event, message);

    playSound("messageSent");
    vibrate(VibrationPatterns.messageSent);

    toast({
      title: confirmTitle,
      description: "تم إبلاغ الراكب",
      duration: 3000,
    });
  };

  // Listen for rider broadcasts (arrived, on my way, wait, where are you)
  useEffect(() => {
    if (!activeRide) return;

    logger.debug(
      "ActiveRideCard",
      "Setting up rider message listener for ride",
      activeRide.id,
    );

    const commChannel = supabase
      .channel(`ride-comm-${activeRide.id}`)
      .on("broadcast", { event: "ride_completed_by_rider" }, (payload) => {
        logger.debug(
          "ActiveRideCard",
          "Received: ride_completed_by_rider",
          payload,
        );

        playSound("completed");
        vibrate(VibrationPatterns.completed);

        toast({
          title: "🏁 الراكب أنهى الرحلة",
          description: "تم إنهاء الرحلة بنجاح",
          duration: 8000,
        });

        showNotification(
          "🏁 الراكب أنهى الرحلة",
          "تم إنهاء الرحلة وستحصل على أرباحك قريباً",
          { tag: "ride-completed-by-rider", requireInteraction: true },
        );

        // تحديث واجهة السائق
        fetchActiveRide();
      })
      .on("broadcast", { event: "rider_arrived" }, (payload) => {
        logger.debug("ActiveRideCard", "Received: rider_arrived", payload);

        playSound("riderArrived");
        vibrate(VibrationPatterns.riderArrived);

        toast({
          title: "🏁 الراكب وصل للوجهة!",
          description: "اضغط 'تم الوصول' لإنهاء الرحلة",
          duration: 10000,
        });

        showNotification(
          "🏁 الراكب وصل للوجهة!",
          "اضغط تم الوصول لإنهاء الرحلة وتحصيل الأجرة",
          { tag: "rider-arrived", requireInteraction: true },
        );
      })
      .on("broadcast", { event: "rider_on_my_way" }, (payload) => {
        logger.debug("ActiveRideCard", "Received: rider_on_my_way", payload);

        playSound("riderOnWay");
        vibrate(VibrationPatterns.riderOnWay);

        toast({
          title: "🚶 الراكب في الطريق!",
          description: "سيصل إليك قريباً",
          duration: 5000,
        });

        showNotification("🚶 الراكب قادم!", "في طريقه إليك الآن", {
          tag: "rider-on-way",
          duration: 5000,
        });
      })
      .on("broadcast", { event: "rider_wait_moment" }, (payload) => {
        logger.debug("ActiveRideCard", "Received: rider_wait_moment", payload);

        playSound("riderWait");
        vibrate(VibrationPatterns.riderWait);

        toast({
          title: "⏱️ طلب الراكب الانتظار",
          description: "دقيقة واحدة فقط",
          duration: 5000,
        });

        showNotification("⏱️ انتظر لحظة", "الراكب يحتاج دقيقة إضافية", {
          tag: "rider-wait",
          duration: 5000,
        });
      })
      .on("broadcast", { event: "rider_where_are_you" }, (payload) => {
        logger.debug(
          "ActiveRideCard",
          "Received: rider_where_are_you",
          payload,
        );

        playSound("riderQuestion");
        vibrate(VibrationPatterns.riderQuestion);

        toast({
          title: "📍 الراكب يسأل عن موقعك",
          description: "اتصل به لتوضيح مكانك بالضبط",
          duration: 8000,
        });

        showNotification(
          "📍 أين أنت؟",
          "الراكب يسأل عن موقعك - يمكنك الاتصال به",
          { tag: "rider-question", requireInteraction: true },
        );
      })
      .on("broadcast", { event: "rider_waiting" }, (payload) => {
        logger.debug("ActiveRideCard", "Received: rider_waiting", payload);

        playSound("confirm");
        vibrate([100, 50, 100]);

        toast({
          title: "👋 الراكب بالانتظار",
          description: "يراك ويستعد للركوب",
          duration: 5000,
        });
      })
      .subscribe((status) => {
        logger.debug("ActiveRideCard", "Rider messages channel status", status);
        if (status === "SUBSCRIBED") {
          logger.info("ActiveRideCard", "Ready to receive rider messages");
        }
      });

    return () => {
      supabase.removeChannel(commChannel);
    };
  }, [activeRide?.id, toast]);

  // Timer for in_progress rides
  useEffect(() => {
    if (
      !activeRide ||
      activeRide.status !== "in_progress" ||
      !activeRide.started_at
    ) {
      setElapsedTime(0);
      return;
    }

    const startTime = new Date(activeRide.started_at).getTime();

    const timer = setInterval(() => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRide]);

  // Waiting timer for arrived status with audio warnings
  useEffect(() => {
    if (!activeRide || activeRide.status !== "arrived") {
      setWaitingTime(0);
      setWaitingWarningShown(false);
      setWaitingCriticalShown(false);
      return;
    }

    const timer = setInterval(() => {
      setWaitingTime((prev) => {
        const newTime = prev + 1;

        // Warning at 4 minutes (1 minute remaining)
        if (newTime >= WAITING_WARNING_THRESHOLD && !waitingWarningShown) {
          setWaitingWarningShown(true);
          playSound("warning");
          vibrate([200, 100, 200, 100, 200]);
          toast({
            title: "⚠️ تنبيه: دقيقة واحدة متبقية!",
            description: "وقت الانتظار المجاني يوشك على الانتهاء",
            duration: 8000,
          });
          showNotification(
            "⚠️ دقيقة واحدة متبقية!",
            "وقت الانتظار المجاني يوشك على الانتهاء",
            { tag: "waiting-warning" },
          );
        }

        // Critical at 4.5 minutes (30 seconds remaining)
        if (newTime >= WAITING_CRITICAL_THRESHOLD && !waitingCriticalShown) {
          setWaitingCriticalShown(true);
          playSound("urgent");
          vibrate([300, 100, 300, 100, 300, 100, 500]);
          toast({
            title: "🚨 تنبيه عاجل: 30 ثانية متبقية!",
            description: "الانتظار الإضافي سيُحتسب على العميل",
            duration: 10000,
            variant: "destructive",
          });
          showNotification(
            "🚨 30 ثانية متبقية!",
            "الانتظار الإضافي سيُحتسب على العميل",
            { tag: "waiting-critical", requireInteraction: true },
          );
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRide?.status, waitingWarningShown, waitingCriticalShown, toast]);

  // Format waiting time with color coding
  const formatWaitingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getWaitingTimeColor = () => {
    if (waitingTime >= WAITING_CRITICAL_THRESHOLD)
      return "text-red-500 bg-red-500/20";
    if (waitingTime >= WAITING_WARNING_THRESHOLD)
      return "text-amber-500 bg-amber-500/20";
    return "text-muted-foreground bg-secondary";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleArrived = async () => {
    if (!activeRide || loading) return;
    setLoading(true);

    try {
      // التحقق من الموقع الحالي بدقة عالية
      let currentLocation: { lat: number; lng: number };

      if (driverLocation) {
        currentLocation = driverLocation;
      } else {
        toast({
          title: "جاري تحديد موقعك...",
          description: "يرجى الانتظار",
        });

        const position = await getCurrentLocationHighAccuracy();
        currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }

      // التحقق من المسافة (يجب أن يكون ضمن 100م)
      const validation = validateDriverAtPickup(
        currentLocation,
        activeRide.pickup_location,
        100,
      );

      if (!validation.isValid) {
        toast({
          title: "⚠️ لم تصل بعد",
          description: validation.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Play confirmation sound immediately
      playSound("confirm");
      vibrate([200, 100, 200]);

      // ✅ DB Update FIRST (reliable REST) — الأولوية لتحديث قاعدة البيانات
      const { error } = await supabase
        .from("rides")
        .update({ status: "arrived" })
        .eq("id", activeRide.id);

      if (error) throw error;

      // ⚡ THEN broadcast (best-effort — لا يمنع الاستمرار)
      notifyRider("driver_arrived", "السائق وصل لموقعك!", {
        riderName: riderInfo?.full_name,
      }).catch(() => {});

      toast({
        title: "تم تأكيد الوصول ✅",
        description: `تم إبلاغ العميل - المسافة: ${Math.round(validation.distance)}م`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide || loading) return;

    // Confirmation dialog
    const confirmed = window.confirm("هل تأكدت من ركوب العميل في السيارة؟");
    if (!confirmed) return;

    setLoading(true);

    try {
      // Play sound immediately
      playSound("inProgress");
      vibrate(VibrationPatterns.inProgress);

      // ✅ DB Update FIRST (reliable REST)
      const { error } = await supabase
        .from("rides")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", activeRide.id);

      if (error) throw error;

      // ⚡ THEN broadcast (best-effort)
      notifyRider("ride_started", "الرحلة بدأت!", {
        riderName: riderInfo?.full_name,
        dropoffAddress: activeRide.dropoff_address,
      }).catch(() => {});

      toast({
        title: "✅ العميل ركب - بدأت الرحلة!",
        description: "رحلة موفقة وآمنة",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // حساب المسافة الفعلية من نقاط التتبع GPS (Haversine)
  const calculateGpsDistance = (points: Array<{ lat: number; lng: number }>): number => {
    if (points.length < 2) return 0;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      const R = 6371;
      const dLat = toRad(points[i].lat - points[i - 1].lat);
      const dLng = toRad(points[i].lng - points[i - 1].lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(points[i - 1].lat)) *
          Math.cos(toRad(points[i].lat)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalKm += R * c;
    }
    return Math.round(totalKm * 100) / 100;
  };

  const handleCompleteRide = async () => {
    if (!activeRide || loading) return;
    setLoading(true);

    try {
      // التحقق من الموقع الحالي بدقة عالية
      let currentLocation: { lat: number; lng: number };

      if (driverLocation) {
        currentLocation = driverLocation;
      } else {
        toast({
          title: "جاري تحديد موقعك...",
          description: "يرجى الانتظار",
        });

        const position = await getCurrentLocationHighAccuracy();
        currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }

      // التحقق من المسافة (يجب أن يكون ضمن 150م من الوجهة)
      const validation = validateDriverAtDropoff(
        currentLocation,
        activeRide.dropoff_location,
        150,
      );

      if (!validation.isValid) {
        toast({
          title: "⚠️ لم تصل للوجهة بعد",
          description: validation.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // إضافة النقطة الأخيرة (موقع الوصول)
      trackingPointsRef.current.push({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        recorded_at: new Date().toISOString(),
      });

      // حساب المسافة الفعلية من نقاط GPS المتراكمة
      const gpsDistance = calculateGpsDistance(trackingPointsRef.current);
      console.log(`[Driver] GPS distance: ${gpsDistance} km from ${trackingPointsRef.current.length} points`);

      const waitingMinutes =
        activeRide.status === "arrived"
          ? Math.floor(
              (Date.now() - new Date(activeRide.created_at).getTime()) / 60000,
            )
          : 0;

      const estimatedFare = activeRide.estimated_fare || 0;

      // Play completion sound immediately
      playSound("completed");
      vibrate(VibrationPatterns.completed);

      // 🔄 استدعاء Edge Function لإكمال الرحلة مع تدقيق الأجرة
      const { data: completionResult, error: completionError } =
        await supabase.functions.invoke("complete-ride", {
          body: {
            ride_id: activeRide.id,
            final_gps_distance: gpsDistance > 0 ? gpsDistance : null,
            waiting_minutes: waitingMinutes,
            tracking_points:
              trackingPointsRef.current.length > 1
                ? trackingPointsRef.current
                : null,
          },
        });

      if (completionError) {
        console.error("[Driver] complete-ride Edge Function failed:", completionError);
        // Fallback: direct DB update if Edge Function fails
        const { error } = await supabase
          .from("rides")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            final_fare: estimatedFare,
            waiting_minutes: waitingMinutes,
            actual_distance_km: gpsDistance > 0 ? gpsDistance : null,
          })
          .eq("id", activeRide.id);
        if (error) throw error;
      }

      // تحديد الأجرة النهائية (قد تكون مُعدّلة)
      const finalFare = completionResult?.final_fare || estimatedFare;
      const fareAdjusted = completionResult?.fare_adjusted || false;

      // إشعار السائق إذا تم تعديل الأجرة
      if (fareAdjusted && completionResult?.adjustment_message) {
        toast({
          title: "💰 تعديل الأجرة",
          description: completionResult.adjustment_message,
        });

        // إشعار الراكب بالتعديل عبر البث (best-effort)
        notifyRider("fare_adjusted", completionResult.adjustment_message, {
          oldFare: estimatedFare,
          newFare: finalFare,
        }).catch(() => {});
      }

      // تنظيف نقاط التتبع
      trackingPointsRef.current = [];
      lastTrackingTimeRef.current = 0;

      // ⚡ Broadcast to rider (best-effort — بعد نجاح التحديث)
      notifyRider("ride_completed", "الحمد لله على السلامة!", {
        finalFare,
        riderName: riderInfo?.full_name,
      }).catch(() => {});

      // Show completed screen with rating
      setCompletedRideData({
        id: activeRide.id,
        final_fare: finalFare,
        distance_km: completionResult?.actual_distance_km || activeRide.distance_km,
        duration_minutes: activeRide.duration_minutes,
        rider_id: activeRide.rider_id,
      });
      setShowCompletedScreen(true);
      setActiveRide(null);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide || loading) return;
    setLoading(true);

    try {
      playSound("cancelled");
      vibrate(VibrationPatterns.cancelled);

      // ✅ DB Update FIRST (reliable REST)
      const { error } = await supabase
        .from("rides")
        .update({
          status: "cancelled",
          cancelled_by: "driver",
          cancellation_reason: "ألغى السائق الرحلة",
        })
        .eq("id", activeRide.id);

      if (error) throw error;

      // ⚡ THEN broadcast (best-effort)
      notifyRider("ride_cancelled_by_driver", "ألغى السائق الرحلة").catch(() => {});

      toast({
        title: "تم إلغاء الرحلة",
        variant: "destructive",
      });

      setActiveRide(null);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show cancellation notice if rider cancelled
  if (showCancellationNotice && cancellationInfo) {
    return (
      <Card className="border-2 border-destructive overflow-hidden">
        <CardContent className="p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>

          <h2 className="text-xl font-bold text-destructive mb-2">
            العميل ألغى الرحلة
          </h2>

          {cancellationInfo.reason && (
            <p className="text-muted-foreground mb-4">
              السبب: {cancellationInfo.reason}
            </p>
          )}

          {cancellationInfo.fee > 0 && (
            <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-success mb-2">
                <Wallet className="w-5 h-5" />
                <span className="font-bold">تعويض مالي</span>
              </div>
              <p className="text-2xl font-bold text-success">
                {cancellationInfo.fee.toLocaleString()} د.ع
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                سيتم إضافة هذا المبلغ تلقائياً إلى حسابك
              </p>
            </div>
          )}

          <Button
            onClick={() => {
              setShowCancellationNotice(false);
              setCancellationInfo(null);
            }}
            className="w-full"
          >
            <CheckCircle className="w-4 h-4 ml-2" />
            موافق
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show completed screen if available
  if (showCompletedScreen && completedRideData) {
    return (
      <DriverRideCompleted
        ride={completedRideData}
        riderName={riderInfo?.full_name || "الراكب"}
        onClose={() => {
          setShowCompletedScreen(false);
          setCompletedRideData(null);
        }}
      />
    );
  }

  if (!activeRide) return null;

  const config = statusConfig[activeRide.status] || statusConfig.accepted;

  return (
    <Card className="border-2 border-primary overflow-hidden">
      <CardContent className="p-0">
        {/* Status Header */}
        <div
          className={`${config.color} text-white px-4 py-3 flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            {config.icon}
            <span className="font-bold">{config.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {activeRide.status === "in_progress" && (
              <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(elapsedTime)}</span>
              </div>
            )}
            {activeRide.status === "arrived" && (
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full ${getWaitingTimeColor()}`}
              >
                {waitingTime >= WAITING_WARNING_THRESHOLD ? (
                  <AlertTriangle className="w-4 h-4 animate-pulse" />
                ) : (
                  <Timer className="w-4 h-4" />
                )}
                <span className="font-mono font-bold">
                  {formatWaitingTime(waitingTime)}
                </span>
                <span className="text-xs opacity-75">/ 5:00</span>
              </div>
            )}
            {onMinimize && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMinimize}
                className="h-8 w-8 p-0 hover:bg-white/20 text-white"
                title="تصغير البطاقة"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 12H4"
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>

        <div className="p-3">
          {/* Customer Info - Compact Row */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {riderInfo?.full_name || "العميل"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {activeRide.payment_method === "cash"
                      ? "الدفع نقداً"
                      : activeRide.payment_method === "wallet"
                        ? "المحفظة"
                        : "الدفع نقداً"}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3 h-3" />
                    {typeof riderInfo?.rating === "number"
                      ? riderInfo.rating.toFixed(1)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <DriverEmergencyButton
                rideId={activeRide.id}
                currentLocation={driverLocation}
              />
              <ChatButton rideId={activeRide.id} userType="driver" />
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={() => {
                  if (riderInfo?.phone) {
                    window.location.href = `tel:${riderInfo.phone}`;
                  } else {
                    toast({
                      title: "رقم الهاتف غير متوفر",
                      variant: "destructive",
                    });
                  }
                }}
                title="اتصال هاتفي"
              >
                <Phone className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-9 w-9 bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                onClick={() => {
                  if (riderInfo?.phone) {
                    const cleanPhone = riderInfo.phone.replace(/[^0-9]/g, "");
                    const whatsappNumber = cleanPhone.startsWith("0")
                      ? "964" + cleanPhone.slice(1)
                      : cleanPhone.startsWith("964")
                        ? cleanPhone
                        : "964" + cleanPhone;
                    window.open(`https://wa.me/${whatsappNumber}`, "_blank");
                  } else {
                    toast({
                      title: "رقم الهاتف غير متوفر",
                      variant: "destructive",
                    });
                  }
                }}
                title="واتساب"
              >
                <svg
                  className="w-4 h-4 text-green-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-2 mb-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-3 h-3 mt-1.5 rounded-full shrink-0 ${
                  activeRide.status === "accepted"
                    ? "bg-primary animate-pulse"
                    : "bg-primary"
                }`}
              />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">نقطة الانطلاق</p>
                <p className="text-sm text-foreground">
                  {activeRide.pickup_address ||
                    getLocationString(activeRide.pickup_location)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div
                className={`w-3 h-3 mt-1.5 rounded-full shrink-0 ${
                  activeRide.status === "in_progress"
                    ? "bg-destructive animate-pulse"
                    : "bg-muted"
                }`}
              />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">الوجهة</p>
                <p className="text-sm text-foreground">
                  {activeRide.dropoff_address ||
                    getLocationString(activeRide.dropoff_location)}
                </p>
              </div>
            </div>
          </div>

          {/* Stats - Compact */}
          <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-lg mb-3">
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">المسافة</p>
              <p className="text-sm font-bold text-foreground">
                {activeRide.distance_km || "?"} كم
              </p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">المدة</p>
              <p className="text-sm font-bold text-foreground">
                {activeRide.duration_minutes || "?"} د
              </p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <Wallet className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
              <p className="text-sm font-bold text-primary">
                {roundFare(activeRide.estimated_fare || 0).toLocaleString()} د.ع
              </p>
            </div>
          </div>

          {fareBreakdown && (
            <div className="mb-3">
              <FareBreakdownCard
                baseFare={fareBreakdown.base_fare || 0}
                distanceKm={activeRide.distance_km || 0}
                perKmRate={fareBreakdown.per_km_rate || 0}
                waitingMinutes={0}
                waitingRatePerMin={fareBreakdown.waiting_rate_per_min || 0}
                vehicleType={activeRide.vehicle_type || "economy"}
                vehicleMultiplier={fareBreakdown.vehicle_multiplier || 1}
                finalFare={
                  fareBreakdown.total_fare || activeRide.estimated_fare || 0
                }
              />
            </div>
          )}

          {/* Navigation Button with Waze/Google/Apple support */}
          <NavigationButton
            lat={
              activeRide.status === "in_progress"
                ? activeRide.dropoff_location.lat
                : activeRide.pickup_location.lat
            }
            lng={
              activeRide.status === "in_progress"
                ? activeRide.dropoff_location.lng
                : activeRide.pickup_location.lng
            }
            label={
              activeRide.status === "in_progress"
                ? "ملاحة للوجهة"
                : "ملاحة للعميل"
            }
            size="compact"
            className="mb-3"
            onOpenModal={
              onNavigationClick
                ? (lat, lng) => {
                    const label =
                      activeRide.status === "in_progress"
                        ? "الوجهة"
                        : "موقع العميل";
                    onNavigationClick(lat, lng, label);
                  }
                : undefined
            }
          />

          {/* Quick Messages to Rider */}
          {activeRide.status === "accepted" && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2 text-center">
                رسائل سريعة للراكب:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 whitespace-nowrap bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                  onClick={() =>
                    sendQuickMessageToRider(
                      "driver_approaching_soon",
                      "السائق قريب وفي الطريق إليك",
                      "✅ تم إبلاغ الراكب",
                    )
                  }
                >
                  🚗 قريب منك
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 whitespace-nowrap bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                  onClick={() =>
                    sendQuickMessageToRider(
                      "driver_car_info",
                      `السيارة ${
                        activeRide.vehicle_type === "economy"
                          ? "اقتصادية"
                          : activeRide.vehicle_type === "comfort"
                            ? "مريحة"
                            : "فاخرة"
                      }`,
                      "✅ تم إرسال معلومات السيارة",
                    )
                  }
                >
                  🚙 معلومات السيارة
                </Button>
              </div>
            </div>
          )}

          {activeRide.status === "arrived" && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2 text-center">
                أبلغ الراكب:
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 whitespace-nowrap bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
                  onClick={() =>
                    sendQuickMessageToRider(
                      "driver_at_location",
                      "وصلت للموقع - أنا بانتظارك",
                      "✅ تم إبلاغ الراكب",
                    )
                  }
                >
                  📍 وصلت للموقع
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 whitespace-nowrap bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                  onClick={() =>
                    sendQuickMessageToRider(
                      "driver_waiting_outside",
                      "أنتظرك أمام البناية",
                      "✅ تم إبلاغ الراكب",
                    )
                  }
                >
                  🏢 أمام البناية
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 whitespace-nowrap bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                  onClick={() =>
                    sendQuickMessageToRider(
                      "driver_car_color",
                      "السيارة بالقرب منك - ابحث عني!",
                      "✅ تم إبلاغ الراكب",
                    )
                  }
                >
                  🎨 لون السيارة
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {activeRide.status === "accepted" && (
              <Button
                className="w-full h-12 text-base shadow-glow"
                onClick={handleArrived}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <MapPin className="w-4 h-4 ml-2" />
                    وصلت لموقع العميل
                  </>
                )}
              </Button>
            )}

            {activeRide.status === "arrived" && (
              <Button
                className="w-full h-12 text-base shadow-glow bg-blue-600 hover:bg-blue-700"
                onClick={handleStartRide}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 ml-2" />✓ العميل ركب في
                    السيارة
                  </>
                )}
              </Button>
            )}

            {activeRide.status === "in_progress" && (
              <Button
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700 shadow-glow"
                onClick={handleCompleteRide}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Flag className="w-4 h-4 ml-2" />
                    🏁 تم الوصول
                  </>
                )}
              </Button>
            )}

            {activeRide.status !== "in_progress" && (
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleCancelRide}
                disabled={loading}
              >
                إلغاء الرحلة
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActiveRideCard;
