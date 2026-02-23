/**
 * ران — مساعد الإعدادات الديناميكية للـ Edge Functions
 * Dynamic Config Helper — reads from system_configs table
 *
 * استراتيجية التحميل:
 * 1. يحاول جلب القيمة من system_configs (قاعدة البيانات)
 * 2. إذا فارغة أو غير موجودة → يرجع لـ Deno.env.get() كاحتياط
 * 3. كاش في الذاكرة لمدة 5 دقائق لتقليل الاستعلامات
 *
 * الاستخدام:
 *   import { getConfig, getConfigBatch } from "../_shared/config.ts";
 *   const token = await getConfig(supabase, "WHATSAPP_ACCESS_TOKEN");
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════════════════════════
// كاش في الذاكرة — TTL 5 دقائق
// ════════════════════════════════════════════════════════════

interface CacheEntry {
  value: string;
  expiry: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
const cache = new Map<string, CacheEntry>();

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.value;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, value: string): void {
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
}

// ════════════════════════════════════════════════════════════
// جلب قيمة مفتاح واحد
// ════════════════════════════════════════════════════════════

export async function getConfig(
  supabase: SupabaseClient,
  keyName: string
): Promise<string> {
  // 1. كاش
  const cached = getCached(keyName);
  if (cached !== null) return cached;

  // 2. قاعدة البيانات
  try {
    const { data, error } = await supabase
      .from("system_configs")
      .select("key_value")
      .eq("key_name", keyName)
      .maybeSingle();

    if (!error && data?.key_value && data.key_value.trim() !== "") {
      setCache(keyName, data.key_value);
      return data.key_value;
    }
  } catch (e) {
    console.warn(`[Config] DB fetch failed for ${keyName}:`, e);
  }

  // 3. احتياط: متغير البيئة
  const envValue = Deno.env.get(keyName) || "";
  if (envValue) {
    setCache(keyName, envValue);
  }
  return envValue;
}

// ════════════════════════════════════════════════════════════
// جلب مجموعة مفاتيح دفعة واحدة (أقل استعلامات)
// ════════════════════════════════════════════════════════════

export async function getConfigBatch(
  supabase: SupabaseClient,
  keyNames: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const toFetch: string[] = [];

  // 1. جلب من الكاش أولاً
  for (const key of keyNames) {
    const cached = getCached(key);
    if (cached !== null) {
      result[key] = cached;
    } else {
      toFetch.push(key);
    }
  }

  // 2. جلب الباقي من قاعدة البيانات
  if (toFetch.length > 0) {
    try {
      const { data, error } = await supabase
        .from("system_configs")
        .select("key_name, key_value")
        .in("key_name", toFetch);

      if (!error && data) {
        for (const row of data) {
          if (row.key_value && row.key_value.trim() !== "") {
            result[row.key_name] = row.key_value;
            setCache(row.key_name, row.key_value);
          }
        }
      }
    } catch (e) {
      console.warn("[Config] Batch DB fetch failed:", e);
    }

    // 3. احتياط: متغيرات البيئة للمفاتيح المفقودة
    for (const key of toFetch) {
      if (!result[key]) {
        const envValue = Deno.env.get(key) || "";
        result[key] = envValue;
        if (envValue) setCache(key, envValue);
      }
    }
  }

  return result;
}

// ════════════════════════════════════════════════════════════
// إنشاء Supabase client بـ service_role (للإعدادات)
// ════════════════════════════════════════════════════════════

export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ════════════════════════════════════════════════════════════
// مسح الكاش (للاختبار أو عند تحديث الإعدادات)
// ════════════════════════════════════════════════════════════

export function clearConfigCache(): void {
  cache.clear();
}
