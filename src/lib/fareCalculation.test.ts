import { describe, it, expect } from 'vitest';
import {
  calculateFare,
  validateDistance,
  DEFAULT_VEHICLE_MULTIPLIERS,
  MAX_SURGE_MULTIPLIER,
  DEFAULT_CITY_SPEED_KMH,
  type FareParams,
} from '@/lib/fareCalculation';

// ═══════════════════════════════════════════
// اختبارات حساب الأجرة الأساسية
// ═══════════════════════════════════════════

describe('calculateFare', () => {
  const baseParams: FareParams = {
    distanceKm: 10,
    baseFare: 2000,
    perKmRate: 500,
    perMinuteRate: 100,
    vehicleMultiplier: 1.0,
    surgeMultiplier: 1.0,
  };

  it('should calculate basic fare correctly', () => {
    const result = calculateFare(baseParams);

    expect(result.baseFare).toBe(2000);
    expect(result.distanceFare).toBe(5000); // 10km × 500
    // وقت مقدر: (10/30)*60 = 20 دقيقة
    expect(result.timeFare).toBe(2000); // 20 دقيقة × 100
    expect(result.subtotal).toBe(2000 + 5000 + 2000); // 9000
    expect(result.totalFare).toBe(9000);
  });

  it('should never go below base fare', () => {
    const result = calculateFare({
      ...baseParams,
      distanceKm: 0.1,
      perKmRate: 0,
      perMinuteRate: 0,
    });

    expect(result.totalFare).toBeGreaterThanOrEqual(baseParams.baseFare);
  });

  it('should apply vehicle multiplier correctly', () => {
    const economy = calculateFare({ ...baseParams, vehicleMultiplier: 1.0 });
    const comfort = calculateFare({ ...baseParams, vehicleMultiplier: 1.3 });
    const premium = calculateFare({ ...baseParams, vehicleMultiplier: 1.8 });
    const womenOnly = calculateFare({ ...baseParams, vehicleMultiplier: 1.2 });

    expect(comfort.totalFare).toBeGreaterThan(economy.totalFare);
    expect(premium.totalFare).toBeGreaterThan(comfort.totalFare);
    expect(womenOnly.totalFare).toBeGreaterThan(economy.totalFare);
    expect(womenOnly.totalFare).toBeLessThan(comfort.totalFare);

    // economy: 9000 × 1.0 = 9000
    expect(economy.totalFare).toBe(9000);
    // comfort: 9000 × 1.3 = 11700
    expect(comfort.totalFare).toBe(11700);
    // premium: 9000 × 1.8 = 16200
    expect(premium.totalFare).toBe(16200);
    // women_only: 9000 × 1.2 = 10800
    expect(womenOnly.totalFare).toBe(10800);
  });

  it('should cap surge multiplier at 2.0', () => {
    const surge2 = calculateFare({ ...baseParams, surgeMultiplier: 2.0 });
    const surge3 = calculateFare({ ...baseParams, surgeMultiplier: 3.0 });
    const surge10 = calculateFare({ ...baseParams, surgeMultiplier: 10.0 });

    // All should be capped at 2.0 
    expect(surge2.totalFare).toBe(surge3.totalFare);
    expect(surge2.totalFare).toBe(surge10.totalFare);
    expect(surge2.surgeMultiplier).toBe(2.0);
    expect(surge3.surgeMultiplier).toBe(2.0);
  });

  it('should not allow surge multiplier below 1.0', () => {
    const result = calculateFare({ ...baseParams, surgeMultiplier: 0.5 });
    expect(result.surgeMultiplier).toBe(1.0);
    expect(result.totalFare).toBe(9000); // same as no surge
  });

  it('should return rounded integer for totalFare', () => {
    const result = calculateFare({
      ...baseParams,
      vehicleMultiplier: 1.3,
      surgeMultiplier: 1.1,
    });

    expect(Number.isInteger(result.totalFare)).toBe(true);
  });
});

// ═══════════════════════════════════════════
// اختبارات أجرة الانتظار
// ═══════════════════════════════════════════

describe('calculateFare - waiting fare', () => {
  const baseParams: FareParams = {
    distanceKm: 5,
    baseFare: 2000,
    perKmRate: 500,
    perMinuteRate: 0,
    vehicleMultiplier: 1.0,
    surgeMultiplier: 1.0,
  };

  it('should add waiting fare for chargeable minutes', () => {
    const result = calculateFare({
      ...baseParams,
      waitingMinutes: 10,
      freeWaitingMinutes: 3,
      waitingFarePerMinute: 200,
    });

    // 10 - 3 = 7 دقائق مدفوعة × 200 = 1400
    expect(result.waitingFare).toBe(1400);
  });

  it('should not charge for free waiting period', () => {
    const result = calculateFare({
      ...baseParams,
      waitingMinutes: 3,
      freeWaitingMinutes: 5,
      waitingFarePerMinute: 200,
    });

    expect(result.waitingFare).toBe(0);
  });

  it('should handle zero waiting correctly', () => {
    const result = calculateFare({
      ...baseParams,
      waitingMinutes: 0,
      freeWaitingMinutes: 5,
      waitingFarePerMinute: 200,
    });

    expect(result.waitingFare).toBe(0);
  });
});

// ═══════════════════════════════════════════
// اختبارات التحقق من المسافة
// ═══════════════════════════════════════════

