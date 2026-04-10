import { createRoot } from "react-dom/client";
import RiderApp from "./RiderApp";
import "@/index.css";
import { initCapacitorPlugins } from "@/lib/capacitorBridge";
import { initUserGestureTracking } from "@/lib/userGestureTracker";
import { initSentry } from "@/lib/sentry";
import { hydrateFromNativeStorage } from "@/lib/capacitorStorage";

// تهيئة Sentry
try {
  initSentry();
} catch (error) {
  console.error("❌ خطأ في تهيئة Sentry:", error);
}

// تهيئة Capacitor
try {
  initCapacitorPlugins();
} catch (error) {
  console.error("❌ خطأ في تهيئة Capacitor:", error);
}

// تتبع تفاعل المستخدم
try {
  initUserGestureTracking();
} catch (error) {
  console.error("❌ خطأ في تتبع تفاعل المستخدم:", error);
}

declare global {
  interface Window {
    google?: any;
  }
}

// إسكات التحذيرات
const _origWarn = console.warn;
const SUPPRESSED_WARNINGS = [
  'RealtimeChannel REST fallback',
  'google.maps.Marker is deprecated',
  'google.maps.DirectionsService is deprecated',
  'google.maps.DirectionsRenderer is deprecated',
];
console.warn = (...args: any[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (SUPPRESSED_WARNINGS.some((s) => msg.includes(s))) return;
  _origWarn.apply(console, args);
};

// استعادة الجلسة من التخزين الأصلي قبل تهيئة التطبيق (مع مهلة 3 ثوانٍ)
Promise.race([
  hydrateFromNativeStorage(),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]).finally(() => {
  try {
    createRoot(document.getElementById("root")!).render(<RiderApp />);
  } catch (error) {
    console.error("❌ خطأ في عرض التطبيق:", error);
  }
});
