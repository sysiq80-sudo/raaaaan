/**
 * ران — خدمات الترميز الجغرافي (Geocoding) — Shared Module
 * RAAN Geocoding — Local Landmarks + Nominatim + Google Maps
 * يُستخدم من كل الـ webhooks: whatsapp, telegram, sms
 *
 * ملاحظة: هذا الملف لا يحتوي على cache — الـ caching يُدار بشكل منفصل في كل webhook.
 * يستقبل googleMapsKey كمعامل لتجنب الارتباط بإعدادات webhook معيّن.
 */

import { haversineDistance } from "./haversine.ts";
import { matchLocalLandmark, type ResolvedLocation } from "./landmarks.ts";

// Re-export for convenience
export type { ResolvedLocation };
export { matchLocalLandmark };

// ════════════════════════════════════════
// Nominatim Geocoding
// ════════════════════════════════════════
export async function nominatimGeocode(query: string, userLat = 33.4233, userLng = 43.2974): Promise<ResolvedLocation | null> {
  try {
    const vbMinLng = (userLng - 0.35).toFixed(2);
    const vbMinLat = (userLat - 0.25).toFixed(2);
    const vbMaxLng = (userLng + 0.35).toFixed(2);
    const vbMaxLat = (userLat + 0.25).toFixed(2);
    const viewbox = `${vbMinLng},${vbMinLat},${vbMaxLng},${vbMaxLat}`;

    const searches = [
      `${query}, العراق`,
      `${query}, الأنبار, العراق`,
      `${query}, Anbar, Iraq`,
    ];
    for (const searchText of searches) {
      const params = new URLSearchParams({
        q: searchText, format: "json", limit: "3", countrycodes: "iq",
        viewbox, bounded: "0", "accept-language": "ar",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "RAAN-Taxi-App/1.0" },
      });
      if (!response.ok) continue;
      const results = await response.json();
      if (results.length > 0) {
        const best = results[0];
        const lat = parseFloat(best.lat);
        const lng = parseFloat(best.lon);
        const dist = haversineDistance(lat, lng, userLat, userLng);
        if (dist <= 80) {
          console.log(`[nominatim] MATCH: ${best.display_name} (${dist.toFixed(1)} km)`);
          return { lat, lng, address: best.display_name?.split(",").slice(0, 3).join("،") || query };
        }
      }
    }
  } catch (err) {
    console.error("[nominatim] Error:", err);
  }
  return null;
}

