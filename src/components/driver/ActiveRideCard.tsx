import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
// NavigationButton moved inline to status headers
import { DriverRideCompleted } from "./DriverRideCompleted";
import { ChatButton } from "@/components/ride/RideChat";
import { DriverEmergencyButton } from "./DriverEmergencyButton";
import { logger } from "@/lib/logger";
import { useDriverLocationSync } from "@/hooks/useDriverLocationSync";
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
  X,
  Zap,
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
  driver_arrival_time: string | null;
  scheduled_at?: string | null;
  rider_id: string;
  payment_method: string | null;
  surge_multiplier?: number;
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
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  // ═══ Helper functions for new render ═══
  const roundFare = (fare: number) => Math.round(fare / 250) * 250;

  // Calculate distance to pickup in meters (Haversine)
  const distanceToPickupM = (() => {
    if (!driverLocation || !activeRide) return null;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(activeRide.pickup_location.lat - driverLocation.lat);
    const dLng = toRad(activeRide.pickup_location.lng - driverLocation.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(driverLocation.lat)) * Math.cos(toRad(activeRide.pickup_location.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  })();

  const isNearPickup = distanceToPickupM !== null && distanceToPickupM < 200;

  // Broadcast channel for driver-rider communication
  const broadcastChannel = useRef<any>(null);

  // ═══ رسائل الراكب الواردة — بانر بارز داخل الكارد ═══
  const [riderIncomingMsg, setRiderIncomingMsg] = useState<{
    text: string;
    senderName: string;
    id: string;
  } | null>(null);
  const riderMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissRiderMsg = () => {
    setRiderIncomingMsg(null);
    if (riderMsgTimerRef.current) clearTimeout(riderMsgTimerRef.current);
  };

  // ═══ مزامنة الموقع المباشر لصفحة التتبع العامة ═══
  useDriverLocationSync({
    rideId: activeRide?.id ?? null,
    driverId,
    driverLocation: driverLocation ?? null,
    isActive: !!activeRide && ['accepted', 'arrived', 'in_progress'].includes(activeRide.status),
  });

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
        driver_arrival_time: (ride as any).driver_arrival_time || null,
        rider_id: ride.rider_id || "",
        payment_method: ride.payment_method,
        surge_multiplier: (ride as any).surge_multiplier ?? undefined,
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
              distance_km: activeRide.distance_km && activeRide.distance_km > 0 ? activeRide.distance_km : 1,
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

  // Send quick message to rider (via broadcast + DB fallback)
  const sendQuickMessageToRider = async (
    event: string,
    message: string,
    confirmTitle: string,
  ) => {
    // 1. Broadcast (instant — best-effort)
    notifyRider(event, message).catch(() => { });

    // 2. DB fallback: حفظ الرسالة في ride_messages لضمان الوصول
    if (activeRide) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('ride_messages').insert({
          ride_id: activeRide.id,
          sender_type: 'driver',
          sender_id: user?.id || driverId,
          message: message,
        });
      } catch (dbErr) {
        logger.warn("ActiveRideCard", "Quick message DB save failed", dbErr);
      }
    }

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

  // ═══ استقبال رسائل الراكب من قاعدة البيانات — بانر بارز ═══
  useEffect(() => {
    if (!activeRide) return;

    const channel = supabase
      .channel(`rider-chat-notify-${activeRide.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
          filter: `ride_id=eq.${activeRide.id}`,
        },
        (payload) => {
          const msg = payload.new as {
            id: string;
            message: string;
            sender_type: string;
          };
          // فقط رسائل الراكب
          if (msg.sender_type !== 'rider') return;

          setRiderIncomingMsg({
            text: msg.message,
            senderName: riderInfo?.full_name || 'الراكب',
            id: msg.id,
          });

          playSound('messageSent');
          vibrate([150, 80, 150, 80, 200]);

          // إخفاء تلقائي بعد 8 ثوانٍ
          if (riderMsgTimerRef.current) clearTimeout(riderMsgTimerRef.current);
          riderMsgTimerRef.current = setTimeout(() => {
            setRiderIncomingMsg(null);
          }, 8000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (riderMsgTimerRef.current) clearTimeout(riderMsgTimerRef.current);
    };
  }, [activeRide?.id, riderInfo?.full_name]);

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
      // التحقق من الموقع الحالي (اختياري — لا يمنع الاستمرار)
      let distanceMeters = 0;
      try {
        let currentLocation: { lat: number; lng: number };

        if (driverLocation) {
          currentLocation = driverLocation;
        } else {
          const position = await getCurrentLocationHighAccuracy();
          currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        }

        // التحقق من المسافة (500م تسامح)
        const validation = validateDriverAtPickup(
          currentLocation,
          activeRide.pickup_location,
          500,
        );
        distanceMeters = validation.distance;

        if (!validation.isValid) {
          toast({
            title: "⚠️ تنبيه: أنت بعيد عن العميل",
            description: `المسافة: ${Math.round(validation.distance)}م — تم التأكيد رغم ذلك`,
          });
        }
      } catch (gpsErr) {
        logger.warn("ActiveRideCard", "GPS check failed, proceeding anyway", gpsErr);
      }

      // Play confirmation sound immediately
      playSound("confirm");
      vibrate([200, 100, 200]);

      // ✅ DB Update FIRST (reliable REST) — الأولوية لتحديث قاعدة البيانات
      const { data: updatedRows, error } = await supabase
        .from("rides")
        .update({
          status: "arrived",
          driver_arrival_time: new Date().toISOString(),
        })
        .eq("id", activeRide.id)
        .select("id, status");

      if (error) throw error;

      // تحقق من أن التحديث طُبّق فعلاً (RLS أو الجلسة قد تمنع بصمت)
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("فشل تحديث الحالة — تحقق من الاتصال وأعد المحاولة");
      }

      // ✅ تحديث الحالة المحلية فوراً (بدون انتظار realtime)
      setActiveRide(prev => prev ? { ...prev, status: "arrived", driver_arrival_time: new Date().toISOString() } : null);

      // ⚡ THEN broadcast (best-effort — لا يمنع الاستمرار)
      notifyRider("driver_arrived", "السائق وصل لموقعك!", {
        riderName: riderInfo?.full_name,
      }).catch(() => { });

      toast({
        title: "تم تأكيد الوصول ✅",
        description: distanceMeters > 0 ? `المسافة: ${Math.round(distanceMeters)}م` : "تم إبلاغ العميل",
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

      // ✅ تحديث الحالة المحلية فوراً (بدون انتظار realtime)
      setActiveRide(prev => prev ? { ...prev, status: "in_progress", started_at: new Date().toISOString() } : null);

      // ⚡ THEN broadcast (best-effort)
      notifyRider("ride_started", "الرحلة بدأت!", {
        riderName: riderInfo?.full_name,
        dropoffAddress: activeRide.dropoff_address,
      }).catch(() => { });

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
      // التحقق من الموقع (اختياري — لا يمنع إكمال الرحلة)
      let currentLocation: { lat: number; lng: number } | null = null;

      try {
        if (driverLocation) {
          currentLocation = driverLocation;
        } else {
          const position = await getCurrentLocationHighAccuracy();
          currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        }

        // التحقق من المسافة (1000م تسامح)
        const validation = validateDriverAtDropoff(
          currentLocation,
          activeRide.dropoff_location,
          1000,
        );

        if (!validation.isValid) {
          toast({
            title: "⚠️ تنبيه: بعيد عن الوجهة",
            description: `المسافة: ${Math.round(validation.distance)}م — تم التأكيد رغم ذلك`,
          });
        }
      } catch (gpsErr) {
        logger.warn("ActiveRideCard", "GPS check failed on complete, proceeding", gpsErr);
      }

      // إضافة النقطة الأخيرة (موقع الوصول)
      if (currentLocation) {
        trackingPointsRef.current.push({
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          recorded_at: new Date().toISOString(),
        });
      }

      // حساب المسافة الفعلية من نقاط GPS المتراكمة
      const gpsDistance = calculateGpsDistance(trackingPointsRef.current);
      console.log(`[Driver] GPS distance: ${gpsDistance} km from ${trackingPointsRef.current.length} points`);

      // حساب وقت الانتظار من وصول السائق (driver_arrival_time) وليس من إنشاء الرحلة
      const arrivalRef = activeRide.driver_arrival_time || activeRide.started_at || activeRide.created_at;
      const waitingMinutes =
        (activeRide.status === "arrived" || activeRide.driver_arrival_time)
          ? Math.max(0, Math.floor(
            (Date.now() - new Date(arrivalRef).getTime()) / 60000,
          ))
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
        // Fallback: تحديث مباشر مع حساب أجرة الانتظار يدوياً
        let fallbackFare = estimatedFare;
        // إضافة أجرة الانتظار يدوياً (3 دقائق مجانية، 250 د.ع/دقيقة)
        const freeMinutes = 3;
        const chargeableWaiting = Math.max(0, waitingMinutes - freeMinutes);
        const waitingFare = chargeableWaiting * 250;
        fallbackFare += waitingFare;

        const { error } = await supabase
          .from("rides")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            final_fare: fallbackFare,
            waiting_minutes: waitingMinutes,
            waiting_fare: waitingFare,
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
        }).catch(() => { });
      }

      // تنظيف نقاط التتبع
      trackingPointsRef.current = [];
      lastTrackingTimeRef.current = 0;

      // ⚡ Broadcast to rider (best-effort — بعد نجاح التحديث)
      notifyRider("ride_completed", "الحمد لله على السلامة!", {
        finalFare,
        riderName: riderInfo?.full_name,
      }).catch(() => { });

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

      // محاولة التحديث مع كل الحقول (as any لتجاوز TypeScript strict)
      const { error } = await supabase
        .from("rides" as any)
        .update({
          status: "cancelled",
          cancelled_by: "driver",
          cancellation_reason: "ألغى السائق الرحلة",
        } as any)
        .eq("id", activeRide.id);

      if (error) {
        console.warn("[CancelRide] Full update failed:", error.message, error.code);

        // محاولة بديلة: تحديث الحالة فقط
        const { error: minError } = await supabase
          .from("rides" as any)
          .update({ status: "cancelled" } as any)
          .eq("id", activeRide.id);

        if (minError) {
          console.warn("[CancelRide] Minimal update failed:", minError.message);

          // محاولة أخيرة عبر RPC
          const { error: rpcError } = await supabase.rpc("update_driver_response" as any, {
            p_ride_id: activeRide.id,
            p_driver_id: driverId,
            p_response: "cancelled",
          });

          if (rpcError) throw rpcError;
        }
      }

      // ⚡ THEN broadcast (best-effort)
      notifyRider("ride_cancelled_by_driver", "ألغى السائق الرحلة").catch(() => { });

      toast({
        title: "تم إلغاء الرحلة",
        variant: "destructive",
      });

      setActiveRide(null);
    } catch (error: any) {
      console.error("[CancelRide] All attempts failed:", error);
      toast({
        title: "خطأ في إلغاء الرحلة",
        description: error.message || "حدث خطأ، حاول مرة أخرى",
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


  return (
    <>
      {/* ═══ بانر رسالة الراكب الواردة — Floating Luxury Notification ═══ */}
      {riderIncomingMsg && (
        <div className="fixed top-2 left-2 right-2 z-[70] pointer-events-auto bg-[#1a243b]/95 backdrop-blur-2xl border border-blue-500/30 rounded-3xl animate-in slide-in-from-top-4 duration-500 shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden" dir="rtl" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          {/* Animated Gradient Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 animate-[gradient_3s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />

          <div className="px-4 pt-4 pb-3 max-w-lg mx-auto">
            <div className="flex items-start justify-between gap-3">
              {/* Message Content & Icon */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-blue-500/40 rounded-full animate-ping" />
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-2 relative z-10 shadow-lg shadow-blue-500/40 text-white">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-semibold text-blue-300 mb-1 flex items-center gap-1.5">
                    <span>رسالة جديدة من {riderIncomingMsg.senderName}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  </p>
                  <p className="font-bold text-[15px] leading-snug break-words text-white">{riderIncomingMsg.text}</p>
                </div>
              </div>
              
              {/* Close Button */}
              <button onClick={dismissRiderMsg} className="shrink-0 rounded-full p-2 bg-slate-800/40 hover:bg-slate-700/80 active:scale-90 text-slate-400 hover:text-white transition-all touch-manipulation" aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Quick Replies */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide snap-x">
              {[
                { label: '🚗 في الطريق', msg: 'أنا في الطريق إليك' },
                { label: '📍 وصلت', msg: 'وصلت، أين أنت؟' },
                { label: '⏱️ انتظر', msg: 'انتظرني دقيقة واحدة' },
                { label: '👍 حسناً', msg: 'حسناً، فهمت' },
              ].map((r) => (
                <button key={r.label} onClick={() => { sendQuickMessageToRider('driver_reply', r.msg, '✅ تم الرد'); dismissRiderMsg(); }}
                  className="bg-[#0b1326] border border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-600/20 active:bg-blue-600/40 text-blue-100 text-[11px] font-bold px-3 py-2.5 rounded-xl whitespace-nowrap transition-all shadow-sm touch-manipulation active:scale-[0.98] snap-start">
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bottom Sheet — Dark Luxury Active Ride ═══ */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        animate={{ height: isSheetExpanded ? '90dvh' : 'auto' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 50 && isSheetExpanded) {
            // سحب للأسفل: تصغير
            setIsSheetExpanded(false);
          } else if (info.offset.y < -50 && !isSheetExpanded) {
            // سحب للأعلى: توسيع
            setIsSheetExpanded(true);
          }
        }}
        className={`absolute bottom-0 left-0 right-0 z-50 pointer-events-auto bg-[#0b1326] rounded-t-[2rem] shadow-[0_-20px_50px_rgba(0,0,0,0.4)] border-t border-slate-700/30 ${isSheetExpanded ? 'overflow-y-auto' : 'overflow-hidden'} flex flex-col`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        dir="rtl"
      >

        {/* Subtle Glow at top */}
        {activeRide.status === "in_progress" && <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#5bdda6]/40 to-transparent blur-sm animate-pulse" />}
        {activeRide.status === "accepted" && <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent blur-sm animate-pulse" />}
        {activeRide.status === "arrived" && <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent blur-sm animate-pulse" />}

        {/* Drag Handle — قابل للسحب */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
          onClick={() => setIsSheetExpanded(prev => !prev)}
        >
          <motion.div
            className="rounded-full bg-slate-600"
            animate={{
              width: isSheetExpanded ? 48 : 48,
              height: 4,
              backgroundColor: isSheetExpanded ? '#5bdda6' : '#475569',
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* ═══ Status Header Bar (Dark Luxury Variants) ═══ */}
        {activeRide.status === "accepted" && (
          <div className="mx-5 rounded-2xl px-4 py-3 flex items-center justify-between mb-4 bg-blue-900/20 border border-blue-500/30">
            <div className="flex items-center gap-2">
              <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                <Navigation className="w-4 h-4 text-blue-400" />
              </motion.div>
              {distanceToPickupM !== null && (
                <span className="bg-[#0b1326]/50 border border-blue-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-blue-300" style={{ fontFamily: "Inter, sans-serif" }}>
                  {distanceToPickupM >= 1000 ? `${(distanceToPickupM / 1000).toFixed(1)} كم` : `${distanceToPickupM} م`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onNavigationClick && (
                <button
                  onClick={() => onNavigationClick(activeRide.pickup_location.lat, activeRide.pickup_location.lng, "موقع العميل")}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 active:scale-95 transition-all touch-manipulation"
                  title="ملاحة إلى العميل"
                >
                  <span className="text-xs font-bold text-blue-400" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>الطريق إلى العميل</span>
                  <Navigation className="w-4 h-4 text-blue-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {activeRide.status === "arrived" && (
          <div className="mx-5 rounded-2xl px-4 py-3 flex items-center justify-between mb-4 bg-amber-900/20 border border-amber-500/30">
            <div className="flex items-center gap-2">
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                <Clock className="w-4 h-4 text-amber-400" />
              </motion.div>
              <span className="font-bold text-amber-400 text-sm" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>في انتظار العميل</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${waitingTime >= WAITING_CRITICAL_THRESHOLD ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-[#0b1326]/50 text-amber-300 border-amber-500/20"}`}>
              {waitingTime >= WAITING_WARNING_THRESHOLD ? <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> : <Timer className="w-3.5 h-3.5" />}
              <span className="tabular-nums" style={{ fontFamily: "Inter, sans-serif" }}>{formatWaitingTime(waitingTime)}</span>
            </div>
          </div>
        )}

        {activeRide.status === "in_progress" && (
          <div className="mx-5 rounded-2xl px-4 py-3 flex items-center justify-between mb-4 bg-[#5bdda6]/10 border border-[#5bdda6]/30">
            <div className="flex items-center gap-2">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <Car className="w-4 h-4 text-[#5bdda6]" />
              </motion.div>
              <span className="font-bold text-[#5bdda6] text-sm" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>الرحلة جارية</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-[#0b1326]/50 border border-[#5bdda6]/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#5bdda6]" />
                <span className="font-bold text-[#5bdda6] text-sm tabular-nums" style={{ fontFamily: "Inter, sans-serif" }}>{formatTime(elapsedTime)}</span>
              </div>
              {onNavigationClick && (
                <button
                  onClick={() => onNavigationClick(activeRide.dropoff_location.lat, activeRide.dropoff_location.lng, "الوجهة")}
                  className="w-9 h-9 rounded-full bg-[#5bdda6]/20 border border-[#5bdda6]/40 flex items-center justify-center hover:bg-[#5bdda6]/30 active:scale-90 transition-all touch-manipulation"
                  title="ملاحة"
                >
                  <Navigation className="w-4 h-4 text-[#5bdda6]" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ Info Area (Bento Layout) ═══ */}
        <div className="px-5 space-y-3 pb-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* بطاقة العميل والأجرة */}
            <div className="bg-[#171f33] rounded-2xl p-4 border border-slate-700/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center border shadow-inner ${activeRide.status === "accepted" ? "bg-blue-500/10 border-blue-500/30" : activeRide.status === "arrived" ? "bg-amber-500/10 border-amber-500/30" : "bg-[#5bdda6]/10 border-[#5bdda6]/30"}`}>
                  <User className={`w-5 h-5 ${activeRide.status === "accepted" ? "text-blue-400" : activeRide.status === "arrived" ? "text-amber-400" : "text-[#5bdda6]"}`} />
                </div>
                <div>
                  <p className="font-bold text-sm text-white truncate max-w-[130px]" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>{riderInfo?.full_name || "العميل"}</p>
                  {(activeRide.status === "accepted" || activeRide.status === "arrived") && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-semibold">
                      <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-3 h-3 fill-amber-400" />{typeof riderInfo?.rating === "number" ? riderInfo.rating.toFixed(1) : "—"}</span>
                      <span>|</span>
                      <span>{activeRide.payment_method === "cash" ? "نقداً" : activeRide.payment_method === "wallet" ? "المحفظة" : "نقداً"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* الأجرة */}
              <div className="flex flex-col items-end">
                <p className="text-[10px] text-slate-400 mb-0.5 font-semibold">الأجرة المقدرة</p>
                <div className="flex items-baseline gap-1" style={{ fontFamily: "Inter, sans-serif" }}>
                  <span className={`text-xl font-black tabular-nums tracking-tight ${activeRide.status === "in_progress" ? "text-[#5bdda6]" : activeRide.status === "arrived" ? "text-amber-400" : "text-blue-400"}`}>{roundFare(activeRide.estimated_fare || 0).toLocaleString()}</span>
                  <span className={`text-[10px] font-bold ${activeRide.status === "in_progress" ? "text-[#5bdda6]/70" : activeRide.status === "arrived" ? "text-amber-400/70" : "text-blue-400/70"}`}>د.ع</span>
                </div>
              </div>
            </div>

            {/* إحصائيات الرحلة أثناء الحركة */}
            {activeRide.status === "in_progress" && (
              <div className="flex gap-2">
                <div className="flex-1 bg-[#171f33] rounded-2xl border border-slate-700/30 p-3 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1">المسافة</span>
                  <span className="text-sm font-bold text-white tabular-nums" style={{ fontFamily: "Inter, sans-serif" }}>{activeRide.distance_km || "?"} كم</span>
                </div>
                <div className="flex-1 bg-[#171f33] rounded-2xl border border-slate-700/30 p-3 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1">المدة المقدرة</span>
                  <span className="text-sm font-bold text-white tabular-nums" style={{ fontFamily: "Inter, sans-serif" }}>{activeRide.duration_minutes || "?"} د</span>
                </div>
              </div>
            )}
          </div>

          {/* ═══ العناوين والمسار (Timeline) ═══ */}
          <div className="bg-[#171f33] rounded-2xl p-4 border border-slate-700/30 relative overflow-hidden">
            <div className="flex gap-4 relative z-10">
              {/* Timeline Indicator */}
              <div className="flex flex-col items-center pt-1.5 pb-1">
                {(activeRide.status === "accepted" || activeRide.status === "arrived") ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse" />
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-blue-500/50 to-red-500/30 my-1 min-h-[20px]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-600 to-[#5bdda6]/50 my-1 min-h-[20px]" />
                    <div className="w-3.5 h-3.5 rounded-full bg-[#5bdda6] shadow-[0_0_10px_rgba(91,221,166,0.6)] animate-pulse" />
                  </>
                )}
              </div>
              
              <div className="flex-1 flex flex-col justify-between gap-3 min-w-0">
                {(activeRide.status === "accepted" || activeRide.status === "arrived") ? (
                  <>
                    <div>
                      <p className="text-[10px] text-blue-400 font-bold tracking-wider mb-0.5" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>الوجهة الحالية (نقطة الاستلام)</p>
                      <p className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">{activeRide.pickup_address || getLocationString(activeRide.pickup_location)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-[10px] text-[#5bdda6] font-bold tracking-wider mb-0.5" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>الوجهة الحالية (نقطة الوصول)</p>
                      <p className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug">{activeRide.dropoff_address || getLocationString(activeRide.dropoff_location)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Utility & Quick Messages (Single Scrollable Row) ═══ */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide snap-x" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* 1. Chat (Priority First) */}
            <div className="flex-none snap-start">
              <div className="relative [&>button]:!bg-[#171f33] [&>button]:!border [&>button]:!border-blue-500/30 [&>button]:!shadow-[0_0_12px_rgba(59,130,246,0.15)] [&>button]:!w-auto [&>button]:!min-w-[100px] [&>button]:!h-[42px] [&>button]:!rounded-xl [&_span]:!text-blue-300 [&_svg]:!text-blue-400 [&>button]:!text-[11px] [&>button]:!font-bold [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:hover:!bg-blue-500/15 active:scale-95 transition-transform">
                <ChatButton rideId={activeRide.id} userType="driver" />
              </div>
            </div>

            {/* 2. Call */}
            <button className="flex-none snap-start h-[42px] px-4 rounded-xl bg-[#171f33] border border-emerald-500/30 hover:bg-emerald-500/15 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(91,221,166,0.1)]"
              onClick={() => { if (riderInfo?.phone) window.location.href = `tel:${riderInfo.phone}`; else toast({ title: "رقم الهاتف غير متوفر", variant: "destructive" }); }}>
              <Phone className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-300">اتصال</span>
            </button>

            {/* 3. WhatsApp */}
            {(activeRide.status === "accepted" || activeRide.status === "arrived") && (
              <button className="flex-none snap-start h-[42px] px-4 rounded-xl bg-[#171f33] border border-[#25D366]/30 hover:bg-[#25D366]/15 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(37,211,102,0.1)]"
                onClick={() => { if (riderInfo?.phone) { const c = riderInfo.phone.replace(/[^0-9]/g, ""); const w = c.startsWith("0") ? "964" + c.slice(1) : c.startsWith("964") ? c : "964" + c; window.open(`https://wa.me/${w}`, "_blank"); } else { toast({ title: "رقم الهاتف غير متوفر", variant: "destructive" }); } }}>
                <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                <span className="text-[11px] font-bold text-[#25D366]">واتساب</span>
              </button>
            )}

            {/* 4. Quick Messages (dynamic) */}
            {activeRide.status === "accepted" && (
              <>
                <button className="flex-none snap-start h-[42px] px-3 rounded-xl bg-[#171f33] border border-blue-500/20 text-blue-300 text-[11px] font-bold hover:bg-blue-500/15 active:scale-95 transition-all touch-manipulation whitespace-nowrap"
                  onClick={() => sendQuickMessageToRider("driver_approaching_soon", "السائق قريب وفي الطريق إليك", "✅ تم إبلاغ الراكب")}>🚗 قريب منك</button>
                <button className="flex-none snap-start h-[42px] px-3 rounded-xl bg-[#171f33] border border-indigo-500/20 text-indigo-300 text-[11px] font-bold hover:bg-indigo-500/15 active:scale-95 transition-all touch-manipulation whitespace-nowrap"
                  onClick={() => sendQuickMessageToRider("driver_car_info", `السيارة ${activeRide.vehicle_type === "economy" ? "اقتصادية" : activeRide.vehicle_type === "comfort" ? "مريحة" : "فاخرة"}`, "✅ تم إرسال معلومات السيارة")}>🚙 معلومات السيارة</button>
              </>
            )}
            {activeRide.status === "arrived" && (
              <>
                <button className="flex-none snap-start h-[42px] px-3 rounded-xl bg-[#171f33] border border-amber-500/20 text-amber-300 text-[11px] font-bold hover:bg-amber-500/15 active:scale-95 transition-all touch-manipulation whitespace-nowrap" onClick={() => sendQuickMessageToRider("driver_at_location", "وصلت للموقع - أنا بانتظارك", "✅ تم إبلاغ الراكب")}>📍 وصلت للموقع</button>
                <button className="flex-none snap-start h-[42px] px-3 rounded-xl bg-[#171f33] border border-blue-500/20 text-blue-300 text-[11px] font-bold hover:bg-blue-500/15 active:scale-95 transition-all touch-manipulation whitespace-nowrap" onClick={() => sendQuickMessageToRider("driver_waiting_outside", "أنتظرك أمام البناية", "✅ تم إبلاغ الراكب")}>🏢 أمام البناية</button>
                <button className="flex-none snap-start h-[42px] px-3 rounded-xl bg-[#171f33] border border-fuchsia-500/20 text-fuchsia-300 text-[11px] font-bold hover:bg-fuchsia-500/15 active:scale-95 transition-all touch-manipulation whitespace-nowrap" onClick={() => { const colorMsg = activeRide.vehicle_type ? `ابحث عن سيارة ${activeRide.vehicle_type === "economy" ? "اقتصادية" : activeRide.vehicle_type === "comfort" ? "مريحة" : "فاخرة"} بالقرب منك` : "السيارة بالقرب منك - ابحث عني!"; sendQuickMessageToRider("driver_car_color", colorMsg, "✅ تم إبلاغ الراكب"); }}>🎨 لون السيارة</button>
              </>
            )}

            {/* 5. Emergency */}
            <div className="flex-none snap-start">
              <DriverEmergencyButton rideId={activeRide.id} currentLocation={driverLocation} />
            </div>
          </div>
        </div>

        {/* ═══ Action Buttons ═══ */}
        <div className="w-full">
          {activeRide.status === "accepted" && (
            <motion.button
              animate={isNearPickup ? { boxShadow: ["0 0 0px 0px rgba(59,130,246,0)", "0 0 20px 2px rgba(59,130,246,0.4)", "0 0 0px 0px rgba(59,130,246,0)"] } : {}}
              transition={isNearPickup ? { duration: 1.8, repeat: Infinity } : {}}
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              className="w-full h-[72px] rounded-none flex items-center justify-center gap-2 font-bold text-lg text-[#0b1326] bg-gradient-to-r from-blue-400 to-blue-500 active:bg-blue-600 disabled:opacity-60 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)] touch-manipulation"
              onClick={handleArrived} disabled={loading}>
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (<><MapPin className="w-5 h-5 ml-1" /><span>وصلت للعميل</span></>)}
            </motion.button>
          )}

          {activeRide.status === "arrived" && (
            <motion.button
              animate={{ boxShadow: ["0 0 0px 0px rgba(245,158,11,0)", "0 0 20px 2px rgba(245,158,11,0.4)", "0 0 0px 0px rgba(245,158,11,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              className="w-full h-[72px] rounded-none flex items-center justify-center gap-2 font-bold text-lg text-[#0b1326] bg-gradient-to-r from-amber-400 to-amber-500 active:bg-amber-600 disabled:opacity-60 transition-all shadow-[0_4px_20px_rgba(245,158,11,0.3)] touch-manipulation"
              onClick={handleStartRide} disabled={loading}>
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (<><CheckCircle className="w-6 h-6 ml-1" /><span>ركب العميل — بدء الرحلة</span></>)}
            </motion.button>
          )}

          {activeRide.status === "in_progress" && (
            <motion.button
              animate={{ boxShadow: ["0 0 0px 0px rgba(91,221,166,0)", "0 0 20px 2px rgba(91,221,166,0.4)", "0 0 0px 0px rgba(91,221,166,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              className="w-full h-[72px] rounded-none flex items-center justify-center gap-2 font-bold text-lg text-[#0b1326] bg-[#5bdda6] active:bg-[#3eba89] disabled:opacity-60 transition-all shadow-[0_4px_20px_rgba(91,221,166,0.3)] touch-manipulation"
              onClick={handleCompleteRide} disabled={loading}>
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (<><Flag className="w-5 h-5 ml-1" /><span>إنهاء الرحلة</span></>)}
            </motion.button>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default ActiveRideCard;
