/**
 * ران — حساب الأجرة والمسافة — Shared Module
 * RAAN Fare Calculation — Shared between all webhooks
 * يُستخدم من: whatsapp-webhook, telegram-ai-booking, sms-webhook
 */

export { haversineDistance } from "./haversine.ts";

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
    console.warn("[fare] Failed to fetch fare settings, using DB defaults:", e);
  }
  // Last-resort fallback — these values should be overridden by app_settings fare_calculation in DB
  console.warn("[fare] ⚠️ Using hardcoded last-resort fallback pricing. Configure app_settings 'fare_calculation' key in DB.");
  return { baseFare: 2000, perKmRate: 1000 };
}

// ════════════════════════════════════════
// حساب أجرة محلي (fallback)
// ════════════════════════════════════════
export function estimateFareLocal(distanceKm: number, baseFare = 2000, perKmRate = 1000): number {
  const raw = baseFare + distanceKm * perKmRate;
  return Math.ceil(raw / 250) * 250;
}
