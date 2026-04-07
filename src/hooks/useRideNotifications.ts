import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { playSound, vibrate, VibrationPatterns, showNotification, requestNotificationPermission } from "@/utils/rideNotificationSounds";
import { isNativePlatform, showNativeNotification, nativeHaptic } from "@/lib/capacitorBridge";

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
  const fcmRegistered = useRef(false);
  // 🛡️ منع تكرار الإشعارات: تتبع آخر حالة تم إشعار المستخدم بها لكل رحلة
  const lastNotifiedStatusRef = useRef<Map<string, string>>(new Map());

  const handleRideUpdate = useCallback((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const newStatus = payload.new.status as string;
    const oldStatus = payload.old.status as string;
    const rideId = payload.new.id as string;

    if (newStatus !== oldStatus && statusMessages[newStatus]) {
      // 🛡️ فحص التكرار: تجاهل إذا سبق إشعار نفس الحالة لنفس الرحلة
      const lastNotified = lastNotifiedStatusRef.current.get(rideId);
      if (lastNotified === newStatus) {
        console.log(`[RiderNotification] Dedup: already notified ${rideId} → ${newStatus}`);
        return;
      }
      lastNotifiedStatusRef.current.set(rideId, newStatus);

      // تنظيف الرحلات المنتهية من خريطة التتبع
      if (newStatus === 'completed' || newStatus === 'cancelled') {
        setTimeout(() => lastNotifiedStatusRef.current.delete(rideId), 10000);
      }

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

      // 🛡️ على التطبيق الأصلي: فقط اهتزاز بدون إشعار محلي
      // لأن FCM يرسل الإشعار عبر DB trigger → edge function
      if (isNativePlatform) {
        nativeHaptic('heavy');
        // لا نستدعي showNativeNotification هنا لتجنب التكرار مع FCM push
      }

      // Show browser notification (web only)
      if (!isNativePlatform) {
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

  // Register FCM token for rider (native app only)
  useEffect(() => {
    if (!userId || !isNativePlatform || fcmRegistered.current) return;

    const registerRiderFCM = async () => {
      try {
        // Read token saved by initNativePushNotifications() in capacitorBridge.ts
        let token = localStorage.getItem('raan_fcm_token');

        if (!token) {
          // If not in localStorage yet, request explicitly
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const permResult = await PushNotifications.requestPermissions();
          if (permResult.receive !== 'granted') return;

          try {
            await PushNotifications.register();
          } catch (regErr) {
            console.warn('⚠️ PushNotifications.register() failed:', regErr);
            return;
          }

          // Wait briefly for token
          token = await new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            PushNotifications.addListener('registration', (t) => {
              clearTimeout(timeout);
              localStorage.setItem('raan_fcm_token', t.value);
              resolve(t.value);
            });
          });
        }

        if (!token) return;

        // Remove old FCM records for this user, then insert new one
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .not('fcm_token', 'is', null);

        const { error } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            endpoint: `fcm://${token}`,
            p256dh_key: '',
            auth_key: '',
            platform: 'android',
            fcm_token: token,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('فشل حفظ رمز FCM للراكب:', error);
        } else {
          fcmRegistered.current = true;
          console.log('✅ Rider FCM token registered');
        }
      } catch (err) {
        console.error('Rider FCM registration error:', err);
      }
    };

    registerRiderFCM();
  }, [userId]);
};