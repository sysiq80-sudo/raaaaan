import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./utils/serviceWorker";

// Load Google Maps JavaScript API at runtime
declare global {
  interface Window {
    google?: any;
  }
}

// Google Maps API will be loaded by @react-google-maps/api wrapper
// RTL support is natively handled by Google Maps for Arabic text

// Register Service Worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().then((registration) => {
      if (registration) {
        console.log('Service Worker registered successfully');
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

