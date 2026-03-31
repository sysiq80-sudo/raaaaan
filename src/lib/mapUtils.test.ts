/**
 * اختبارات وحدة لأدوات الخرائط — RAAN
 * Unit tests for map utility functions
 */
import { describe, it, expect } from "vitest";
import { calculateLocalDistance, calculateDistanceMeters } from "@/lib/mapUtils";
import type { Coordinates } from "@/lib/mapUtils";

describe("calculateLocalDistance", () => {
  it("يحسب المسافة بين نقطتين معروفتين في بغداد", () => {
    // ساحة التحرير → المنصور (~5 كم تقريباً)
    const from: Coordinates = { lat: 33.3386, lng: 44.3866 }; // ساحة التحرير
    const to: Coordinates = { lat: 33.3127, lng: 44.3475 };   // المنصور

    const distance = calculateLocalDistance(from, to);
    // المسافة المباشرة ~4.5 كم
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(7);
  });

  it("يرجع 0 عندما النقطتين نفسهن", () => {
    const point: Coordinates = { lat: 33.3, lng: 44.3 };
    const distance = calculateLocalDistance(point, point);
    expect(distance).toBe(0);
  });

  it("يحسب مسافة طويلة — بغداد → البصرة (~460 كم)", () => {
    const baghdad: Coordinates = { lat: 33.3152, lng: 44.3661 };
    const basra: Coordinates = { lat: 30.5085, lng: 47.7804 };

    const distance = calculateLocalDistance(baghdad, basra);
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(550);
  });
});

describe("calculateDistanceMeters", () => {
  it("يحول الكيلومترات لأمتار بشكل صحيح", () => {
    const from: Coordinates = { lat: 33.3386, lng: 44.3866 };
    const to: Coordinates = { lat: 33.3396, lng: 44.3876 };

    const distanceKm = calculateLocalDistance(from, to);
    const distanceM = calculateDistanceMeters(from, to);

    expect(distanceM).toBeCloseTo(distanceKm * 1000, 0);
  });

  it("مسافة قصيرة بين نقطتين قريبتين (100-200م)", () => {
    // نقطتين على نفس الشارع تقريباً
    const from: Coordinates = { lat: 33.3386, lng: 44.3866 };
    const to: Coordinates = { lat: 33.3396, lng: 44.3866 };

    const distance = calculateDistanceMeters(from, to);
    expect(distance).toBeGreaterThan(50);
    expect(distance).toBeLessThan(200);
  });
});
