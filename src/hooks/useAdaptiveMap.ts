/**
 * ران — useAdaptiveMap Hook
 * يدير خريطة مع automatic provider switching (fallback chain)
 * - يحاول OpenStreetMap أولاً
 * - إذا فشل، يحاول Google Maps
 * - إذا فشل، يعرض Static fallback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IMapAdapter, MapProvider, Coordinate, MapOptions } from '@/lib/adapters';
import { AdapterFactory, FEATURE_FLAGS, MapAdapterFactory } from '@/lib/adapters';

interface UseAdaptiveMapOptions extends MapOptions {
  enabled?: boolean;
}

interface UseAdaptiveMapReturn {
  currentAdapter: IMapAdapter | null;
  currentProvider: MapProvider | null;
  error: string | null;
  isLoading: boolean;
  switchProvider: (provider: MapProvider) => Promise<boolean>;
  canFallback: boolean;
  retryCount: number;
}

export const useAdaptiveMap = (options: UseAdaptiveMapOptions): UseAdaptiveMapReturn => {
  const { enabled = true, ...mapOptions } = options;

  const [currentAdapter, setCurrentAdapter] = useState<IMapAdapter | null>(null);
  const [currentProvider, setCurrentProvider] = useState<MapProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const adaptersRef = useRef<Map<MapProvider, IMapAdapter>>(new Map());
  const loadingRef = useRef(false);

  /**
   * تحميل adaptive map مع fallback chain
   */
  useEffect(() => {
    if (!enabled || loadingRef.current) return;

    loadingRef.current = true;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
          console.log('🗺️ [useAdaptiveMap] Starting map initialization...');
        }

        // جرب AdapterFactory (automatic fallback)
        const result = await AdapterFactory.createMapAdapter();
        const { adapter, provider } = result;

        // تخزين الـ adapter
        adaptersRef.current.set(provider, adapter);

        // تحميل الخريطة
        if (mapOptions && Object.keys(mapOptions).length > 0) {
          // تأجيل التحميل إلى بعد المكون render
          queueMicrotask(() => {
            // الخريطة ستُحمّل في useEffect آخر
          });
        }

        setCurrentAdapter(adapter);
        setCurrentProvider(provider);
        setError(null);
        setRetryCount(0);

        if (FEATURE_FLAGS.LOG_PROVIDER_SWITCHES) {
          console.log(`✅ [mapAdapter] Initialized with ${provider}`);
        }
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize map';
        console.error('❌ [useAdaptiveMap] Error:', errorMsg);
        setError(errorMsg);
        setCurrentAdapter(null);
        setCurrentProvider(null);
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    })();

    return () => {
      // Cleanup on unmount
      adaptersRef.current.forEach(adapter => {
        try {
          adapter.destroy();
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      });
      adaptersRef.current.clear();
    };
  }, [enabled]);

  /**
   * محاولة التبديل إلى provider آخر
   */
  const switchProvider = useCallback(async (newProvider: MapProvider): Promise<boolean> => {
    try {
      if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
        console.log(`🔄 [useAdaptiveMap] Switching to ${newProvider}...`);
      }

      // جرب الـ adapter المطلوب
      let adapter = adaptersRef.current.get(newProvider);

      if (!adapter) {
        // إذا لم يكن موجود، حمّله
        try {
          const newAdapter = await MapAdapterFactory.create(newProvider);
          adaptersRef.current.set(newProvider, newAdapter);
          adapter = newAdapter;
        } catch (err) {
          console.error(`❌ Failed to create ${newProvider} adapter:`, err);
          return false;
        }
      }

      setCurrentAdapter(adapter ?? null);
      setCurrentProvider(newProvider);
      setError(null);

      if (FEATURE_FLAGS.LOG_PROVIDER_SWITCHES) {
        console.log(`✅ Switched to ${newProvider}`);
      }

      return true;
    } catch (err: any) {
      console.error('Switch provider error:', err);
      return false;
    }
  }, []);

  /**
   * إعادة المحاولة عند الفشل
   */
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setIsLoading(true);
      loadingRef.current = false; // جرب التحميل مرة أخرى
    }
  }, [retryCount]);

  return {
    currentAdapter,
    currentProvider,
    error,
    isLoading,
    switchProvider,
    canFallback: true,
    retryCount,
  };
};

// ============================================================
// HELPER: useMapInitialization
// استخدمها لـ initialize الخريطة في HTML container
// ============================================================

export const useMapInitialization = (
  adapter: IMapAdapter | null,
  containerRef: React.RefObject<HTMLDivElement>,
  options: MapOptions
) => {
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!adapter || !containerRef.current || initRef.current) return;

    initRef.current = true;

    (async () => {
      try {
        const map = await adapter.createMap(containerRef.current!, options);
        setMapInstance(map);
        setInitError(null);
      } catch (err: any) {
        console.error('❌ Map initialization error:', err);
        setInitError(err.message);
      }
    })();

    return () => {
      if (mapInstance && adapter) {
        try {
          adapter.destroy();
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }
    };
  }, [adapter, containerRef, options]);

  return { mapInstance, initError };
};

// ============================================================
// LOG
// ============================================================

if (FEATURE_FLAGS.DEBUG_ADAPTERS) {
  console.log('🎣 useAdaptiveMap hook module loaded');
}
