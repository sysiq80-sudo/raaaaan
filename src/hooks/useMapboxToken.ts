import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Default public token as fallback
const DEFAULT_TOKEN =
  "pk.eyJ1IjoicmFhbmFpIiwiYSI6ImNtajQxYjQ1YzB3M3ozZnM0bW9xaDB2eXgifQ.k9lvJOuDjRHL198DEb9YVw";

// Cache the token in memory
let cachedToken: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

export const useMapboxToken = () => {
  const [token, setToken] = useState<string>(cachedToken || DEFAULT_TOKEN);
  const [isLoading, setIsLoading] = useState(!cachedToken);

  const fetchToken = useCallback(async () => {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedToken && now - cacheTimestamp < CACHE_DURATION) {
      setToken(cachedToken);
      setIsLoading(false);
      return cachedToken;
    }

    try {
      // Try to get token from Supabase function first
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const tokenData = await response.json();
        if (tokenData.token) {
          const fetchedToken = tokenData.token;

          // Update cache
          cachedToken = fetchedToken;
          cacheTimestamp = now;

          setToken(fetchedToken);
          return fetchedToken;
        }
      }

      // Fallback to database if function fails
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "mapbox_token")
        .maybeSingle();

      const fetchedToken = data?.value?.toString() || DEFAULT_TOKEN;

      // Update cache
      cachedToken = fetchedToken;
      cacheTimestamp = now;

      setToken(fetchedToken);
      return fetchedToken;
    } catch (error) {
      console.error("Error fetching Mapbox token:", error);
      setToken(DEFAULT_TOKEN);
      return DEFAULT_TOKEN;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedToken) {
      fetchToken();
    }
  }, [fetchToken]);

  return {
    token,
    isLoading,
    refetch: fetchToken,
  };
};

// Synchronous getter for token (uses cache or default)
export const getMapboxToken = (): string => {
  return cachedToken || DEFAULT_TOKEN;
};

// Preload token (call early in app initialization)
export const preloadMapboxToken = async (): Promise<string> => {
  if (cachedToken) return cachedToken;

  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "mapbox_token")
      .maybeSingle();

    cachedToken = data?.value?.toString() || DEFAULT_TOKEN;
    cacheTimestamp = Date.now();
    return cachedToken;
  } catch {
    return DEFAULT_TOKEN;
  }
};
