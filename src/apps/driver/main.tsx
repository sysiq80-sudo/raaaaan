import { createRoot } from "react-dom/client";
import DriverApp from "./DriverApp";
import "@/index.css";
import { initCapacitorPlugins } from "@/lib/capacitorBridge";
import { initUserGestureTracking } from "@/lib/userGestureTracker";
import { initSentry } from "@/lib/sentry";

// تهيئة Sentry
initSentry();

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
