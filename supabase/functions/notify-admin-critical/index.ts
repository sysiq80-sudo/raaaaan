/**
 * ران — تنبيهات حرجة للأدمن عبر تليجرام
 * RAAN — Critical Admin Alerts via Telegram
 *
 * يُستدعى من الفرونت أو Edge Functions الأخرى عند حدوث أخطاء حرجة
 * مثل: فشل الدفع، رحلة معلقة طويلاً، سائق مفقود، إلخ
 *
 * POST body:
 * {
 *   "type": "payment_failed" | "ride_stuck" | "driver_sos" | "system_error" | "security",
 *   "message": "وصف مختصر",
 *   "metadata": { ... }  // اختياري
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let ADMIN_TELEGRAM_BOT_TOKEN = "";
let ADMIN_CHAT_ID = "";
let TELEGRAM_API = "";
let _configLoaded = false;

async function loadConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "ADMIN_TELEGRAM_BOT_TOKEN",
      "ADMIN_TELEGRAM_CHAT_ID",
    ]);
    ADMIN_TELEGRAM_BOT_TOKEN = cfg["ADMIN_TELEGRAM_BOT_TOKEN"] || "";
    ADMIN_CHAT_ID = cfg["ADMIN_TELEGRAM_CHAT_ID"] || "";
    TELEGRAM_API = `https://api.telegram.org/bot${ADMIN_TELEGRAM_BOT_TOKEN}`;
    _configLoaded = true;
  } catch (e) {
    console.warn("[notify-admin] Config load failed:", e);
    ADMIN_TELEGRAM_BOT_TOKEN = Deno.env.get("ADMIN_TELEGRAM_BOT_TOKEN") || "";
    ADMIN_CHAT_ID = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID") || "";
    TELEGRAM_API = `https://api.telegram.org/bot${ADMIN_TELEGRAM_BOT_TOKEN}`;
  }
}

// corsHeaders — يستخدم الأساس من المشترك مع إضافة x-internal-secret
import { corsHeaders as baseCorsHeaders } from "../_shared/utils.ts";
const corsHeaders = {
  ...baseCorsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 40;
const rateHits = new Map<string, number[]>();

function rateLimitOk(key: string): boolean {
  const now = Date.now();
  const arr = (rateHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX_PER_WINDOW) return false;
  arr.push(now);
  rateHits.set(key, arr);
  return true;
}

async function authorizeNotifyAdmin(req: Request): Promise<Response | null> {
  const internal = Deno.env.get("ADMIN_NOTIFY_INTERNAL_SECRET");
  const hdr =
    req.headers.get("x-internal-secret") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (internal && hdr === internal) {
    return null;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ ok: false, error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const jwt = authHeader.slice(7);
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(SUPABASE_URL, anon);
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!rateLimitOk(`user:${user.id}`)) {
    return new Response(
      JSON.stringify({ ok: false, error: "rate_limited" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

const ALERT_ICONS: Record<string, string> = {
  payment_failed: "💳❌",
  ride_stuck: "🚕⏱",
  driver_sos: "🆘",
  system_error: "⚠️🔥",
  security: "🔒🚨",
};

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      console.error("[notify-admin] Telegram send failed:", await res.text());
    }
    return res.ok;
  } catch (err) {
    console.error("[notify-admin] Telegram error:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denied = await authorizeNotifyAdmin(req);
  if (denied) return denied;

  await loadConfig();

  if (!ADMIN_TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.warn("[notify-admin] Missing bot token or chat ID — alert skipped");
    return new Response(
      JSON.stringify({ ok: false, error: "not_configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { type = "system_error", message, metadata } = await req.json();

    const icon = ALERT_ICONS[type] || "⚠️";
    const time = new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad" });

    let alertText =
      `${icon} <b>تنبيه حرج — ران</b>\n\n` +
      `📋 النوع: <code>${type}</code>\n` +
      `📝 ${message || "بدون تفاصيل"}\n` +
      `🕐 ${time}`;

    if (metadata) {
      const details = Object.entries(metadata)
        .map(([k, v]) => `  • ${k}: ${v}`)
        .join("\n");
      if (details) {
        alertText += `\n\n📎 تفاصيل:\n${details}`;
      }
    }

    const sent = await sendTelegram(ADMIN_CHAT_ID, alertText);

    // تسجيل في قاعدة البيانات
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from("admin_alerts_log").insert({
      alert_type: type,
      message: message || "",
      metadata: metadata || {},
      telegram_sent: sent,
    }).then(() => {}, (e: unknown) => {
      // الجدول قد لا يكون موجوداً — لا نفشل بسببه
      console.warn("[notify-admin] Log insert failed (table may not exist):", e);
    });

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notify-admin] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
