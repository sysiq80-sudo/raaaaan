/**
 * ران — خدمة تتبع الموقع الأصلي (Native Background Location)
 * 
 * ⚠️ هذا الملف بديل لـ backgroundLocationService.ts الحالي الذي يستخدم
 * Web APIs (watchPosition + SharedWorker) والتي تُقتل بعد إغلاق الشاشة
 * على أجهزة Xiaomi/MIUI و Samsung (70%+ من السوق العراقي).
 * 
 * الحل: استخدام @transistorsoft/capacitor-background-geolocation
 * الذي يعمل كـ Android Foreground Service حقيقي.
 * 
 * ═══════════════════════════════════════════
 * خطوات التثبيت:
 * ═══════════════════════════════════════════
 * 
 * 1. تثبيت الحزمة:
 *    npm install @transistorsoft/capacitor-background-geolocation
 *    أو للنسخة المجانية (محدودة):
 *    npm install @transistorsoft/capacitor-background-geolocation-free
 * 
 * 2. مزامنة Capacitor:
 *    npx cap sync android
 * 
 * 3. إضافة أذونات Android في android/app/src/main/AndroidManifest.xml:
 *    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
 *    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
 *    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
 *    <uses-permission android:name="android.permission.WAKE_LOCK" />
 *    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
 * 
 * 4. استبدال الاستدعاء في الكود
 *    
 * ═══════════════════════════════════════════
 * ملاحظات الترخيص:
 * ═══════════════════════════════════════════
 * - النسخة المدفوعة: ~$299/سنة — تدعم headless mode + stopOnTerminate: false
 * - النسخة المجانية: تعمل لكن بقيود (لا headless, لا startOnBoot)
 * - للإنتاج: النسخة المدفوعة ضرورية لضمان عمل التتبع 24/7
 */

import {
  addLocation,
  getPendingLocations,
  markLocationsSynced,
  purgeOldLocations,
} from './locationDB';

import { isNativePlatform } from '@/lib/capacitorBridge';

export interface LocationData {
  lat:      number;
  lng:      number;
  accuracy: number;
  heading?: number | null;
  speed?:   number | null;
  timestamp: number;
}

export interface NativeLocationOptions {
  driverId:        string;
  rideId:          string;
  updateInterval?: number;   // ms (default 5000)
  minAccuracy?:    number;   // metres (default 50)
}

/**
 * يبدأ التتبع الأصلي عبر Capacitor Background Geolocation
 * يبقى يعمل حتى عند إغلاق الشاشة أو ذهاب التطبيق للخلفية
 */
