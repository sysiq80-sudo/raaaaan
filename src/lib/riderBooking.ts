import {
  calculateDistanceMeters,
  type Coordinates,
} from "@/lib/mapUtils";

export const MIN_PICKUP_DROPOFF_DISTANCE_METERS = 100;

export interface BookingLocation extends Coordinates {
  address?: string;
}

export interface BookingStop {
  id: string;
  address: string;
  location: Coordinates | null;
}

export type RideLocationValidation = {
  ok: boolean;
  reason?: "missing_location" | "pickup_dropoff_too_close" | "outside_iraq";
  distanceMeters?: number;
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`انتهت مهلة ${label}`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const isCoordinateInIraq = ({ lat, lng }: Coordinates): boolean =>
  lat >= 29 && lat <= 37.5 && lng >= 38 && lng <= 49;

export const validateRideLocations = (
  pickupLocation: BookingLocation | null,
  dropoffLocation: BookingLocation | null,
): RideLocationValidation => {
  if (!pickupLocation || !dropoffLocation) {
    return { ok: false, reason: "missing_location" };
  }

  const distanceMeters = calculateDistanceMeters(pickupLocation, dropoffLocation);
  if (distanceMeters < MIN_PICKUP_DROPOFF_DISTANCE_METERS) {
    return {
      ok: false,
      reason: "pickup_dropoff_too_close",
      distanceMeters,
    };
  }

  if (
    !isCoordinateInIraq(pickupLocation) ||
    !isCoordinateInIraq(dropoffLocation)
  ) {
    return { ok: false, reason: "outside_iraq" };
  }

  return { ok: true, distanceMeters };
};

export const buildRideStopsPayload = (
  stops: BookingStop[],
): Record<string, unknown>[] =>
  stops
    .filter((stop): stop is BookingStop & { location: Coordinates } =>
      Boolean(stop.location),
    )
    .map((stop) => ({
      id: stop.id,
      lat: stop.location.lat,
      lng: stop.location.lng,
      address: stop.address,
    }));

export const checkServiceAreaWithRetry = async <
  T extends { in_service: boolean } | null,
>(
  checkServiceArea: (lat: number, lng: number) => Promise<T>,
  lat: number,
  lng: number,
  timeoutLabel: string,
): Promise<T> => {
  const firstCheck = await withTimeout(
    checkServiceArea(lat, lng),
    3000,
    timeoutLabel,
  );

  if (firstCheck && !firstCheck.in_service) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const secondCheck = await withTimeout(
      checkServiceArea(lat, lng),
      3000,
      `${timeoutLabel} (إعادة محاولة)`,
    );
    return secondCheck || firstCheck;
  }

  return firstCheck;
};
