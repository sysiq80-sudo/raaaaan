import { describe, expect, it, vi } from "vitest";
import {
  buildRideStopsPayload,
  checkServiceAreaWithRetry,
  isCoordinateInIraq,
  validateRideLocations,
  withTimeout,
} from "./riderBooking";

describe("riderBooking helpers", () => {
  it("validates Iraqi coordinate bounds", () => {
    expect(isCoordinateInIraq({ lat: 33.4233, lng: 43.2974 })).toBe(true);
    expect(isCoordinateInIraq({ lat: 25.2048, lng: 55.2708 })).toBe(false);
  });

  it("rejects missing booking locations", () => {
    expect(validateRideLocations(null, { lat: 33.4, lng: 43.3 }).ok).toBe(false);
  });

  it("accepts nearby pickup and dropoff locations (no minimum distance)", () => {
    expect(
      validateRideLocations(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.42331, lng: 43.29741 },
      ),
    ).toMatchObject({ ok: true });
  });

  it("accepts valid pickup and dropoff locations", () => {
    expect(
      validateRideLocations(
        { lat: 33.4233, lng: 43.2974 },
        { lat: 33.3128, lng: 44.3615 },
      ),
    ).toMatchObject({ ok: true });
  });

  it("builds a stops payload without empty stops", () => {
    expect(
      buildRideStopsPayload([
        { id: "a", address: "A", location: { lat: 33, lng: 43 } },
        { id: "b", address: "B", location: null },
      ]),
    ).toEqual([{ id: "a", address: "A", lat: 33, lng: 43 }]);
  });

  it("times out slow promises", async () => {
    await expect(
      withTimeout(new Promise((resolve) => setTimeout(resolve, 30)), 1, "slow"),
    ).rejects.toThrow("انتهت مهلة slow");
  });

  it("retries service checks once when the first result is out of service", async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({ in_service: false })
      .mockResolvedValueOnce({ in_service: true });

    await expect(checkServiceAreaWithRetry(check, 33, 43, "service")).resolves.toEqual({
      in_service: true,
    });
    expect(check).toHaveBeenCalledTimes(2);
  });
});
