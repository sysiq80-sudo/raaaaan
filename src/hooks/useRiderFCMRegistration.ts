import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform, initNativePushNotifications } from "@/lib/capacitorBridge";

/**
 * تسجيل رمز FCM للراكب في push_subscriptions
 * يعمل على المنصات الأصلية (Android/iOS) فقط
 * يُستدعى مرة واحدة عند تحميل الصفحة
 */
export const useRiderFCMRegistration = (userId: string | null) => {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || !isNativePlatform || registered.current) return;

    const registerFCM = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') return;

        const token = await new Promise<string | null>((resolve) => {
          let isResolved = false;
          let listenerHandle: { remove: () => void } | null = null;

          const cleanup = () => {
            if (listenerHandle) {
              try { listenerHandle.remove(); } catch { /* ignore */ }
            }
          };

          const timeout = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve(localStorage.getItem('raan_fcm_token'));
            }
          }, 5000);

          // Register registration listener first to avoid missing the token event.
          PushNotifications.addListener('registration', (t) => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              cleanup();
              localStorage.setItem('raan_fcm_token', t.value);
              resolve(t.value);
            }
          }).then(handle => {
            listenerHandle = handle;
            if (isResolved) {
              cleanup();
            } else {
              // Trigger registration once listener is confirmed active.
              PushNotifications.register().catch(regErr => {
                console.warn('⚠️ PushNotifications.register() failed:', regErr);
                if (!isResolved) {
                  isResolved = true;
                  clearTimeout(timeout);
                  cleanup();
                  resolve(null);
                }
              });
            }
          }).catch(err => {
            console.error('Failed to add registration listener:', err);
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              resolve(null);
            }
          });
        });

        if (!token) return;

        // Ensure global native push notifications event handlers are initialized.
        try {
          await initNativePushNotifications();
        } catch (initErr) {
          console.warn('⚠️ Failed to initialize native push notifications:', initErr);
        }

        // تنظيف الاشتراكات المعطوبة القديمة: fcm:// بدون fcm_token
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .like('endpoint', 'fcm://%')
          .is('fcm_token', null);

        // Keep a single active native FCM subscription per rider.
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .like('endpoint', 'fcm://%');

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
          registered.current = true;
          console.log('✅ Rider FCM token registered');
        }
      } catch (err) {
        console.error('Rider FCM registration error:', err);
      }
    };

    registerFCM();
  }, [userId]);
};
