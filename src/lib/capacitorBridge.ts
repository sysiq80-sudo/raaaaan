/**
 * ران — جسر Capacitor للإضافات الأصلية (Capacitor Native Bridge)
 * 
 * يوفر واجهة موحدة للتعامل مع إضافات Capacitor الأصلية
 * يعمل في كلا البيئتين: المتصفح (web) و التطبيق الأصلي (native)
 * 
 * الإضافات المدعومة:
 * - Geolocation: تتبع GPS في الخلفية
 * - PushNotifications: إشعارات أصلية
 * - LocalNotifications: إشعارات محلية
 * - Haptics: اهتزاز متقدم
 * - App: أحداث التطبيق (foreground/background)
 * - StatusBar: تخصيص شريط الحالة
 */

import { Capacitor } from '@capacitor/core';

// ═══ كشف البيئة ═══

/** هل التطبيق يعمل داخل غلاف Capacitor الأصلي */
export const isNativePlatform = Capacitor.isNativePlatform();

/** هل المنصة Android */
export const isAndroid = Capacitor.getPlatform() === 'android';

/** هل المنصة iOS */
export const isIOS = Capacitor.getPlatform() === 'ios';

/** هل المنصة ويب */
export const isWeb = Capacitor.getPlatform() === 'web';

const FOREGROUND_PUSH_DEDUPE_TTL_MS = 8_000;
const foregroundPushDedupe = new Map<string, number>();
const RIDER_STATUS_TYPES = new Set([
  'RIDE_STATUS_CHANGE',
  'ride-accepted',
  'driver-arrived',
  'ride-started',
  'ride-completed',
  'ride-cancelled',
]);

// ═══ GPS / تحديد الموقع في الخلفية ═══

/**
 * تهيئة تتبع GPS الأصلي عبر Capacitor
 * يعمل حتى عند تصغير التطبيق (على المنصات الأصلية)
 */
export const startNativeLocationTracking = async (
  onLocationUpdate: (lat: number, lng: number, accuracy: number) => void,
  options?: { enableHighAccuracy?: boolean; interval?: number }
): Promise<string | null> => {
  if (!isNativePlatform) {
    console.log('📍 تتبع الموقع: استخدام Web API (ليس Capacitor)');
    return null; // سيُستخدم Web Geolocation API بدلاً
  }

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    
    // طلب الأذونات
    const permission = await Geolocation.requestPermissions();
    if (permission.location !== 'granted') {
      console.warn('⚠️ إذن الموقع مرفوض');
      return null;
    }

    // بدء المراقبة
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: 20000,
        maximumAge: options?.interval ?? 10000,
      },
      (position, err) => {
        if (err) {
          console.error('خطأ GPS Capacitor:', err);
          return;
        }
        if (position) {
          onLocationUpdate(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy
          );
        }
      }
    );

    console.log('📍 تتبع GPS الأصلي مفعل — watchId:', watchId);
    return watchId;
  } catch (error) {
    console.error('فشل تفعيل تتبع GPS الأصلي:', error);
    return null;
  }
};

/**
 * إيقاف تتبع GPS الأصلي
 */
export const stopNativeLocationTracking = async (watchId: string | null): Promise<void> => {
  if (!isNativePlatform || !watchId) return;
  
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.clearWatch({ id: watchId });
    console.log('📍 تم إيقاف تتبع GPS الأصلي');
  } catch (error) {
    console.error('خطأ في إيقاف GPS:', error);
  }
};

// ═══ الإشعارات المحلية ═══

/**
 * عرض إشعار محلي أصلي (يعمل حتى بدون اتصال إنترنت)
 * مُحسَّن لطلبات الرحلات: أولوية قصوى + اهتزاز قوي
 */
