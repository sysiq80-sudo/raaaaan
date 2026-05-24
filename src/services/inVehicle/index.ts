import { AndroidAutoAdapter } from "@/services/inVehicle/androidAutoAdapter";
import { BaseInVehicleAdapter } from "@/services/inVehicle/baseInVehicleAdapter";
import { CarPlayAdapter } from "@/services/inVehicle/carPlayAdapter";
import type { InVehicleAdapter, InVehiclePlatform } from "@/types/inVehicle";

class NoopInVehicleAdapter extends BaseInVehicleAdapter {
  constructor() {
    super("none");
  }

  isAvailable(): boolean {
    return false;
  }
}

export function createInVehicleAdapter(platform: InVehiclePlatform): InVehicleAdapter {
  if (platform === "android_auto") return new AndroidAutoAdapter();
  if (platform === "carplay") return new CarPlayAdapter();
  return new NoopInVehicleAdapter();
}

export function getConfiguredInVehiclePlatform(): InVehiclePlatform {
  const raw = (import.meta.env.VITE_IN_VEHICLE_PLATFORM || "none").toString().toLowerCase();

  // In local browser development, auto-enable a simulated platform
  // so the car app can be tested without native Android Auto/CarPlay bridges.
  if (raw === "none" && import.meta.env.DEV && typeof window !== "undefined") {
    return "android_auto";
  }

  if (raw === "android_auto") return "android_auto";
  if (raw === "carplay") return "carplay";
  return "none";
}
