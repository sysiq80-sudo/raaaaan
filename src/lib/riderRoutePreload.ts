type RoutePreloader = () => Promise<unknown>;

const loaded = new Set<string>();

const preload = (key: string, loader?: RoutePreloader) => {
  if (!loader || loaded.has(key)) return;
  loaded.add(key);
  void loader().catch(() => {
    loaded.delete(key);
  });
};

const riderPreloaders: Record<string, RoutePreloader> = {
  "/rider": () => import("@/components/rider/AIVoiceHome"),
  "/rider/go": () => import("@/pages/rider/GoPage"),
  "/rider/rides": () => import("@/pages/rider/RiderRidesPage"),
  "/rider/payments": () => import("@/pages/rider/RiderPaymentsPage"),
  "/rider/wallet-topup": () => import("@/pages/rider/WalletTopupPage"),
  "/rider/saved-places": () => import("@/pages/rider/RiderSavedPlacesPage"),
  "/rider/settings": () => import("@/pages/rider/RiderSettingsPage"),
  "/help": () => import("@/pages/HelpAndContact"),
};

export const preloadRiderRoute = (path: string) => {
  preload(path, riderPreloaders[path]);
};
