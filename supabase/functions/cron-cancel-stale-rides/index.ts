/**
 * ران — إلغاء الرحلات المعلّقة تلقائياً (Cron Job)
 * يعمل كل دقيقة — يلغي أي رحلة pending أقدم من 10 دقائق
 * ويرسل إشعار للراكب عبر واتساب أو تليجرام
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let WHATSAPP_ACCESS_TOKEN = "";
let WHATSAPP_PHONE_ID = "";
let TELEGRAM_BOT_TOKEN = "";
let WA_GRAPH_API = "";
let TG_API = "";
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
    WA_GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    TG_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[cron-cancel-stale] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[cron-cancel-stale] ⚠️ Config load failed, using env fallbacks:", e);
    WHATSAPP_ACCESS_TOKEN = WHATSAPP_ACCESS_TOKEN || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    WHATSAPP_PHONE_ID = WHATSAPP_PHONE_ID || Deno.env.get("WHATSAPP_PHONE_ID") || "";
    TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN || Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    WA_GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    TG_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }
}

const STALE_MESSAGE = "نعتذر منك، لا يتوفر كباتن حالياً لأننا في وضع التجربة 🚕. جرب تطلب مرة ثانية بعد شوية!";

// ════════════════════════════════════════
// إرسال رسالة واتساب
// ════════════════════════════════════════
async function sendWhatsAppMessage(phoneNumber: string, text: string) {
  try {
    const res = await fetch(WA_GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: text },
      }),
    });
    const result = await res.text();
    console.log(`[wa] Sent to ${phoneNumber} (${res.status}): ${result.substring(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error(`[wa] Failed to send to ${phoneNumber}:`, e);
    return false;
  }
}

// ════════════════════════════════════════
// إرسال رسالة تليجرام
// ════════════════════════════════════════
async function sendTelegramMessage(chatId: string, text: string) {
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const result = await res.text();
    console.log(`[tg] Sent to ${chatId} (${res.status}): ${result.substring(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error(`[tg] Failed to send to ${chatId}:`, e);
    return false;
  }
}

// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
serve(async (_req) => {
  await loadDynamicConfig();
  const startTime = Date.now();
  console.log("[cron] ===== STALE RIDES CHECK =====");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── 1. البحث عن الرحلات المعلّقة أكثر من 10 دقائق ──
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: staleRides, error: fetchError } = await supabase
      .from("rides")
      .select("id, rider_id, trip_type, pickup_address, dropoff_address, created_at")
      .eq("status", "pending")
      .lte("created_at", tenMinutesAgo);

    if (fetchError) {
      console.error("[cron] Error fetching stale rides:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!staleRides || staleRides.length === 0) {
      console.log("[cron] No stale rides found.");
      return new Response(JSON.stringify({ cancelled: 0, elapsed_ms: Date.now() - startTime }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[cron] Found ${staleRides.length} stale ride(s)`);

    let cancelledCount = 0;
    let notifiedCount = 0;

    for (const ride of staleRides) {
      // ── 2. إلغاء الرحلة ──
      const { error: updateError } = await supabase
        .from("rides")
        .update({
          status: "cancelled",
          cancellation_reason: "timeout_no_driver",
        })
        .eq("id", ride.id)
        .eq("status", "pending"); // حماية ضد race condition

      if (updateError) {
        console.error(`[cron] Failed to cancel ride ${ride.id}:`, updateError);
        continue;
      }

      cancelledCount++;
      console.log(`[cron] Cancelled ride ${ride.id} (${ride.trip_type || "unknown"}) — created: ${ride.created_at}`);

      // ── 3. جلب بيانات الراكب من profiles ──
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, email")
        .eq("user_id", ride.rider_id)
        .maybeSingle();

      if (!profile?.phone) {
        console.warn(`[cron] No profile/phone for rider ${ride.rider_id}, skipping notification`);
        continue;
      }

      // ── 4. إرسال الإشعار حسب نوع الرحلة ──
      const tripType = ride.trip_type || "";

      if (tripType === "whatsapp" && profile.phone.startsWith("wa_")) {
        // استخراج رقم الهاتف: wa_995555004471 → 995555004471
        const waPhone = profile.phone.replace("wa_", "");
        const sent = await sendWhatsAppMessage(waPhone, STALE_MESSAGE);
        if (sent) notifiedCount++;
      } else if (tripType === "telegram" && profile.phone.startsWith("tg_")) {
        // استخراج chat ID: tg_123456789 → 123456789
        const chatId = profile.phone.replace("tg_", "");
        const sent = await sendTelegramMessage(chatId, STALE_MESSAGE);
        if (sent) notifiedCount++;
      } else {
        console.log(`[cron] Unknown trip_type "${tripType}" or phone format "${profile.phone}" — no notification sent`);
      }
    }

    const elapsed = Date.now() - startTime;
    const summary = { cancelled: cancelledCount, notified: notifiedCount, total_found: staleRides.length, elapsed_ms: elapsed };
    console.log(`[cron] Done:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[cron] CRITICAL ERROR:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
