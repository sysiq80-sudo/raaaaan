/**
 * ران كابتن — إعدادات Capacitor لتطبيق السائق
 * 
 * appId: com.raan.captain
 * appName: ران كابتن
 * webDir: dist-driver
 * 
 * الاستخدام:
 *   npm run build:driver
 *   npx cap sync --config capacitor.driver.config.ts android
 */
import type { CapacitorConfig } from '@capacitor/cli';

const DEV_IP = process.env.DEV_SERVER_IP;
const IS_DEV = !!DEV_IP;

const config: CapacitorConfig = {
  appId: 'com.raan.captain',
  appName: 'كابتن ران',
  webDir: 'dist-driver',

  server: {
    ...(IS_DEV ? { url: `http://${DEV_IP}:8082`, cleartext: true } : {}),
    androidScheme: 'https',
    allowNavigation: [
      'https://maps.googleapis.com',
      'https://maps.google.com',
      'https://maps.gstatic.com',
      'https://wgolkcztdrwdphwjvqxt.supabase.co',
      'http://localhost',
      'https://localhost',
      'capacitor://localhost',
    ],
  },

  android: {
    allowMixedContent: IS_DEV,
    backgroundColor: '#0a0f14',
  },

  plugins: {
    Geolocation: {},
    BackgroundGeolocation: {
      // إعدادات لمكافحة Doze Mode في أجهزة شاومي وسامسونج
      desiredAccuracy: 10, // دقة عالية
      distanceFilter: 50, // تحديث كل 50 متر
      stopOnTerminate: false, // استمرار عند إغلاق التطبيق
      startOnBoot: true, // بدء عند تشغيل الجهاز
      foregroundService: true, // خدمة أمامية لتجنب القتل
      notificationTitle: 'ران كابتن - تتبع الموقع',
      notificationText: 'جاري تتبع موقعك للرحلات',
      heartbeatInterval: 60, // فحص كل دقيقة
      preventSuspend: true, // منع التعليق
      stationaryRadius: 25, // نطاق ثابت
      activityRecognitionInterval: 10000, // فحص النشاط كل 10 ثوانٍ
      // إعدادات البطارية
      disableStopDetection: true, // تعطيل كشف التوقف لتوفير البطارية
      pausesLocationUpdatesAutomatically: false, // عدم إيقاف التحديثات تلقائياً
    },
    LocalNotifications: {
      smallIcon: 'ic_transparent',
      iconColor: '#10b981',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#0a0f14',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#00000000',
      overlaysWebView: true,
    },
    Haptics: {},
    Keyboard: {
      resize: 'none',
      style: 'dark',
    },
    Network: {},
    App: {},
    // ═══ إضافات مُفعَّلة (كانت مثبتة لكن غير مُعلنة) ═══
    Device: {},
    Preferences: {},
    Browser: {},
    KeepAwake: {},       // إبقاء الشاشة مضاءة أثناء الرحلة
    TextToSpeech: {},    // نطق "طلب جديد يبعد 2 كم" صوتياً
    SpeechRecognition: {}, // أوامر صوتية عربية
  },
};

export default config;
