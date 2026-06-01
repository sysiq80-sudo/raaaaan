// =============================================================
// نظام تنبيهات حارس الكابتن — Captain Guardian Alerts
// يُستدعى من DB triggers و pg_cron
// الميزة 1: رادار المخاطر (Risk Radar)
// الميزة 2: مدرب الالتزام (Punctuality Coach)
// الميزة 3: درع التعويض (Compensation Shield)
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, requireInternalSecret } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let CAPTAIN_BOT_TOKEN = "";
let TELEGRAM_API = "";
let _configLoaded = false;

const REQUIRED_ACTION_FIELDS: Record<string, string[]> = {
  risk_radar: ["ride_id", "driver_id", "rider_id"],
  compensation_shield: ["ride_id", "driver_id"],
  punctuality_check: [],
};

function getMissingActionFields(action: string, body: Record<string, unknown>): string[] {
  const requiredFields = REQUIRED_ACTION_FIELDS[action];
  if (!requiredFields) return ["action"];
  return requiredFields.filter((fieldName) => !body[fieldName]);
}

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["CAPTAIN_BOT_TOKEN"]);
    CAPTAIN_BOT_TOKEN = cfg["CAPTAIN_BOT_TOKEN"] || CAPTAIN_BOT_TOKEN;
    TELEGRAM_API = `https://api.telegram.org/bot${CAPTAIN_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[captain-guardian-alerts] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[captain-guardian-alerts] ⚠️ Config load failed, using env fallbacks:", e);
    CAPTAIN_BOT_TOKEN = CAPTAIN_BOT_TOKEN || Deno.env.get("CAPTAIN_BOT_TOKEN") || "";
    TELEGRAM_API = `https://api.telegram.org/bot${CAPTAIN_BOT_TOKEN}`;
  }
}
// ==================== Telegram Helper ====================

async function sendTelegram(chatId: string, text: string) {
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
      console.error(`[Telegram] Failed to send to ${chatId}:`, err);
    }
    return res.ok;
  } catch (err) {
    console.error(`[Telegram] Error sending to ${chatId}:`, err);
    return false;
  }
}