export const showNativeNotification = async (
  title: string,
  body: string,
  id?: number,
  options?: { 
    channelId?: string; 
    priority?: 'high' | 'default';
    ongoing?: boolean;
    data?: Record<string, string | undefined>;
    actionButtons?: Array<{ id: string; title: string }>;
  }
): Promise<void> => {
  if (!isNativePlatform) return; // على الويب نستخدم Web Notifications

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    // التحقق من الإذن أولاً (بدون طلبه مجدداً — يُطلب مبكراً في initCapacitorPlugins)
    let permGranted = false;
    try {
      const perm = await LocalNotifications.checkPermissions();
      permGranted = perm.display === 'granted';
      if (!permGranted) {
        // محاولة أخيرة لطلب الإذن
        const reqPerm = await LocalNotifications.requestPermissions();
        permGranted = reqPerm.display === 'granted';
      }
    } catch {
      // افتراض الإذن ممنوح إذا فشل الفحص
      permGranted = true;
    }
    if (!permGranted) {
      console.warn('⚠️ LocalNotifications permission denied — cannot show notification');
      return;
    }

    // إنشاء القناة إذا لم تكن موجودة (ضمان دائم)
    const targetChannelId = options?.channelId || 'raan-rides';
    try {
      const existingChannels = await LocalNotifications.listChannels();
      const channelExists = existingChannels.channels?.some(ch => ch.id === targetChannelId);
      if (!channelExists) {
        await LocalNotifications.createChannel({
          id: targetChannelId,
          name: targetChannelId === 'raan-rides' ? 'طلبات الرحلات' : 'إشعارات ران',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });
        console.log(`📢 أُنشئت قناة الإشعار: ${targetChannelId}`);
      }
    } catch { /* تجاهل خطأ فحص القناة */ }

    const notifId = id || (Date.now() % 2147483647);

    const notification: Parameters<typeof LocalNotifications.schedule>[0]['notifications'][0] = {
      id: notifId,
      title,
      body,
      sound: undefined,
      // ic_transparent موجود دائماً في مكتبة @capacitor/local-notifications
      // ic_stat_icon_config_sample غير موجود مما يُسبب صمتاً تاماً في بعض النسخ
      smallIcon: 'ic_transparent',
      largeIcon: 'ic_launcher',
      channelId: options?.channelId || 'raan-rides',
      // ⚠️ مهم: لا تضع schedule.at بالوقت الحالي!
      // Capacitor يتحقق: if (at.getTime() < new Date().getTime()) return; ← يُلغي الإشعار صامتاً!
      // حذف schedule يعني الإشعار يظهر فورياً عبر notificationManager.notify() دون الحاجة لـ AlarmManager
      extra: {
        priority: options?.priority || 'high',
        ...options?.data
      },
      actionTypeId: options?.actionButtons?.length ? `raan-actions-${notifId}` : undefined,
    };

    // تسجيل أزرار الإجراء (مثل قبول/رفض)
    if (options?.actionButtons?.length) {
      await LocalNotifications.registerActionTypes({
        types: [{
          id: `raan-actions-${notifId}`,
          actions: options.actionButtons.map(btn => ({
            id: btn.id,
            title: btn.title,
          })),
        }],
      });
    }

    await LocalNotifications.schedule({ notifications: [notification] });
  } catch (error) {
    console.error('فشل عرض الإشعار المحلي:', error);
  }
};

// ═══ الاهتزاز المتقدم ═══

/**
 * اهتزاز أصلي متقدم (أقوى من Web Vibration API)
 */
export const nativeHaptic = async (style: 'light' | 'medium' | 'heavy' = 'heavy'): Promise<void> => {
  if (!isNativePlatform) {
    // Fallback للويب — guarded by user interaction policy
    const patterns: Record<string, number[]> = {
      light: [50],
      medium: [100, 50, 100],
      heavy: [300, 100, 300, 100, 400],
    };
    import('./userGestureTracker').then(({ safeVibrate }) => {
      safeVibrate(patterns[style]);
    }).catch(() => { /* ignore */ });
    return;
  }

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const styleMap: Record<string, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: styleMap[style] });
  } catch {
    // Fallback
    import('./userGestureTracker').then(({ safeVibrate }) => safeVibrate([200])).catch(() => { /* ignore */ });
  }
};

