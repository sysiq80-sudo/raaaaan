/**
 * ران — useAdaptiveGeocoding Hook
 * يدير الجيوكودينج مع:
 * - Automatic provider switching (Nominatim → fallback)
 * - Search debouncing (300ms)
 * - LRU cache للبحث
 * - Request cancellation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IGeocodingAdapter, Coordinate, PlacePrediction, GeocodingProvider } from '@/lib/adapters';
import { AdapterFactory, FEATURE_FLAGS, PERFORMANCE_CONFIG } from '@/lib/adapters';

interface UseAdaptiveGeocodingOptions {
  enabled?: boolean;
  debounceMs?: number;
  cacheTTL?: number;
  maxCacheSize?: number;
}

interface CachedSearch {
  results: PlacePrediction[];
  timestamp: number;
}

interface UseAdaptiveGeocodingReturn {
  currentAdapter: IGeocodingAdapter | null;
  currentProvider: GeocodingProvider | null;
  error: string | null;
  isSearching: boolean;
  searchPlaces: (query: string, center?: Coordinate) => Promise<PlacePrediction[]>;
  geocode: (address: string, bounds?: any) => Promise<Coordinate | null>;
  reverseGeocode: (lat: number, lng: number) => Promise<string | null>;
  clearCache: () => void;
}

class SearchCache {
  private cache: Map<string, CachedSearch> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 500, ttl: number = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private makeKey(query: string, lat?: number, lng?: number): string {
    const centerStr = lat != null && lng != null ? `${lat.toFixed(2)},${lng.toFixed(2)}` : 'nocenter';
    return `${query.trim().toLowerCase()}|${centerStr}`;
  }

  get(query: string, lat?: number, lng?: number): PlacePrediction[] | null {
    const key = this.makeKey(query, lat, lng);
    const cached = this.cache.get(key);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.results;
  }

  set(query: string, results: PlacePrediction[], lat?: number, lng?: number): void {
    const key = this.makeKey(query, lat, lng);

    // LRU: remove oldest if full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { results, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const useAdaptiveGeocoding = (
  options: UseAdaptiveGeocodingOptions = {}
): UseAdaptiveGeocodingReturn => {
  const {
    enabled = true,
    debounceMs = PERFORMANCE_CONFIG.SEARCH_DEBOUNCE_MS,
    cacheTTL = PERFORMANCE_CONFIG.GEOCODE_CACHE_TTL,
    maxCacheSize = PERFORMANCE_CONFIG.GEOCODE_CACHE_MAX_SIZE,
  } = options;

  const [currentAdapter, setCurrentAdapter] = useState<IGeocodingAdapter | null>(null);
  const [currentProvider, setCurrentProvider] = useState<GeocodingProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const cacheRef = useRef(new SearchCache(maxCacheSize, cacheTTL));
  const adaptersRef = useRef<Map<GeocodingProvider, IGeocodingAdapter>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  /**
   * تحميل adaptive geocoding
   */
  useEffect(() => {
    if (!enabled || loadingRef.current) return;

    loadingRef.current = true;

    (async () => {
      try {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log('🔍 [useAdaptiveGeocoding] Initializing...');
        }

        const result = await AdapterFactory.createGeocodingAdapter();
        const { adapter, provider } = result;

        adaptersRef.current.set(provider, adapter);
        setCurrentAdapter(adapter);
        setCurrentProvider(provider);
        setError(null);

        if (FEATURE_FLAGS.LOG_PROVIDER_SWITCHES) {
          console.log(`✅ [geocodingAdapter] Initialized with ${provider}`);
        }
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize geocoding';
        console.error('❌ [useAdaptiveGeocoding]:', errorMsg);
        setError(errorMsg);
      } finally {
        loadingRef.current = false;
      }
    })();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cacheRef.current.clear();
    };
  }, [enabled]);

  /**
   * البحث عن أماكن مع debounce
   */
  const searchPlaces = useCallback(
    (query: string, center?: Coordinate): Promise<PlacePrediction[]> => {
      return new Promise((resolve, reject) => {
        // الغي الـ timer السابق
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // الغي الـ request السابق
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // إذا كان الـ query فارغ
        if (!query || query.trim().length === 0) {
          resolve([]);
          return;
        }

        // جرب الـ cache أولاً
        const cached = cacheRef.current.get(query, center?.lat, center?.lng);
        if (cached) {
          if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
            console.log('💾 Search results from cache');
          }
          resolve(cached);
          return;
        }

        // Debounce الـ search
        debounceTimerRef.current = setTimeout(async () => {
          if (!currentAdapter) {
            reject(new Error('Geocoding adapter not initialized'));
            return;
          }

          try {
            setIsSearching(true);
            setError(null);

            const results = await currentAdapter.searchPlaces(query, center);

            // Cache الـ results
            cacheRef.current.set(query, results, center?.lat, center?.lng);

            if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
              console.log(`🔍 Search found ${results.length} results for "${query}"`);
            }

            resolve(results);
          } catch (err: any) {
            // Skip abort errors
            if (err.name === 'AbortError') {
              return;
            }

            const errorMsg = err instanceof Error ? err.message : 'Search failed';
            console.error('❌ Search error:', errorMsg);
            setError(errorMsg);
            reject(err);
          } finally {
            setIsSearching(false);
          }
        }, debounceMs);
      });
    },
    [currentAdapter, debounceMs]
  );

  /**
   * Geocode عنوان
   */
  const geocode = useCallback(
    async (address: string, bounds?: any): Promise<Coordinate | null> => {
      if (!currentAdapter) {
        throw new Error('Geocoding adapter not initialized');
      }

      try {
        return await currentAdapter.geocode(address, bounds);
      } catch (err) {
        console.error('❌ Geocode error:', err);
        throw err;
      }
    },
    [currentAdapter]
  );

  /**
   * Reverse geocode إحداثيات
   */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      if (!currentAdapter) {
        throw new Error('Geocoding adapter not initialized');
      }

      try {
        return await currentAdapter.reverseGeocode(lat, lng);
      } catch (err) {
        console.error('❌ Reverse geocode error:', err);
        throw err;
      }
    },
    [currentAdapter]
  );

  /**
   * مسح الـ cache
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
      console.log('🗑️ Geocoding cache cleared');
    }
  }, []);

  return {
    currentAdapter,
    currentProvider,
    error,
    isSearching,
    searchPlaces,
    geocode,
    reverseGeocode,
    clearCache,
  };
};

// ============================================================
// LOG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🎣 useAdaptiveGeocoding hook module loaded');
}
