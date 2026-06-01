import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  playSound,
  vibrate,
  VibrationPatterns,
  showNotification,
} from "@/utils/rideNotificationSounds";

interface Ride {
  id: string;
  pickup_location: { lat: number; lng: number };
  dropoff_location: { lat: number; lng: number };
  status: string;
  driver_id: string | null;
}

interface Driver {
  full_name: string;
  current_location: { lat: number; lng: number } | null;
}

interface UseBroadcastChannelProps {
  ride: Ride;
  driver: Driver | null;
  onRideUpdate: (ride: Record<string, unknown>) => void;
  onDriverLocationUpdate: (location: { lat: number; lng: number }) => void;
  onClose: () => void;
  onDriverCancelled?: () => void;
  setShowArrivedAlert: (show: boolean) => void;
  // ✅ تم حذف setShowCompletedScreen — يتولى useActiveRide عرض شاشة التقييم
}

export const useBroadcastChannel = ({
  ride,
  driver,
  onRideUpdate,
  onDriverLocationUpdate,
  onClose,
  onDriverCancelled,
  setShowArrivedAlert,
}: UseBroadcastChannelProps) => {
  const { toast } = useToast();
  const broadcastChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const previousStatusRef = useRef<string>(ride.status);
  // منع تكرار إشعار إكمال الرحلة من الـ broadcast والـ DB fallback معاً
  const completedNotifiedRef = useRef(false);

  // Refs for callbacks to prevent stale closures without re-subscribing channels
  const onRideUpdateRef = useRef(onRideUpdate);
  const onDriverLocationUpdateRef = useRef(onDriverLocationUpdate);

  useEffect(() => {
    onRideUpdateRef.current = onRideUpdate;
    onDriverLocationUpdateRef.current = onDriverLocationUpdate;
  }, [onRideUpdate, onDriverLocationUpdate]);

  // Setup broadcast channel for instant updates
  useEffect(() => {
    console.log("[useBroadcastChannel] Setting up channel for ride:", ride.id);

    const channel = supabase.channel(`ride-comm-${ride.id}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: `rider-${ride.id}` },
      },
    });

    channel
      .on("broadcast", { event: "ride_accepted" }, (payload: Record<string, unknown>) => {
        console.log("[Broadcast] ⚡ ride_accepted received");
        const eventPayload = payload.payload as Record<string, unknown> | undefined;
        if (onRideUpdateRef.current) onRideUpdateRef.current({ ...ride, status: "accepted" });
        playSound("accepted");
        vibrate(VibrationPatterns.accepted);

        toast({
          title: "🎉 تم قبول طلبك!",
          description: typeof eventPayload?.driverName === "string"
            ? `${eventPayload.driverName} في الطريق إليك`
            : "السائق في الطريق إليك الآن",
          duration: 8000,
        });

        showNotification(
          "🎉 تم قبول طلبك!",
          "السائق في الطريق إليك - انتظره في موقع الانطلاق",
          { tag: "ride-accepted", requireInteraction: true, duration: 10000 }
        );
      })
      .on("broadcast", { event: "driver_arrived" }, (payload: Record<string, unknown>) => {
        console.log("[Broadcast] ⚡ driver_arrived received");
        if (onRideUpdateRef.current) onRideUpdateRef.current({ ...ride, status: "arrived" });
        playSound("arrived");
        vibrate(VibrationPatterns.arrived);
        setShowArrivedAlert(true);

        toast({
          title: "🔔 السائق وصل!",
          description: "اخرج الآن - السائق في انتظارك",
          duration: 15000,
        });

        showNotification(
          "🔔 السائق وصل!",
          `${driver?.full_name || "السائق"} وصل لموقعك - اخرج الآن`,
          { tag: "driver-arrived", requireInteraction: true, duration: 15000 }
        );

        setTimeout(() => setShowArrivedAlert(false), 15000);
      })
      .on("broadcast", { event: "ride_started" }, (payload: Record<string, unknown>) => {
        console.log("[Broadcast] ⚡ ride_started received");
        if (onRideUpdateRef.current) onRideUpdateRef.current({
          ...ride,
          status: "in_progress",
          started_at: new Date().toISOString(),
        });
        playSound("inProgress");
        vibrate(VibrationPatterns.inProgress);

        toast({
          title: "🛣️ انطلقت الرحلة!",
          description: "أنت في الطريق للوجهة - رحلة موفقة",
          duration: 5000,
        });
      })
      .on("broadcast", { event: "ride_completed" }, (payload: Record<string, unknown>) => {
        console.log("[Broadcast] ⚡ ride_completed received");
        if (onRideUpdateRef.current) onRideUpdateRef.current({
          ...ride,
          status: "completed",
          completed_at: new Date().toISOString(),
        });
        if (!completedNotifiedRef.current) {
          completedNotifiedRef.current = true;
          playSound("completed");
          vibrate(VibrationPatterns.completed);
          toast({
            title: "✅ تم إكمال الرحلة!",
            description: "الحمد لله على السلامة 🤲",
            duration: 8000,
          });
        }
        // ✅ useActiveRide يتولى عرض شاشة التقييم عبر الـ Realtime الخاص به
      })
      .on(
        "broadcast",
        { event: "ride_cancelled_by_driver" },
        (payload: Record<string, unknown>) => {
          console.log("[Broadcast] ⚡ ride_cancelled_by_driver received");
          const eventPayload = payload.payload as Record<string, unknown> | undefined;
          playSound("cancelled");
          vibrate(VibrationPatterns.cancelled);

          toast({
            title: "❌ تم إلغاء الرحلة من السائق",
            description:
              (typeof eventPayload?.reason === "string" ? eventPayload.reason : undefined) ||
              "السائق ألغى الرحلة - يمكنك طلب سائق آخر",
            variant: "destructive",
            duration: 10000,
          });

          if (onDriverCancelled) {
            onDriverCancelled();
          } else {
            setTimeout(() => onClose(), 3000);
          }
        }
      )
      .on("broadcast", { event: "driver_location_update" }, (payload: Record<string, unknown>) => {
        const eventPayload = payload.payload as Record<string, unknown> | undefined;
        const newLocation = eventPayload?.location as { lat?: number; lng?: number } | undefined;
        if (newLocation?.lat && newLocation?.lng) {
          console.log("[Broadcast] 📍 Driver location updated (Real-time):", newLocation);
          if (onDriverLocationUpdateRef.current) onDriverLocationUpdateRef.current({ lat: newLocation.lat, lng: newLocation.lng });
        }
      })
      .on("broadcast", { event: "driver_approaching_soon" }, () => {
        playSound("driverApproaching");
        vibrate(VibrationPatterns.driverApproaching);
        toast({
          title: "🚗 السائق قريب!",
          description: "السائق في الطريق إليك وقريب من موقعك",
          duration: 5000,
        });
      })
      .on("broadcast", { event: "driver_at_location" }, () => {
        playSound("driverAtLocation");
        vibrate(VibrationPatterns.driverMessage);
        toast({
          title: "📍 السائق وصل للموقع",
          description: "السائق بانتظارك - اخرج الآن",
          duration: 8000,
        });
      })
      .on("broadcast", { event: "driver_waiting_outside" }, () => {
        playSound("driverWaitingOutside");
        vibrate(VibrationPatterns.driverMessage);
        toast({
          title: "🏢 السائق أمام البناية",
          description: "السائق ينتظرك أمام البناية",
          duration: 6000,
        });
      });

    channel.subscribe((status) => {
      console.log("[useBroadcastChannel] Channel status:", status);
      if (status === "SUBSCRIBED") {
        broadcastChannel.current = channel;
        setIsConnected(true);
      } else if (status === "CHANNEL_ERROR") {
        console.error("[useBroadcastChannel] Channel error - will retry");
        setIsConnected(false);
      }
    });

    return () => {
      console.log("[useBroadcastChannel] Cleaning up channel");
      completedNotifiedRef.current = false;
      supabase.removeChannel(channel);
      broadcastChannel.current = null;
      setIsConnected(false);
    };
  }, [ride.id]);

  // Fallback: Database subscription for ride status changes
  useEffect(() => {
    console.log(
      "[useBroadcastChannel] Setting up DB subscription for ride:",
      ride.id
    );

    const dbChannel = supabase
      .channel(`ride-db-${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${ride.id}`,
        },
        (payload) => {
          console.log("[DB Update] Ride update received:", payload.new);
          const updatedRide = payload.new as Record<string, unknown>;
          const newStatus = typeof updatedRide.status === "string" ? updatedRide.status : "";
          const prevStatus = previousStatusRef.current;

          // Only process if status actually changed
          if (newStatus !== prevStatus) {
            console.log(
              "[DB Update] Status changed:",
              prevStatus,
              "->",
              newStatus
            );
            previousStatusRef.current = newStatus;

            // Handle status-specific notifications if broadcast didn't fire
            if (newStatus === "accepted" && prevStatus === "pending") {
              playSound("accepted");
              vibrate(VibrationPatterns.accepted);
              toast({
                title: "🎉 تم قبول طلبك!",
                description: "السائق في الطريق إليك الآن",
                duration: 8000,
              });
            }

            if (newStatus === "arrived" && prevStatus !== "arrived") {
              playSound("arrived");
              vibrate(VibrationPatterns.arrived);
              setShowArrivedAlert(true);
              toast({
                title: "🔔 السائق وصل!",
                description: "اخرج الآن - السائق في انتظارك",
                duration: 15000,
              });
              setTimeout(() => setShowArrivedAlert(false), 15000);
            }

            if (newStatus === "in_progress" && prevStatus !== "in_progress") {
              playSound("inProgress");
              vibrate(VibrationPatterns.inProgress);
              toast({
                title: "🛣️ انطلقت الرحلة!",
                description: "أنت في الطريق للوجهة - رحلة موفقة",
                duration: 5000,
              });
            }

            if (newStatus === "completed") {
              if (!completedNotifiedRef.current) {
                completedNotifiedRef.current = true;
                playSound("completed");
                vibrate(VibrationPatterns.completed);
                toast({
                  title: "✅ تم إكمال الرحلة!",
                  description: "الحمد لله على السلامة 🤲",
                  duration: 8000,
                });
              }
              // ✅ useActiveRide يتولى عرض شاشة التقييم عبر الـ Realtime الخاص به
            }

            if (newStatus === "cancelled") {
              playSound("cancelled");
              vibrate(VibrationPatterns.cancelled);
              toast({
                title: "❌ تم إلغاء الرحلة",
                description:
                  (typeof updatedRide.cancellation_reason === "string" ? updatedRide.cancellation_reason : undefined) || "تم إلغاء الرحلة",
                variant: "destructive",
              });
              if (onDriverCancelled && updatedRide.cancelled_by !== "rider") {
                onDriverCancelled();
              } else {
                setTimeout(() => onClose(), 2000);
              }
            }

            // Update ride state
            onRideUpdate({ ...ride, ...updatedRide });
          }
        }
      )
      .subscribe((status) => {
        console.log("[useBroadcastChannel] DB subscription status:", status);
      });

    return () => {
      supabase.removeChannel(dbChannel);
    };
  }, [ride.id]);

  // Update previous status ref when ride prop changes
  useEffect(() => {
    previousStatusRef.current = ride.status;
  }, [ride.status]);

  const sendQuickMessage = useCallback(
    async (event: string, title: string, description: string) => {
      console.log(
        "[sendQuickMessage] Sending event:",
        event,
        "to ride:",
        ride.id
      );

      // 1. Broadcast (best-effort)
      if (broadcastChannel.current) {
        broadcastChannel.current
          .send({
            type: "broadcast",
            event: event,
            payload: {
              rideId: ride.id,
              driverId: ride.driver_id,
              message: description,
              timestamp: new Date().toISOString(),
            },
          })
          .then(() => {
            console.log("[sendQuickMessage] Message sent successfully:", event);
          })
          .catch((error: unknown) => {
            console.error("[sendQuickMessage] Error sending message:", error);
          });
      } else {
        console.warn("[sendQuickMessage] Broadcast channel not initialized!");
      }

      // 2. DB fallback: write to ride_messages to ensure delivery and display in chat
      let dbMessage = description;
      if (event === "rider_waiting") dbMessage = "👋 أنا بالانتظار";
      else if (event === "rider_where_are_you") dbMessage = "📍 أين وصلت؟";
      else if (event === "rider_wait_moment") dbMessage = "⏱️ انتظرني لحظة لو سمحت";
      else if (event === "rider_on_my_way") dbMessage = "🚶 أنا في الطريق إليك";

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("ride_messages").insert({
            ride_id: ride.id,
            sender_type: "rider",
            sender_id: user.id,
            message: dbMessage,
          });
          console.log("[sendQuickMessage] Message successfully written to database");
        }
      } catch (dbErr) {
        console.warn("[sendQuickMessage] Quick message DB insert failed", dbErr);
      }

      playSound("messageSent");
      vibrate(VibrationPatterns.messageSent);

      toast({
        title: title,
        description: description,
        duration: 3000,
      });
    },
    [ride.id, ride.driver_id, toast]
  );

  const handleRiderArrived = useCallback(async () => {
    // 1. إنهاء الرحلة فقط إذا لا تزال في الحالة in_progress
    //    (يمنع تفعيل trigger المكافآت مرتين لو أنهى السائق الرحلة في نفس الوقت)
    const { error } = await supabase
      .from("rides")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", ride.id)
      .eq("status", "in_progress");  // guard: لا تحديث إذا أُكملت مسبقاً

    if (error) {
      console.error("[handleRiderArrived] Error completing ride:", error);
      toast({
        title: "حدث خطأ",
        description: "لم نتمكن من إنهاء الرحلة، حاول مرة أخرى",
        variant: "destructive",
      });
      return;
    }

    // 2. إرسال broadcast للسائق بأن الراكب أنهى الرحلة
    if (broadcastChannel.current) {
      await broadcastChannel.current.send({
        type: "broadcast",
        event: "ride_completed_by_rider",
        payload: {
          rideId: ride.id,
          message: "الراكب أنهى الرحلة",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 3. صوت الإكمال + اهتزاز
    playSound("completed");
    vibrate(VibrationPatterns.completed);

    // ✅ لا نستدعي setShowCompletedScreen — useActiveRide يكشف تغيير الحالة عبر Realtime ويعرضها
  }, [ride.id, toast]);

  return {
    sendQuickMessage,
    handleRiderArrived,
    broadcastChannel,
    isConnected,
  };
};
