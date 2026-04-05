/**
 * ران - محرك البحث الموحد الذكي
 * يدمج كل مصادر البحث في قائمة واحدة مرتبة:
 * 1. الأماكن المحفوظة (saved_places) — أعلى أولوية
 * 2. البحوثات السابقة (localStorage) — أولوية عالية
 * 3. المعالم المحلية (landmarks table) — أولوية متوسطة-عالية
 * 4. Google Places API — أولوية قياسية
 * 
 * + اقتراحات ذكية (Smart Zero-State) عندما يكون حقل البحث فارغاً
 * + إزالة التكرار بالإحداثيات (ضمن 50 متر = نفس المكان)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistanceMeters } from '@/lib/mapUtils';
import type { RecentSearch } from './useRecentSearches';

// ─── أنواع النتائج الموحدة ───

export type UnifiedResultSource = 'saved' | 'recent' | 'landmark' | 'google' | 'smart';

export interface UnifiedSearchResult {
  id: string;
  source: UnifiedResultSource;
  place_id?: string;           // Google place ID (للنتائج من Google)
  main_text: string;
  secondary_text?: string;
  description: string;
  lat?: number;
  lng?: number;
  distance_meters?: number;
  distance_text?: string;
  score: number;               // درجة الترتيب المركبة (0-100)
  category?: string;           // تصنيف المكان (restaurant, hospital, etc.)
  badge?: 'saved' | 'recent';  // شارة مرئية
  eta_minutes?: number;        // وقت الوصول التقديري
  icon_type?: string;          // نوع الأيقونة
}

export interface SmartSuggestion {
  id: string;
  type: 'home' | 'work' | 'lunch' | 'shopping' | 'recent';
  title: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  confidence: number;
  reason: string;
}

interface LandmarkRecord {
  id: string;
  name_ar: string;
  name_en?: string;
  category?: string;
  location: { lat: number; lng: number } | null;
  is_active: boolean;
}

interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
  label: string;
}

// ─── ثوابت ───

const DEDUPE_RADIUS_METERS = 50;
const LANDMARKS_CACHE_KEY = 'raan_landmarks_cache';
const LANDMARKS_CACHE_TTL = 30 * 60 * 1000; // 30 دقيقة

// أوزان المصادر
const SOURCE_WEIGHTS: Record<UnifiedResultSource, number> = {
  saved: 95,
  recent: 80,
  landmark: 70,
  google: 60,
  smart: 50,
};

// ─── مساعدات ───

function fuzzyMatch(text: string, query: string): number {
  if (!text || !query) return 0;
  const t = text.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  
  // تطابق كامل
  if (t === q) return 1.0;
  // يبدأ بـ
  if (t.startsWith(q)) return 0.9;
  // يحتوي على
  if (t.includes(q)) return 0.7;
  // تطابق كلمات
  const qWords = q.split(/\s+/);
  const matchedWords = qWords.filter(w => t.includes(w));
  if (matchedWords.length > 0) return 0.5 * (matchedWords.length / qWords.length);
  
  return 0;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} م`;
  return `${(meters / 1000).toFixed(1)} كم`;
}

function deduplicateByLocation(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
  const seen: Array<{ lat: number; lng: number; id: string }> = [];
  return results.filter(r => {
    if (!r.lat || !r.lng) return true; // لا إحداثيات = نحتفظ بها
    const isDupe = seen.some(s => {
      const dist = calculateDistanceMeters(
        { lat: s.lat, lng: s.lng },
        { lat: r.lat!, lng: r.lng! }
      );
      return dist < DEDUPE_RADIUS_METERS;
    });
    if (!isDupe) {
      seen.push({ lat: r.lat, lng: r.lng, id: r.id });
    }
    return !isDupe;
  });
}

// ─── Hook رئيسي ───

export const useUnifiedSearch = (
  userLocation: { lat: number; lng: number } | null,
  userId?: string | null,
) => {
  const [landmarks, setLandmarks] = useState<LandmarkRecord[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const landmarksFetchedRef = useRef(false);

  // ─── جلب المعالم المحلية مع تخزين مؤقت ───
  useEffect(() => {
    if (landmarksFetchedRef.current) return;
    
    const loadLandmarks = async () => {
      // تحقق من الكاش المحلي
      try {
        const cached = localStorage.getItem(LANDMARKS_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < LANDMARKS_CACHE_TTL) {
            setLandmarks(data);
            landmarksFetchedRef.current = true;
            return;
          }
        }
      } catch { /* ignore */ }

      try {
        const { data, error } = await supabase
          .from('landmarks')
          .select('id, name_ar, name_en, category, location, is_active')
          .eq('is_active', true)
          .limit(500);

        if (!error && data) {
          const parsed = (data as any[]).map(d => ({
            id: d.id,
            name_ar: d.name_ar,
            name_en: d.name_en,
            category: d.category,
            location: d.location,
            is_active: d.is_active,
          }));
          setLandmarks(parsed);
          landmarksFetchedRef.current = true;
          // حفظ في الكاش
          try {
            localStorage.setItem(LANDMARKS_CACHE_KEY, JSON.stringify({
              data: parsed,
              timestamp: Date.now(),
            }));
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error('Error loading landmarks:', err);
      }
    };

    loadLandmarks();
  }, []);

  // ─── جلب الأماكن المحفوظة ───
  useEffect(() => {
    if (!userId) {
      setSavedPlaces([]);
      return;
    }

    const loadSaved = async () => {
      try {
        const { data, error } = await supabase
          .from('saved_places')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setSavedPlaces(data as unknown as SavedPlace[]);
        }
      } catch (err) {
        console.error('Error loading saved places:', err);
      }
    };

    loadSaved();
  }, [userId]);

  // ─── البحث في المصادر المحلية ───
  const searchLocal = useCallback((
    query: string,
    recentSearches: RecentSearch[],
  ): UnifiedSearchResult[] => {
    if (!query.trim()) return [];
    const q = query.trim();
    const results: UnifiedSearchResult[] = [];

    // 1. بحث في الأماكن المحفوظة
    for (const place of savedPlaces) {
      const nameScore = Math.max(
        fuzzyMatch(place.name, q),
        fuzzyMatch(place.address, q),
        fuzzyMatch(place.label, q),
      );
      if (nameScore > 0.3) {
        const distM = userLocation
          ? calculateDistanceMeters(userLocation, { lat: place.lat, lng: place.lng })
          : undefined;
        results.push({
          id: `saved_${place.id}`,
          source: 'saved',
          main_text: place.name,
          secondary_text: place.address,
          description: place.address,
          lat: place.lat,
          lng: place.lng,
          distance_meters: distM,
          distance_text: distM != null ? formatDistance(distM) : undefined,
          score: SOURCE_WEIGHTS.saved * nameScore,
          badge: 'saved',
          icon_type: place.icon || 'heart',
        });
      }
    }

    // 2. بحث في البحوثات السابقة
    for (const search of recentSearches) {
      const nameScore = Math.max(
        fuzzyMatch(search.mainText, q),
        fuzzyMatch(search.address, q),
        fuzzyMatch(search.secondaryText || '', q),
      );
      if (nameScore > 0.3) {
        const distM = userLocation
          ? calculateDistanceMeters(userLocation, { lat: search.lat, lng: search.lng })
          : undefined;
        results.push({
          id: `recent_${search.id}`,
          source: 'recent',
          main_text: search.mainText,
          secondary_text: search.secondaryText,
          description: search.address,
          lat: search.lat,
          lng: search.lng,
          distance_meters: distM,
          distance_text: distM != null ? formatDistance(distM) : undefined,
          score: SOURCE_WEIGHTS.recent * nameScore,
          badge: 'recent',
          icon_type: 'clock',
        });
      }
    }

    // 3. بحث في المعالم المحلية
    for (const lm of landmarks) {
      if (!lm.location) continue;
      const nameScore = Math.max(
        fuzzyMatch(lm.name_ar, q),
        fuzzyMatch(lm.name_en || '', q),
        fuzzyMatch(lm.category || '', q),
      );
      if (nameScore > 0.3) {
        const distM = userLocation
          ? calculateDistanceMeters(userLocation, lm.location)
          : undefined;
        // تعزيز درجة الأماكن القريبة
        const proximityBonus = distM != null && distM < 3000 ? 10 : 0;
        results.push({
          id: `landmark_${lm.id}`,
          source: 'landmark',
          main_text: lm.name_ar,
          secondary_text: lm.name_en || undefined,
          description: lm.name_ar,
          lat: lm.location.lat,
          lng: lm.location.lng,
          distance_meters: distM,
          distance_text: distM != null ? formatDistance(distM) : undefined,
          score: SOURCE_WEIGHTS.landmark * nameScore + proximityBonus,
          category: lm.category || undefined,
          icon_type: lm.category || 'map-pin',
        });
      }
    }

    return results;
  }, [savedPlaces, landmarks, userLocation]);

  // ─── دمج النتائج المحلية مع Google ───
  const mergeResults = useCallback((
    localResults: UnifiedSearchResult[] = [],
    googleResults: Array<{
      place_id: string;
      main_text: string;
      secondary_text?: string;
      description: string;
      distance_meters?: number;
      distance_text?: string;
    }> = [],
  ): UnifiedSearchResult[] => {
    // تحويل نتائج Google لصيغة موحدة
    const googleUnified: UnifiedSearchResult[] = (googleResults ?? []).map((g, i) => ({
      id: `google_${g.place_id}`,
      source: 'google' as const,
      place_id: g.place_id,
      main_text: g.main_text,
      secondary_text: g.secondary_text,
      description: g.description,
      distance_meters: g.distance_meters,
      distance_text: g.distance_text,
      // ترتيب Google حسب ترتيبه الأصلي (أول نتيجة = أعلى)
      score: SOURCE_WEIGHTS.google - (i * 2),
      icon_type: 'map-pin',
    }));

    // دمج وإزالة التكرار
    const allResults = [...(localResults ?? []), ...googleUnified];
    const deduped = deduplicateByLocation(allResults);
    
    // ترتيب حسب الدرجة (الأعلى أولاً)
    deduped.sort((a, b) => b.score - a.score);
    
    return deduped;
  }, []);

  // ─── الاقتراحات الذكية (Zero-State) ───
  const getSmartSuggestions = useCallback((): SmartSuggestion[] => {
    if (!userLocation) return [];
    
    const suggestions: SmartSuggestion[] = [];
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // اقتراحات حسب الوقت
    if (hour >= 6 && hour <= 9) {
      suggestions.push({
        id: 'smart_work',
        type: 'work',
        title: 'الذهاب للعمل',
        subtitle: 'بناءً على وقت الدوام الصباحي',
        address: '',
        lat: 0, lng: 0,
        confidence: 0.8,
        reason: 'وقت الذهاب للعمل',
      });
    } else if (hour >= 12 && hour <= 14) {
      suggestions.push({
        id: 'smart_lunch',
        type: 'lunch',
        title: 'وقت الغداء',
        subtitle: 'مطاعم قريبة منك',
        address: '',
        lat: 0, lng: 0,
        confidence: 0.6,
        reason: 'وقت الغداء',
      });
    } else if (hour >= 16 && hour <= 20) {
      suggestions.push({
        id: 'smart_home',
        type: 'home',
        title: 'العودة للمنزل',
        subtitle: 'بناءً على وقت العودة المعتاد',
        address: '',
        lat: 0, lng: 0,
        confidence: 0.75,
        reason: 'وقت العودة من العمل',
      });
    }

    // اقتراحات نهاية الأسبوع (الجمعة والسبت في العراق)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      suggestions.push({
        id: 'smart_weekend',
        type: 'shopping',
        title: 'تسوق وترفيه',
        subtitle: 'عطلة نهاية الأسبوع',
        address: '',
        lat: 0, lng: 0,
        confidence: 0.5,
        reason: 'عطلة نهاية الأسبوع',
      });
    }

    // ربط بالأماكن المحفوظة (بيت + عمل)
    for (const place of savedPlaces) {
      const label = (place.label || '').toLowerCase();
      const icon = (place.icon || '').toLowerCase();
      
      if (label.includes('home') || label.includes('بيت') || label.includes('منزل') || icon === 'home') {
        const existing = suggestions.find(s => s.type === 'home');
        if (existing) {
          existing.address = place.address;
          existing.lat = place.lat;
          existing.lng = place.lng;
          existing.confidence = 0.95;
          existing.subtitle = place.name;
        }
      }
      
      if (label.includes('work') || label.includes('عمل') || label.includes('دوام') || icon === 'briefcase') {
        const existing = suggestions.find(s => s.type === 'work');
        if (existing) {
          existing.address = place.address;
          existing.lat = place.lat;
          existing.lng = place.lng;
          existing.confidence = 0.95;
          existing.subtitle = place.name;
        }
      }
    }

    // فلتر: أزل الاقتراحات بدون إحداثيات حقيقية (لم ترتبط بأماكن محفوظة)
    // نحتفظ بها كاقتراحات عامة حتى لو لم تكن مربوطة
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }, [userLocation, savedPlaces]);

  // ─── أقرب المعالم (للـ Zero-State) ───
  const getNearbyLandmarks = useCallback((limit = 3): UnifiedSearchResult[] => {
    if (!userLocation || landmarks.length === 0) return [];
    
    const withDistance = landmarks
      .filter(lm => lm.location)
      .map(lm => {
        const distM = calculateDistanceMeters(userLocation, lm.location!);
        return { lm, distM };
      })
      .filter(({ distM }) => distM < 20000) // ضمن 20 كم
      .sort((a, b) => a.distM - b.distM)
      .slice(0, limit);

    return withDistance.map(({ lm, distM }) => ({
      id: `landmark_${lm.id}`,
      source: 'landmark' as const,
      main_text: lm.name_ar,
      secondary_text: lm.name_en || undefined,
      description: lm.name_ar,
      lat: lm.location!.lat,
      lng: lm.location!.lng,
      distance_meters: distM,
      distance_text: formatDistance(distM),
      score: SOURCE_WEIGHTS.landmark,
      category: lm.category || undefined,
      icon_type: lm.category || 'map-pin',
    }));
  }, [userLocation, landmarks]);

  // ─── البحث الأوفلاين (fallback عند فشل Google) ───
  const searchOffline = useCallback((
    query: string,
    recentSearches: RecentSearch[],
  ): UnifiedSearchResult[] => {
    const localResults = searchLocal(query, recentSearches);
    localResults.sort((a, b) => b.score - a.score);
    return deduplicateByLocation(localResults);
  }, [searchLocal]);

  return {
    savedPlaces,
    landmarks,
    searchLocal,
    mergeResults,
    getSmartSuggestions,
    getNearbyLandmarks,
    searchOffline,
  };
};
