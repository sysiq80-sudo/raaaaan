type RoutePreloader = () => Promise<unknown>;

const loaded = new Set<string>();

const preload = (key: string, loader?: RoutePreloader) => {
  if (!loader || loaded.has(key)) return;
  loaded.add(key);
  void loader().catch(() => {
    loaded.delete(key);
  });
};

const driverPreloaders: Record<string, RoutePreloader> = {
  "/driver/rides": () => import("@/pages/driver/DriverRides"),
  "/driver/finance": () => import("@/pages/driver/DriverFinance"),
  "/driver/payments": () => import("@/pages/driver/DriverFinance"),
  "/driver/profile": () => import("@/pages/driver/DriverProfile"),
  "/driver/statistics": () => import("@/pages/driver/DriverStatistics"),
  "/driver/settings": () => import("@/pages/driver/DriverSettings"),
  "/driver/incentives": () => import("@/pages/driver/DriverIncentives"),
  "/driver/application-status": () => import("@/pages/driver/DriverApplicationStatus"),
  "/help": () => import("@/pages/HelpAndContact"),
};

export const preloadDriverRoute = (path: string) => {
  preload(path, driverPreloaders[path]);
};
