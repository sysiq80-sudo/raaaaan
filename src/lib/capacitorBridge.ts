/**
 * ران — جسر Capacitor للإضافات الأصلية (Capacitor Native Bridge)
 * 
 * يوفر واجهة موحدة للتعامل مع إضافات Capacitor الأصلية
 * يعمل في كلا البيئتين: المتصفح (web) و التطبيق الأصلي (native)
 * 
 * الإضافات المدعومة (15 إضافة):
 * - Geolocation: تتبع GPS في الخلفية
 * - PushNotifications: إشعارات FCM أصلية
 * - LocalNotifications: إشعارات محلية فورية
 * - Haptics: اهتزاز متقدم (خفيف/متوسط/قوي)
 * - App: أحداث التطبيق (foreground/background)
 * - StatusBar: تخصيص شريط الحالة
 * - Keyboard: التحكم بسلوك لوحة المفاتيح
 * - Device: معلومات الجهاز والبطارية
 * - Network: مراقبة حالة الاتصال
 * - SplashScreen: إدارة شاشة البداية
 * - Preferences: تخزين محلي أصلي
 * - Browser: فتح روابط خارجية
 * - KeepAwake: إبقاء الشاشة مضاءة (للسائق)
 * - TextToSpeech: نطق صوتي عربي
 * - SpeechRecognition: تعرف صوتي أصلي
 */

import { Capacitor } from '@capacitor/core';
import { capacitorStorageSync } from './capacitorStorage';

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
  'ride_accepted',
  'driver-arrived',
  'driver_arrived',
  'ride-started',
  'ride_started',
  'ride-completed',
  'ride_completed',
  'ride-cancelled',
  'ride_cancelled',
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
    
    // التحقق من الإذن فقط. طلب الإذن يتم من تفاعل واضح مثل زر الاتصال.
    let permGranted = false;
    try {
      const perm = await LocalNotifications.checkPermissions();
      permGranted = perm.display === 'granted';
    } catch (permError) {
      console.warn('⚠️ Permission check failed, assuming denied:', permError);
      permGranted = false;
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

/**
 * تخصيص شريط حالة Android — شفاف مع overlay لدعم Safe Area
 * + ضبط CSS custom properties لتعويض عدم عمل env(safe-area-inset-*) على Android WebView
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

  // ═══ ضبط CSS safe area variables لأن env() لا تعمل على Android WebView ═══
  if (isAndroid) {
    applySafeAreaCSSVariables();
  }
};

let safeAreaListenersInstalled = false;
let safeAreaFrame: number | null = null;

/**
 * يكشف ارتفاع أشرطة النظام على Android ويضبط CSS custom properties.
 * Android WebView غالباً يرجع env(safe-area-inset-bottom)=0 مع edge-to-edge.
 * لا نفرض حداً أدنى سفلياً لأن WebView قد يكون مقاساً فوق شريط Android أصلاً؛
 * فرض قيمة ثابتة يرفع شريط الراكب ويترك فراغاً فوق أزرار النظام.
 */
function applySafeAreaCSSVariables() {
  const updateSafeArea = () => {
    const root = document.documentElement;
    const topInset = Math.max(readEnvSafeAreaInset('top'), 24);
    const bottomInset = getAndroidBottomInset();

    root.style.setProperty('--safe-area-top', `${topInset}px`);
    root.style.setProperty('--safe-area-bottom', `${bottomInset}px`);
    console.log(`📐 Safe area (Android): top=${topInset}px, bottom=${bottomInset}px`);
  };

  const scheduleUpdate = () => {
    if (safeAreaFrame !== null) cancelAnimationFrame(safeAreaFrame);
    safeAreaFrame = requestAnimationFrame(() => {
      safeAreaFrame = null;
      updateSafeArea();
    });
  };

  scheduleUpdate();

  if (safeAreaListenersInstalled) return;
  safeAreaListenersInstalled = true;
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('orientationchange', scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleUpdate, { passive: true });
}

function readEnvSafeAreaInset(edge: 'top' | 'bottom'): number {
  if (!document.body) return 0;

  try {
    const probe = document.createElement('div');
    probe.style.cssText = [
      'position:fixed',
      edge === 'top' ? 'top:0' : 'bottom:0',
      'left:0',
      'width:1px',
      `height:env(safe-area-inset-${edge},0px)`,
      'pointer-events:none',
      'opacity:0',
      'z-index:-1',
    ].join(';');
    document.body.appendChild(probe);
    const inset = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    return Number.isFinite(inset) ? Math.max(0, inset) : 0;
  } catch {
    return 0;
  }
}

function getAndroidBottomInset(): number {
  const envBottom = readEnvSafeAreaInset('bottom');
  const visualHeight = window.visualViewport?.height ?? window.innerHeight;
  const visualGap = Math.max(0, window.innerHeight - visualHeight);
  const inset = Math.max(envBottom, visualGap);

  // Use one bounded Android nav inset. Larger viewport gaps usually mean keyboard
  // or WebView measurement noise; applying them lifts rider buttons too far.
  return Number.isFinite(inset) ? Math.min(72, Math.round(inset)) : 0;
}

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
  
  // تخصيص شريط الحالة ولوحة المفاتيح
  await configureStatusBar();
  await configureKeyboard();

  // إنشاء قنوات إشعارات لـ Android + طلب الإذن مبكراً
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

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

  // مراقبة تغييرات الشبكة في الوقت الفعلي
  onNetworkStatusChange((connected, type) => {
    console.log(`🌐 تغيير الشبكة: ${connected ? '✅ متصل' : '❌ غير متصل'} (${type})`);
  });

  // مراقبة حالة التطبيق (نشط ↔ خلفية)
  onAppStateChange((isActive) => {
    console.log(`📱 التطبيق: ${isActive ? '▶️ نشط' : '⏸️ خلفية'}`);
  });

  // معلومات الجهاز عند البدء
  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    console.log(`📱 الجهاز: ${info.manufacturer} ${info.model} | ${info.operatingSystem} ${info.osVersion}`);
  } catch { /* صامت */ }

  // حالة الشبكة الحالية عند البدء
  const netStatus = await getNetworkStatus();
  console.log(`🌐 الشبكة: ${netStatus.connected ? '✅ متصل' : '❌ غير متصل'} (${netStatus.connectionType})`);

  // إخفاء شاشة البداية بعد اكتمال التهيئة
  setTimeout(() => hideSplashScreen(), 500);

  // قفل الشاشة عمودياً (يمنع الدوران أثناء القيادة/استخدام الخريطة)
  lockScreenPortrait();

  console.log('✅ جميع إضافات Capacitor مُهيأة بنجاح (18 إضافة)');
};

