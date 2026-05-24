/**
 * ران — خدمات الترميز الجغرافي (Geocoding)
 * RAAN Geocoding — Local Landmarks + Nominatim + Google Maps
 * مع Cache ذكي لتقليل استدعاءات API
 */

import { GOOGLE_MAPS_KEY } from "./config.ts";
import { haversineDistance } from "./fare.ts";
import {
  getCachedForwardGeocode,
  cacheForwardGeocode,
  getCachedReverseGeocode,
  cacheReverseGeocode,
} from "./cache.ts";

// ════════════════════════════════════════
// قاعدة بيانات أماكن الرمادي المحلية
// ════════════════════════════════════════
export interface ResolvedLocation {
  lat: number;
  lng: number;
  address: string;
}

export const RAMADI_LANDMARKS: Record<string, { lat: number; lng: number; address: string; aliases: string[] }> = {
  "جامعة الأنبار": { lat: 33.4350, lng: 43.2650, address: "جامعة الأنبار، الرمادي", aliases: ["جامعة الانبار", "الجامعة", "جامعة انبار", "university of anbar", "جامعة"] },
  "مستشفى الرمادي التعليمي": { lat: 33.4280, lng: 43.3050, address: "مستشفى الرمادي التعليمي", aliases: ["المستشفى", "مستشفى الرمادي", "المستشفى التعليمي", "رمادي تعليمي"] },
  "دائرة صحة الأنبار": { lat: 33.4260, lng: 43.3010, address: "دائرة صحة الأنبار، الرمادي", aliases: ["صحة الانبار", "دائرة الصحة", "صحة الأنبار"] },
  "حي التأميم": { lat: 33.4350, lng: 43.3100, address: "حي التأميم، الرمادي", aliases: ["التأميم", "تأميم", "التاميم", "تاميم"] },
  "حي الحوز": { lat: 33.4200, lng: 43.3150, address: "حي الحوز، الرمادي", aliases: ["الحوز", "حوز"] },
  "حي الملعب": { lat: 33.4300, lng: 43.2900, address: "حي الملعب، الرمادي", aliases: ["الملعب", "ملعب الرمادي", "ملعب"] },
  "حي الضباط": { lat: 33.4150, lng: 43.2850, address: "حي الضباط، الرمادي", aliases: ["الضباط", "ضباط"] },
  "حي العزيزية": { lat: 33.4180, lng: 43.3200, address: "حي العزيزية، الرمادي", aliases: ["العزيزية", "عزيزية"] },
  "حي 5 كيلو": { lat: 33.4100, lng: 43.2750, address: "حي خمسة كيلو، الرمادي", aliases: ["5 كيلو", "خمسة كيلو", "خمس كيلو", "٥ كيلو", "5كيلو", "خمسه كيلو"] },
  "حي العشرين": { lat: 33.4220, lng: 43.2800, address: "حي العشرين، الرمادي", aliases: ["العشرين", "عشرين"] },
  "حي البكر": { lat: 33.4280, lng: 43.2950, address: "حي البكر، الرمادي", aliases: ["البكر", "بكر"] },
  "حي الورار": { lat: 33.4320, lng: 43.3200, address: "حي الورار، الرمادي", aliases: ["الورار", "ورار"] },
  "حي السلام": { lat: 33.4250, lng: 43.2700, address: "حي السلام، الرمادي", aliases: ["السلام", "سلام"] },
  "تقاطع الزيوت": { lat: 33.4240, lng: 43.3000, address: "تقاطع الزيوت، الرمادي", aliases: ["الزيوت", "زيوت", "تقاطع زيوت"] },
  "شارع المستودع": { lat: 33.4200, lng: 43.2950, address: "شارع المستودع، الرمادي", aliases: ["المستودع", "مستودع"] },
  "الشارع العام": { lat: 33.4230, lng: 43.3000, address: "الشارع العام، الرمادي", aliases: ["شارع عام"] },
  "السوق المركزي": { lat: 33.4235, lng: 43.3020, address: "السوق المركزي، الرمادي", aliases: ["السوق", "سوق الرمادي", "سوق مركزي"] },
  "البوعلوان": { lat: 33.4400, lng: 43.2800, address: "البوعلوان، الرمادي", aliases: ["بوعلوان", "بو علوان"] },
  "حي المعلمين": { lat: 33.4150, lng: 43.3050, address: "حي المعلمين، الرمادي", aliases: ["المعلمين", "معلمين"] },
  "حي الأندلس": { lat: 33.4100, lng: 43.3100, address: "حي الأندلس، الرمادي", aliases: ["الأندلس", "الاندلس", "أندلس", "اندلس"] },
  "الجسر الحديدي": { lat: 33.4230, lng: 43.3080, address: "الجسر الحديدي، الرمادي", aliases: ["جسر حديدي", "الجسر"] },
  "مبنى المحافظة": { lat: 33.4240, lng: 43.3040, address: "مبنى المحافظة، الرمادي", aliases: ["المحافظة", "محافظة الأنبار", "محافظة الانبار", "محافظة"] },
  "حي الثيلة": { lat: 33.4300, lng: 43.3150, address: "حي الثيلة، الرمادي", aliases: ["الثيلة", "ثيلة"] },
  "حي القطانة": { lat: 33.4270, lng: 43.3180, address: "حي القطانة، الرمادي", aliases: ["القطانة", "قطانة"] },
  "حي السفحة": { lat: 33.4350, lng: 43.3050, address: "حي السفحة، الرمادي", aliases: ["السفحة", "سفحة"] },
  "حي البوذياب": { lat: 33.4380, lng: 43.2900, address: "حي البوذياب، الرمادي", aliases: ["البوذياب", "بوذياب", "بو ذياب"] },
  "شارع 60": { lat: 33.4200, lng: 43.2700, address: "شارع 60، الرمادي", aliases: ["شارع ستين", "ستين"] },
  "شارع فلسطين": { lat: 33.4250, lng: 43.2950, address: "شارع فلسطين، الرمادي", aliases: ["فلسطين"] },
  "حي الروضة": { lat: 33.4180, lng: 43.2900, address: "حي الروضة، الرمادي", aliases: ["الروضة", "روضة"] },
  "حي الجزيرة": { lat: 33.4300, lng: 43.2800, address: "حي الجزيرة، الرمادي", aliases: ["الجزيرة", "جزيرة"] },
  "مكتب الرؤية": { lat: 33.4230, lng: 43.3010, address: "مكتب الرؤية، الرمادي", aliases: ["الرؤية", "رؤية", "مكتب رؤية"] },
  "حي التقدم": { lat: 33.4100, lng: 43.2650, address: "حي التقدم، الرمادي", aliases: ["التقدم", "تقدم"] },
  "حي الطيران": { lat: 33.4050, lng: 43.2800, address: "حي الطيران، الرمادي", aliases: ["الطيران", "طيران"] },
  "حي الصوفية": { lat: 33.4280, lng: 43.3100, address: "حي الصوفية، الرمادي", aliases: ["الصوفية", "صوفية"] },
  "حي الجمهوري": { lat: 33.4210, lng: 43.3060, address: "حي الجمهوري، الرمادي", aliases: ["الجمهوري", "جمهوري"] },
  "حي الشرطة": { lat: 33.4190, lng: 43.2980, address: "حي الشرطة، الرمادي", aliases: ["الشرطة", "شرطة"] },
  "حي المعاضيد": { lat: 33.4330, lng: 43.2970, address: "حي المعاضيد، الرمادي", aliases: ["المعاضيد", "معاضيد"] },
  "مجمع ران التجاري": { lat: 33.4225, lng: 43.2990, address: "مجمع ران التجاري، الرمادي", aliases: ["مجمع ران", "ران التجاري"] },
  "قضاء الفلوجة": { lat: 33.3530, lng: 43.7830, address: "الفلوجة، الأنبار", aliases: ["الفلوجة", "فلوجة"] },
  "قضاء هيت": { lat: 33.6390, lng: 42.8270, address: "هيت، الأنبار", aliases: ["هيت"] },
  "قضاء حديثة": { lat: 34.1370, lng: 42.3790, address: "حديثة، الأنبار", aliases: ["حديثة"] },
};

