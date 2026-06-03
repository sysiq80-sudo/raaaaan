import { createRoot } from "react-dom/client";
import DriverApp from "./DriverApp";
import "@/index.css";
import { initCapacitorPlugins, isNativePlatform } from "@/lib/capacitorBridge";
import { initUserGestureTracking } from "@/lib/userGestureTracker";

if (isNativePlatform || window.matchMedia("(display-mode: standalone)").matches) {
  document.documentElement.classList.add("app-shell");
}

// ⚡ Sentry يُحمّل بعد العرض الأول — لا يُبطئ البداية
const deferredInit = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 2000);
deferredInit(() => {
  import("@/lib/sentry").then(({ initSentry }) => {
    try { initSentry(); } catch (e) { console.error("[Sentry] فشل:", e); }
  });
});

// تهيئة Capacitor
initCapacitorPlugins();

// تتبع تفاعل المستخدم
initUserGestureTracking();

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

createRoot(document.getElementById("root")!).render(<DriverApp />);
