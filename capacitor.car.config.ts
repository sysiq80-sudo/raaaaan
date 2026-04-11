/**
 * ران RAAN Car — إعدادات Capacitor لتطبيق السيارة
 *
 * appId: com.raan.car
 * appName: ران سيارة
 * webDir: dist-car
 */
import type { CapacitorConfig } from "@capacitor/cli";

const DEV_IP = process.env.DEV_SERVER_IP;
const IS_DEV = !!DEV_IP;

const config: CapacitorConfig = {
  appId: "com.raan.car",
  appName: "ران سيارة",
  webDir: "dist-car",

  server: {
    ...(IS_DEV ? { url: `http://${DEV_IP}:8084`, cleartext: true } : {}),
    androidScheme: "https",
    allowNavigation: [
      "https://maps.googleapis.com",
      "https://maps.google.com",
      "https://maps.gstatic.com",
      "https://wgolkcztdrwdphwjvqxt.supabase.co",
      "http://localhost",
      "https://localhost",
      "capacitor://localhost",
    ],
  },

  android: {
    allowMixedContent: IS_DEV,
    backgroundColor: "#0a0f14",
  },

  plugins: {
    Geolocation: {},
    LocalNotifications: {
      smallIcon: "ic_transparent",
      iconColor: "#10b981",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: "#0a0f14",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#00000000",
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
    KeepAwake: {},       // إبقاء شاشة السيارة مضاءة
  },
};

export default config;