// ════════════════════════════════════════
// مطابقة المعالم المحلية
// ════════════════════════════════════════
export function matchLocalLandmark(query: string): ResolvedLocation | null {
  const q = query.trim().toLowerCase().replace(/[.,،\-_]/g, "");

  // مطابقة مباشرة
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    if (q === name.toLowerCase() || q === name.toLowerCase().replace("حي ", "")) {
      console.log(`[geocode] LOCAL MATCH (exact): "${query}" → ${name}`);
      return { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
  }

  // مطابقة بالاسماء البديلة
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    for (const alias of loc.aliases) {
      if (q === alias.toLowerCase() || q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
        console.log(`[geocode] LOCAL MATCH (alias "${alias}"): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  // مطابقة جزئية بالكلمات
  const words = q.split(/\s+/).filter((w: string) => w.length > 2);
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    const nameLower = name.toLowerCase();
    const allAliases = [nameLower, ...loc.aliases.map((a: string) => a.toLowerCase())];
    for (const target of allAliases) {
      if (words.every((w: string) => target.includes(w))) {
        console.log(`[geocode] LOCAL MATCH (partial): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  return null;
}

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
export async function resolveRamadiLocation(query: string, userLat = 33.4233, userLng = 43.2974): Promise<ResolvedLocation | null> {
  const cleanQuery = query.replace(/[.,،]/g, "").trim();
  console.log(`[geocode] Resolving: "${cleanQuery}" (user@${userLat.toFixed(4)},${userLng.toFixed(4)})`);

  // استراتيجية -1: Cache
  const cached = getCachedForwardGeocode(cleanQuery);
  if (cached) return cached;

  // استراتيجية 0: محلي
  const localMatch = matchLocalLandmark(cleanQuery);
  if (localMatch) {
    cacheForwardGeocode(cleanQuery, localMatch);
    return localMatch;
  }

  // استراتيجية 1: Nominatim
  const nominatimResult = await nominatimGeocode(cleanQuery, userLat, userLng);
  if (nominatimResult) {
    cacheForwardGeocode(cleanQuery, nominatimResult);
    return nominatimResult;
  }

  // بناء bounds ديناميكي حول موقع المستخدم
  const boundsStr = `${(userLat - 0.25).toFixed(2)},${(userLng - 0.35).toFixed(2)}|${(userLat + 0.25).toFixed(2)},${(userLng + 0.35).toFixed(2)}`;

  // استراتيجيات 2-4: Google Geocoding
  const strategies = [
    cleanQuery,
    `${cleanQuery} الأنبار`,
    `${cleanQuery} الأنبار العراق`,
  ];

  for (const addr of strategies) {
    const params = new URLSearchParams({
      address: addr, key: GOOGLE_MAPS_KEY, language: "ar",
      components: "country:IQ", bounds: boundsStr,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) {
      const result = data.results[0];
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;
      const dist = haversineDistance(lat, lng, userLat, userLng);
      if (dist <= 80) {
        const resolved = { lat, lng, address: result.formatted_address };
        cacheForwardGeocode(cleanQuery, resolved);
        return resolved;
      }
    }
  }

  // استراتيجية 5: Google Places Text Search
  try {
    const placesParams = new URLSearchParams({
      query: `${cleanQuery} الأنبار العراق`, key: GOOGLE_MAPS_KEY,
      language: "ar", location: `${userLat},${userLng}`, radius: "50000",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${placesParams}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) {
      const place = data.results[0];
      const resolved = { lat: place.geometry.location.lat, lng: place.geometry.location.lng, address: place.formatted_address || place.name };
      cacheForwardGeocode(cleanQuery, resolved);
      return resolved;
    }
  } catch { }

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
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // فحص الـ Cache أولاً
  const cached = getCachedReverseGeocode(lat, lng);
  if (cached) return cached;

  // المحاولة 1: Google Maps Geocoding API
  try {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: GOOGLE_MAPS_KEY, language: "ar", result_type: "street_address|neighborhood|sublocality|locality" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const concise = extractConciseAddress(data.results);
      if (concise) {
        console.log(`[reverse-geocode] Google concise: ${concise}`);
        cacheReverseGeocode(lat, lng, concise);
        return concise;
      }
      const fullAddress = data.results[0].formatted_address;
      cacheReverseGeocode(lat, lng, fullAddress);
      return fullAddress;
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
        cacheReverseGeocode(lat, lng, addr2);
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