let pushNotificationsInitialized = false;

/**
 * تهيئة إشعارات Push الأصلية عبر FCM
 * يسجل الجهاز لاستقبال الإشعارات في الخلفية
 */
export const initNativePushNotifications = async (): Promise<void> => {
  if (!isNativePlatform) return;
  
  if (pushNotificationsInitialized) {
    console.log('🔔 [initNativePushNotifications] Push notifications already initialized, skipping duplicate listeners registration.');
    return;
  }
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // التحقق من الإذن
    const permResult = await PushNotifications.checkPermissions();
    
    if (permResult.receive === 'prompt' || permResult.receive === 'prompt-with-rationale') {
      console.warn('⚠️ إذن Push مؤجل حتى يفعّل السائق الإشعارات');
      return;
    } else if (permResult.receive !== 'granted') {
      console.warn('⚠️ إذن Push غير ممنوح:', permResult.receive);
      return;
    }

    // مستمعات قبل register() حتى لا يُفقد حدث registration (مهم للسائق/الراكب)
    PushNotifications.addListener('registration', (token) => {
      console.log('📱 FCM Token received:', token.value?.substring(0, 20) + '...');
      try {
        capacitorStorageSync.setItem('raan_fcm_token', token.value);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('raan_fcm_token', token.value);
        }
      } catch {
        // صامت
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ FCM Registration error:', error);
    });

    try {
      await PushNotifications.register();
    } catch (regErr) {
      console.warn('⚠️ PushNotifications.register() failed (Firebase may not be configured):', regErr);
      return;
    }
    
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
          capacitorStorageSync.setItem('raan_pending_accept_ride', rideId);
        } catch {
          // صامت
        }
      } else {
        // فتح الطلب من الإشعار
        try {
          capacitorStorageSync.setItem('raan_pending_open_ride', rideId);
        } catch {
          // صامت
        }
      }
    });
    
    pushNotificationsInitialized = true;
    console.log('✅ FCM Push Notifications initialized');
  } catch (error) {
    console.log('FCM initialization skipped:', error);
  }
};

// ═══ لوحة المفاتيح ═══

/**
 * ضبط سلوك لوحة المفاتيح لمنع تشويه الخريطة عند فتحها
 * تُستدعى تلقائياً في initCapacitorPlugins
 */