// ═══ أحداث التطبيق ═══

/**
 * الاستماع لأحداث انتقال التطبيق للخلفية/المقدمة
 */
export const onAppStateChange = async (
  callback: (isActive: boolean) => void
): Promise<(() => void) | null> => {
  if (!isNativePlatform) {
    // Fallback: استخدام visibilitychange
    const handler = () => callback(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }

  try {
    const { App } = await import('@capacitor/app');
    const listener = await App.addListener('appStateChange', (state) => {
      callback(state.isActive);
    });
    return () => listener.remove();
  } catch {
    return null;
  }
};

// ═══ شريط الحالة ═══

/**
 * تخصيص شريط حالة Android — شفاف مع overlay لدعم Safe Area
 */
export const configureStatusBar = async (): Promise<void> => {
  if (!isNativePlatform) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#00000000' }); // شفاف
    await StatusBar.setOverlaysWebView({ overlay: true }); // تراكب فوق المحتوى
  } catch {
    // صامت
  }
};

// ═══ تهيئة شاملة ═══

/**
 * تهيئة كل إضافات Capacitor عند بدء التطبيق
 * تُستدعى مرة واحدة في App.tsx أو main.tsx
 */
export const initCapacitorPlugins = async (): Promise<void> => {
  if (!isNativePlatform) {
    console.log('🌐 التطبيق يعمل في المتصفح — Capacitor plugins غير مفعلة');
    return;
  }

  console.log(`📱 تطبيق Capacitor — المنصة: ${Capacitor.getPlatform()}`);
  
  // تخصيص شريط الحالة
  await configureStatusBar();

  // إنشاء قنوات إشعارات لـ Android + طلب الإذن مبكراً
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // ⚠️ طلب إذن LocalNotifications مبكراً (قبل أول إشعار)
    // على Android 13+، يجب منح POST_NOTIFICATIONS قبل schedule()
    try {
      const permResult = await LocalNotifications.requestPermissions();
      if (permResult.display === 'granted') {
        console.log('✅ LocalNotifications permission granted');
      } else {
        console.warn('⚠️ LocalNotifications permission:', permResult.display);
      }
    } catch (permErr) {
      console.warn('فشل طلب إذن LocalNotifications:', permErr);
    }
    
    // قناة طلبات الرحلات — أولوية قصوى
    await LocalNotifications.createChannel({
      id: 'raan-rides',
      name: 'طلبات الرحلات',
      description: 'إشعارات طلبات الرحلات الجديدة للسائق',
      importance: 5, // MAX
      visibility: 1, // PUBLIC
      vibration: true,
      sound: undefined, // default sound
      lights: true,
      lightColor: '#10b981',
    });
    
    // قناة تحديثات الرحلة للراكب — أولوية عالية
    await LocalNotifications.createChannel({
      id: 'raan-rider',
      name: 'تحديثات الرحلة',
      description: 'إشعارات حالة الرحلة للراكب (قبول، وصول، إلخ)',
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      vibration: true,
      sound: undefined,
      lights: true,
      lightColor: '#f59e0b',
    });

    // قناة الإشعارات العامة — أولوية متوسطة
    await LocalNotifications.createChannel({
      id: 'raan-general',
      name: 'إشعارات عامة',
      description: 'تحديثات الحساب والنظام',
      importance: 3, // DEFAULT
      visibility: 1,
      vibration: true,
      sound: undefined,
      lights: true,
      lightColor: '#3b82f6',
    });
    
    console.log('📢 قنوات الإشعارات مُنشأة (rides + rider + general)');
  } catch (err) {
    console.log('لم يتم إنشاء قناة الإشعارات:', err);
  }
  
  // تسجيل إشعارات FCM Push (لاستقبال الإشعارات حتى مع إغلاق الشاشة)
  await initNativePushNotifications();
};

