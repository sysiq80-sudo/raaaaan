import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  key: string; // Unique identifier for the rate limit (e.g., 'login_attempts', 'api_calls')
  userId?: string; // Optional user ID for user-specific limits
  ipAddress?: string; // Optional IP address for IP-based limits
}

interface RateLimitState {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: number | null;
  lastRequest: number;
}

interface RateLimitHookReturn {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: number | null;
  canMakeRequest: () => boolean;
  recordRequest: () => Promise<boolean>;
  getTimeUntilReset: () => number;
  reset: () => void;
}

export const useRateLimiting = (
  config: RateLimitConfig,
): RateLimitHookReturn => {
  const { maxRequests, windowMs, key, userId, ipAddress } = config;

  const [state, setState] = useState<RateLimitState>({
    isLimited: false,
    remainingRequests: maxRequests,
    resetTime: null,
    lastRequest: 0,
  });

  // Generate unique storage key
  const storageKey = `ratelimit_${key}_${userId || "anonymous"}_${ipAddress || "unknown"}`;

  // Load rate limit state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const now = Date.now();

        // Check if the stored data is still valid
        if (parsed.resetTime && now < parsed.resetTime) {
          setState(parsed);
        } else {
          // Reset if window has expired
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error("[RateLimit] Error parsing stored data:", error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // Save state to localStorage
  const saveState = useCallback(
    (newState: RateLimitState) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState));
      } catch (error) {
        console.error("[RateLimit] Error saving state:", error);
      }
    },
    [storageKey],
  );

  // Check if a request can be made
  const canMakeRequest = useCallback((): boolean => {
    const now = Date.now();

    // If we're in a rate limited state, check if the window has expired
    if (state.isLimited && state.resetTime) {
      if (now >= state.resetTime) {
        // Window has expired, reset the state
        const newState = {
          isLimited: false,
          remainingRequests: maxRequests,
          resetTime: null,
          lastRequest: now,
        };
        setState(newState);
        saveState(newState);
        return true;
      }
      return false;
    }

    return state.remainingRequests > 0;
  }, [state, maxRequests, saveState]);

  // Record a request and update the state
  const recordRequest = useCallback(async (): Promise<boolean> => {
    if (!canMakeRequest()) {
      return false;
    }

    const now = Date.now();
    const newRemaining = state.remainingRequests - 1;
    const isNowLimited = newRemaining <= 0;

    const newState: RateLimitState = {
      isLimited: isNowLimited,
      remainingRequests: Math.max(0, newRemaining),
      resetTime: isNowLimited ? now + windowMs : null,
      lastRequest: now,
    };

    setState(newState);
    saveState(newState);

    // Record in database for server-side validation
    try {
      await (supabase as any).from("rate_limits").insert({
        key,
        user_id: userId,
        ip_address: ipAddress,
        request_count: 1,
        window_start: new Date(now),
        window_end: new Date(now + windowMs),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[RateLimit] Error recording request:", error);
      // Continue even if database recording fails
    }

    return true;
  }, [
    canMakeRequest,
    state.remainingRequests,
    windowMs,
    saveState,
    key,
    userId,
    ipAddress,
  ]);

  // Get time until reset in milliseconds
  const getTimeUntilReset = useCallback((): number => {
    if (!state.resetTime) return 0;
    const now = Date.now();
    return Math.max(0, state.resetTime - now);
  }, [state.resetTime]);

  // Manual reset (for testing or admin purposes)
  const reset = useCallback(() => {
    const newState: RateLimitState = {
      isLimited: false,
      remainingRequests: maxRequests,
      resetTime: null,
      lastRequest: Date.now(),
    };
    setState(newState);
    localStorage.removeItem(storageKey);
  }, [maxRequests, storageKey]);

  // Auto-reset when window expires
  useEffect(() => {
    if (state.isLimited && state.resetTime) {
      const timeoutId = setTimeout(() => {
        reset();
      }, getTimeUntilReset());

      return () => clearTimeout(timeoutId);
    }
  }, [state.isLimited, state.resetTime, reset, getTimeUntilReset]);

  return {
    isLimited: state.isLimited,
    remainingRequests: state.remainingRequests,
    resetTime: state.resetTime,
    canMakeRequest,
    recordRequest,
    getTimeUntilReset,
    reset,
  };
};

// Specialized hooks for common use cases

export const useLoginRateLimit = (userId?: string) => {
  return useRateLimiting({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    key: "login_attempts",
    userId,
  });
};

export const useApiRateLimit = (userId?: string) => {
  return useRateLimiting({
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    key: "api_calls",
    userId,
  });
};

export const useSmsRateLimit = (phoneNumber?: string) => {
  return useRateLimiting({
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    key: "sms_verification",
    userId: phoneNumber,
  });
};

export const usePasswordResetRateLimit = (email?: string) => {
  return useRateLimiting({
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    key: "password_reset",
    userId: email,
  });
};

// Utility function to check rate limits from server
export const checkServerRateLimit = async (
  key: string,
  userId?: string,
  ipAddress?: string,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number | null;
}> => {
  try {
    const { data, error } = await (supabase
      .from("rate_limits" as any) as any)
      .select("*")
      .eq("key", key)
      .eq("user_id", userId)
      .gte("window_end", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { allowed: true, remaining: 100, resetTime: null };
    }

    const record = data[0];
    const now = new Date();
    const windowEnd = new Date(record.window_end);

    if (now > windowEnd) {
      return { allowed: true, remaining: 100, resetTime: null };
    }

    const remaining = Math.max(0, 100 - record.request_count);
    return {
      allowed: remaining > 0,
      remaining,
      resetTime: windowEnd.getTime(),
    };
  } catch (error) {
    console.error("[RateLimit] Server check failed:", error);
    // Allow request if server check fails
    return { allowed: true, remaining: 100, resetTime: null };
  }
};

// Rate limit violation handler
export const handleRateLimitViolation = (key: string, userId?: string) => {
  const messages = {
    login_attempts:
      "تم تجاوز عدد المحاولات المسموحة. يرجى الانتظار 15 دقيقة قبل المحاولة مرة أخرى.",
    api_calls:
      "تم تجاوز حد الطلبات المسموحة. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى.",
    sms_verification:
      "تم تجاوز حد رسائل التحقق المسموحة. يرجى الانتظار ساعة قبل المحاولة مرة أخرى.",
    password_reset:
      "تم تجاوز حد طلبات إعادة تعيين كلمة المرور. يرجى الانتظار ساعة قبل المحاولة مرة أخرى.",
  };

  toast.error(
    messages[key as keyof typeof messages] ||
      "تم تجاوز الحد المسموح. يرجى المحاولة لاحقاً.",
  );

  // Log violation for monitoring
  console.warn(
    `[RateLimit] Violation detected for ${key}, user: ${userId || "anonymous"}`,
  );
};
