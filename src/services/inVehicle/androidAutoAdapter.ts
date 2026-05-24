import { BaseInVehicleAdapter } from "@/services/inVehicle/baseInVehicleAdapter";

export class AndroidAutoAdapter extends BaseInVehicleAdapter {
  constructor() {
    super("android_auto");
  }

  isAvailable(): boolean {
    // In local browser development we simulate availability.
    if (import.meta.env.DEV && typeof window !== "undefined") return true;

    // Placeholder until native Android Auto bridge is added.
    return false;
  }
}
