import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp";
import "@/index.css";
import { initSentry } from "@/lib/sentry";

// تهيئة Sentry
initSentry();

declare global {
  interface Window {
    google?: any;
  }
}

createRoot(document.getElementById("root")!).render(<AdminApp />);
