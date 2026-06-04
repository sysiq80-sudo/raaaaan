/**
 * landmarksCache.ts
 * ─────────────────
 * Singleton: يُحمّل جدول `landmarks` مرة واحدة فقط عند أول استدعاء.
 * كل عمليات البحث بعدها تحدث في الذاكرة بدون أي HTTP request.
 * 
 * الأولوية في useLocationPicker:
 *   1. Landmark من هذا الجدول  ← هذا الملف
 *   2. Google Geocoding POI
 *   3. Nominatim POI (مجاني لكن قد يكون بطيئاً)
 */

import { supabase } from '@/integrations/supabase/client';
import { arabicIncludes } from '@/utils/normalizeArabic';

interface CachedLandmark {
  name_ar: string;
  name_en: string | null;
  lat: number;
  lng: number;
  category?: string | null;
}

export interface NearestLandmark {
  name: string;
  name_ar: string;
  name_en: string | null;
  category?: string | null;
  distance_meters: number;
}

// ── Singleton state ──────────────────────────────────────────────────────────
let _cache: CachedLandmark[] | null = null;
let _loadPromise: Promise<CachedLandmark[]> | null = null;

// ── Haversine distance (meters) ──────────────────────────────────────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // نصف قطر الأرض بالأمتار
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── تحميل الجدول (مرة واحدة فقط طوال عمر التطبيق) ──────────────────────────
export async function loadLandmarksCache(): Promise<CachedLandmark[]> {
  // إذا محمّل بالفعل — أرجع فوراً
  if (_cache) return _cache;

  // إذا تحميل جارٍ — انتظر نفس الـ Promise (لا طلب HTTP ثانٍ)
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('landmarks')
        .select('name_ar, name_en, category, location')
        .eq('is_active', true)
        .limit(2000); // حد أقصى آمن

      if (error || !data) {
        _loadPromise = null; // اسمح بإعادة المحاولة عند الفشل
        return [];
      }

      _cache = data.map((row: any) => ({
        name_ar: row.name_ar as string,
        name_en: row.name_en as string | null,
        category: row.category as string | null,
        lat: (row.location as { lat: number; lng: number }).lat,
        lng: (row.location as { lat: number; lng: number }).lng,
      }));

      return _cache;
    } catch {
      _loadPromise = null;
      return [];
    }
  })();

  return _loadPromise;
}

// ── البحث عن أقرب معلم (synchronous بعد التحميل) ────────────────────────────
/**
 * يُرجع اسم أقرب معلم ضمن النطاق المحدد.
 * @param lat  خط عرض الدبوس
 * @param lng  خط طول الدبوس
 * @param maxRadiusM  النطاق الأقصى بالأمتار (افتراضي 200م)
 */
export function findNearestLandmark(
  lat: number,
  lng: number,
  maxRadiusM = 300
): string | null {
  return findNearestLandmarkInfo(lat, lng, maxRadiusM)?.name ?? null;
}

export function findNearestLandmarkInfo(
  lat: number,
  lng: number,
  maxRadiusM = 300
): NearestLandmark | null {
  if (!_cache || _cache.length === 0) return null;

  let best: CachedLandmark | null = null;
  let bestDist = Infinity;

  for (const lm of _cache) {
    const dist = haversineMeters(lat, lng, lm.lat, lm.lng);
    if (dist <= maxRadiusM && dist < bestDist) {
      bestDist = dist;
      best = lm;
    }
  }

  if (!best) return null;

  const hasGarbledArabic = best.name_ar.includes('?');
  const name = !hasGarbledArabic && best.name_ar.trim()
    ? best.name_ar
    : best.name_en || best.name_ar;

  return {
    name,
    name_ar: best.name_ar,
    name_en: best.name_en,
    category: best.category,
    distance_meters: Math.round(bestDist),
  };
}

// ── مسح الكاش (للتحديث عند إضافة معالم جديدة) ───────────────────────────────
export function invalidateLandmarksCache(): void {
  _cache = null;
  _loadPromise = null;
}

// ── البحث بالاسم (يُرجع أماكن مطابقة للنص) ────────────────────────────────────
/**
 * يبحث في المعالم المحلية بالاسم العربي أو الإنجليزي بشكل مرن.
 * يُستخدم في AIVoiceHome وuseDynamicPlacesSearch كأولوية قبل Nominatim.
 */
export interface LandmarkSearchResult {
  place_id: string;
  main_text: string;
  secondary_text: string;
  description: string;
  lat: number;
  lng: number;
  isLocalLandmark: true;
}

export function searchLandmarksByName(
  query: string,
  maxResults = 5
): LandmarkSearchResult[] {
  if (!_cache || !query.trim()) return [];

  const q = query.trim();
  const results: LandmarkSearchResult[] = [];

  for (const lm of _cache) {
    const matchesAr = arabicIncludes(lm.name_ar, q);
    const matchesEn = lm.name_en
      ? lm.name_en.toLowerCase().includes(q.toLowerCase())
      : false;

    if (matchesAr || matchesEn) {
      results.push({
        place_id: `landmark_${lm.name_ar}`,
        main_text: lm.name_ar,
        secondary_text: lm.name_en || lm.category || 'معلم محلي',
        description: lm.name_ar,
        lat: lm.lat,
        lng: lm.lng,
        isLocalLandmark: true,
      });
      if (results.length >= maxResults) break;
    }
  }

  return results;
}
