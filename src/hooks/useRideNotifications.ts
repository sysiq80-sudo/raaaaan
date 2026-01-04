import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { playSound, vibrate, VibrationPatterns, showNotification, requestNotificationPermission } from "@/utils/rideNotificationSounds";

interface StatusMessage {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  soundType: 'accepted' | 'arrived' | 'inProgress' | 'completed' | 'cancelled';
  vibrationPattern: number[];
  notificationTag: string;
  toastDuration: number;
}

const statusMessages: Record<string, StatusMessage> = {
  accepted: {
    title: "تم قبول طلبك! 🚗",
    description: "السائق في طريقه إليك الآن",
    soundType: 'accepted',
    vibrationPattern: VibrationPatterns.accepted,
    notificationTag: 'ride-accepted',
    toastDuration: 8000
  },
  arrived: {
    title: "وصل السائق! 📍",
    description: "السائق في موقع الانطلاق - اخرج الآن!",
    soundType: 'arrived',
    vibrationPattern: VibrationPatterns.arrived,
    notificationTag: 'driver-arrived',
    toastDuration: 10000
  },
  in_progress: {
    title: "بدأت الرحلة! 🛣️",
    description: "استمتع برحلتك مع ران - رحلة موفقة",
    soundType: 'inProgress',
    vibrationPattern: VibrationPatterns.inProgress,
    notificationTag: 'ride-started',
    toastDuration: 5000
  },
  completed: {
    title: "اكتملت الرحلة! ✅",
    description: "الحمد لله على السلامة 🤲 - شكراً لاستخدامك ران",
    soundType: 'completed',
    vibrationPattern: VibrationPatterns.completed,
    notificationTag: 'ride-completed',
    toastDuration: 8000
  },
  cancelled: {
    title: "تم إلغاء الرحلة ❌",
    description: "تم إلغاء رحلتك",
    variant: "destructive",
    soundType: 'cancelled',
    vibrationPattern: VibrationPatterns.cancelled,
    notificationTag: 'ride-cancelled',
    toastDuration: 5000
  }
};

export const useRideNotifications = (userId: string | null) => {
  const { toast } = useToast();

  const handleRideUpdate = useCallback((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const newStatus = payload.new.status as string;
    const oldStatus = payload.old.status as string;

    if (newStatus !== oldStatus && statusMessages[newStatus]) {
      const message = statusMessages[newStatus];
      
      console.log(`[RiderNotification] Status: ${oldStatus} → ${newStatus}`);
      
      // Play status-specific sound
      playSound(message.soundType);

      // Vibrate with status-specific pattern
      vibrate(message.vibrationPattern);

      // Show toast notification
      toast({
        title: message.title,
        description: message.description,
        variant: message.variant || "default",
        duration: message.toastDuration
      });

      // Show browser notification
      showNotification(
        message.title, 
        message.description, 
        { 
          tag: message.notificationTag,
          requireInteraction: newStatus === 'arrived',
          duration: message.toastDuration
        }
      );
    }
  }, [toast]);

  useEffect(() => {
    if (!userId) return;

    console.log(`[RiderNotification] Subscribing for user: ${userId}`);
    
    const channel = supabase
      .channel('rider-ride-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `rider_id=eq.${userId}`
        },
        (payload) => handleRideUpdate(payload as { new: Record<string, unknown>; old: Record<string, unknown> })
      )
      .subscribe((status) => {
        console.log(`[RiderNotification] Subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, handleRideUpdate]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);
};