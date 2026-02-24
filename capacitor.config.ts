/**
 * ران RAAN — Capacitor Configuration
 * 
 * إعدادات تغليف تطبيق الويب كتطبيق Android أصلي
 * يُستخدم لإنشاء APK للسائقين (كابتن ران)
 * 
 * لبناء APK:
 *   1. npm run build
 *   2. npx cap sync android
 *   3. npx cap open android  (يفتح Android Studio)
 *   4. Build > Generate Signed APK
 * 
 * أو بدون Android Studio:
 *   cd android && ./gradlew assembleDebug
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raan.captain',
  appName: 'ران كابتن',
  webDir: 'dist',
  
  // إعدادات الخادم — استخدم الملفات المبنية (لا خادم خارجي)
  server: {
    // للتطوير المحلي: افتح التعليق عن السطرين التاليين
    // url: 'http://192.168.1.x:5173',
    // cleartext: true,
    androidScheme: 'https',
    // السماح بالتنقل لروابط خارجية (Google Maps, WhatsApp)
    allowNavigation: [
      'https://maps.googleapis.com',
      'https://maps.google.com',
      'https://maps.gstatic.com',
      'https://wgolkcztdrwdphwjvqxt.supabase.co',
      'https://api.mapbox.com',
      'https://tile.openstreetmap.org',
      'http://localhost',
      'https://localhost',
      'capacitor://localhost',
    ],
  },

  // إعدادات Android
  android: {
    // السماح بالمحتوى المختلط (HTTP + HTTPS) للتطوير
    allowMixedContent: true,
    // ألوان شريط الحالة
    backgroundColor: '#0a0f14',
    // إبقاء التطبيق مستيقظاً
    // يتم التحكم به برمجياً عبر Wake Lock API
  },

  // إعدادات الإضافات
  plugins: {
    // تحديد الموقع — GPS عالي الدقة
    Geolocation: {
      // طلب إذن الموقع دائماً (حتى في الخلفية)
    },

    // الإشعارات المحلية
    LocalNotifications: {
      // أيقونة صغيرة للإشعارات
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#10b981',
      // قنوات الإشعارات لـ Android 8+
      // sound: 'raan_alert.wav', // يمكن إضافة صوت مخصص لاحقاً
    },

    // إشعارات Push
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // شاشة البداية
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0a0f14',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },

    // شريط الحالة — شفاف مع وضع overlay لدعم Safe Area
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#00000000',
      overlaysWebView: true,
    },
  },
};

export default config;
