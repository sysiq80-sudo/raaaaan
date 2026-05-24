export type InVehiclePlatform = "none" | "android_auto" | "carplay";

export type InVehicleEventType =
  | "session_started"
  | "session_stopped"
  | "ride_offer_received"
  | "ride_offer_accepted"
  | "ride_offer_rejected"
  | "navigation_started"
  | "navigation_stopped";

export interface InVehicleEvent {
  type: InVehicleEventType;
  rideId?: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface InVehicleRideCardModel {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFareIqd: number;
  distanceKm: number;
  riderName?: string;
}

export interface InVehicleSessionContext {
  driverId: string;
  language: "ar" | "en" | "ku";
  isOnline: boolean;
}

export interface InVehicleAdapter {
  readonly platform: InVehiclePlatform;
  init(context: InVehicleSessionContext): Promise<void>;
  isAvailable(): boolean;
  publishEvent(event: InVehicleEvent): Promise<void>;
  dispose(): Promise<void>;
}
