/**
 * ران — إشعارات تحديث الرحلة عبر تيليغرام (الراكب)
 * Telegram Ride Status Notifications — Strict State Machine
 *
 * State Machine (Strict & Uninterruptible):
 *   pending    → البحث عن كابتن
 *   accepted   → رسالة بتفاصيل الكابتن + أزرار inline (📍 موقع + 💬 محادثة)
 *   arrived    → الكابتن وصل 🚨
 *   in_progress→ بدأت الرحلة
 *   completed  → إيصال + أزرار تقييم ⭐ (1-5)
 *   cancelled  → تم إلغاء الرحلة
 *
 * Parallel Actions (DO NOT alter ride state):
 *   - Live Driver Location → tracking link
 *   - Proxy Chat → driver ↔ rider via bot (rides.status unchanged)
 *
 * Updated: 2026-02-25
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let TELEGRAM_BOT_TOKEN = "";
let SITE_URL = "https://raanai.lovable.app";
let TELEGRAM_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["TELEGRAM_BOT_TOKEN", "SITE_URL"]);
    TELEGRAM_BOT_TOKEN = cfg["TELEGRAM_BOT_TOKEN"] || TELEGRAM_BOT_TOKEN;
    SITE_URL = cfg["SITE_URL"] || SITE_URL;
    TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[telegram-ride-updates] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[telegram-ride-updates] ⚠️ Config load failed, using env fallbacks:", e);
    TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN || Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    SITE_URL = SITE_URL || Deno.env.get("SITE_URL") || "https://raanai.lovable.app";
    TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }
}
// ════════════════════════════════════════════════════════════
// Telegram Helpers
// ════════════════════════════════════════════════════════════

async function sendMessage(chatId: number | string, text: string, replyMarkup?: any) {
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  console.log(`[RideUpdates] sendMessage payload:`, JSON.stringify(body).substring(0, 600));

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`[RideUpdates] sendMessage FAILED (${res.status}) for chat ${chatId}:`, responseText);
  } else {
    console.log(`[RideUpdates] ✅ Message sent to chat ${chatId}:`, responseText.substring(0, 200));
  }
}

// ════════════════════════════════════════════════════════════
// Smart Destination Hint
// ════════════════════════════════════════════════════════════

const VAGUE_KEYWORDS = ["شارع", "حي", "منطقة"];
const LANDMARK_KEYWORDS = ["جامعة", "مستشفى", "مول", "ملعب"];

function getSmartHint(address: string | null): string {
  if (!address) return "";
  if (LANDMARK_KEYWORDS.some((kw) => address.includes(kw))) return "";
  if (VAGUE_KEYWORDS.some((kw) => address.includes(kw))) {
    return (
      `\n\n💡 <b>تنويه:</b> بما أنك حددت الوجهة (عامة)، ` +
      `يا ريت تبلغ الكابتن بالضبط وين توگف ` +
      `(بداية الشارع، منتصفه، أو نهايته) لضمان دقة الوصول.`
    );
  }
  return "";
}

// ════════════════════════════════════════════════════════════
// Main Handler — Strict State Machine
// ════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const payload = await req.json();

    const {
      ride_id,
      new_status,
      old_status,
      trip_type,
      rider_id,
      driver_id,
      final_fare,
      estimated_fare,
      pickup_address,
      dropoff_address,
      distance_km,
      duration_minutes,
    } = payload;

    console.log(
      `[RideUpdates] ride=${ride_id} status: ${old_status} → ${new_status}, trip_type=${trip_type}`
    );

    // ── الشرط الأساسي: فقط رحلات تيليغرام مع تغيّر الحالة
    if (trip_type !== "telegram") {
      console.log("[RideUpdates] Not a telegram ride, skipping.");
      return jsonOk({ skipped: true, reason: "not_telegram" });
    }
    if (new_status === old_status) {
      console.log("[RideUpdates] Status unchanged, skipping.");
      return jsonOk({ skipped: true, reason: "same_status" });
    }

    // ── التحقق من صحة انتقال الحالة (State Machine Validation)
    const validTransitions: Record<string, string[]> = {
      pending: ["accepted", "cancelled"],
      accepted: ["arrived", "cancelled"],
      arrived: ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
    };
    if (old_status && validTransitions[old_status]) {
      if (!validTransitions[old_status].includes(new_status)) {
        console.warn(`[RideUpdates] ⚠️ Invalid transition: ${old_status} → ${new_status}`);
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── جلب telegram chat_id للراكب
    const chatId = await resolveRiderChatId(supabase, rider_id);
    if (!chatId) {
      console.error(`[RideUpdates] Could not resolve Telegram chat_id for rider ${rider_id}`);
      return jsonOk({ skipped: true, reason: "no_chat_id" });
    }

    // ══════════════════════════════════════════════
    // 1️⃣ ACCEPTED — تم قبول الطلب + أزرار inline
    // ══════════════════════════════════════════════
    if (new_status === "accepted" && driver_id) {
      const driver = await fetchDriverDetails(supabase, driver_id);
      const eta = driver?.eta ?? 5;

      // أزرار inline: محادثة فقط
      // ❌ تم إزالة زر التتبع مؤقتاً (track_) بسبب فشل إنشاء رابط التتبع في الإنتاج
      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "💬 راسل السائق", callback_data: `chat_${ride_id}` },
          ],
        ],
      };

      const msgText =
        `🎉 <b>تم قبول طلبك!</b>\n\n` +
        `👤 الكابتن: <b>${driver?.full_name ?? "غير معروف"}</b>\n` +
        `🚗 السيارة: ${driver?.vehicle_model ?? "—"} - ${driver?.vehicle_color ?? "—"} (${driver?.vehicle_plate ?? "—"})\n\n` +
        `⏳ وقت الوصول: خلال <b>${eta} دقائق</b> تقريباً.\n` +
        `خليك جاهز.. الكابتن بالطريق!`;

      console.log(`[RideUpdates] Sending accepted msg to ${chatId} with inline_keyboard:`, JSON.stringify(inlineKeyboard));

      await sendMessage(chatId, msgText, inlineKeyboard);

      return jsonOk({ sent: "accepted", buttons: true });
    }

    // ══════════════════════════════════════════════
    // 2️⃣ ARRIVED — الكابتن وصل 🚨
    // ══════════════════════════════════════════════
    if (new_status === "arrived") {
      await sendMessage(
        chatId,
        `🚨 <b>الكابتن وصل وهو بانتظارك في الخارج!</b>\nيرجى التوجه للسيارة بأسرع وقت. 🚗`
      );
      return jsonOk({ sent: "arrived" });
    }

    // ══════════════════════════════════════════════
    // 3️⃣ IN_PROGRESS — بدأت الرحلة
    // ══════════════════════════════════════════════
    if (new_status === "in_progress") {
      let tripDuration: number | null = null;
      try {
        const { data: rideRow } = await supabase
          .from("rides")
          .select("duration_minutes")
          .eq("id", ride_id)
          .maybeSingle();
        tripDuration = rideRow?.duration_minutes ?? null;
      } catch (e) {
        console.warn("[RideUpdates] Failed to fetch duration_minutes:", e);
      }

      const durationLine = tripDuration
        ? `\n⏱️ مدة الطريق: <b>${tripDuration} دقيقة </b> تقريباً.`
        : "";

      const smartHint = getSmartHint(dropoff_address);

      await sendMessage(chatId, `🚀 <b>أنت الآن في الرحلة!</b>${durationLine}${smartHint}`);
      return jsonOk({ sent: "in_progress" });
    }

    // ══════════════════════════════════════════════
    // 4️⃣ COMPLETED — إيصال + تقييم ⭐
    // ══════════════════════════════════════════════
    if (new_status === "completed") {
      const fare = final_fare || estimated_fare || 0;
      const distText = distance_km ? `${Number(distance_km).toFixed(1)} كم` : "—";
      const durationText = duration_minutes ? `${duration_minutes} دقيقة` : "—";

      // إيصال الرحلة
      const receiptMsg =
        `✅ <b>الحمد لله على السلامة!</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🧾 <b>إيصال الرحلة</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📍 من: ${pickup_address || "—"}\n` +
        `🏁 إلى: ${dropoff_address || "—"}\n` +
        `📏 المسافة: ${distText}\n` +
        `⏱️ المدة: ${durationText}\n` +
        `💰 المبلغ: <b>${fare.toLocaleString()} د.ع</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `شكراً لاستخدامك ران! الرحلة انتهت. كيف تقيم الكابتن؟ 👇`;

      // أزرار التقييم Inline (5 نجوم) + رحلة عكسية
      const ratingButtons = {
        inline_keyboard: [
          [
            { text: "⭐ 1", callback_data: `rate_${ride_id}_1` },
            { text: "⭐ 2", callback_data: `rate_${ride_id}_2` },
            { text: "⭐ 3", callback_data: `rate_${ride_id}_3` },
            { text: "⭐ 4", callback_data: `rate_${ride_id}_4` },
            { text: "⭐ 5", callback_data: `rate_${ride_id}_5` },
          ],
          [
            { text: "🔄 رحلة عكسية", callback_data: `reverse_ride_${ride_id}` },
          ],
        ],
      };

      await sendMessage(chatId, receiptMsg, ratingButtons);

      // ── عرض خيار رحلة جديدة مع كيبورد الموقع
      await sendMessage(chatId, `هل تريد رحلة جديدة؟ 🚕\nدز موقعك الحالي مرة ثانية 👇`, {
        keyboard: [[{ text: "📍 مشاركة موقعي الحالي", request_location: true }]],
        resize_keyboard: true,
      });

      // 🔥 CRITICAL: مسح sub-state الدردشة عند اكتمال الرحلة
      try {
        // مسح عبر telegram chat_id
        await supabase.from("bot_customers").update({ last_intent: null })
          .eq("platform", "telegram").eq("platform_id", String(chatId));
        console.log(`[RideUpdates] ✅ Cleared chat sub-state for Telegram ${chatId} on completed`);
      } catch (e) {
        console.warn("[RideUpdates] Failed to clear sub-state on completed:", e);
      }

      return jsonOk({ sent: "completed", receipt: true, rating_buttons: true });
    }

    // ══════════════════════════════════════════════
    // 5️⃣ CANCELLED — تم الإلغاء + مسح context + أزرار inline
    // ══════════════════════════════════════════════
    if (new_status === "cancelled") {
      // 🔥 CRITICAL: مسح sub-state الدردشة فوراً عند الإلغاء
      try {
        await supabase.from("bot_customers").update({ last_intent: null })
          .eq("platform", "telegram").eq("platform_id", String(chatId));
        console.log(`[RideUpdates] ✅ Cleared chat sub-state for Telegram ${chatId} on cancelled`);
      } catch (e) {
        console.warn("[RideUpdates] Failed to clear sub-state on cancelled:", e);
      }

      const cancelledBy = payload.cancelled_by;
      const reason = payload.cancellation_reason;

      let cancelMsg = `❌ <b>تم إلغاء الطلب بنجاح.</b>\n`;
      if (cancelledBy === "driver") {
        cancelMsg += `\nالسبب: السائق ألغى الرحلة.`;
      } else if (cancelledBy === "system") {
        cancelMsg += `\nالسبب: لم يتوفر سائق قريب.`;
      }
      if (reason) {
        cancelMsg += `\nملاحظة: ${reason}`;
      }
      cancelMsg += `\n\nتكدر تطلب رحلة جديدة بأي وقت! 🚕\nكيف يمكنني مساعدتك الآن؟`;

      // أزرار inline تفاعلية (حجز جديد + مساعدة)
      const cancelButtons = {
        inline_keyboard: [
          [
            { text: "🚗 حجز رحلة جديدة", callback_data: "action_book_ride" },
            { text: "📞 الاستفسارات", callback_data: "action_inquiry" },
          ],
        ],
      };

      await sendMessage(chatId, cancelMsg, cancelButtons);
      return jsonOk({ sent: "cancelled", buttons: true });
    }

    console.log(`[RideUpdates] Unhandled status: ${new_status}, skipping.`);
    return jsonOk({ skipped: true, reason: "unhandled_status" });
  } catch (err) {
    console.error("[RideUpdates] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════
// Helper: جلب telegram_id من rider_id
// ════════════════════════════════════════════════════════════

async function resolveRiderChatId(
  supabase: any,
  riderId: string
): Promise<number | null> {
  if (!riderId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("user_id", riderId)
    .maybeSingle();

  if (profile?.phone && profile.phone.startsWith("tg_")) {
    const telegramId = parseInt(profile.phone.replace("tg_", ""), 10);
    if (!isNaN(telegramId)) {
      console.log(`[RideUpdates] Resolved chat_id from profile.phone: ${telegramId}`);
      return telegramId;
    }
  }

  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(riderId);
    const tgId = authUser?.user?.user_metadata?.telegram_id;
    if (tgId) {
      console.log(`[RideUpdates] Resolved chat_id from user_metadata: ${tgId}`);
      return typeof tgId === "number" ? tgId : parseInt(tgId, 10);
    }
  } catch (e) {
    console.error("[RideUpdates] Failed to fetch auth user:", e);
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// Helper: جلب تفاصيل السائق
// ════════════════════════════════════════════════════════════

interface DriverDetails {
  full_name: string;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  eta: number;
}

async function fetchDriverDetails(
  supabase: any,
  driverId: string
): Promise<DriverDetails | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("full_name, vehicle_model, vehicle_color, vehicle_plate")
    .eq("id", driverId)
    .maybeSingle();

  if (error || !data) {
    console.error("[RideUpdates] Failed to fetch driver:", error?.message);
    return null;
  }

  return {
    full_name: data.full_name,
    vehicle_model: data.vehicle_model,
    vehicle_color: data.vehicle_color,
    vehicle_plate: data.vehicle_plate,
    eta: 5,
  };
}

// ════════════════════════════════════════════════════════════
// Helper: JSON Response
// ════════════════════════════════════════════════════════════

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
