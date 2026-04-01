import { createRoot } from "react-dom/client";
import CarApp from "./CarApp";
import "@/index.css";
import { initCapacitorPlugins } from "@/lib/capacitorBridge";
import { initSentry } from "@/lib/sentry";

initSentry();
initCapacitorPlugins();

// علامة وضع السيارة على مستوى المستند لعزل أي تنسيقات car-mode.
document.documentElement.setAttribute("data-app-mode", "car");

// هذا المفتاح يضمن أن أي جزء يعتمد الدور سيبقى ضمن سياق السائق
localStorage.setItem("raan_current_role", "driver");

createRoot(document.getElementById("root")!).render(<CarApp />);