/**
 * تهيئة إشعارات Push الأصلية عبر FCM
 * يسجل الجهاز لاستقبال الإشعارات في الخلفية
 */
export const initNativePushNotifications = async (): Promise<void> => {
  if (!isNativePlatform) return;
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // التحقق من الإذن
    const permResult = await PushNotifications.checkPermissions();
    
    if (permResult.receive === 'prompt' || permResult.receive === 'prompt-with-rationale') {
      const requestResult = await PushNotifications.requestPermissions();
      if (requestResult.receive !== 'granted') {
        console.warn('⚠️ إذن Push مرفوض');
        return;
      }
    } else if (permResult.receive !== 'granted') {
      console.warn('⚠️ إذن Push غير ممنوح:', permResult.receive);
      return;
    }
    
    // تسجيل FCM
    await PushNotifications.register();
    
    // مستمع رمز التسجيل
    PushNotifications.addListener('registration', (token) => {
      console.log('📱 FCM Token received:', token.value?.substring(0, 20) + '...');
      // سيتم حفظه في driverNotificationService.registerFCMToken()
      // نحفظ الرمز مؤقتاً في localStorage حتى يتم تسجيل الدخول
      try {
        localStorage.setItem('raan_fcm_token', token.value);
      } catch {
        // صامت
      }
    });
    
    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ FCM Registration error:', error);
    });
    
    // إشعار وصل والتطبيق في المقدمة — عرض إشعار محلي + إبلاغ التطبيق
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('📩 FCM Push in foreground:', notification.title);
      
      const rideId = notification.data?.ride_id || notification.data?.rideId;
      const notifType = notification.data?.type;
      const dedupeKey = `${rideId || 'no-ride'}:${notifType || 'unknown'}`;
      const now = Date.now();

      // منع تكرار إشعارات foreground لنفس الحدث خلال نافذة قصيرة
      const lastSeenAt = foregroundPushDedupe.get(dedupeKey);
      if (typeof lastSeenAt === 'number' && now - lastSeenAt < FOREGROUND_PUSH_DEDUPE_TTL_MS) {
        return;
      }
      foregroundPushDedupe.set(dedupeKey, now);
      for (const [key, seenAt] of foregroundPushDedupe.entries()) {
        if (now - seenAt > FOREGROUND_PUSH_DEDUPE_TTL_MS) {
          foregroundPushDedupe.delete(key);
        }
      }

      // للراكب في foreground: لا تُظهر Local notification إضافي لحالات الرحلة
      if (
        document.visibilityState === 'visible' &&
        typeof notifType === 'string' &&
        RIDER_STATUS_TYPES.has(notifType)
      ) {
        return;
      }
      
      // عرض إشعار محلي أصلي حتى لو التطبيق مفتوح (السائق قد لا يكون على صفحة الطلبات)
      const channelId = notifType === 'new_ride' || notifType === 'NEW_RIDE_REQUEST' 
        ? 'raan-rides' : 'raan-rider';
      
      await showNativeNotification(
        notification.title || '🚗 ران',
        notification.body || '',
        undefined,
        { 
          channelId,
          priority: 'high',
          data: rideId ? { rideId, type: notifType } : undefined
        }
      );
    });
    
    // النقر على إشعار FCM
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 FCM notification tapped:', action.actionId);
      const rideId = action.notification.data?.ride_id || action.notification.data?.rideId;
      
      if (!rideId) return;

      if (action.actionId === 'accept') {
        // قبول الرحلة — يُعالج عند فتح الصفحة
        try {
          localStorage.setItem('raan_pending_accept_ride', rideId);
        } catch {
          // صامت
        }
      } else {
        // فتح الطلب من الإشعار
        try {
          localStorage.setItem('raan_pending_open_ride', rideId);
        } catch {
          // صامت
        }
      }
    });
    
    console.log('✅ FCM Push Notifications initialized');
  } catch (error) {
    console.log('FCM initialization skipped:', error);
  }
};
