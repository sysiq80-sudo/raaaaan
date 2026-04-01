import type {
  InVehicleAdapter,
  InVehicleEvent,
  InVehiclePlatform,
  InVehicleSessionContext,
} from "@/types/inVehicle";

export abstract class BaseInVehicleAdapter implements InVehicleAdapter {
  readonly platform: InVehiclePlatform;
  protected context: InVehicleSessionContext | null = null;

  protected constructor(platform: InVehiclePlatform) {
    this.platform = platform;
  }

  async init(context: InVehicleSessionContext): Promise<void> {
    this.context = context;
  }

  isAvailable(): boolean {
    return false;
  }

  async publishEvent(event: InVehicleEvent): Promise<void> {
    console.log("[InVehicle] event", this.platform, event.type, event.rideId || "-");
  }

  async dispose(): Promise<void> {
    this.context = null;
  }
}
