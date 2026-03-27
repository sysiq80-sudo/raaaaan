/**
 * ران — مساعد إعدادات التطبيق للـ Edge Functions
 * App Settings Helper — reads from app_settings table (JSONB values)
 *
 * استراتيجية التحميل:
 * 1. كاش في الذاكرة لمدة 5 دقائق
 * 2. إذا انتهى الكاش → يجلب من app_settings
 * 3. إذا فشل → يرجع القيم الافتراضية
 *
 * الاستخدام:
 *   import { getSecuritySettings } from "../_shared/appSettings.ts";
 *   const settings = await getSecuritySettings(supabase);
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════════════════════════
// كاش في الذاكرة — TTL 5 دقائق
// ════════════════════════════════════════════════════════════

interface CacheEntry {
  value: unknown;
  expiry: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
const appSettingsCache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = appSettingsCache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.value;
  }
  appSettingsCache.delete(key);
  return null;
}

function setCache(key: string, value: unknown): void {
  appSettingsCache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
}

// ════════════════════════════════════════════════════════════
// جلب إعداد واحد من app_settings
// ════════════════════════════════════════════════════════════

export async function getAppSetting<T = unknown>(
  supabase: SupabaseClient,
  key: string,
  defaultValue?: T
): Promise<T> {
  // 1. كاش
  const cached = getCached(key);
  if (cached !== null) return cached as T;

  // 2. قاعدة البيانات
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (!error && data?.value) {
      setCache(key, data.value);
      return data.value as T;
    }
  } catch (e) {
    console.warn(`[AppSettings] DB fetch failed for ${key}:`, e);
  }

  // 3. القيمة الافتراضية
  return (defaultValue ?? null) as T;
}

// ════════════════════════════════════════════════════════════
// إعدادات الأمان والحدود — مع القيم الافتراضية
// ════════════════════════════════════════════════════════════

export interface SecuritySettings {
  whatsapp_rate_limit_per_minute: number;
  whatsapp_voice_rate_limit_per_minute: number;
  max_active_rides_per_user: number;
  ride_creation_cooldown_seconds: number;
  max_failed_match_attempts: number;
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  whatsapp_rate_limit_per_minute: 10,
  whatsapp_voice_rate_limit_per_minute: 3,
  max_active_rides_per_user: 3,
  ride_creation_cooldown_seconds: 60,
  max_failed_match_attempts: 5,
};

export async function getSecuritySettings(
  supabase: SupabaseClient
): Promise<SecuritySettings> {
  const raw = await getAppSetting<Partial<SecuritySettings>>(
    supabase,
    "security_settings",
    DEFAULT_SECURITY_SETTINGS
  );
  
  // دمج مع الافتراضي لضمان وجود كل المفاتيح
  return { ...DEFAULT_SECURITY_SETTINGS, ...raw };
}

// ════════════════════════════════════════════════════════════
// مسح الكاش (للاختبار أو عند تحديث الإعدادات)
// ════════════════════════════════════════════════════════════

export function clearAppSettingsCache(): void {
  appSettingsCache.clear();
}
