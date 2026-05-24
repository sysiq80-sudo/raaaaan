import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp";
import "@/index.css";
import { initSentry } from "@/lib/sentry";

// تهيئة Sentry
try { initSentry(); } catch (e) { console.error('[Sentry] فشل:', e); }

declare global {
  interface Window {
    google?: any;
  }
}

createRoot(document.getElementById("root")!).render(<AdminApp />);
