/**
 * ران — منطق حساب الأسعار الصافي (Pure Functions)
 * RAAN — Pure Fare Calculation Logic
 *
 * هذه الدوال بدون أي تبعيات React — قابلة للاختبار المباشر
 * تُستخدم من useFareCalculation hook ومن calculate-fare Edge Function
 */

export type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';

export interface FareParams {
  distanceKm: number;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  vehicleMultiplier: number;
  surgeMultiplier: number;
  waitingMinutes?: number;
  freeWaitingMinutes?: number;
  waitingFarePerMinute?: number;
  /** Duration from OSRM/routing in minutes. If provided, used instead of estimating from distance. */
  durationMinutes?: number;
}

export interface FareResult {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  waitingFare: number;
  subtotal: number;
  surgeMultiplier: number;
  vehicleMultiplier: number;
  totalFare: number;
}

/** الحد الأقصى لمعامل الذروة */
export const MAX_SURGE_MULTIPLIER = 2.0;

/** سرعة المدينة الافتراضية لتقدير الوقت (كم/ساعة) */
export const DEFAULT_CITY_SPEED_KMH = 30;

/** الحد الأعلى الافتراضي لمسافة الرحلة، ويمكن تغييره من إعدادات الإدارة */
export const DEFAULT_MAX_TRIP_DISTANCE_KM = 2000;

/**
 * حساب الأجرة بناءً على المسافة والمعاملات
 * يُرجع تفاصيل الحساب كاملة
 */
export function calculateFare(params: FareParams): FareResult {
  const {
    distanceKm,
    baseFare,
    perKmRate,
    perMinuteRate,
    vehicleMultiplier,
    surgeMultiplier,
    waitingMinutes = 0,
    freeWaitingMinutes = 0,
    waitingFarePerMinute = 0,
  } = params;

  // أجرة المسافة
  const distanceFare = distanceKm * perKmRate;

  // تقدير وقت الرحلة — يستخدم durationMinutes من OSRM إذا متوفر، وإلا يحسب من المسافة
  const estimatedMinutes = params.durationMinutes
    ? Math.max(1, Math.round(params.durationMinutes))
    : Math.max(1, Math.round((distanceKm / DEFAULT_CITY_SPEED_KMH) * 60));
  const timeFare = estimatedMinutes * perMinuteRate;

  // أجرة الانتظار (بعد خصم الوقت المجاني)
  const chargeableWaiting = Math.max(0, waitingMinutes - freeWaitingMinutes);
  const waitingFare = chargeableWaiting * waitingFarePerMinute;

  // المجموع الفرعي — لا يقل عن الأجرة الأساسية
  const subtotal = Math.max(baseFare, baseFare + distanceFare + timeFare + waitingFare);

  // تطبيق معامل الذروة (maximum 2.0x)
  const clampedSurge = Math.min(Math.max(surgeMultiplier, 1.0), MAX_SURGE_MULTIPLIER);

  // الأجرة النهائية = (مجموع فرعي × معامل المركبة × معامل الذروة)
  const totalFare = Math.round(subtotal * vehicleMultiplier * clampedSurge);

  return {
    baseFare,
    distanceFare,
    timeFare,
    waitingFare,
    subtotal,
    surgeMultiplier: clampedSurge,
    vehicleMultiplier,
    totalFare,
  };
}

/**
 * التحقق من صحة المسافة
 */
export function validateDistance(
  distanceKm: number,
  maxDistanceKm: number = DEFAULT_MAX_TRIP_DISTANCE_KM,
): { valid: boolean; error?: string } {
  if (!isFinite(distanceKm) || isNaN(distanceKm) || distanceKm < 0) {
    return { valid: false, error: 'المسافة غير صحيحة' };
  }
  const effectiveMaxDistance = Number.isFinite(maxDistanceKm) && maxDistanceKm > 0
    ? maxDistanceKm
    : DEFAULT_MAX_TRIP_DISTANCE_KM;
  if (distanceKm > effectiveMaxDistance) {
    return { valid: false, error: 'المسافة غير صحيحة' };
  }
  return { valid: true };
}

/**
 * المعاملات الافتراضية لأنواع المركبات (fallback)
 */
export const DEFAULT_VEHICLE_MULTIPLIERS: Record<VehicleType, number> = {
  economy: 1.0,
  comfort: 1.3,
  premium: 1.8,
  women_only: 1.2,
};
