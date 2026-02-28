import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Default public API key as fallback (restricted to your domain in Google Cloud Console)
const DEFAULT_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Cache the API key in memory
let cachedApiKey: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

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
          if (valueObj.api_key) {
            fetchedApiKey = valueObj.api_key as string;
          }
        }
        // If value is a plain string
        else if (typeof data.value === 'string') {
          fetchedApiKey = data.value;
        }
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
        if (valueObj.api_key) {
          cachedApiKey = valueObj.api_key as string;
        }
      }
      // If value is a plain string
      else if (typeof data.value === 'string') {
        cachedApiKey = data.value;
      }
    }

    cacheTimestamp = Date.now();
    return cachedApiKey || DEFAULT_API_KEY;
  } catch {
    return DEFAULT_API_KEY;
  }
};