export async function startNativeTracking(opts: NativeLocationOptions): Promise<void> {
  if (!isNativePlatform) {
    console.warn('[NativeLocation] ليس تطبيق أصلي — استخدم backgroundLocationService بدلاً من ذلك');
    return;
  }

  try {
    const BackgroundGeolocation = (await import(
      '@transistorsoft/capacitor-background-geolocation'
    )).default;

    // تكوين الخدمة
    await BackgroundGeolocation.ready({
      // ── إعدادات الموقع ──
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,                    // تحديث كل 10 أمتار
      locationUpdateInterval: opts.updateInterval || 5000,
      fastestLocationUpdateInterval: 2000,

      // ── منع القتل بواسطة Android ──
      stopOnTerminate: false,                // يبقى حتى بعد إغلاق التطبيق
      startOnBoot: true,                     // يبدأ مع تشغيل الجهاز
      foregroundService: true,               // Foreground Service = إشعار دائم

      // ── إعدادات الإشعار (Android) ──
      notification: {
        title: 'ران كابتن 🚗',
        text: 'جارٍ تتبع رحلتك...',
        channelName: 'raan-location-tracking',
        sticky: true,
        smallIcon: 'mipmap/ic_launcher',
        largeIcon: 'mipmap/ic_launcher',
      },

      // ── Headless mode (يعمل بدون UI) ──
      enableHeadless: true,

      // ── تقليل استهلاك البطارية ──
      preventSuspend: true,
      heartbeatInterval: 60,                 // نبض كل 60 ثانية

      // ── عدم إرسال للسيرفر تلقائياً (نتحكم يدوياً) ──
      autoSync: false,
    });

    // ── مستمع تحديث الموقع ──
    BackgroundGeolocation.onLocation(async (location) => {
      const loc: LocationData = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: new Date(location.timestamp).getTime(),
      };

      // تخطي المواقع ذات الدقة المنخفضة
      if (loc.accuracy > (opts.minAccuracy || 50)) return;

      console.log(
        `[NativeLocation] ${loc.lat.toFixed(5)},${loc.lng.toFixed(5)} ±${loc.accuracy.toFixed(0)}m`
      );

      // 1. كتابة IndexedDB أولاً (يبقى حتى بدون إنترنت)
      const localId = await addLocation({
        driver_id: opts.driverId,
        ride_id: opts.rideId,
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        heading: loc.heading,
        speed: loc.speed,
        timestamp: loc.timestamp,
      });

      // 2. محاولة الإرسال لـ Supabase
      if (navigator.onLine) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { error } = await supabase
            .from('driver_live_locations' as any)
            .upsert({
              ride_id: opts.rideId,
              driver_id: opts.driverId,
              location: { lat: loc.lat, lng: loc.lng },
              heading: loc.heading ?? null,
              speed: loc.speed ?? null,
              accuracy: loc.accuracy,
              updated_at: new Date(loc.timestamp).toISOString(),
            }, { onConflict: 'ride_id' });

          if (!error) {
            await markLocationsSynced([localId]);
          }
        } catch {
          // سيتم المزامنة لاحقاً
        }
      }
    });

    // ── بدء التتبع ──
    await BackgroundGeolocation.start();
    console.log('[NativeLocation] ✅ بدأ التتبع الأصلي بنجاح');

  } catch (error) {
    console.error('[NativeLocation] فشل بدء التتبع:', error);
    throw error;
  }
}

/**
 * إيقاف التتبع الأصلي
 */
export async function stopNativeTracking(): Promise<void> {
  if (!isNativePlatform) return;

  try {
    const BackgroundGeolocation = (await import(
      '@transistorsoft/capacitor-background-geolocation'
    )).default;

    await BackgroundGeolocation.stop();

    // مزامنة المواقع المعلقة
    await syncPendingLocations();

    // تنظيف المواقع القديمة
    await purgeOldLocations();

    console.log('[NativeLocation] ⏹ تم إيقاف التتبع');
  } catch (error) {
    console.error('[NativeLocation] فشل إيقاف التتبع:', error);
  }
}

/**
 * مزامنة المواقع المعلقة (بعد استعادة الإنترنت)
 */
async function syncPendingLocations(): Promise<void> {
  if (!navigator.onLine) return;

  // استخدام نفس منطق backgroundLocationService
  // (لا تكرار — الملف يستورد من locationDB مباشرة)
  const pending = await getPendingLocations('');
  if (!pending.length) return;

  console.log(`[NativeLocation] مزامنة ${pending.length} موقع معلق...`);

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const synced: number[] = [];

    for (const loc of pending) {
      const { error } = await supabase
        .from('driver_live_locations' as any)
        .upsert({
          ride_id: loc.ride_id,
          driver_id: loc.driver_id,
          location: { lat: loc.lat, lng: loc.lng },
          heading: loc.heading ?? null,
          speed: loc.speed ?? null,
          accuracy: loc.accuracy,
          is_offline: true,
          updated_at: new Date(loc.timestamp).toISOString(),
        }, { onConflict: 'ride_id' });

      if (!error && loc.id) synced.push(loc.id);
    }

    if (synced.length) {
      await markLocationsSynced(synced);
      console.log(`[NativeLocation] ✅ تمت مزامنة ${synced.length}/${pending.length} موقع`);
    }
  } catch (error) {
    console.error('[NativeLocation] فشل المزامنة:', error);
  }
}