// ════════════════════════════════════════
// حل الموقع (محلي → Nominatim → Google → Places)
// ════════════════════════════════════════
export async function resolveRamadiLocation(
  query: string,
  googleMapsKey: string,
  userLat = 33.4233,
  userLng = 43.2974
): Promise<ResolvedLocation | null> {
  const cleanQuery = query.replace(/[.,،]/g, "").trim();
  console.log(`[geocode] Resolving: "${cleanQuery}" (user@${userLat.toFixed(4)},${userLng.toFixed(4)})`);

  // استراتيجية 0: محلي
  const localMatch = matchLocalLandmark(cleanQuery);
  if (localMatch) return localMatch;

  // استراتيجية 1: Nominatim
  const nominatimResult = await nominatimGeocode(cleanQuery, userLat, userLng);
  if (nominatimResult) return nominatimResult;

  // بناء bounds ديناميكي حول موقع المستخدم
  const boundsStr = `${(userLat - 0.25).toFixed(2)},${(userLng - 0.35).toFixed(2)}|${(userLat + 0.25).toFixed(2)},${(userLng + 0.35).toFixed(2)}`;

  // استراتيجيات 2-4: Google Geocoding
  const strategies = [
    cleanQuery,
    `${cleanQuery} الأنبار`,
    `${cleanQuery} الأنبار العراق`,
  ];

  let data: any = { status: "ZERO_RESULTS" };
  for (const addr of strategies) {
    const params = new URLSearchParams({
      address: addr, key: googleMapsKey, language: "ar",
      components: "country:IQ", bounds: boundsStr,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    data = await response.json();
    console.log(`[geocode] Google "${addr}": status=${data.status}, results=${data.results?.length || 0}`);
    if (data.error_message) console.log(`[geocode] Google error: ${data.error_message}`);
    if (data.status === "OK" && data.results?.length) {
      const result = data.results[0];
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;
      const dist = haversineDistance(lat, lng, userLat, userLng);
      if (dist <= 80) {
        return { lat, lng, address: result.formatted_address };
      }
    }
  }

  // استراتيجية 5: Google Places Text Search
  try {
    const placesParams = new URLSearchParams({
      query: `${cleanQuery} الأنبار العراق`, key: googleMapsKey,
      language: "ar", location: `${userLat},${userLng}`, radius: "50000",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${placesParams}`);
    const placesData = await response.json();
    if (placesData.status === "OK" && placesData.results?.[0]) {
      const place = placesData.results[0];
      return {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        address: place.formatted_address || place.name,
      };
    }
  } catch { }

  // فشل كل المحاولات — فحص آخر نتيجة Google
  if (data.status === "OK" && data.results?.[0]) {
    const result = data.results[0];
    const addressComponents = result.address_components || [];
    const formattedAddress = result.formatted_address || "";

    const isAnbar = addressComponents.some(
      (c: { long_name: string }) =>
        c.long_name.includes("Anbar") || c.long_name.includes("الأنبار") ||
        c.long_name.includes("الرمادي") || c.long_name.includes("Ramadi")
    ) || formattedAddress.includes("الأنبار") || formattedAddress.includes("Anbar") || formattedAddress.includes("Ramadi");

    if (!isAnbar) {
      const distFromCenter = haversineDistance(result.geometry.location.lat, result.geometry.location.lng, userLat, userLng);
      if (distFromCenter > 80) {
        console.log(`[geocode] Rejected — too far (${distFromCenter.toFixed(1)} km): ${formattedAddress}`);
        return null;
      }
      console.log(`[geocode] Not labeled Anbar but within ${distFromCenter.toFixed(1)} km, accepting.`);
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      address: formattedAddress,
    };
  }

  console.error(`[geocode] ALL strategies failed for: "${query}"`);
  return null;
}

// ════════════════════════════════════════
// استخراج عنوان مختصر من نتائج Google
// ════════════════════════════════════════
export function extractConciseAddress(results: any[]): string | null {
  try {
    const result = results[0];
    const components = result.address_components || [];

    let neighborhood = "";
    let route = "";
    let sublocality = "";
    let locality = "";
    let adminArea = "";

    for (const comp of components) {
      const types = comp.types || [];
      if (types.includes("neighborhood")) neighborhood = comp.long_name;
      if (types.includes("route")) route = comp.long_name;
      if (types.includes("sublocality") || types.includes("sublocality_level_1")) sublocality = comp.long_name;
      if (types.includes("locality")) locality = comp.long_name;
      if (types.includes("administrative_area_level_1")) adminArea = comp.long_name;
    }

    const city = locality || adminArea || "الرمادي";
    const area = neighborhood || route || sublocality;

    if (area && city) return `${area}، ${city}`;
    if (area) return area;
    if (city) return city;

    const shortest = results
      .map((r: any) => r.formatted_address)
      .filter(Boolean)
      .sort((a: string, b: string) => a.length - b.length)[0];
    return shortest || null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════
// Reverse Geocode (إحداثيات → عنوان)
// ════════════════════════════════════════
export async function reverseGeocode(lat: number, lng: number, googleMapsKey: string): Promise<string> {
  // المحاولة 1: Google Maps Geocoding API
  try {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: googleMapsKey, language: "ar", result_type: "street_address|neighborhood|sublocality|locality" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const concise = extractConciseAddress(data.results);
      if (concise) {
        console.log(`[reverse-geocode] Google concise: ${concise}`);
        return concise;
      }
      return data.results[0].formatted_address;
    }
    console.warn(`[reverse-geocode] Google status: ${data.status}`, data.error_message || "");
  } catch (e) {
    console.error("[reverse-geocode] Google error:", e);
  }

  // المحاولة 2: Nominatim
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&zoom=18`;
    const response = await fetch(nominatimUrl, {
      headers: { "User-Agent": "RaanTaxiBot/1.0" },
    });
    const data = await response.json();
    if (data && data.address) {
      const addr = data.address;
      const area = addr.neighbourhood || addr.suburb || addr.road || addr.quarter || "";
      const city = addr.city || addr.town || addr.state || "الرمادي";
      if (area && city) {
        const addr2 = `${area}، ${city}`;
        console.log(`[reverse-geocode] Nominatim: ${addr2}`);
        return addr2;
      }
      if (data.display_name) {
        const parts = data.display_name.split(",").map((s: string) => s.trim()).filter(Boolean);
        const short = parts.slice(0, 2).join("، ");
        console.log(`[reverse-geocode] Nominatim display: ${short}`);
        return short;
      }
    }
  } catch (e) {
    console.error("[reverse-geocode] Nominatim error:", e);
  }

  // الملاذ الأخير: إحداثيات خام
  console.warn(`[reverse-geocode] All strategies failed, returning raw coords`);
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
