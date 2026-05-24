/**
 * ران — useAdaptiveRouting Hook
 * يدير المسارات مع:
 * - Automatic provider switching (OSRM → fallback)
 * - LRU cache للمسارات المحسوبة
 * - Timeout handling
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IRoutingAdapter, RouteResult, Coordinate, RoutingProvider } from '@/lib/adapters';
import { AdapterFactory, FEATURE_FLAGS, PERFORMANCE_CONFIG } from '@/lib/adapters';

interface UseAdaptiveRoutingOptions {
  enabled?: boolean;
  cacheTTL?: number;
  maxCacheSize?: number;
}

interface CachedRoute {
  result: RouteResult;
  timestamp: number;
}

interface UseAdaptiveRoutingReturn {
  currentAdapter: IRoutingAdapter | null;
  currentProvider: RoutingProvider | null;
  error: string | null;
  isLoading: boolean;
  getRoute: (
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[]
  ) => Promise<RouteResult>;
  getDistance: (origin: Coordinate, destination: Coordinate) => Promise<number>;
  clearCache: () => void;
  getCacheStats: () => { size: number; hits: number; misses: number };
}

export class RouteCache {
  private cache: Map<string, CachedRoute> = new Map();
  private maxSize: number;
  private ttl: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private makeKey(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[]
  ): string {
    const coordStr = (c: Coordinate) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
    const waypointStr = waypoints ? waypoints.map(coordStr).join('→') : '';
    return `${coordStr(origin)}→${coordStr(destination)}${waypointStr ? '→' + waypointStr : ''}`;
  }

  get(
    origin: Coordinate,
    destination: Coordinate,
    waypoints?: Coordinate[]
  ): RouteResult | null {
    const key = this.makeKey(origin, destination, waypoints);
    const cached = this.cache.get(key);

    if (!cached) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return cached.result;
  }

  set(
    origin: Coordinate,
    destination: Coordinate,
    result: RouteResult,
    waypoints?: Coordinate[]
  ): void {
    const key = this.makeKey(origin, destination, waypoints);

    // LRU: remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const useAdaptiveRouting = (
  options: UseAdaptiveRoutingOptions = {}
): UseAdaptiveRoutingReturn => {
  const {
    enabled = true,
    cacheTTL = PERFORMANCE_CONFIG.ROUTE_CACHE_TTL,
    maxCacheSize = PERFORMANCE_CONFIG.ROUTE_CACHE_MAX_SIZE,
  } = options;

  const [currentAdapter, setCurrentAdapter] = useState<IRoutingAdapter | null>(null);
  const [currentProvider, setCurrentProvider] = useState<RoutingProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const cacheRef = useRef(new RouteCache(maxCacheSize, cacheTTL));
  const adaptersRef = useRef<Map<RoutingProvider, IRoutingAdapter>>(new Map());
  const loadingRef = useRef(false);

  /**
   * تحميل adaptive routing
   */
  useEffect(() => {
    if (!enabled || loadingRef.current) return;

    loadingRef.current = true;

    (async () => {
      try {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log('🛣️ [useAdaptiveRouting] Initializing...');
        }

        const result = await AdapterFactory.createRoutingAdapter();
        const { adapter, provider } = result;

        adaptersRef.current.set(provider, adapter);
        setCurrentAdapter(adapter);
        setCurrentProvider(provider);
        setError(null);

        if (FEATURE_FLAGS.LOG_PROVIDER_SWITCHES) {
          console.log(`✅ [routingAdapter] Initialized with ${provider}`);
        }
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize routing';
        console.error('❌ [useAdaptiveRouting]:', errorMsg);
        setError(errorMsg);
      } finally {
        loadingRef.current = false;
      }
    })();

    return () => {
      cacheRef.current.clear();
    };
  }, [enabled]);

  /**
   * حساب المسار (مع caching)
   */
  const getRoute = useCallback(
    async (
      origin: Coordinate,
      destination: Coordinate,
      waypoints?: Coordinate[]
    ): Promise<RouteResult> => {
      // جرب الـ cache أولاً
      const cached = cacheRef.current.get(origin, destination, waypoints);
      if (cached) {
        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log('💾 Route from cache');
        }
        return cached;
      }

      if (!currentAdapter) {
        throw new Error('Routing adapter not initialized');
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await currentAdapter.getRoute(origin, destination, waypoints);

        // Cache الـ result
        cacheRef.current.set(origin, destination, result, waypoints);

        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log(`🛣️ Route calculated: ${(result.distance / 1000).toFixed(1)}km`);
        }

        return result;
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to get route';
        console.error('❌ Route error:', errorMsg);
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentAdapter]
  );

  /**
   * حساب المسافة فقط
   */
  const getDistance = useCallback(
    async (origin: Coordinate, destination: Coordinate): Promise<number> => {
      // جرب الـ cache أولاً
      const cached = cacheRef.current.get(origin, destination);
      if (cached) {
        return cached.distance;
      }

      if (!currentAdapter) {
        throw new Error('Routing adapter not initialized');
      }

      try {
        return await currentAdapter.getDistance(origin, destination);
      } catch (err) {
        console.error('❌ Distance error:', err);
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
      console.log('🗑️ Route cache cleared');
    }
  }, []);

  /**
   * الحصول على إحصائيات الـ cache
   */
  const getCacheStats = useCallback(() => {
    return cacheRef.current.getStats();
  }, []);

  return {
    currentAdapter,
    currentProvider,
    error,
    isLoading,
    getRoute,
    getDistance,
    clearCache,
    getCacheStats,
  };
};

// ============================================================
// LOG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🎣 useAdaptiveRouting hook module loaded');
}
