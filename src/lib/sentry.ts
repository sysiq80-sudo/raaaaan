/**
 * ران — تهيئة Sentry لتتبع الأخطاء في الإنتاج
 * RAAN — Sentry Error Tracking
 */
import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log("[Sentry] ⏭️ DSN غير مكوّن — تتبع الأخطاء معطّل");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: `raan@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,
    // ⚡ تقليل حمل Tracing — أخف على WebView
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 0.5,
    enabled: !!SENTRY_DSN,
    ignoreErrors: [
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      "AbortError",
      "ResizeObserver loop",
      "Non-Error promise rejection",
    ],
    beforeSend(event) {
      return event;
    },
  });

  console.log("[Sentry] ✅ تتبع الأخطاء مفعّل");
}

/** تعيين هوية المستخدم لربط الأخطاء بالمستخدم */
export function setSentryUser(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser({ id: user.id, email: user.email });
  if (user.role) Sentry.setTag("user_role", user.role);
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export { Sentry };
