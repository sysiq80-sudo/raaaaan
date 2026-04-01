/**
 * ران RAAN Car — إعدادات Capacitor لتطبيق السيارة
 *
 * appId: com.raan.car
 * appName: ران سيارة
 * webDir: dist-car
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.raan.car",
  appName: "ران سيارة",
  webDir: "dist-car",

  server: {
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
    allowMixedContent: true,
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
      launchShowDuration: 2000,
      backgroundColor: "#0a0f14",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
  },
};

export default config;
