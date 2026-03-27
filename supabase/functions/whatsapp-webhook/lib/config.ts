/**
 * ران — إعدادات واتساب و Rate Limiting
 * RAAN WhatsApp Config & Rate Limiter
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../../_shared/config.ts";
import { getSecuritySettings, SecuritySettings } from "../../_shared/appSettings.ts";

// ════════════════════════════════════════
// Rate Limiter — حدود الاستخدام لكل رقم هاتف
// يدعم: 1) قاعدة البيانات (موثوق) 2) الذاكرة (احتياط)
// ════════════════════════════════════════
const rateLimitMap = new Map<string, number[]>();
let _securitySettings: SecuritySettings | null = null;
let _settingsLoadedAt = 0;

// Rate Limiting عبر قاعدة البيانات (مشترك بين كل الـ instances)
export async function isRateLimitedDB(
  supabase: any,
  phone: string,
  isVoice: boolean,
  settings: SecuritySettings
): Promise<boolean> {
  const limit = isVoice
    ? settings.whatsapp_voice_rate_limit_per_minute
    : settings.whatsapp_rate_limit_per_minute;
  const key = isVoice ? `voice:${phone}` : `msg:${phone}`;

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
    // احتياط: استخدم الذاكرة
    return isRateLimited(phone, isVoice, settings);
  }
}

// Rate Limiting في الذاكرة (احتياط)
export function isRateLimited(phone: string, isVoice: boolean, settings: SecuritySettings): boolean {
  const now = Date.now();
  const limit = isVoice
    ? settings.whatsapp_voice_rate_limit_per_minute
    : settings.whatsapp_rate_limit_per_minute;
  const key = isVoice ? `voice:${phone}` : `msg:${phone}`;
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < 60000);
  if (recent.length >= limit) return true;
  recent.push(now);
  rateLimitMap.set(key, recent);
  // تنظيف الذاكرة — لا نخزّن أكثر من 500 رقم
  if (rateLimitMap.size > 500) {
    const oldest = rateLimitMap.keys().next().value;
    if (oldest) rateLimitMap.delete(oldest);
  }
  return false;
}

export async function getOrLoadSecuritySettings(): Promise<SecuritySettings | null> {
  if (_securitySettings && Date.now() - _settingsLoadedAt < 300000) {
    return _securitySettings;
  }
  try {
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    _securitySettings = await getSecuritySettings(svc);
    _settingsLoadedAt = Date.now();
  } catch (e) {
    console.warn("[wa] ⚠️ Security settings load failed:", e);
  }
  return _securitySettings;
}

// ════════════════════════════════════════
// المتغيرات — تُحمّل ديناميكياً من system_configs
// ════════════════════════════════════════
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export let VERIFY_TOKEN = "";
export let WHATSAPP_ACCESS_TOKEN = "";
export let WHATSAPP_PHONE_ID = "";
export let OPENAI_API_KEY = "";
export let GOOGLE_MAPS_KEY = "";
export let SITE_URL = "https://raanai.lovable.app";
export let GRAPH_API = "";
export let ADMIN_TELEGRAM_BOT_TOKEN = "";
export let ADMIN_GROUP_CHAT_ID = "";
let _configLoaded = false;

export async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_ID",
      "OPENAI_API_KEY",
      "GOOGLE_MAPS_KEY",
      "SITE_URL",
      "ADMIN_TELEGRAM_BOT_TOKEN",
      "ADMIN_GROUP_CHAT_ID",
    ]);
    VERIFY_TOKEN = cfg["WHATSAPP_VERIFY_TOKEN"] || VERIFY_TOKEN;
    WHATSAPP_ACCESS_TOKEN = cfg["WHATSAPP_ACCESS_TOKEN"] || WHATSAPP_ACCESS_TOKEN;
    WHATSAPP_PHONE_ID = cfg["WHATSAPP_PHONE_ID"] || WHATSAPP_PHONE_ID;
    OPENAI_API_KEY = cfg["OPENAI_API_KEY"] || OPENAI_API_KEY;
    GOOGLE_MAPS_KEY = cfg["GOOGLE_MAPS_KEY"] || GOOGLE_MAPS_KEY;
    SITE_URL = cfg["SITE_URL"] || SITE_URL;
    ADMIN_TELEGRAM_BOT_TOKEN = cfg["ADMIN_TELEGRAM_BOT_TOKEN"] || ADMIN_TELEGRAM_BOT_TOKEN;
    ADMIN_GROUP_CHAT_ID = cfg["ADMIN_GROUP_CHAT_ID"] || ADMIN_GROUP_CHAT_ID;
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    _configLoaded = true;
    console.log("[wa] ✅ Dynamic config loaded from system_configs");
  } catch (e) {
    console.warn("[wa] ⚠️ Config load failed, using env fallbacks:", e);
    VERIFY_TOKEN = VERIFY_TOKEN || Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
    WHATSAPP_ACCESS_TOKEN = WHATSAPP_ACCESS_TOKEN || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    WHATSAPP_PHONE_ID = WHATSAPP_PHONE_ID || Deno.env.get("WHATSAPP_PHONE_ID") || "";
    OPENAI_API_KEY = OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY") || "";
    GOOGLE_MAPS_KEY = GOOGLE_MAPS_KEY || Deno.env.get("GOOGLE_MAPS_KEY") || "";
    SITE_URL = SITE_URL || Deno.env.get("SITE_URL") || "https://raanai.lovable.app";
    ADMIN_TELEGRAM_BOT_TOKEN = ADMIN_TELEGRAM_BOT_TOKEN || Deno.env.get("ADMIN_TELEGRAM_BOT_TOKEN") || "";
    ADMIN_GROUP_CHAT_ID = ADMIN_GROUP_CHAT_ID || Deno.env.get("ADMIN_GROUP_CHAT_ID") || "";
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
  }
}

// re-export for convenience
export { createClient, getConfigBatch, createServiceClient, getSecuritySettings };
export type { SecuritySettings };
