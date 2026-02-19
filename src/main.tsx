import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./utils/serviceWorker";
import { supabase } from "./integrations/supabase/client";

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

// Google Maps API will be loaded by @react-google-maps/api wrapper
// RTL support is natively handled by Google Maps for Arabic text

// Register Service Worker only after auth session is validated
let serviceWorkerRegistered = false;

if ("serviceWorker" in navigator && !serviceWorkerRegistered) {
  window.addEventListener("load", async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && !serviceWorkerRegistered) {
        const registration = await registerServiceWorker();
        if (registration) {
          serviceWorkerRegistered = true;
          console.log("✅ Service Worker registered successfully");
        }
      } else {
        console.log("⏳ Service Worker deferred - no active session");
      }
    } catch (error) {
      console.error("SW registration check failed:", error);
    }
  });

  // Also register when user signs in later (only once)
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" && !serviceWorkerRegistered) {
      registerServiceWorker().then((registration) => {
        if (registration) {
          serviceWorkerRegistered = true;
          console.log("✅ Service Worker registered after sign-in");
        }
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
