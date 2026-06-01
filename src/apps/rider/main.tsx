import { createRoot } from "react-dom/client";
import RiderApp from "./RiderApp";
import "@/index.css";
import "@/lib/i18nConfig";
import { initCapacitorPlugins, isNativePlatform } from "@/lib/capacitorBridge";
import { initUserGestureTracking } from "@/lib/userGestureTracker";
import { hydrateFromNativeStorage } from "@/lib/capacitorStorage";

// ⚡ تفعيل قشرة تطبيق الجوال — GPU acceleration + momentum scrolling + no rubber band
// هذا ضروري لتطبيق كل تحسينات الأداء في index.css (html.app-shell)
if (isNativePlatform || window.matchMedia('(display-mode: standalone)').matches) {
  document.documentElement.classList.add('app-shell');
}

// ⚡ Sentry يُحمّل بعد العرض الأول — لا يُبطئ البداية
const deferredInit = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 2000);
deferredInit(() => {
  import("@/lib/sentry").then(({ initSentry }) => {
    try { initSentry(); } catch (e) { console.error("[Sentry] فشل:", e); }
  });
});

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
  new Promise((resolve) => setTimeout(resolve, 1000)), // ✅ FIX: كان 3000ms
]).finally(() => {
  try {
    createRoot(document.getElementById("root")!).render(<RiderApp />);
  } catch (error) {
    console.error("❌ خطأ في عرض التطبيق:", error);
  }
});
