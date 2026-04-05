/// <reference types="vite/client" />

/** نوع التطبيق المستقل — يُعرَّف في vite.rider.config.ts / vite.driver.config.ts / vite.admin.config.ts / vite.car.config.ts */
declare const __APP_MODE__: 'rider' | 'driver' | 'admin' | 'car' | undefined;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}
