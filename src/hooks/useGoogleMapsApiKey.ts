import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Default public API key as fallback (from .env)
const DEFAULT_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Cache the API key in memory
let cachedApiKey: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour (was 24h - shorter to pick up changes faster)

/**
 * Validate that an API key is a real Google Maps key (not "none", empty, or placeholder)
 */
const isValidApiKey = (key: unknown): key is string => {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'none' || trimmed === 'null' || trimmed === 'undefined') return false;
  if (!trimmed.startsWith('aizasy') && !trimmed.startsWith('AIzaSy')) return false;
  return trimmed.length >= 30;
};

export const useGoogleMapsApiKey = () => {
  const [apiKey, setApiKey] = useState<string>(cachedApiKey || DEFAULT_API_KEY);
  const [isLoading, setIsLoading] = useState(!cachedApiKey);

  const fetchApiKey = useCallback(async () => {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedApiKey && now - cacheTimestamp < CACHE_DURATION) {
      setApiKey(cachedApiKey);
      setIsLoading(false);
      return cachedApiKey;
    }

    // ✅ Guard: لا تجلب المفتاح من Supabase إن لم يكن هناك جلسة نشطة
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // استخدم المفتاح الافتراضي فقط
      setApiKey(DEFAULT_API_KEY);
      setIsLoading(false);
      return DEFAULT_API_KEY;
    }

    try {
      // جلب المفتاح من app_settings مباشرة (مع fallback إلى env)
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_maps_api_key")
        .maybeSingle();

      // Extract API key from JSONB value
      let fetchedApiKey = DEFAULT_API_KEY;
      if (data?.value) {
        // If value is JSONB object with api_key property
        if (typeof data.value === 'object' && !Array.isArray(data.value)) {
          const valueObj = data.value as Record<string, unknown>;
          const candidate = valueObj.api_key;
          if (isValidApiKey(candidate)) {
            fetchedApiKey = candidate;
          } else {
            console.warn('[Maps] Supabase api_key field is invalid/none — using .env fallback:', candidate);
          }
        }
        // If value is a plain string
        else if (typeof data.value === 'string') {
          if (isValidApiKey(data.value)) {
            fetchedApiKey = data.value;
          } else {
            console.warn('[Maps] Supabase value is invalid/none — using .env fallback:', data.value);
          }
        }
      } else {
        console.log('[Maps] No google_maps_api_key found in app_settings — using .env fallback');
      }

      // Update cache
      cachedApiKey = fetchedApiKey;
      cacheTimestamp = now;

      setApiKey(fetchedApiKey);
      return fetchedApiKey;
    } catch (error) {
      console.warn("Google Maps API key fallback used:", error);
      setApiKey(DEFAULT_API_KEY);
      return DEFAULT_API_KEY;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedApiKey) {
      fetchApiKey();
    }
  }, [fetchApiKey]);

  return {
    apiKey,
    isLoading,
    refetch: fetchApiKey,
  };
};

// Synchronous getter for API key (uses cache or default)
export const getGoogleMapsApiKey = (): string => {
  return cachedApiKey || DEFAULT_API_KEY;
};

// Preload API key (call early in app initialization - only when authenticated)
export const preloadGoogleMapsApiKey = async (): Promise<string> => {
  if (cachedApiKey) return cachedApiKey;

  // ✅ Guard: لا تجلب المفتاح مسبقاً بدون جلسة
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return DEFAULT_API_KEY;
  } catch {
    return DEFAULT_API_KEY;
  }

  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "google_maps_api_key")
      .maybeSingle();

    // Extract API key from JSONB value
    if (data?.value) {
      // If value is JSONB object with api_key property
      if (typeof data.value === 'object' && !Array.isArray(data.value)) {
        const valueObj = data.value as Record<string, unknown>;
        if (isValidApiKey(valueObj.api_key)) {
          cachedApiKey = valueObj.api_key as string;
        }
      }
      // If value is a plain string
      else if (typeof data.value === 'string') {
        if (isValidApiKey(data.value)) {
          cachedApiKey = data.value;
        }
      }
    }

    cacheTimestamp = Date.now();
    return cachedApiKey || DEFAULT_API_KEY;
  } catch {
    return DEFAULT_API_KEY;
  }
};
