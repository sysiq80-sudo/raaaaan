// ════════════════════════════════════════════════════════════
// Phase 3 (Dispatch v2) — Smart ETA Helper
//
// يُرجع ETA حقيقي عبر:
//   1) directions_cache (lookup سريع)
//   2) Google Directions API (إن لم يكن مكاش)
//   3) Haversine fallback (إن فشل API)
//
// Bucketing: lat/lng مدوَّر إلى 0.001 درجة (~100م) + ساعة اليوم
// TTL: 24 ساعة
// ════════════════════════════════════════════════════════════

import { haversineDistance, calculateETA } from "./utils.ts";

export interface ETAResult {
  duration_seconds: number;
  distance_meters: number;
  eta_minutes: number;
  source: "cache" | "google" | "haversine_fallback";
}

const GRID_PRECISION = 1000; // 0.001 degree ≈ 100m
const CACHE_TTL_HOURS = 24;
const GOOGLE_TIMEOUT_MS = 1500;

function bucketCoord(value: number): number {
  return Math.round(value * GRID_PRECISION) / GRID_PRECISION;
}

function buildCacheKey(
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
  hour: number,
): string {
  const ol = bucketCoord(oLat).toFixed(3);
  const og = bucketCoord(oLng).toFixed(3);
  const dl = bucketCoord(dLat).toFixed(3);
  const dg = bucketCoord(dLng).toFixed(3);
  return `${ol}_${og}_${dl}_${dg}_${hour}`;
}

async function readFromCache(
  supabase: any,
  key: string,
): Promise<ETAResult | null> {
  try {
    const { data, error } = await supabase
      .from("directions_cache")
      .select("duration_seconds, distance_meters, expires_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (error || !data) return null;

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return null; // منتهي الصلاحية
    }

    // bump hit_count (best-effort, لا انتظار)
    supabase
      .from("directions_cache")
      .update({ hit_count: (data as any).hit_count != null ? undefined : 1 })
      .eq("cache_key", key)
      .then(() => {})
      .catch(() => {});

    return {
      duration_seconds: data.duration_seconds,
      distance_meters: data.distance_meters,
      eta_minutes: Math.round(data.duration_seconds / 60),
      source: "cache",
    };
  } catch {
    return null;
  }
}

async function writeToCache(
  supabase: any,
  key: string,
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
  hour: number,
  duration: number,
  distance: number,
): Promise<void> {
  try {
    await supabase.from("directions_cache").upsert(
      {
        cache_key: key,
        origin_lat: bucketCoord(oLat),
        origin_lng: bucketCoord(oLng),
        dest_lat: bucketCoord(dLat),
        dest_lng: bucketCoord(dLng),
        hour_bucket: hour,
        duration_seconds: duration,
        distance_meters: distance,
        source: "google",
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch (e) {
    console.warn("[eta] cache write failed:", (e as Error).message);
  }
}

async function fetchFromGoogle(
  apiKey: string,
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
): Promise<{ duration: number; distance: number } | null> {
  if (!apiKey) return null;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${oLat},${oLng}&destination=${dLat},${dLng}` +
    `&mode=driving&departure_time=now&language=ar&key=${apiKey}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GOOGLE_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json();

    if (data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) {
      return null;
    }

    const leg = data.routes[0].legs[0];
    // duration_in_traffic أدق إذا متاح، وإلا duration العادي
    const duration: number =
      leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
    const distance: number = leg.distance?.value ?? 0;

    if (!duration || !distance) return null;
    return { duration, distance };
  } catch (e) {
    clearTimeout(timer);
    console.warn("[eta] google fetch failed:", (e as Error).message);
    return null;
  }
}

/**
 * Smart ETA: cache → google → haversine fallback
 *
 * @param supabase - service-role client
 * @param googleApiKey - Google Maps API key (من config)
 * @param oLat,oLng - الأصل
 * @param dLat,dLng - الوجهة
 */
export async function getSmartETA(
  supabase: any,
  googleApiKey: string,
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
): Promise<ETAResult> {
  const hour = new Date().getHours();
  const key = buildCacheKey(oLat, oLng, dLat, dLng, hour);

  // 1) cache
  const cached = await readFromCache(supabase, key);
  if (cached) return cached;

  // 2) google
  const fresh = await fetchFromGoogle(googleApiKey, oLat, oLng, dLat, dLng);
  if (fresh) {
    // fire-and-forget cache write
    writeToCache(
      supabase,
      key,
      oLat,
      oLng,
      dLat,
      dLng,
      hour,
      fresh.duration,
      fresh.distance,
    ).catch(() => {});

    return {
      duration_seconds: fresh.duration,
      distance_meters: fresh.distance,
      eta_minutes: Math.round(fresh.duration / 60),
      source: "google",
    };
  }

  // 3) haversine fallback (السلوك القديم — لا يفشل النظام أبداً)
  const distanceKm = haversineDistance(oLat, oLng, dLat, dLng);
  const etaMin = calculateETA(distanceKm);
  return {
    duration_seconds: etaMin * 60,
    distance_meters: Math.round(distanceKm * 1000),
    eta_minutes: etaMin,
    source: "haversine_fallback",
  };
}

/**
 * Batch ETA: يستعلم لمصفوفة من الوجهات بكفاءة (cache-first بالتوازي، Google بالتوازي للمتبقي)
 * استخدام أمثل لـ Phase 3 dispatch (top-K candidates after pre-filter).
 */
export async function getBatchETA(
  supabase: any,
  googleApiKey: string,
  origin: { lat: number; lng: number },
  destinations: Array<{ id: string; lat: number; lng: number }>,
): Promise<Map<string, ETAResult>> {
  const results = new Map<string, ETAResult>();
  await Promise.all(
    destinations.map(async (dest) => {
      const r = await getSmartETA(
        supabase,
        googleApiKey,
        origin.lat,
        origin.lng,
        dest.lat,
        dest.lng,
      );
      results.set(dest.id, r);
    }),
  );
  return results;
}
