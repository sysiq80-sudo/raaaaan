import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./utils/serviceWorker";
import { supabase } from "./integrations/supabase/client";
import { initCapacitorPlugins, isNativePlatform } from "./lib/capacitorBridge";

// تهيئة إضافات Capacitor (إذا كنا داخل التطبيق الأصلي)
initCapacitorPlugins();

// Load Google Maps JavaScript API at runtime
declare global {
  interface Window {
    google?: any;
  }
}

// ═══════════════════════════════════════════════════════════════
// إسكات التحذيرات غير المؤثرة (تنظيف الكونسول)
// ═══════════════════════════════════════════════════════════════
const _origWarn = console.warn;
const SUPPRESSED_WARNINGS = [
  'RealtimeChannel REST fallback',         // تحذير سوبابيس الداخلي
  'google.maps.Marker is deprecated',      // تحذير جوجل المستقبلي
  'Non-serializable values were found',    // تحذير React Navigation
];
console.warn = (...args: any[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (SUPPRESSED_WARNINGS.some((s) => msg.includes(s))) return;
  _origWarn.apply(console, args);
};

// ═══════════════════════════════════════════════════════════════
// ⚡ إزالة Service Worker القديم فوراً لمنع الشاشة البيضاء/السوداء
// يجب تنفيذه قبل أي شيء آخر — يمسح الكاش التالف
// ═══════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    for (const registration of registrations) {
      await registration.unregister();
      console.log('🧹 Unregistered old Service Worker');
    }
    // امسح جميع الكاشات القديمة
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        console.log('🧹 Deleted cache:', name);
      }
    }
  }).catch((err) => console.error('SW cleanup error:', err));
}

// Google Maps API will be loaded by @react-google-maps/api wrapper
// RTL support is natively handled by Google Maps for Arabic text

// ✅ Service Worker — تفعيل الإشعارات و PWA
// Phase 12: Hybrid notification system with offline sync
if ('serviceWorker' in navigator) {
  // Register after app mounts (auth context fully loaded)
  window.addEventListener('load', async () => {
    setTimeout(async () => {
      try {
        await registerServiceWorker();
        console.log('✅ Service Worker registered — PWA ready');
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    }, 1000); // Delay 1s to ensure auth context is ready
  });
}

createRoot(document.getElementById("root")!).render(<App />);