describe('validateDistance', () => {
  it('should accept valid distances', () => {
    expect(validateDistance(1)).toEqual({ valid: true });
    expect(validateDistance(10)).toEqual({ valid: true });
    expect(validateDistance(100)).toEqual({ valid: true });
    expect(validateDistance(0.5)).toEqual({ valid: true });
    expect(validateDistance(500)).toEqual({ valid: true });
  });

  it('should reject distances below 0.1 km', () => {
    const result = validateDistance(0.05);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject distances above 500 km', () => {
    const result = validateDistance(501);
    expect(result.valid).toBe(false);
  });

  it('should reject NaN', () => {
    expect(validateDistance(NaN).valid).toBe(false);
  });

  it('should reject Infinity', () => {
    expect(validateDistance(Infinity).valid).toBe(false);
    expect(validateDistance(-Infinity).valid).toBe(false);
  });

  it('should reject negative distances', () => {
    expect(validateDistance(-5).valid).toBe(false);
  });
});

// ═══════════════════════════════════════════
// اختبارات معاملات المركبات الافتراضية
// ═══════════════════════════════════════════

describe('DEFAULT_VEHICLE_MULTIPLIERS', () => {
  it('should have economy at 1.0 (base)', () => {
    expect(DEFAULT_VEHICLE_MULTIPLIERS.economy).toBe(1.0);
  });

  it('should have comfort > economy', () => {
    expect(DEFAULT_VEHICLE_MULTIPLIERS.comfort).toBeGreaterThan(DEFAULT_VEHICLE_MULTIPLIERS.economy);
  });

  it('should have premium as highest', () => {
    expect(DEFAULT_VEHICLE_MULTIPLIERS.premium).toBeGreaterThan(DEFAULT_VEHICLE_MULTIPLIERS.comfort);
  });

  it('should have women_only between economy and comfort', () => {
    expect(DEFAULT_VEHICLE_MULTIPLIERS.women_only).toBeGreaterThan(DEFAULT_VEHICLE_MULTIPLIERS.economy);
    expect(DEFAULT_VEHICLE_MULTIPLIERS.women_only).toBeLessThan(DEFAULT_VEHICLE_MULTIPLIERS.comfort);
  });

  it('should have all 4 vehicle types', () => {
    expect(Object.keys(DEFAULT_VEHICLE_MULTIPLIERS)).toHaveLength(4);
    expect(DEFAULT_VEHICLE_MULTIPLIERS).toHaveProperty('economy');
    expect(DEFAULT_VEHICLE_MULTIPLIERS).toHaveProperty('comfort');
    expect(DEFAULT_VEHICLE_MULTIPLIERS).toHaveProperty('premium');
    expect(DEFAULT_VEHICLE_MULTIPLIERS).toHaveProperty('women_only');
  });
});

// ═══════════════════════════════════════════
// اختبارات الثوابت
// ═══════════════════════════════════════════

describe('Constants', () => {
  it('should have MAX_SURGE_MULTIPLIER at 2.0', () => {
    expect(MAX_SURGE_MULTIPLIER).toBe(2.0);
  });

  it('should have DEFAULT_CITY_SPEED_KMH at 30', () => {
    expect(DEFAULT_CITY_SPEED_KMH).toBe(30);
  });
});

// ═══════════════════════════════════════════
// اختبارات سيناريوهات واقعية عراقية
// ═══════════════════════════════════════════

describe('Real-world Iraq scenarios', () => {
  it('should calculate Baghdad short ride (3km economy)', () => {
    const result = calculateFare({
      distanceKm: 3,
      baseFare: 2000,
      perKmRate: 500,
      perMinuteRate: 100,
      vehicleMultiplier: 1.0,
      surgeMultiplier: 1.0,
    });

    // 2000 + (3×500) + (6min×100) = 2000 + 1500 + 600 = 4100
    expect(result.totalFare).toBe(4100);
    expect(result.totalFare).toBeGreaterThanOrEqual(2000); // minimum
  });

  it('should calculate Baghdad-Karbala intercity (100km premium)', () => {
    const result = calculateFare({
      distanceKm: 100,
      baseFare: 2000,
      perKmRate: 500,
      perMinuteRate: 100,
      vehicleMultiplier: 1.8,
      surgeMultiplier: 1.0,
    });

    // 2000 + (100×500) + (200min×100) = 2000 + 50000 + 20000 = 72000
    // × 1.8 = 129,600
    expect(result.totalFare).toBe(129600);
  });

  it('should calculate rush hour surge (1.5x)', () => {
    const noSurge = calculateFare({
      distanceKm: 5,
      baseFare: 2000,
      perKmRate: 500,
      perMinuteRate: 100,
      vehicleMultiplier: 1.0,
      surgeMultiplier: 1.0,
    });

    const withSurge = calculateFare({
      distanceKm: 5,
      baseFare: 2000,
      perKmRate: 500,
      perMinuteRate: 100,
      vehicleMultiplier: 1.0,
      surgeMultiplier: 1.5,
    });

    expect(withSurge.totalFare).toBe(Math.round(noSurge.totalFare * 1.5));
  });

  it('should calculate ride with 15min waiting (5 free)', () => {
    const result = calculateFare({
      distanceKm: 5,
      baseFare: 2000,
      perKmRate: 500,
      perMinuteRate: 100,
      vehicleMultiplier: 1.0,
      surgeMultiplier: 1.0,
      waitingMinutes: 15,
      freeWaitingMinutes: 5,
      waitingFarePerMinute: 200,
    });

    // waiting: (15 - 5) × 200 = 2000
    expect(result.waitingFare).toBe(2000);
    expect(result.totalFare).toBeGreaterThan(0);
  });
});
