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

  // البحث الأساسي باستخدام AutocompleteSuggestion API الجديد + Cache + Cancellation
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.trim().length < 2) {
        setPredictions([]);
        return;
      }

      // Request cancellation ID
      const currentSearchId = ++searchIdRef.current;

      // ─── تحقق من الكاش أولاً ───
      const cached = searchCache.get(query, userLocation?.lat, userLocation?.lng);
      if (cached) {
        setPredictions(cached.data);
        if (!cached.isStale) {
          return; // كاش طازج — لا حاجة لاستدعاء API
        }
        // كاش قديم — نعرض الكاش ونحدث بالخلفية
      }

      if (!apiReadyRef.current) {
        // أوفلاين أو API غير جاهز
        setIsOffline(true);
        if (!cached) setPredictions([]);
        return;
      }

      setIsOffline(false);
      if (!cached) setIsSearching(true);
      
      try {
        // ✨ بحث مع نطاقات متزايدة
        const radiuses = userLocation ? [5000, 10000, 20000] : [20000];
        let formattedPredictions: PlacePrediction[] = [];

        // مركز الرمادي الافتراضي للتحيز الجغرافي
        const ramadiCenter = new google.maps.LatLng(33.4233, 43.2974);
        
        for (const radius of radiuses) {
          if (formattedPredictions.length > 0) break;
          
          console.log(`🔍 Search attempt with ${radius / 1000}km radius...`);
          
          const request: any = {
            input: query,
            language: "ar",
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ["iq"],
          };

          // تحيز البحث نحو الرمادي — حتى لو لم يتوفر موقع المستخدم
          const biasCenter = userLocation
            ? new google.maps.LatLng(userLocation.lat, userLocation.lng)
            : ramadiCenter;
          request.locationBias = { center: biasCenter, radius };
          request.origin = biasCenter;

          const { suggestions } = await google.maps.places.AutocompleteSuggestion
            .fetchAutocompleteSuggestions(request);

          if (suggestions && suggestions.length > 0) {
            formattedPredictions = suggestions
              .filter(s => s.placePrediction)
              .map((s) => {
                const pred = s.placePrediction!;
                const distMeters = pred.distanceMeters ?? undefined;
                return {
                  place_id: pred.placeId,
                  main_text: pred.mainText.text,
                  secondary_text: pred.secondaryText?.text,
                  description: pred.text.text,
                  distance_meters: distMeters,
                  distance_text: distMeters != null ? formatDistance(distMeters) : undefined,
                };
              });
            
            console.log(`✅ Found ${formattedPredictions.length} results at ${radius / 1000}km radius`);
            break;
          }
        }

        // فرز وفلترة حسب المسافة (إذا متوفرة من API)
        if (userLocation && formattedPredictions.length > 0) {
          // فرز حسب المسافة (الأقرب أولاً)
          formattedPredictions.sort((a, b) => {
            const da = a.distance_meters ?? Number.POSITIVE_INFINITY;
            const db = b.distance_meters ?? Number.POSITIVE_INFINITY;
            return da - db;
          });

          // فلترة النتائج البعيدة جداً
          const hasNearby = formattedPredictions.some(p => (p.distance_meters ?? Infinity) <= 5000);
          if (hasNearby) {
            formattedPredictions = formattedPredictions.filter(p => {
              if ((p.distance_meters ?? Infinity) > 5000) {
                console.log(`🚫 Filtered out distant result: ${p.main_text} (${p.distance_text})`);
                return false;
              }
              return true;
            });
          }

          console.log(`✅ Results after distance sorting:`);
          formattedPredictions.slice(0, 5).forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.main_text} - ${p.distance_text ?? 'N/A'}`);
          });
        }

        console.log(`✅ Found ${formattedPredictions.length} results (sorted by distance)`);
        
        // ─── Cancellation check — تجاهل إذا هناك بحث أحدث ───
        if (currentSearchId !== searchIdRef.current) return;
        
        // ─── حفظ في الكاش ───
        searchCache.set(query, formattedPredictions, userLocation?.lat, userLocation?.lng);
        
        setPredictions(formattedPredictions);
      } catch (error: any) {
        console.error("❌ Search error:", error);
        
        if (error.message?.includes('REQUEST_DENIED')) {
          console.error("⚠️ Places API: REQUEST_DENIED - تحقق من Google Cloud Console");
          toast({
            title: "⚠️ خطأ في الاتصال",
            description: "تعذر الاتصال بخدمة البحث، حاول مرة أخرى",
            variant: "destructive",
          });
        } else if (!error.message?.includes('ZERO_RESULTS')) {
          console.error("⚠️ Unexpected search error:", error.message);
        }
        
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [userLocation, toast, formatDistance]
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

  // جلب تفاصيل المكان باستخدام Place (New) API
  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      if (!apiReadyRef.current) {
        console.error("Places API (New) not ready");
        return null;
      }

      setIsLoadingDetails(true);
      try {
        const place = new google.maps.places.Place({ id: placeId });
        await place.fetchFields({
          fields: ["formattedAddress", "location", "displayName", "id"],
        });

        if (place.location && place.formattedAddress) {
          // تجديد session token بعد الاختيار
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

          return {
            lat: place.location.lat(),
            lng: place.location.lng(),
            address: place.formattedAddress,
            name: place.displayName || "",
            placeId: place.id || placeId,
          };
        }
        return null;
      } catch (error: any) {
        console.error("Error getting place details:", error);
        
        let errorMessage = "حدث خطأ أثناء جلب تفاصيل الموقع";
        
        if (error.message?.includes('REQUEST_DENIED')) {
          errorMessage = "API Key غير مصرح له باستخدام Places API";
          console.error("⚠️ Places Details: REQUEST_DENIED - Check API Restrictions");
        }
        
        toast({
          title: "خطأ في جلب التفاصيل",
          description: errorMessage,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [toast]
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
