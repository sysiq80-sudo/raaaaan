/**
 * ران — ترحيل رسائل الدردشة بين السائق والراكب عبر البوت
 * Relay Chat Message — Driver ↔ Bot Rider Bridge
 *
 * يُستدعى من Database Trigger على ride_messages
 * عندما يرسل السائق رسالة من التطبيق → تُرسل للراكب عبر واتساب أو تيليغرام
 *
 * الحقول المتوقعة:
 *   ride_id     — معرف الرحلة
 *   message     — نص الرسالة
 *   sender_type — 'driver'
 *   platform    — 'whatsapp' أو 'telegram'
 *   rider_id    — معرف الراكب (auth.users.id)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let WHATSAPP_ACCESS_TOKEN = "";
let WHATSAPP_PHONE_ID = "";
let TELEGRAM_BOT_TOKEN = "";
let GRAPH_API = "";
let TELEGRAM_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_ID",
      "TELEGRAM_BOT_TOKEN",
    ]);
    WHATSAPP_ACCESS_TOKEN = cfg["WHATSAPP_ACCESS_TOKEN"] || WHATSAPP_ACCESS_TOKEN;
    WHATSAPP_PHONE_ID = cfg["WHATSAPP_PHONE_ID"] || WHATSAPP_PHONE_ID;
    TELEGRAM_BOT_TOKEN = cfg["TELEGRAM_BOT_TOKEN"] || TELEGRAM_BOT_TOKEN;
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[relay] ✅ Dynamic config loaded from system_configs");
  } catch (e) {
    console.warn("[relay] ⚠️ Config load failed, using env fallbacks:", e);
    WHATSAPP_ACCESS_TOKEN = WHATSAPP_ACCESS_TOKEN || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    WHATSAPP_PHONE_ID = WHATSAPP_PHONE_ID || Deno.env.get("WHATSAPP_PHONE_ID") || "";
    TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN || Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════
// WhatsApp: إرسال رسالة نصية
// ════════════════════════════════════════════════════════════

async function sendWhatsAppMessage(to: string, text: string) {
  try {
    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[RelayChatMessage] WhatsApp send failed to ${to}:`, err);
      return false;
    }
    console.log(`[RelayChatMessage] WhatsApp message sent to ${to}`);
    return true;
  } catch (e) {
    console.error(`[RelayChatMessage] WhatsApp send error:`, e);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
// Telegram: إرسال رسالة نصية
// ════════════════════════════════════════════════════════════

async function sendTelegramMessage(chatId: number | string, text: string) {
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
      const err = await res.text();
      console.error(`[RelayChatMessage] Telegram send failed to ${chatId}:`, err);
      return false;
    }
    console.log(`[RelayChatMessage] Telegram message sent to ${chatId}`);
    return true;
  } catch (e) {
    console.error(`[RelayChatMessage] Telegram send error:`, e);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
// Helper: جلب رقم واتساب الراكب من rider_id
// ════════════════════════════════════════════════════════════

async function resolveWhatsAppPhone(
  supabase: any,
  riderId: string
): Promise<string | null> {
  if (!riderId) return null;

  // 1. من profiles.phone (مثل wa_9647884669922)
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("user_id", riderId)
    .maybeSingle();

  if (profile?.phone && !profile.phone.startsWith("tg_")) {
    // إزالة بادئة wa_ إذا موجودة ثم تنظيف
    let phone = profile.phone;
    if (phone.startsWith("wa_")) phone = phone.replace("wa_", "");
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length >= 10) return cleanPhone;
  }

  // 2. Fallback: auth.users.phone
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(riderId);
    const phone = authUser?.user?.phone;
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length >= 10) return cleanPhone;
    }
  } catch (e) {
    console.error("[RelayChatMessage] Failed to fetch auth user:", e);
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// Helper: جلب telegram chat_id من rider_id
// ════════════════════════════════════════════════════════════

async function resolveTelegramChatId(
  supabase: any,
  riderId: string
): Promise<number | null> {
  if (!riderId) return null;

  // 1. من profiles.phone (مثل tg_123456789)
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("user_id", riderId)
    .maybeSingle();

  if (profile?.phone && profile.phone.startsWith("tg_")) {
    const telegramId = parseInt(profile.phone.replace("tg_", ""), 10);
    if (!isNaN(telegramId)) return telegramId;
  }

  // 2. Fallback: auth.users.user_metadata.telegram_id
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(riderId);
    const tgId = authUser?.user?.user_metadata?.telegram_id;
    if (tgId) return typeof tgId === "number" ? tgId : parseInt(tgId, 10);
  } catch (e) {
    console.error("[RelayChatMessage] Failed to fetch auth user:", e);
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// Helper: جلب اسم السائق
// ════════════════════════════════════════════════════════════

async function getDriverName(
  supabase: any,
  rideId: string
): Promise<string> {
  const { data } = await supabase
    .from("rides")
    .select("driver_id")
    .eq("id", rideId)
    .maybeSingle();

  if (!data?.driver_id) return "الكابتن";

  const { data: driver } = await supabase
    .from("drivers")
    .select("full_name")
    .eq("id", data.driver_id)
    .maybeSingle();

  return driver?.full_name || "الكابتن";
}

// ════════════════════════════════════════════════════════════
// Main Handler
// ════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  // تحميل الإعدادات الديناميكية من system_configs
  await loadDynamicConfig();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { ride_id, message, sender_type, platform, rider_id } = payload;

    console.log(
      `[RelayChatMessage] ride=${ride_id} sender=${sender_type} platform=${platform}`
    );

    // التحقق من البيانات المطلوبة
    if (!ride_id || !message || !platform || !rider_id) {
      console.error("[RelayChatMessage] Missing required fields");
      return jsonOk({ error: "missing_fields" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // جلب اسم السائق
    const driverName = await getDriverName(supabase, ride_id);

    // صياغة الرسالة
    const formattedMsg = `💬 رسالة من ${driverName}:\n\n${message}`;

    // ══════════════════════════════════
    // إرسال عبر واتساب
    // ══════════════════════════════════
    if (platform === "whatsapp") {
      const phone = await resolveWhatsAppPhone(supabase, rider_id);
      if (!phone) {
        console.error(`[RelayChatMessage] Could not resolve WhatsApp phone for rider ${rider_id}`);
        return jsonOk({ error: "no_phone" });
      }

      const sent = await sendWhatsAppMessage(phone, formattedMsg);
      return jsonOk({ sent, platform: "whatsapp" });
    }

    // ══════════════════════════════════
    // إرسال عبر تيليغرام
    // ══════════════════════════════════
    if (platform === "telegram") {
      const chatId = await resolveTelegramChatId(supabase, rider_id);
      if (!chatId) {
        console.error(`[RelayChatMessage] Could not resolve Telegram chat_id for rider ${rider_id}`);
        return jsonOk({ error: "no_chat_id" });
      }

      const sent = await sendTelegramMessage(
        chatId,
        `💬 <b>رسالة من ${driverName}:</b>\n\n${message}`
      );
      return jsonOk({ sent, platform: "telegram" });
    }

    console.log(`[RelayChatMessage] Unknown platform: ${platform}`);
    return jsonOk({ error: "unknown_platform" });

  } catch (err) {
    console.error("[RelayChatMessage] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ════════════════════════════════════════════════════════════
// Helper: JSON Response
// ════════════════════════════════════════════════════════════

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
