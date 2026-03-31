/**
 * ران — خدمة إشعارات السائق المركزية (Driver Notification Service)
 * 
 * تدير جميع جوانب نظام الإشعارات:
 * - التحقق من جدول الكتم قبل إرسال الإشعار
 * - تأكيد التسليم ومحاولة إعادة الإرسال
 * - مزامنة تفضيلات الإشعارات مع Supabase
 * - تسجيل FCM للتطبيق الأصلي (APK)
 */

import { supabase } from "@/integrations/supabase/client";
import { useDriverStore } from "@/stores/driverStore";
import { isNativePlatform } from "@/lib/capacitorBridge";

// ═══ أنواع البيانات ═══

export type MuteMode = 'off' | 'always' | 'scheduled';

export interface NotificationPreferences {
  mute_mode: MuteMode;
  mute_schedule_start: string; // "HH:mm"
  mute_schedule_end: string;   // "HH:mm"
  mute_days: number[];         // 0=Sun..6=Sat
  sounds_enabled: boolean;
  vibration_enabled: boolean;
  notification_volume: number; // 0-100
}

export interface DeliveryConfirmation {
  notification_id: string;
  delivered_at: string;
  channel: 'realtime' | 'web_push' | 'fcm' | 'local';
}

// ═══ فحص الكتم ═══

/**
 * التحقق مما إذا كانت الإشعارات مكتومة الآن
 * يستخدم حالة driverStore مباشرة
 */
export const isNotificationMutedNow = (): boolean => {
  const state = useDriverStore.getState();
  return state.isMutedNow();
};

/**
 * التحقق من الكتم بناءً على تفضيلات محددة (للاستخدام في Edge Function)
 */
export const checkMuteSchedule = (prefs: NotificationPreferences): boolean => {
  if (prefs.mute_mode === 'off') return false;
  if (prefs.mute_mode === 'always') return true;

  // scheduled mode
  const now = new Date();
  const currentDay = now.getDay();
  if (!prefs.mute_days.includes(currentDay)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = prefs.mute_schedule_start.split(':').map(Number);
  const [endH, endM] = prefs.mute_schedule_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // عبر منتصف الليل
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
};

// ═══ مزامنة التفضيلات مع قاعدة البيانات ═══

/**
 * حفظ تفضيلات الإشعارات في Supabase
 */
export const saveNotificationPreferences = async (
  driverId: string,
  prefs: NotificationPreferences
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        notification_preferences: prefs as unknown as Record<string, any>,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId);

    if (error) {
      console.error('خطأ في حفظ تفضيلات الإشعارات:', error);
      return false;
    }

    console.log('✅ تم حفظ تفضيلات الإشعارات');
    return true;
  } catch (error) {
    console.error('فشل حفظ التفضيلات:', error);
    return false;
  }
};

/**
 * جلب تفضيلات الإشعارات من Supabase
 */
export const loadNotificationPreferences = async (
  driverId: string
): Promise<NotificationPreferences | null> => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('notification_preferences')
      .eq('id', driverId)
      .single();

    if (error || !data?.notification_preferences) {
      return null;
    }

    return data.notification_preferences as unknown as NotificationPreferences;
  } catch (error) {
    console.error('فشل جلب التفضيلات:', error);
    return null;
  }
};

/**
 * مزامنة التفضيلات المحلية مع قاعدة البيانات
 * يُستدعى عند تسجيل الدخول أو تغيير الإعدادات
 */
export const syncNotificationPreferences = async (driverId: string): Promise<void> => {
  const state = useDriverStore.getState();
  
  // محاولة جلب التفضيلات من السيرفر أولاً
  const serverPrefs = await loadNotificationPreferences(driverId);
  
  if (serverPrefs) {
    // تحديث المخزن المحلي بتفضيلات السيرفر
    state.setNotificationMuteMode(serverPrefs.mute_mode);
    state.setMuteSchedule(
      serverPrefs.mute_schedule_start,
      serverPrefs.mute_schedule_end,
      serverPrefs.mute_days
    );
    state.setNotificationVolume(serverPrefs.notification_volume);
    
    if (serverPrefs.sounds_enabled !== state.soundsEnabled) {
      state.toggleSounds();
    }
    if (serverPrefs.vibration_enabled !== state.vibrationEnabled) {
      state.toggleVibration();
    }
    
    console.log('📥 تم مزامنة التفضيلات من السيرفر');
  } else {
    // رفع التفضيلات المحلية للسيرفر
    await saveNotificationPreferences(driverId, {
      mute_mode: state.notificationMuteMode,
      mute_schedule_start: state.muteScheduleStart,
      mute_schedule_end: state.muteScheduleEnd,
      mute_days: state.muteDays,
      sounds_enabled: state.soundsEnabled,
      vibration_enabled: state.vibrationEnabled,
      notification_volume: state.notificationVolume,
    });
    console.log('📤 تم رفع التفضيلات المحلية للسيرفر');
  }
};

// ═══ تسجيل FCM للتطبيق الأصلي ═══

/**
 * تسجيل رمز FCM في Supabase لاستقبال إشعارات الخلفية
 * يستخدم فقط عندما يعمل التطبيق كـ APK أصلي
 */