export const configureKeyboard = async (): Promise<void> => {
  if (!isNativePlatform) return;

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    // منع الكيبورد من دفع الـ WebView للأعلى (يحافظ على الخريطة)
    await Keyboard.setResizeMode({ mode: KeyboardResize.None });
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
    await Keyboard.setScroll({ isDisabled: false });
    console.log('⌨️ Keyboard configured');
  } catch {
    // صامت — الإضافة غير متوفرة
  }
};

// ═══ إبقاء الشاشة مضاءة (للسائق) ═══

/**
 * إبقاء الشاشة مضاءة أثناء الرحلة النشطة
 * يُستدعى عند بدء رحلة السائق ويُلغى عند انتهائها
 */
export const setKeepAwake = async (keepAwake: boolean): Promise<void> => {
  if (!isNativePlatform) return;

  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (keepAwake) {
      await KeepAwake.keepAwake();
      console.log('💡 الشاشة ستبقى مضاءة');
    } else {
      await KeepAwake.allowSleep();
      console.log('💡 السماح للشاشة بالنوم');
    }
  } catch {
    // صامت
  }
};

// ═══ معلومات الجهاز والبطارية ═══

/**
 * قراءة مستوى البطارية — يُستخدم لتقليل تكرار GPS عند انخفاض الشحن
 */
export const getDeviceBatteryInfo = async (): Promise<{
  batteryLevel?: number;
  isCharging?: boolean;
}> => {
  if (!isNativePlatform) return {};

  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getBatteryInfo();
    return {
      batteryLevel: info.batteryLevel,
      isCharging: info.isCharging,
    };
  } catch {
    return {};
  }
};

/**
 * قراءة معلومات الجهاز (الطراز، المنصة، إصدار النظام)
 */
export const getDeviceInfo = async (): Promise<{
  model?: string;
  platform?: string;
  osVersion?: string;
  manufacturer?: string;
}> => {
  if (!isNativePlatform) return {};

  try {
    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    return {
      model: info.model,
      platform: info.platform,
      osVersion: info.osVersion,
      manufacturer: info.manufacturer,
    };
  } catch {
    return {};
  }
};

// ═══ تحويل النص إلى كلام (Text-to-Speech) ═══

/**
 * نطق نص صوتي — مفيد لتطبيق الراكب والسائق
 * أمثلة: "تم حجز رحلتك" — "طلب جديد، يبعد 2 كم"
 */
export const speakText = async (
  text: string,
  lang: string = 'ar-SA'
): Promise<void> => {
  if (!isNativePlatform) {
    // Fallback للمتصفح
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // صامت
    }
    return;
  }

  try {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    await TextToSpeech.speak({
      text,
      lang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
    });
  } catch (err) {
    console.error('TTS Error:', err);
  }
};

/**
 * إيقاف أي نطق جارٍ
 */
export const stopSpeaking = async (): Promise<void> => {
  if (!isNativePlatform) {
    window.speechSynthesis?.cancel();
    return;
  }

  try {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    await TextToSpeech.stop();
  } catch {
    // صامت
  }
};

// ═══ التعرف على الصوت الأصلي (Speech Recognition) ═══

/**
 * بدء الاستماع الصوتي الأصلي — أدق من Web Speech API
 * يُستخدم في AIVoiceHome للتعرف على أوامر الراكب
 */
export const startNativeSpeechRecognition = async (
  onResult: (text: string) => void,
  onError: (err: string) => void,
  lang: string = 'ar-SA'
): Promise<boolean> => {
  if (!isNativePlatform) {
    // على الويب نستخدم Web Speech API (موجود بالفعل في AIVoiceHome)
    return false;
  }

  try {
    const { SpeechRecognition } = await import(
      '@capacitor-community/speech-recognition'
    );

    // التحقق من الإذن
    const permStatus = await SpeechRecognition.checkPermissions();
    if (permStatus.speechRecognition !== 'granted') {
      const req = await SpeechRecognition.requestPermissions();
      if (req.speechRecognition !== 'granted') {
        onError('إذن الميكروفون مرفوض');
        return false;
      }
    }

    // الاستماع للنتائج الجزئية
    SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
      if (data.matches?.length > 0) {
        onResult(data.matches[0]);
      }
    });

    await SpeechRecognition.start({
      language: lang,
      maxResults: 1,
      prompt: 'تحدث الآن...',
      partialResults: true,
      popup: false,
    });

    console.log('🎙️ Native speech recognition started');
    return true;
  } catch (err) {
    onError(String(err));
    return false;
  }
};