// ==================== Main Handler ====================

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const internalDenied = requireInternalSecret(req, corsHeaders);
  if (internalDenied) return internalDenied;

  await loadDynamicConfig();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";
    const missingFields = getMissingActionFields(action, body);

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "INVALID_GUARDIAN_PAYLOAD", missing_fields: missingFields }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[CaptainGuardian] Action: ${action}`, JSON.stringify(body));

    switch (action) {
      case "risk_radar":
        await handleRiskRadar(supabase, body);
        break;
      case "compensation_shield":
        await handleCompensationShield(supabase, body);
        break;
      case "punctuality_check":
        await handlePunctualityCheck(supabase);
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: "UNKNOWN_GUARDIAN_ACTION" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CaptainGuardian] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// =============================================================
// الميزة 1: رادار المخاطر — Risk Radar
// يُفعّل عندما يقبل السائق رحلة جديدة
// يفحص سجل إلغاءات الراكب وينبه السائق
// =============================================================

async function handleRiskRadar(supabase: any, payload: any) {
  const { ride_id, driver_id, rider_id } = payload;

  console.log(`[RiskRadar] ride=${ride_id}, driver=${driver_id}, rider=${rider_id}`);

  // جلب telegram_chat_id للسائق
  const { data: driver } = await supabase
    .from("drivers")
    .select("telegram_chat_id, full_name")
    .eq("id", driver_id)
    .single();

  if (!driver?.telegram_chat_id) {
    console.log(`[RiskRadar] Driver ${driver_id} has no telegram_chat_id — skipping`);
    return;
  }

  // فحص سجل إلغاءات الراكب (آخر 30 يوم)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: riderRides } = await supabase
    .from("rides")
    .select("id, status, cancelled_by")
    .eq("rider_id", rider_id)
    .gte("created_at", thirtyDaysAgo);

  if (!riderRides?.length) {
    console.log(`[RiskRadar] Rider ${rider_id} has no history — safe`);
    return;
  }

  const totalRides = riderRides.length;
  const cancelledByRider = riderRides.filter(
    (r: any) => r.status === "cancelled" && r.cancelled_by === "rider"
  ).length;
  const completedRides = riderRides.filter(
    (r: any) => r.status === "completed"
  ).length;
  const cancellationRate = (cancelledByRider / totalRides) * 100;

  // لا تنبيه إلا إذا كان الراكب خطير (>30% إلغاء أو >3 إلغاءات)
  if (cancellationRate < 30 && cancelledByRider < 3) {
    console.log(
      `[RiskRadar] Rider ${rider_id} is safe: ${cancelledByRider}/${totalRides} (${cancellationRate.toFixed(0)}%)`
    );
    return;
  }

  // جلب اسم الراكب
  const { data: riderProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", rider_id)
    .single();

  // تحديد مستوى الخطر
  let riskEmoji = "⚠️";
  let riskText = "متوسط";
  if (cancellationRate >= 50 || cancelledByRider >= 5) {
    riskEmoji = "🔴";
    riskText = "عالي";
  } else if (cancellationRate >= 70 || cancelledByRider >= 8) {
    riskEmoji = "🚨";
    riskText = "خطير جداً";
  }

  // إرسال التنبيه للسائق
  const alertMsg =
    `${riskEmoji} <b>تنبيه رادار المخاطر!</b>\n\n` +
    `📋 رحلة جديدة من: <b>${riderProfile?.full_name || "راكب"}</b>\n\n` +
    `📊 سجل الراكب (آخر 30 يوم):\n` +
    `├ إلغاءات: ${cancelledByRider} مرة\n` +
    `├ رحلات مكتملة: ${completedRides}\n` +
    `├ نسبة الإلغاء: ${cancellationRate.toFixed(0)}%\n` +
    `└ مستوى الخطر: <b>${riskText}</b>\n\n` +
    `💡 <b>نصيحة:</b> خذ حذرك كابتن!\n` +
    `• انتظر تأكيد الراكب قبل ما تتحرك بعيد\n` +
    `• تواصل مع الراكب وتأكد من جديته`;

  await sendTelegram(driver.telegram_chat_id, alertMsg);

  // تسجيل التنبيه
  await supabase.from("captain_alerts_log").insert({
    driver_id,
    ride_id,
    alert_type: "risk_radar",
    message: `راكب بنسبة إلغاء ${cancellationRate.toFixed(0)}% (${cancelledByRider}/${totalRides})`,
  });

  console.log(
    `[RiskRadar] Alert sent to driver ${driver_id} about rider ${rider_id}: ${cancellationRate.toFixed(0)}%`
  );
}

// =============================================================
// الميزة 3: درع التعويض — Compensation Shield (إشعار فقط)
// يُفعّل عندما يلغي الراكب بعد قبول السائق
//
// ⚠️ هذه الدالة لا تكتب أي بيانات مالية نهائياً.
// المسؤول الوحيد عن التعويض المالي هو trigger_rider_cancellation_penalty (DB).
// دور هذه الدالة: قراءة ما سجّله الـ trigger فعلاً ثم إبلاغ السائق عبر تلغرام.
// =============================================================

async function handleCompensationShield(supabase: any, payload: any) {
  const { ride_id, driver_id, old_status } = payload;

  console.log(`[CompensationShield] ride=${ride_id}, driver=${driver_id}, old_status=${old_status}`);

  // جلب معلومات السائق
  const { data: driver } = await supabase
    .from("drivers")
    .select("telegram_chat_id, full_name")
    .eq("id", driver_id)
    .single();

  if (!driver?.telegram_chat_id) {
    console.log(`[CompensationShield] Driver ${driver_id} has no telegram_chat_id — skipping`);
    return;
  }

  // جلب تفاصيل الرحلة
  const { data: ride } = await supabase
    .from("rides")
    .select("matched_at, pickup_address, dropoff_address")
    .eq("id", ride_id)
    .single();

  if (!ride) {
    console.log(`[CompensationShield] Ride ${ride_id} not found`);
    return;
  }

  const minutesSinceAccept = ride.matched_at
    ? ((Date.now() - new Date(ride.matched_at).getTime()) / (1000 * 60)).toFixed(0)
    : "?";

  // ── المصدر الوحيد للحقيقة المالية: قاعدة البيانات ──
  // نقرأ ما سجّله trigger_rider_cancellation_penalty فعلاً في wallet_transactions.
  // pg_net يُطلق هذا الطلب بعد commit الـ transaction، فالبيانات مضمونة مرئية.
  //
  // ملاحظة: create_wallet_transaction() يُسجّل التعويض كـ type='bonus'
  // مع metadata->>'penalty_type' = 'rider_cancellation_compensation'
  // لذا نفلتر على كليهما لتمييز تعويض الإلغاء عن أي مكافأة عادية.
  const { data: compensationTx } = await supabase
    .from("wallet_transactions")
    .select("amount, description")
    .eq("ride_id", ride_id)
    .eq("driver_id", driver_id)
    .eq("transaction_type", "bonus")
    .filter("metadata->>penalty_type", "eq", "rider_cancellation_compensation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let logMessage: string;

  if (compensationTx) {
    // السائق حصل على تعويض — أبلّغه بالمبلغ الفعلي من DB
    const statusLabel = old_status === "arrived" ? "بعد وصولك" : "بعد قبولك";
    const alertMsg =
      `🛡️ <b>درع التعويض — تم حماية حقوقك!</b>\n\n` +
      `❌ الراكب ألغى الرحلة ${statusLabel}\n\n` +
      `📍 من: ${ride.pickup_address || "?"}\n` +
      `📍 إلى: ${ride.dropoff_address || "?"}\n` +
      `⏱ منذ القبول: ${minutesSinceAccept} دقيقة\n\n` +
      `💰 <b>التعويض: ${compensationTx.amount.toLocaleString()} د.ع</b>\n` +
      `✅ تمت إضافته لمحفظتك تلقائياً\n\n` +
      `الله يعوضك خير كابتن! 💪🛡️`;

    await sendTelegram(driver.telegram_chat_id, alertMsg);
    logMessage = `إشعار تعويض ${compensationTx.amount} د.ع`;
    console.log(`[CompensationShield] Notified driver ${driver_id}: ${compensationTx.amount} IQD for ride ${ride_id}`);
  } else {
    // لا تعويض — إلغاء مبكر لم تتوفر شروطه
    await sendTelegram(
      driver.telegram_chat_id,
      `❌ <b>رحلة ملغاة</b>\n\n` +
        `📍 من: ${ride.pickup_address || "?"}\n` +
        `📍 إلى: ${ride.dropoff_address || "?"}\n` +
        `⏱ منذ القبول: ${minutesSinceAccept} دقيقة\n\n` +
        `ℹ️ الإلغاء كان مبكراً — لم تتوفر شروط التعويض.\n` +
        `الله يعوضك كابتن! 💪`
    );
    logMessage = `إلغاء مبكر — لا تعويض`;
    console.log(`[CompensationShield] No compensation for driver ${driver_id}, ride ${ride_id} — notified`);
  }

  // تسجيل الإشعار (لا مال — إشعار فقط)
  await supabase.from("captain_alerts_log").insert({
    driver_id,
    ride_id,
    alert_type: "compensation_shield",
    message: logMessage,
  });
}

// =============================================================
// الميزة 2: مدرب الالتزام — Punctuality Coach
// يُستدعى كل 5 دقائق عبر pg_cron
// يفحص الرحلات المتأخرة وينبه السائقين
// =============================================================

async function handlePunctualityCheck(supabase: any) {
  console.log("[PunctualityCoach] Running scheduled check...");

  const now = Date.now();
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

  // رحلات مقبولة من أكثر من 10 دقائق ولم يصل السائق بعد
  const { data: delayedAccepted } = await supabase
    .from("rides")
    .select("id, driver_id, pickup_address, matched_at")
    .eq("status", "accepted")
    .lt("matched_at", tenMinutesAgo)
    .not("driver_id", "is", null)
    .not("matched_at", "is", null);

  // رحلات وصل السائق من أكثر من 10 دقائق ولم تبدأ بعد
  const { data: delayedArrived } = await supabase
    .from("rides")
    .select("id, driver_id, pickup_address, driver_arrival_time")
    .eq("status", "arrived")
    .lt("driver_arrival_time", tenMinutesAgo)
    .not("driver_id", "is", null)
    .not("driver_arrival_time", "is", null);

  const allDelayed = [
    ...(delayedAccepted || []).map((r: any) => ({
      ...r,
      delayType: "accepted",
      refTime: r.matched_at,
    })),
    ...(delayedArrived || []).map((r: any) => ({
      ...r,
      delayType: "arrived",
      refTime: r.driver_arrival_time,
    })),
  ];

  if (allDelayed.length === 0) {
    console.log("[PunctualityCoach] No delayed rides found ✓");
    return;
  }

  console.log(`[PunctualityCoach] Found ${allDelayed.length} delayed rides`);

  // منع التكرار: فحص التنبيهات المرسلة مؤخراً
  const rideIds = allDelayed.map((r: any) => r.id);
  const { data: existingAlerts } = await supabase
    .from("captain_alerts_log")
    .select("ride_id")
    .eq("alert_type", "punctuality_coach")
    .in("ride_id", rideIds)
    .gte("created_at", fiveMinutesAgo);

  const alertedRideIds = new Set(
    (existingAlerts || []).map((a: any) => a.ride_id)
  );

  let alertsSent = 0;

  for (const ride of allDelayed) {
    // تخطي إذا تم التنبيه مؤخراً
    if (alertedRideIds.has(ride.id)) continue;

    // جلب telegram السائق
    const { data: driver } = await supabase
      .from("drivers")
      .select("telegram_chat_id, full_name")
      .eq("id", ride.driver_id)
      .single();

    if (!driver?.telegram_chat_id) continue;

    const minutesDelay = Math.round(
      (now - new Date(ride.refTime).getTime()) / (1000 * 60)
    );

    const delayTypeText =
      ride.delayType === "accepted"
        ? "قبلت الرحلة ولم تصل بعد"
        : "وصلت للموقع ولم تبدأ الرحلة";

    const alertMsg =
      `⏰ <b>تذكير ودي — رحلة متأخرة</b>\n\n` +
      `📍 ${ride.pickup_address || "نقطة الانطلاق"}\n` +
      `⏱ مرّت <b>${minutesDelay} دقيقة</b> — ${delayTypeText}\n\n` +
      `💡 <b>نصائح:</b>\n` +
      `• تواصل مع الراكب لتأكيد الموعد\n` +
      `• إذا الراكب مو جاهز، يمكنك إلغاء الرحلة\n\n` +
      `⭐ التأخير يؤثر على تقييمك كابتن — ساعدنا نحافظ على الخدمة!`;

    const sent = await sendTelegram(driver.telegram_chat_id, alertMsg);

    if (sent) {
      // تسجيل التنبيه
      await supabase.from("captain_alerts_log").insert({
        driver_id: ride.driver_id,
        ride_id: ride.id,
        alert_type: "punctuality_coach",
        message: `تأخير ${minutesDelay} دقيقة — ${delayTypeText}`,
      });
      alertsSent++;
    }
  }

  console.log(
    `[PunctualityCoach] Sent ${alertsSent} alerts out of ${allDelayed.length} delayed rides`
  );
}