export const registerFCMToken = async (driverId: string): Promise<boolean> => {
  if (!isNativePlatform) {
    console.log('🌐 ليس تطبيق أصلي — لا حاجة لـ FCM');
    return false;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // طلب الإذن
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('⚠️ إذن الإشعارات مرفوض');
      return false;
    }

    // التسجيل للإشعارات
    await PushNotifications.register();

    // انتظار رمز التسجيل
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', async (token) => {
        console.log('📱 FCM Token:', token.value);
        
        // حفظ في localStorage للاستخدام السريع
        try { localStorage.setItem('raan_fcm_token', token.value); } catch {}
        
        // حذف السجلات القديمة ثم إدراج الجديد
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('driver_id', driverId)
          .not('fcm_token', 'is', null);

        const { error } = await supabase
          .from('push_subscriptions')
          .insert({
            driver_id: driverId,
            endpoint: `fcm://${token.value}`,
            p256dh_key: '',
            auth_key: '',
            platform: 'android',
            fcm_token: token.value,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('فشل حفظ رمز FCM:', error);
          resolve(false);
        } else {
          console.log('✅ تم حفظ رمز FCM للسائق:', driverId);
          resolve(true);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ فشل تسجيل FCM:', error);
        resolve(false);
      });
    });
  } catch (error) {
    console.error('فشل تسجيل FCM:', error);
    return false;
  }
};

/**
 * إعداد مستمعات الإشعارات الأصلية (FCM)
 * يعالج النقر على الإشعار والإشعارات في المقدمة
 */
export const setupNativePushListeners = async (
  onRideNotification?: (rideId: string) => void
): Promise<(() => void) | null> => {
  if (!isNativePlatform) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // إشعار وصل والتطبيق في المقدمة
    const receivedListener = await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('📩 إشعار FCM في المقدمة:', notification);
        
        const rideId = notification.data?.ride_id || notification.data?.rideId;
        if (rideId && onRideNotification) {
          onRideNotification(rideId);
        }
      }
    );

    // النقر على إشعار
    const actionListener = await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        console.log('👆 نقر على إشعار FCM:', action);
        
        const rideId = action.notification.data?.ride_id || action.notification.data?.rideId;
        if (rideId && onRideNotification) {
          onRideNotification(rideId);
        }
      }
    );

    return () => {
      receivedListener.remove();
      actionListener.remove();
    };
  } catch (error) {
    console.error('فشل إعداد مستمعات FCM:', error);
    return null;
  }
};

// ═══ تأكيد التسليم ═══

/**
 * تأكيد استلام الإشعار (يُستخدم لتتبع معدل التسليم)
 */
export const confirmNotificationDelivery = async (
  notificationId: string,
  channel: 'realtime' | 'web_push' | 'fcm' | 'local'
): Promise<void> => {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'notification_opened',
        notification_id: notificationId,
        opened_at: new Date().toISOString(),
        channel
      }
    });
  } catch (error) {
    console.error('فشل تأكيد التسليم:', error);
  }
};

// ═══ قبول الرحلة من الإشعار ═══

/**
 * قبول رحلة من إشعار SW أو FCM
 * يُستدعى عند النقر على زر "قبول" في الإشعار
 */
export const acceptRideFromNotification = async (
  rideId: string,
  driverId: string
): Promise<boolean> => {
  try {
    // التحقق من أن الرحلة لا تزال متاحة
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('status')
      .eq('id', rideId)
      .single();

    if (rideError || !ride || ride.status !== 'pending') {
      console.log('الرحلة لم تعد متاحة:', ride?.status);
      return false;
    }

    // قبول الرحلة
    const { error } = await supabase
      .from('rides')
      .update({
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .eq('status', 'pending');

    if (error) {
      console.error('فشل قبول الرحلة:', error);
      return false;
    }

    // تحديث حالة السائق
    await supabase
      .from('drivers')
      .update({ is_available: false, updated_at: new Date().toISOString() })
      .eq('id', driverId);

    console.log('✅ تم قبول الرحلة من الإشعار:', rideId);
    return true;
  } catch (error) {
    console.error('خطأ في قبول الرحلة:', error);
    return false;
  }
};

// ═══ إدارة حالة الإشعارات عبر القنوات ═══

/**
 * مؤقت فحص جدول الكتم التلقائي
 * يتحقق كل دقيقة ويُحدّث حالة الإشعارات حسب الجدول
 */
let muteCheckInterval: ReturnType<typeof setInterval> | null = null;

export const startMuteScheduleChecker = (): void => {
  if (muteCheckInterval) return;
  
  muteCheckInterval = setInterval(() => {
    const isMuted = isNotificationMutedNow();
    
    // يمكن استخدام هذا لتحديث UI أو تعطيل قنوات معينة
    if (isMuted) {
      console.log('🔇 وضع الكتم نشط');
    }
  }, 60000); // كل دقيقة
  
  console.log('⏰ بدء مراقبة جدول الكتم');
};

export const stopMuteScheduleChecker = (): void => {
  if (muteCheckInterval) {
    clearInterval(muteCheckInterval);
    muteCheckInterval = null;
    console.log('⏰ إيقاف مراقبة جدول الكتم');
  }
};
