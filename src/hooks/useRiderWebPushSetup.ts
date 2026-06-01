import { useEffect, useRef } from "react";
import { isNativePlatform } from "@/lib/capacitorBridge";
import {
  registerServiceWorker,
  isServiceWorkerSupported,
} from "@/utils/serviceWorker";
import { supabase } from "@/integrations/supabase/client";

/**
 * تسجيل إشعارات Web Push للراكب في المتصفح
 * يعمل فقط على الويب (ليس الأصلي) — complementary to useRiderFCMRegistration
 * يسجل تلقائياً عند تحميل الصفحة بدون واجهة مرئية
 */
export const useRiderWebPushSetup = (userId: string | null) => {
  const registered = useRef(false);

  useEffect(() => {
    // Only on web platform, not native
    if (!userId || isNativePlatform || registered.current) return;
    if (!isServiceWorkerSupported()) return;

    const setupWebPush = async () => {
      try {
        // Register service worker
        const registration = await registerServiceWorker();
        if (!registration) return;

        // Only auto-register if permission was already granted (from settings).
        // Don't auto-trigger the browser prompt — it gets silently blocked
        // without a user gesture. The settings page toggle handles first-time requests.
        try {
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            console.log("[RiderWebPush] Permission not yet granted, skipping auto-setup");
            return;
          }
        } catch {
          console.log("[RiderWebPush] Notification API not available, skipping");
          return;
        }

        // Always refresh subscription to avoid stale endpoints kept by older SW state.
        // This prevents "Requested entity was not found" loops for rider notifications.
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          try {
            await existingSubscription.unsubscribe();
          } catch (unsubscribeErr) {
            console.warn("[RiderWebPush] Could not unsubscribe old subscription:", unsubscribeErr);
          }
        }

        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.warn('[RiderWebPush] VITE_VAPID_PUBLIC_KEY is not defined in environment variables. Web Push subscription aborted.');
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey,
        });

        if (!subscription) return;

        // Save to server via Edge Function (uses user_id for riders)
        const json = subscription.toJSON();
        if (!json.endpoint) {
          console.warn("[RiderWebPush] Missing endpoint in subscription payload");
          return;
        }

        let error = null;
        try {
          const res = await supabase.functions.invoke(
            "send-push-notification",
            {
              body: {
                action: "subscribe",
                subscription: {
                  user_id: userId,
                  endpoint: json.endpoint,
                  p256dh_key: json.keys?.p256dh || "",
                  auth_key: json.keys?.auth || "",
                },
              },
            }
          );
          error = res.error;
        } catch (invokeErr) {
          error = invokeErr;
        }

        if (error) {
          console.log("[RiderWebPush] Edge Function subscription failed, executing database fallback");
          
          try {
            // 1. Delete any existing subscription with same endpoint to avoid duplicates
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', json.endpoint);

            // 2. Extract fcm_token if it is an FCM web endpoint
            let fcmToken: string | null = null;
            if (json.endpoint.includes('fcm.googleapis.com/fcm/send/')) {
              fcmToken = json.endpoint.split('/fcm/send/')[1] || null;
            }

            // 3. Keep a single active web subscription per rider
            if (json.endpoint.includes('fcm.googleapis.com/fcm/send/')) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId)
                .or('platform.eq.web,endpoint.like.https://fcm.googleapis.com/fcm/send/%');
            }

            // 4. Insert the new subscription
            const { error: dbError } = await supabase
              .from('push_subscriptions')
              .insert({
                user_id: userId,
                endpoint: json.endpoint,
                p256dh_key: json.keys?.p256dh || "",
                auth_key: json.keys?.auth || "",
                platform: 'web',
                fcm_token: fcmToken,
                updated_at: new Date().toISOString()
              });

            if (dbError) {
              console.error("[RiderWebPush] Database fallback failed:", dbError.message);
            } else {
              registered.current = true;
              console.log("✅ Rider Web Push registered via database fallback for user:", userId);
            }
          } catch (fallbackErr) {
            console.error("[RiderWebPush] Database fallback exception:", fallbackErr);
          }
        } else {
          registered.current = true;
          console.log("✅ Rider Web Push registered via Edge Function for user:", userId);
        }
      } catch (err) {
        console.debug("[RiderWebPush] Setup skipped:", (err as Error).message);
      }
    };

    setupWebPush();
  }, [userId]);
};