/**
 * إيقاف الاستماع الصوتي الأصلي
 */
export const stopNativeSpeechRecognition = async (): Promise<void> => {
  if (!isNativePlatform) return;

  try {
    const { SpeechRecognition } = await import(
      '@capacitor-community/speech-recognition'
    );
    await SpeechRecognition.stop();
    await SpeechRecognition.removeAllListeners();
  } catch {
    // صامت
  }
};

// ═══ مراقبة الشبكة ═══

/**
 * الاستماع لتغيرات حالة الاتصال بالإنترنت
 * يُستخدم لتحويل التطبيق لوضع Offline بسلاسة
 */
export const onNetworkStatusChange = async (
  callback: (isConnected: boolean, connectionType: string) => void
): Promise<(() => void) | null> => {
  if (!isNativePlatform) {
    // Fallback: استخدام navigator.onLine
    const onlineHandler = () => callback(true, 'wifi');
    const offlineHandler = () => callback(false, 'none');
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }

  try {
    const { Network } = await import('@capacitor/network');
    const listener = await Network.addListener('networkStatusChange', (status) => {
      callback(status.connected, status.connectionType);
    });
    return () => listener.remove();
  } catch {
    return null;
  }
};

/**
 * قراءة حالة الشبكة الحالية
 */
export const getNetworkStatus = async (): Promise<{
  connected: boolean;
  connectionType: string;
}> => {
  if (!isNativePlatform) {
    return { connected: navigator.onLine, connectionType: 'unknown' };
  }

  try {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    return { connected: status.connected, connectionType: status.connectionType };
  } catch {
    return { connected: navigator.onLine, connectionType: 'unknown' };
  }
};

// ═══ شاشة البداية (Splash Screen) ═══

/**
 * إخفاء شاشة البداية — تُستدعى بعد اكتمال تحميل التطبيق
 */
export const hideSplashScreen = async (): Promise<void> => {
  if (!isNativePlatform) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {
    // صامت
  }
};

// ═══ قفل اتجاه الشاشة (Screen Orientation) ═══

/**
 * قفل الشاشة على الوضع العمودي — يمنع الدوران أثناء استخدام الخريطة
 */
export const lockScreenPortrait = async (): Promise<void> => {
  if (!isNativePlatform) return;

  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {
    // صامت — لن يعمل على الويب
  }
};

// ═══ رسائل Toast أصلية ═══

/**
 * عرض رسالة Toast أصلية — أسرع وأنعم من JS toasts
 * @param text النص المعروض
 * @param duration 'short' (2s) أو 'long' (3.5s)
 * @param position 'top' | 'center' | 'bottom'
 */
export const showNativeToast = async (
  text: string,
  duration: 'short' | 'long' = 'short',
  position: 'top' | 'center' | 'bottom' = 'bottom'
): Promise<void> => {
  if (!isNativePlatform) {
    // Fallback: console + لا شيء (يُستخدم toast من shadcn/ui بدلاً)
    console.log(`[Toast] ${text}`);
    return;
  }

  try {
    const { Toast } = await import('@capacitor/toast');
    await Toast.show({ text, duration, position });
  } catch {
    console.warn('[capacitorBridge] Toast plugin not available');
  }
};

// ═══ نوافذ حوار أصلية (Dialog) ═══

/**
 * عرض نافذة تأكيد أصلية — تعود true إذا ضغط "موافق"
 */
export const showNativeConfirm = async (
  title: string,
  message: string,
  okButtonTitle: string = 'موافق',
  cancelButtonTitle: string = 'إلغاء'
): Promise<boolean> => {
  if (!isNativePlatform) {
    return window.confirm(`${title}\n${message}`);
  }

  try {
    const { Dialog } = await import('@capacitor/dialog');
    const { value } = await Dialog.confirm({
      title,
      message,
      okButtonTitle,
      cancelButtonTitle,
    });
    return value;
  } catch {
    return window.confirm(`${title}\n${message}`);
  }
};

/**
 * عرض رسالة تنبيه أصلية
 */
export const showNativeAlert = async (
  title: string,
  message: string,
  buttonTitle: string = 'حسناً'
): Promise<void> => {
  if (!isNativePlatform) {
    window.alert(`${title}\n${message}`);
    return;
  }

  try {
    const { Dialog } = await import('@capacitor/dialog');
    await Dialog.alert({ title, message, buttonTitle });
  } catch {
    window.alert(`${title}\n${message}`);
  }
};

