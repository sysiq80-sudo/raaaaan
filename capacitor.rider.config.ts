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

const config: CapacitorConfig = {
  appId: 'com.raan.rider',
  appName: 'ران',
  webDir: 'dist-rider',

  server: {
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
    allowMixedContent: true,
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
  },
};

export default config;
