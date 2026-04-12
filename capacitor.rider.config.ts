/**
 * ران — إعدادات Capacitor لتطبيق الراكب
 * 
 * appId: com.raan.rider
 * appName: ران
 * webDir: dist-rider
 * 
 * الاستخدام:
 *   npm run build:rider
 *   npx cap sync --config capacitor.rider.config.ts android
 */
import type { CapacitorConfig } from '@capacitor/cli';

// فقط في التطوير: اضبط DEV_SERVER_IP لتفعيل hot reload
// في الإنتاج: لا تضبطه — Capacitor يحمّل من webDir مباشرة
const DEV_IP = process.env.DEV_SERVER_IP;
const IS_DEV = !!DEV_IP;

const config: CapacitorConfig = {
  appId: 'com.raan.rider',
  appName: 'RAAN | ران',
  webDir: 'dist-rider',

  server: {
    ...(IS_DEV ? { url: `http://${DEV_IP}:8081`, cleartext: true } : {}),
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
    TextToSpeech: {},    // نطق حالة الرحلة صوتياً
    SpeechRecognition: {}, // واجهة الراكب الصوتية
  },
};

export default config;
