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
  appName: 'ران كابتن',
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
  },
};

export default config;
