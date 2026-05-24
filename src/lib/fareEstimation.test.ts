/**
 * اختبارات وحدة لمنطق حساب الأجرة — RAAN
 * Unit tests for fare estimation pure logic
 *
 * نختبر الحسابات الرياضية مباشرة بدون React hooks
 */
import { describe, it, expect } from "vitest";

// ---- المعاملات الافتراضية (مطابقة لـ useRegionFares + useVehicleTypes) ----
const DEFAULT_BASE_FARE = 2000;
const DEFAULT_PER_KM = 500;
const MULTIPLIERS: Record<string, number> = {
  economy: 1.0,
  comfort: 1.3,
  premium: 1.8,
  women_only: 1.2,
};

/**
 * نسخة مستخلصة من estimateFareLocally في useFareCalculation.ts
 * تُعيد نفس الحساب تماماً:
 *   subtotal = max(baseFare, baseFare + distanceFare)
 *   total    = round(subtotal × vehicleMultiplier)
 */
function estimateFare(
  distanceKm: number,
  vehicleType: string,
  baseFare = DEFAULT_BASE_FARE,
  perKmRate = DEFAULT_PER_KM,
) {
  const vehicleMultiplier = MULTIPLIERS[vehicleType] ?? 1;
  const distanceFare = distanceKm * perKmRate;
  const subtotal = Math.max(baseFare, baseFare + distanceFare);
  const totalFare = Math.round(subtotal * vehicleMultiplier);

  return { baseFare, distanceFare, subtotal, vehicleMultiplier, totalFare };
}

// ----------- الاختبارات -----------

describe("estimateFare — حساب اقتصادي", () => {
  it("5 كم × اقتصادي = 4,500 د.ع", () => {
    const result = estimateFare(5, "economy");
    // 2000 + (5 × 500) = 4500, × 1.0 = 4500
    expect(result.totalFare).toBe(4500);
    expect(result.distanceFare).toBe(2500);
    expect(result.subtotal).toBe(4500);
  });

  it("0 كم = الحد الأدنى (base_fare فقط)", () => {
    const result = estimateFare(0, "economy");
    expect(result.totalFare).toBe(DEFAULT_BASE_FARE);
  });

  it("10 كم = 7,000 د.ع", () => {
    const result = estimateFare(10, "economy");
    // 2000 + (10 × 500) = 7000
    expect(result.totalFare).toBe(7000);
  });
});

describe("estimateFare — معاملات أنواع المركبات", () => {
  const distanceKm = 10; // subtotal = 2000 + 5000 = 7000

  it("comfort 1.3× → 9,100", () => {
    expect(estimateFare(distanceKm, "comfort").totalFare).toBe(9100);
  });

  it("premium 1.8× → 12,600", () => {
    expect(estimateFare(distanceKm, "premium").totalFare).toBe(12600);
  });

  it("women_only 1.2× → 8,400", () => {
    expect(estimateFare(distanceKm, "women_only").totalFare).toBe(8400);
  });

  it("نوع مجهول يستخدم معامل 1.0", () => {
    expect(estimateFare(distanceKm, "unknown").totalFare).toBe(7000);
  });
});

describe("estimateFare — أسعار مخصصة لكل منطقة", () => {
  it("منطقة بسعر أعلى — base 3000, per_km 800", () => {
    const result = estimateFare(5, "economy", 3000, 800);
    // 3000 + (5 × 800) = 7000
    expect(result.totalFare).toBe(7000);
  });

  it("منطقة رخيصة — base 1000, per_km 250", () => {
    const result = estimateFare(10, "comfort", 1000, 250);
    // subtotal = 1000 + 2500 = 3500, × 1.3 = 4550
    expect(result.totalFare).toBe(4550);
  });
});

describe("estimateFare — حالات حدّية", () => {
  it("مسافة قصيرة جداً (0.1 كم)", () => {
    const result = estimateFare(0.1, "economy");
    // 2000 + (0.1 × 500) = 2050
    expect(result.totalFare).toBe(2050);
  });

  it("مسافة طويلة جداً (100 كم)", () => {
    const result = estimateFare(100, "economy");
    // 2000 + (100 × 500) = 52000
    expect(result.totalFare).toBe(52000);
  });

  it("totalFare يُقرّب لأقرب عدد صحيح", () => {
    // 3 كم comfort: (2000+1500) × 1.3 = 4550 — بالضبط
    const result = estimateFare(3, "comfort");
    expect(Number.isInteger(result.totalFare)).toBe(true);
    expect(result.totalFare).toBe(4550);
  });
});

// ---- حساب الانتظار (مطابق لـ useRegionFares.calculateFareWithWaiting) ----

describe("fare with waiting — حساب الانتظار", () => {
  const DEFAULT_WAITING_PER_MIN = 200;

  function fareWithWaiting(
    distanceKm: number,
    vehicleType: string,
    waitingMinutes: number,
    waitingFarePerMin = DEFAULT_WAITING_PER_MIN,
  ) {
    const base = estimateFare(distanceKm, vehicleType);
    const waitingFare = Math.round(waitingMinutes * waitingFarePerMin);
    return { ...base, waitingFare, totalFare: base.totalFare + waitingFare };
  }

  it("5 كم + 10 دقائق انتظار = 4500 + 2000 = 6500", () => {
    const r = fareWithWaiting(5, "economy", 10);
    expect(r.waitingFare).toBe(2000);
    expect(r.totalFare).toBe(6500);
  });

  it("0 دقائق انتظار = بدون تكلفة إضافية", () => {
    const r = fareWithWaiting(5, "economy", 0);
    expect(r.waitingFare).toBe(0);
    expect(r.totalFare).toBe(4500);
  });
});
