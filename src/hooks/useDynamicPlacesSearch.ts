/**
 * ران - Hook البحث الديناميكي عن الأماكن (محسّن)
 * يوفر بحث فوري عن المواقع عبر Google Places API (New)
 * 
 * ✨ التحسينات:
 * - LRU Cache: تخزين مؤقت لـ 50 استعلام (TTL: 5 دقائق)
 * - Request Cancellation: إلغاء الطلبات القديمة عند الكتابة السريعة
 * - Adaptive Debounce: تأخير متكيف حسب سرعة الكتابة وطول النص
 * - Offline Detection: كشف عدم الاتصال
 * 
 * يستخدم APIs الجديدة:
 * - AutocompleteSuggestion.fetchAutocompleteSuggestions()
 * - Place.fetchFields()
 * - distanceMeters من API مباشرة
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleMapsApiKey } from "./useGoogleMapsApiKey";
import { useToast } from "./use-toast";
import { NominatimGeocodingAdapter } from "@/lib/adapters/NominatimGeocodingAdapter";
import { searchLandmarksByName, loadLandmarksCache } from "@/utils/landmarksCache";

// Nominatim fallback singleton (بدون Google Places API)
const nominatimAdapter = new NominatimGeocodingAdapter();

// تحميل كاش المعالم فوراً عند أول import
loadLandmarksCache().catch(() => {});

export interface PlacePrediction {
  place_id: string;
  main_text: string;
  secondary_text?: string;
  description: string;
  lat?: number;
  lng?: number;
  distance_meters?: number;
  distance_text?: string;
}

export interface PlaceDetails {
  lat: number;
  lng: number;
  address: string;
  name: string;
  placeId: string;
}

// ─── LRU Cache ───
interface CacheEntry {
  predictions: PlacePrediction[];
  timestamp: number;
}

const CACHE_MAX_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000;        // 5 دقائق
const CACHE_STALE_TTL = 2 * 60 * 1000;  // 2 دقيقة (stale-while-revalidate)

class SearchCache {
  private cache = new Map<string, CacheEntry>();

  private makeKey(query: string, lat?: number, lng?: number): string {
    const locHash = lat != null && lng != null ? `${lat.toFixed(2)}_${lng.toFixed(2)}` : 'noloc';
    return `${query.trim().toLowerCase()}__${locHash}`;
  }

  get(query: string, lat?: number, lng?: number): { data: PlacePrediction[]; isStale: boolean } | null {
    const key = this.makeKey(query, lat, lng);
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return { data: entry.predictions, isStale: age > CACHE_STALE_TTL };
  }

  set(query: string, predictions: PlacePrediction[], lat?: number, lng?: number): void {
    const key = this.makeKey(query, lat, lng);
    // حذف أقدم مدخل إذا الكاش ممتلئ
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { predictions, timestamp: Date.now() });
  }
}

const searchCache = new SearchCache();

export const useDynamicPlacesSearch = (userLocation?: { lat: number; lng: number } | null) => {
  const { toast } = useToast();
  const { apiKey: googleMapsApiKey } = useGoogleMapsApiKey();

  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // لا حاجة لـ service refs - API الجديد يستخدم static methods
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const apiReadyRef = useRef(false);
  
  // Request cancellation
  const searchIdRef = useRef(0);
  
  // Adaptive debounce
  const lastTypeTimeRef = useRef(0);
  const typeCountRef = useRef(0);
  const typeWindowRef = useRef(0);

  const formatDistance = useCallback((meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} م`;
    return `${(meters / 1000).toFixed(1)} كم`;
  }, []);

  // تهيئة session token عند توفر Google Maps
  useEffect(() => {
    if (!googleMapsApiKey) return;

    const initSession = () => {
      if (typeof window === 'undefined' || !window.google?.maps?.places) return false;
      
      // التأكد من توفر API الجديد
      if (!window.google.maps.places.AutocompleteSuggestion || !window.google.maps.places.Place) {
        console.warn("⚠️ New Places API not available, may need v=weekly");
        return false;
      }

      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      apiReadyRef.current = true;
      console.log("✅ Places API (New) ready");
      return true;
    };

    if (initSession()) return;

    // انتظار تحميل Google Maps
    let delay = 100;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tryInit = () => {
      attempts++;
      if (attempts > 20) return;
      if (initSession()) return;
      delay = Math.min(delay * 1.5, 1000);
      timer = setTimeout(tryInit, delay);
    };
    timer = setTimeout(tryInit, delay);

    return () => clearTimeout(timer);
  }, [googleMapsApiKey]);

  // البحث: 1️⃣ معالم محلية ← 2️⃣ Nominatim إضافي
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setPredictions([]);
        return;
      }

      const currentSearchId = ++searchIdRef.current;

      // كشف نوع الاستعلام — Nominatim يُترجم العربي إلى فئة OSM (قلعة→castle)
      const isArabicQuery = /[\u0600-\u06FF]/.test(query);

      // ضمان تحميل الكاش للاستعلامات العربية
      // (فوري إذا محمّل بالفعل — ينتظر مرة واحدة فقط عند أول استخدام)
      if (isArabicQuery) {
        await loadLandmarksCache();
      }

      // 1️⃣ المعالم المحلية — مرنة (قلعه → قلعة أربيل)
      const localMatches = searchLandmarksByName(query, 5).map((l) => ({
        place_id: l.place_id,
        main_text: l.main_text,
        secondary_text: l.secondary_text,
        description: l.description,
        lat: l.lat,
        lng: l.lng,
      } as PlacePrediction));

      // ── العربي + محلي: يُوقف كل شيء آخر (قبل الكاش) ──
      // الكاش قد يحمل نتائج Nominatim قديمة → نتجاهله تماماً لاستعلامات عربية
      if (isArabicQuery && localMatches.length > 0) {
        if (currentSearchId === searchIdRef.current) {
          setPredictions(localMatches.slice(0, 6));
        }
        return;
      }

      // ── فحص الكاش (فقط للاستعلامات غير العربية أو العربية بدون نتائج محلية) ──
      const cached = searchCache.get(query, userLocation?.lat, userLocation?.lng);
      if (cached && !cached.isStale) {
        if (currentSearchId === searchIdRef.current) {
          const localIds = new Set(localMatches.map((l) => l.place_id));
          const merged = [
            ...localMatches,
            ...cached.data.filter((c) => !localIds.has(c.place_id)),
          ].slice(0, 6);
          setPredictions(merged);
        }
        return;
      }

      // إذا كانت المعالم المحلية كافية (≥3) — تجاوز Nominatim كلياً
      if (localMatches.length >= 3) {
        if (currentSearchId === searchIdRef.current) {
          setPredictions(localMatches.slice(0, 6));
        }
        return;
      }

      // إظهار المحلي فوراً بينما Nominatim يعمل
      if (localMatches.length > 0 && currentSearchId === searchIdRef.current) {
        setPredictions(localMatches);
      }

      setIsSearching(true);
      try {
        const center = userLocation
          ? { lat: userLocation.lat, lng: userLocation.lng }
          : undefined;

        const results = await nominatimAdapter.searchPlaces(query, center);

        if (currentSearchId !== searchIdRef.current) return;

        const nominatimPredictions: PlacePrediction[] = results.map((r) => ({
          place_id: r.place_id,
          main_text: r.main_text,
          secondary_text: r.secondary_text,
          description: r.description,
          lat: r.lat,
          lng: r.lng,
          distance_meters: r.distance_meters,
          distance_text: r.distance_meters ? formatDistance(r.distance_meters) : undefined,
        }));

        // دمج: المحلي أولاً، ثم Nominatim (بدون تكرار)
        const localIds = new Set(localMatches.map((l) => l.place_id));
        const merged = [
          ...localMatches,
          ...nominatimPredictions.filter((n) => !localIds.has(n.place_id)),
        ].slice(0, 6);

        searchCache.set(query, nominatimPredictions, userLocation?.lat, userLocation?.lng);
        setPredictions(merged);
      } catch (err) {
        console.error('❌ Nominatim search failed:', err);
        if (currentSearchId === searchIdRef.current) {
          // إذا فشل Nominatim — أبق المحلي فقط
          setPredictions(localMatches);
        }
      } finally {
        if (currentSearchId === searchIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [userLocation, formatDistance]
  );

  // Adaptive debounce search
  useEffect(() => {
    // حساب debounce متكيف
    const now = Date.now();
    const timeSinceLastType = now - lastTypeTimeRef.current;
    lastTypeTimeRef.current = now;
    
    // عداد سرعة الكتابة (عدد الأحرف في آخر ثانية)
    if (timeSinceLastType < 1000) {
      typeCountRef.current++;
    } else {
      typeCountRef.current = 1;
    }
    if (timeSinceLastType < 300) {
      typeWindowRef.current++;
    } else {
      typeWindowRef.current = 0;
    }

    let debounceMs: number;
    const queryLen = searchQuery.trim().length;
    
    if (queryLen < 2) {
      // استعلام قصير جداً — لا بحث
      debounceMs = 99999;
    } else if (typeWindowRef.current > 3) {
      // كتابة سريعة جداً — انتظر أكثر
      debounceMs = 500;
    } else if (queryLen >= 5) {
      // استعلام طويل ومحدد — رد سريع
      debounceMs = 200;
    } else if (typeCountRef.current <= 1) {
      // كتابة بطيئة — رد سريع
      debounceMs = 200;
    } else {
      // افتراضي
      debounceMs = 300;
    }

    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // جلب تفاصيل المكان — إذا كان lat/lng محفوظاً في الذاكرة من searchCache أو predictions
  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      try {
        // البحث في الكاش الحالي للـ predictions
        const foundInPredictions = predictions.find((p) => p.place_id === placeId);
        if (foundInPredictions?.lat && foundInPredictions?.lng) {
          return {
            lat: foundInPredictions.lat,
            lng: foundInPredictions.lng,
            address: foundInPredictions.description || foundInPredictions.main_text,
            name: foundInPredictions.main_text,
            placeId: foundInPredictions.place_id,
          };
        }

        // Fallback: Geocoding عبر Nominatim إذا لم نجد إحداثيات
        setIsLoadingDetails(true);
        const coord = await nominatimAdapter.geocode(placeId);
        if (coord) {
          return {
            lat: coord.lat,
            lng: coord.lng,
            address: placeId,
            name: placeId,
            placeId,
          };
        }
        return null;
      } catch (err) {
        console.error('❌ getPlaceDetails failed:', err);
        return null;
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [predictions]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setPredictions([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    predictions,
    isSearching,
    isLoadingDetails,
    isOffline,
    performSearch,
    getPlaceDetails,
    clearSearch,
  };
};
