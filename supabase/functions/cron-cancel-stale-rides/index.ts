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
// جلب إعدادات الانتظار الديناميكية
// ════════════════════════════════════════
async function getWaitSettings(supabase: ReturnType<typeof createClient<any>>) {
  try {
    const { data, error } = await supabase
      .from("rider_wait_settings")
      .select("max_wait_minutes, auto_cancel_enabled, auto_cancel_message")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        maxWaitMinutes: data.max_wait_minutes ?? 10,
        autoCancelEnabled: data.auto_cancel_enabled ?? true,
        autoCancelMessage: data.auto_cancel_message || STALE_MESSAGE,
      };
    }
  } catch (e) {
    console.warn("[cron] Failed to load rider_wait_settings, using defaults:", e);
  }
  return { maxWaitMinutes: 10, autoCancelEnabled: true, autoCancelMessage: STALE_MESSAGE };
}

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
    // ── 0. جلب إعدادات الانتظار الديناميكية ──
    const waitSettings = await getWaitSettings(supabase);

    if (!waitSettings.autoCancelEnabled) {
      console.log("[cron] Auto-cancel is DISABLED in rider_wait_settings. Skipping.");
      return new Response(JSON.stringify({ cancelled: 0, reason: "auto_cancel_disabled", elapsed_ms: Date.now() - startTime }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxWaitMs = waitSettings.maxWaitMinutes * 60 * 1000;
    const cancelMessage = waitSettings.autoCancelMessage;

    console.log(`[cron] Using dynamic timeout: ${waitSettings.maxWaitMinutes} min`);

    // ── 1. البحث عن الرحلات المعلّقة أكثر من الوقت المحدد ──
    const cutoffTime = new Date(Date.now() - maxWaitMs).toISOString();

    const { data: staleRides, error: fetchError } = await supabase
      .from("rides")
      .select("id, rider_id, trip_type, pickup_address, dropoff_address, created_at")
      .eq("status", "pending")
      .lte("created_at", cutoffTime);

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
        const sent = await sendWhatsAppMessage(waPhone, cancelMessage);
        if (sent) notifiedCount++;
      } else if (tripType === "telegram" && profile.phone.startsWith("tg_")) {
        // استخراج chat ID: tg_123456789 → 123456789
        const chatId = profile.phone.replace("tg_", "");
        const sent = await sendTelegramMessage(chatId, cancelMessage);
        if (sent) notifiedCount++;
      } else if (tripType === "sms" && profile.phone.startsWith("sms_")) {
        // SMS booking: sms_9647801234567 → 9647801234567
        const smsPhone = profile.phone.replace("sms_", "");
        // Send via OTPIQ (use edge function invoke to avoid duplicating logic)
        try {
          await supabase.functions.invoke("sms-ride-updates", {
            body: {
              ride_id: ride.id,
              phone: smsPhone,
              message: cancelMessage,
              status: "cancelled",
            },
          });
          notifiedCount++;
        } catch (e) {
          console.warn(`[cron] SMS notification failed for ${smsPhone}:`, e);
        }
      } else {
        // إشعار FCM لمستخدم التطبيق (trip_type app أو غير معروف)
        try {
          const fcmRes = await supabase.functions.invoke("fcm-ride-updates", {
            body: {
              ride_id: ride.id,
              user_id: ride.rider_id,
              title: "تم إلغاء الرحلة تلقائياً",
              message: cancelMessage,
              status: "cancelled",
            },
          });
          if (fcmRes?.error) {
            console.warn(`[cron] FCM notification failed for user ${ride.rider_id}:`, fcmRes.error);
          } else {
            notifiedCount++;
            console.log(`[cron] FCM notification sent to user ${ride.rider_id}`);
          }
        } catch (e) {
          console.warn(`[cron] FCM notification failed for user ${ride.rider_id}:`, e);
        }
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
