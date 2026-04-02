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
  onRideUpdate: (ride: any) => void;
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
  const broadcastChannel = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const previousStatusRef = useRef<string>(ride.status);

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
      .on("broadcast", { event: "ride_accepted" }, (payload: any) => {
        console.log("[Broadcast] ⚡ ride_accepted received");
        onRideUpdate({ ...ride, status: "accepted" });
        playSound("accepted");
        vibrate(VibrationPatterns.accepted);

        toast({
          title: "🎉 تم قبول طلبك!",
          description: payload.payload?.driverName
            ? `${payload.payload.driverName} في الطريق إليك`
            : "السائق في الطريق إليك الآن",
          duration: 8000,
        });

        showNotification(
          "🎉 تم قبول طلبك!",
          "السائق في الطريق إليك - انتظره في موقع الانطلاق",
          { tag: "ride-accepted", requireInteraction: true, duration: 10000 }
        );
      })
      .on("broadcast", { event: "driver_arrived" }, (payload: any) => {
        console.log("[Broadcast] ⚡ driver_arrived received");
        onRideUpdate({ ...ride, status: "arrived" });
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
      .on("broadcast", { event: "ride_started" }, (payload: any) => {
        console.log("[Broadcast] ⚡ ride_started received");
        onRideUpdate({
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
      .on("broadcast", { event: "ride_completed" }, (payload: any) => {
        console.log("[Broadcast] ⚡ ride_completed received");
        onRideUpdate({
          ...ride,
          status: "completed",
          completed_at: new Date().toISOString(),
        });
        playSound("completed");
        vibrate(VibrationPatterns.completed);

        toast({
          title: "✅ تم إكمال الرحلة!",
          description: "الحمد لله على السلامة 🤲",
          duration: 8000,
        });

        // ✅ useActiveRide يتولى عرض شاشة التقييم عبر الـ Realtime الخاص به
      })
      .on(
        "broadcast",
        { event: "ride_cancelled_by_driver" },
        (payload: any) => {
          console.log("[Broadcast] ⚡ ride_cancelled_by_driver received");
          playSound("cancelled");
          vibrate(VibrationPatterns.cancelled);

          toast({
            title: "❌ تم إلغاء الرحلة من السائق",
            description:
              payload.payload?.reason ||
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
      .on("broadcast", { event: "driver_location_update" }, (payload: any) => {
        const newLocation = payload.payload?.location;
        if (newLocation?.lat && newLocation?.lng) {
          console.log("[Broadcast] 📍 Driver location updated (Real-time):", newLocation);
          onDriverLocationUpdate(newLocation);
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
      supabase.removeChannel(channel);
      broadcastChannel.current = null;
      setIsConnected(false);
    };
  }, [ride.id, driver?.full_name]);

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
          const updatedRide = payload.new as any;
          const newStatus = updatedRide.status;
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
              playSound("completed");
              vibrate(VibrationPatterns.completed);
              toast({
                title: "✅ تم إكمال الرحلة!",
                description: "الحمد لله على السلامة 🤲",
                duration: 8000,
              });
              // ✅ useActiveRide يتولى عرض شاشة التقييم عبر الـ Realtime الخاص به
            }

            if (newStatus === "cancelled") {
              playSound("cancelled");
              vibrate(VibrationPatterns.cancelled);
              toast({
                title: "❌ تم إلغاء الرحلة",
                description:
                  updatedRide.cancellation_reason || "تم إلغاء الرحلة",
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
    (event: string, title: string, description: string) => {
      console.log(
        "[sendQuickMessage] Sending event:",
        event,
        "to ride:",
        ride.id
      );

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
          .catch((error: any) => {
            console.error("[sendQuickMessage] Error sending message:", error);
          });
      } else {
        console.warn("[sendQuickMessage] Broadcast channel not initialized!");
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
    // 1. إنهاء الرحلة فوراً في قاعدة البيانات
    const { error } = await supabase
      .from("rides")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", ride.id);

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
