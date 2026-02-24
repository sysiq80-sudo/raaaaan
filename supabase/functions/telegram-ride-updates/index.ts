/**
 * ران — إشعارات تحديث الرحلة عبر تيليغرام (الراكب)
 * Telegram Ride Status Notifications for @raan_1_bot
 *
 * يُستدعى من Database Webhook (trigger) كل ما يتغير status في rides
 * الشرط: trip_type = 'telegram' + تغيّر الحالة
 *
 * الحالات المدعومة:
 *   accepted   → رسالة بتفاصيل الكابتن + السيارة
 *   arrived    → الكابتن وصل
 *   in_progress→ بدأت الرحلة
 *   completed  → وصلت بالسلامة + أزرار التقييم ⭐
 *   cancelled  → تم إلغاء الرحلة
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

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
    const cfg = await getConfigBatch(svc, [
      "TELEGRAM_BOT_TOKEN",
      "SITE_URL",
    ]);
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[RideUpdates] sendMessage failed for chat ${chatId}:`, err);
  } else {
    console.log(`[RideUpdates] Message sent to chat ${chatId}`);
  }
}

// ════════════════════════════════════════════════════════════
// Smart Destination Hint — تنويه ذكي للوجهة
// ════════════════════════════════════════════════════════════

const VAGUE_KEYWORDS = ["شارع", "حي", "منطقة"];
const LANDMARK_KEYWORDS = ["جامعة", "مستشفى", "مول", "ملعب"];

function getSmartHint(address: string | null): string {
  if (!address) return "";

  // إذا الوجهة معلم معروف — لا حاجة للتنويه
  if (LANDMARK_KEYWORDS.some((kw) => address.includes(kw))) return "";

  // إذا الوجهة عامة (شارع/حي/منطقة) — أضف تنويه
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
// Main Handler
// ════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const payload = await req.json();

    // الحقول المتوقعة من الـ trigger
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── جلب telegram chat_id للراكب من profiles.phone (tg_{telegram_id}) أو user_metadata
    const chatId = await resolveRiderChatId(supabase, rider_id);
    if (!chatId) {
      console.error(`[RideUpdates] Could not resolve Telegram chat_id for rider ${rider_id}`);
      return jsonOk({ skipped: true, reason: "no_chat_id" });
    }

    // ══════════════════════════════════
    // 1️⃣ accepted — تم قبول الطلب + رابط التتبع المباشر
    // ══════════════════════════════════
    if (new_status === "accepted" && driver_id) {
      const driver = await fetchDriverDetails(supabase, driver_id);
      const eta = driver?.eta ?? 5;

      // إنشاء رابط التتبع المباشر
      let trackingLine = "";
      try {
        const { data: token } = await supabase
          .rpc("generate_ride_tracking_token", { p_ride_id: ride_id });
        if (token) {
          const trackingUrl = `${SITE_URL}/track/${token}`;
          trackingLine = `\n\n📍 <b>تتبع الرحلة مباشرة:</b>\n${trackingUrl}`;
        }
      } catch (e) {
        console.warn("[RideUpdates] Failed to generate tracking link:", e);
      }

      await sendMessage(
        chatId,
        `🎉 <b>تم قبول طلبك!</b>\n\n` +
          `👤 الكابتن: <b>${driver?.full_name ?? "غير معروف"}</b>\n` +
          `🚗 السيارة: ${driver?.vehicle_model ?? "—"} - ${driver?.vehicle_color ?? "—"} (${driver?.vehicle_plate ?? "—"})\n\n` +
          `⏳ وقت الوصول: خلال <b>${eta} دقائق</b> تقريباً.\n` +
          `خليك جاهز.. الكابتن بالطريق!` +
          trackingLine
      );

      return jsonOk({ sent: "accepted" });
    }

    // ══════════════════════════════════
    // 2️⃣ arrived — الكابتن وصل
    // ══════════════════════════════════
    if (new_status === "arrived") {
      await sendMessage(
        chatId,
        `🔔 <b>الكابتن وصل للموقع!</b>\nهو بانتظارك الآن.. يرجى التوجه للسيارة.`
      );
      return jsonOk({ sent: "arrived" });
    }

    // ══════════════════════════════════
    // 3️⃣ in_progress — بدأت الرحلة + تنويه ذكي
    // ══════════════════════════════════
    if (new_status === "in_progress") {
      // جلب مدة الرحلة المقدرة من جدول rides
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
        ? `\n⏱️ مدة الطريق: <b>${tripDuration} دقيقة</b> تقريباً.`
        : "";

      const smartHint = getSmartHint(dropoff_address);

      await sendMessage(
        chatId,
        `🚀 <b>أنت الآن في الرحلة!</b>${durationLine}${smartHint}`
      );
      return jsonOk({ sent: "in_progress" });
    }

    // ══════════════════════════════════
    // 4️⃣ completed — وصلت بالسلامة + تقييم
    // ══════════════════════════════════
    if (new_status === "completed") {
      const fare = final_fare || estimated_fare || 0;

      // أزرار التقييم Inline
      const ratingButtons = {
        inline_keyboard: [
          [
            { text: "⭐ 1", callback_data: `rate_${ride_id}_1` },
            { text: "⭐ 2", callback_data: `rate_${ride_id}_2` },
            { text: "⭐ 3", callback_data: `rate_${ride_id}_3` },
            { text: "⭐ 4", callback_data: `rate_${ride_id}_4` },
            { text: "⭐ 5", callback_data: `rate_${ride_id}_5` },
          ],
        ],
      };

      await sendMessage(
        chatId,
        `✅ <b>الحمد لله على السلامة!</b>\n\n` +
          `💰 المبلغ المطلوب: <b>${fare.toLocaleString()} د.ع</b>\n\n` +
          `شكراً لاستخدامك الحجز الذكي من ران 🚕\n` +
          `كيف كان تعامل الكابتن؟ 👇`,
        ratingButtons
      );

      // ── عرض خيار رحلة جديدة مع كيبورد الموقع
      await sendMessage(
        chatId,
        `هل تريد رحلة جديدة؟ 🚕\nدز موقعك الحالي مرة ثانية 👇`,
        {
          keyboard: [[{ text: "📍 مشاركة موقعي الحالي", request_location: true }]],
          resize_keyboard: true,
        }
      );

      return jsonOk({ sent: "completed" });
    }

    // ══════════════════════════════════
    // 5️⃣ cancelled — تم الإلغاء
    // ══════════════════════════════════
    if (new_status === "cancelled") {
      const cancelledBy = payload.cancelled_by;
      const reason = payload.cancellation_reason;

      let cancelMsg = `❌ <b>تم إلغاء الرحلة</b>\n`;
      if (cancelledBy === "driver") {
        cancelMsg += `\nالسبب: السائق ألغى الرحلة.`;
      } else if (cancelledBy === "system") {
        cancelMsg += `\nالسبب: لم يتوفر سائق قريب.`;
      }
      if (reason) {
        cancelMsg += `\nملاحظة: ${reason}`;
      }
      cancelMsg += `\n\nيمكنك طلب رحلة جديدة بإرسال موقعك مرة أخرى 📍`;

      await sendMessage(chatId, cancelMsg);
      return jsonOk({ sent: "cancelled" });
    }

    // أي حالة أخرى — تجاهل
    console.log(`[RideUpdates] Unhandled status: ${new_status}, skipping.`);
    return jsonOk({ skipped: true, reason: "unhandled_status" });

  } catch (err) {
    console.error("[RideUpdates] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ════════════════════════════════════════════════════════════
// Helper: جلب telegram_id من rider_id
// الاستراتيجية:
//   1. profiles.phone يبدأ بـ "tg_" → استخرج الرقم
//   2. fallback: auth.users.raw_user_meta_data → telegram_id
// ════════════════════════════════════════════════════════════

async function resolveRiderChatId(
  supabase: ReturnType<typeof createClient>,
  riderId: string
): Promise<number | null> {
  if (!riderId) return null;

  // 1. جلب profiles.phone
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

  // 2. Fallback: auth.users.raw_user_meta_data.telegram_id
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
  supabase: ReturnType<typeof createClient>,
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
    eta: 5, // قيمة افتراضية — يمكن حسابها مستقبلاً من المسافة
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
