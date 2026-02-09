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

// Google Maps API will be loaded by @react-google-maps/api wrapper
// RTL support is natively handled by Google Maps for Arabic text

// Register Service Worker only after auth session is validated
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const registration = await registerServiceWorker();
        if (registration) {
          console.log('Service Worker registered successfully');
        }
      } else {
        console.log('⏳ Service Worker deferred - no active session');
      }
    } catch (error) {
      console.error('SW registration check failed:', error);
    }
  });

  // Also register when user signs in later
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      registerServiceWorker().then((registration) => {
        if (registration) {
          console.log('Service Worker registered after sign-in');
        }
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);

