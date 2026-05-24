import { BaseInVehicleAdapter } from "@/services/inVehicle/baseInVehicleAdapter";

export class CarPlayAdapter extends BaseInVehicleAdapter {
  constructor() {
    super("carplay");
  }

  isAvailable(): boolean {
    // In local browser development we simulate availability.
    if (import.meta.env.DEV && typeof window !== "undefined") return true;

    // Placeholder until native iOS CarPlay bridge is added.
    return false;
  }
}
