import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./lib/i18nConfig"; // تهيئة i18next قبل أي شيء
import "mapbox-gl/dist/mapbox-gl.css"; // ✅ FIX: إصلاح الخرائط — يجب أن يكون قبل index.css
import "./index.css";
import { registerServiceWorker } from "./utils/serviceWorker";
import { supabase } from "./integrations/supabase/client";
import { initCapacitorPlugins, isNativePlatform } from "./lib/capacitorBridge";
import { initUserGestureTracking } from "./lib/userGestureTracker";
import { validateEnv } from "./lib/validateEnv";

// التحقق من متغيرات البيئة
validateEnv();

// ⚡ تهيئة Sentry — يجب أن يكون أول شيء قبل createRoot
try {
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN || "";
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      sendDefaultPii: true,
      environment: import.meta.env.MODE,
      release: `raan@${import.meta.env.VITE_APP_VERSION || "1.0.0"}`,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      initialScope: {
        tags: { platform: isMobile ? "mobile" : "web" },
      },
      integrations: [
        Sentry.browserTracingIntegration(),
        // Replay معطّل على الجوال — ثقيل جداً على WebView
        ...(!isMobile ? [Sentry.replayIntegration()] : []),
      ],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
} catch (e) {
  console.error('[Sentry] فشل في التهيئة:', e);
}

// تهيئة إضافات Capacitor (إذا كنا داخل التطبيق الأصلي)
initCapacitorPlugins();

// تتبع تفاعل المستخدم (مطلوب لـ navigator.vibrate)
initUserGestureTracking();

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
  'RealtimeChannel REST fallback',                   // تحذير سوبابيس الداخلي
  'google.maps.Marker is deprecated',                // تحذير جوجل المستقبلي
  'Non-serializable values were found',              // تحذير React Navigation
  'google.maps.DirectionsService is deprecated',     // تحذير جوجل — لم يُوقف بعد
  'google.maps.DirectionsRenderer is deprecated',    // نفس المجموعة
];
console.warn = (...args: any[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (SUPPRESSED_WARNINGS.some((s) => msg.includes(s))) return;
  _origWarn.apply(console, args);
};

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

import React from 'react';
import { hydrateFromNativeStorage } from './lib/capacitorStorage';

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// استعادة الجلسة من التخزين الأصلي قبل تهيئة التطبيق (مع مهلة 3 ثوانٍ)
Promise.race([
  hydrateFromNativeStorage(),
  new Promise((resolve) => setTimeout(resolve, 1000)), // ✅ FIX: كان 3000ms — 1s كافية للعلامة التجارية
]).finally(() => {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
