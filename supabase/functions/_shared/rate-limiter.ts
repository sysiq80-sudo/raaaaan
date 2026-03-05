/**
 * ران — نظام تحديد المعدل (Rate Limiting) — Shared Module
 * RAAN Rate Limiter — DB-backed + In-Memory fallback
 * يُستخدم من: whatsapp-webhook, telegram-ai-booking
 */

import { getSecuritySettings, type SecuritySettings } from "./appSettings.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════
// Rate Limiter في الذاكرة (احتياط)
// ════════════════════════════════════════
const rateLimitMap = new Map<string, number[]>();

export function isRateLimitedMemory(identifier: string, isVoice: boolean, settings: SecuritySettings): boolean {
  const now = Date.now();
  const limit = isVoice
    ? settings.whatsapp_voice_rate_limit_per_minute
    : settings.whatsapp_rate_limit_per_minute;
  const key = isVoice ? `voice:${identifier}` : `msg:${identifier}`;
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < 60000);
  if (recent.length >= limit) return true;
  recent.push(now);
  rateLimitMap.set(key, recent);
  // تنظيف الذاكرة — لا نخزّن أكثر من 500 مفتاح
  if (rateLimitMap.size > 500) {
    const oldest = rateLimitMap.keys().next().value;
    if (oldest) rateLimitMap.delete(oldest);
  }
  return false;
}

// ════════════════════════════════════════
// Rate Limiter عبر قاعدة البيانات (مشترك بين كل الـ instances)
// ════════════════════════════════════════
export async function isRateLimitedDB(
  supabase: any,
  identifier: string,
  isVoice: boolean,
  settings: SecuritySettings
): Promise<boolean> {
  const limit = isVoice
    ? settings.whatsapp_voice_rate_limit_per_minute
    : settings.whatsapp_rate_limit_per_minute;
  const key = isVoice ? `voice:${identifier}` : `msg:${identifier}`;

  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_phone_key: key,
      p_limit: limit,
      p_window_seconds: 60,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.warn("[rate-limit] DB check failed, falling back to memory:", e);
    return isRateLimitedMemory(identifier, isVoice, settings);
  }
}

// ════════════════════════════════════════
// تحميل إعدادات الأمان (مع كاش 5 دقائق)
// ════════════════════════════════════════
let _securitySettings: SecuritySettings | null = null;
let _settingsLoadedAt = 0;

export async function getOrLoadSecuritySettings(supabaseUrl?: string, serviceRoleKey?: string): Promise<SecuritySettings> {
  if (_securitySettings && Date.now() - _settingsLoadedAt < 300000) {
    return _securitySettings;
  }
  try {
    const url = supabaseUrl || Deno.env.get("SUPABASE_URL")!;
    const key = serviceRoleKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(url, key);
    _securitySettings = await getSecuritySettings(svc);
    _settingsLoadedAt = Date.now();
    return _securitySettings;
  } catch (e) {
    console.warn("[rate-limit] ⚠️ Security settings load failed:", e);
  }

  // القيم الافتراضية
  return {
    whatsapp_rate_limit_per_minute: 10,
    whatsapp_voice_rate_limit_per_minute: 3,
    max_active_rides_per_user: 3,
    ride_creation_cooldown_seconds: 60,
    max_failed_match_attempts: 5,
  };
}

// Re-exports
export type { SecuritySettings };
