/**
 * ران — حساب الأجرة والمسافة
 * RAAN Fare Calculation & Haversine Distance
 */

// ════════════════════════════════════════
// Haversine Distance (km)
// ════════════════════════════════════════
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ════════════════════════════════════════
// حساب الأجرة عبر Edge Function
// ════════════════════════════════════════
export async function calculateFareFromEdge(
  supabase: any,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  distanceKm: number,
  vehicleType: string = "economy"
): Promise<number> {
  try {
    const { data, error } = await supabase.functions.invoke("calculate-fare", {
      body: {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        distance_km: distanceKm,
        vehicle_type: vehicleType,
      },
    });
    if (error) throw error;
    if (data?.total_fare) return Math.ceil(data.total_fare / 250) * 250;
    // fallback — يجلب إعدادات الأجرة من الأدمن
    const fs = await getFareSettings(supabase);
    return estimateFareLocal(distanceKm, fs.baseFare, fs.perKmRate);
  } catch (e) {
    console.warn("[fare] Edge function failed, using local fallback:", e);
    const fs = await getFareSettings(supabase);
    return estimateFareLocal(distanceKm, fs.baseFare, fs.perKmRate);
  }
}

// ════════════════════════════════════════
// إعدادات الأجرة — مخزن مؤقت (5 دقائق)
// ════════════════════════════════════════
let _fareSettingsCache: { baseFare: number; perKmRate: number; fetchedAt: number } | null = null;

export async function getFareSettings(supabase: any): Promise<{ baseFare: number; perKmRate: number }> {
  const now = Date.now();
  if (_fareSettingsCache && (now - _fareSettingsCache.fetchedAt) < 300_000) {
    return _fareSettingsCache;
  }
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "fare_calculation")
      .maybeSingle();
    if (data?.value) {
      const cfg = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      _fareSettingsCache = {
        baseFare: cfg.base_fare ?? cfg.baseFare ?? 2000,
        perKmRate: cfg.per_km_rate ?? cfg.perKmRate ?? 1000,
        fetchedAt: now,
      };
      return _fareSettingsCache;
    }
  } catch (e) {
    console.warn("[fare] Failed to fetch fare settings, using defaults:", e);
  }
  return { baseFare: 2000, perKmRate: 1000 };
}

// ════════════════════════════════════════
// حساب أجرة محلي
// ════════════════════════════════════════
export function estimateFareLocal(distanceKm: number, baseFare = 2000, perKmRate = 1000): number {
  const raw = baseFare + distanceKm * perKmRate;
  return Math.ceil(raw / 250) * 250;
}
