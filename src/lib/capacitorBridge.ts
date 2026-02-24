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
 */
export const showNativeNotification = async (
  title: string,
  body: string,
  id?: number
): Promise<void> => {
  if (!isNativePlatform) return; // على الويب نستخدم Web Notifications

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    // طلب الإذن
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: id || Date.now(),
          title,
          body,
          sound: undefined, // يمكن إضافة صوت مخصص لاحقاً
          smallIcon: 'ic_stat_icon_config_sample',
          largeIcon: 'ic_launcher',
          channelId: 'raan-rides',
          schedule: { at: new Date(Date.now()) },
        },
      ],
    });
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
    // Fallback للويب
    if ('vibrate' in navigator) {
      const patterns: Record<string, number[]> = {
        light: [50],
        medium: [100, 50, 100],
        heavy: [300, 100, 300, 100, 400],
      };
      navigator.vibrate(patterns[style]);
    }
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
    if ('vibrate' in navigator) navigator.vibrate([200]);
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

  // إنشاء قناة إشعارات لـ Android
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
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
    console.log('📢 قناة الإشعارات "raan-rides" مُنشأة');
  } catch (err) {
    console.log('لم يتم إنشاء قناة الإشعارات:', err);
  }
};
