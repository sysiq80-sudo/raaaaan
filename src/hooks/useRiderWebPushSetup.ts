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

        const vapidPublicKey =
          import.meta.env.VITE_VAPID_PUBLIC_KEY ||
          "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

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

        const { error } = await supabase.functions.invoke(
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

        if (error) {
          console.error("[RiderWebPush] Error saving subscription:", error);
        } else {
          registered.current = true;
          console.log("✅ Rider Web Push registered for user:", userId);
        }
      } catch (err) {
        console.error("[RiderWebPush] Setup error:", err);
      }
    };

    setupWebPush();
  }, [userId]);
};
