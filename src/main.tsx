import { createRoot } from "react-dom/client";
import mapboxgl from 'mapbox-gl';
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./utils/serviceWorker";

// Enable RTL text support for Arabic on Mapbox maps
mapboxgl.setRTLTextPlugin(
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
  null,
  true // Lazy load
);

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
