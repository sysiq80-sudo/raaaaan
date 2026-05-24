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
import { corsHeaders } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let CAPTAIN_BOT_TOKEN = "";
let TELEGRAM_API = "";
let _configLoaded = false;

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const action = body.action;

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
        console.log(`[CaptainGuardian] Unknown action: ${action}`);
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
// الميزة 3: درع التعويض — Compensation Shield
// يُفعّل عندما يلغي الراكب بعد قبول السائق
// يفحص إذا السائق تحرك ويعوضه تلقائياً
// =============================================================

async function handleCompensationShield(supabase: any, payload: any) {
  const {
    ride_id,
    driver_id,
    rider_id,
    cancellation_reason,
    distance_to_pickup_at_cancel,
  } = payload;

  console.log(
    `[CompensationShield] ride=${ride_id}, driver=${driver_id}, distance=${distance_to_pickup_at_cancel}`
  );

  // جلب معلومات السائق
  const { data: driver } = await supabase
    .from("drivers")
    .select("telegram_chat_id, full_name")
    .eq("id", driver_id)
    .single();

  // جلب تفاصيل الرحلة
  const { data: ride } = await supabase
    .from("rides")
    .select("matched_at, pickup_address, dropoff_address, estimated_fare, distance_km")
    .eq("id", ride_id)
    .single();

  if (!ride) {
    console.log(`[CompensationShield] Ride ${ride_id} not found`);
    return;
  }

  // حساب الوقت منذ قبول الرحلة
  const acceptedAt = ride.matched_at ? new Date(ride.matched_at) : null;
  const minutesSinceAccept = acceptedAt
    ? (Date.now() - acceptedAt.getTime()) / (1000 * 60)
    : 0;

  // معايير التعويض: السائق انتظر > 2 دقيقة أو تحرك باتجاه الراكب (< 3 كم)
  const DISTANCE_THRESHOLD = 3; // كم
  const TIME_THRESHOLD = 2; // دقائق

  const driverMoved =
    distance_to_pickup_at_cancel != null &&
    distance_to_pickup_at_cancel < DISTANCE_THRESHOLD;
  const waitedLong = minutesSinceAccept > TIME_THRESHOLD;

  if (!driverMoved && !waitedLong) {
    console.log(
      `[CompensationShield] No compensation: time=${minutesSinceAccept.toFixed(1)}min, distance=${distance_to_pickup_at_cancel}`
    );

    // إشعار بسيط بدون تعويض
    if (driver?.telegram_chat_id) {
      await sendTelegram(
        driver.telegram_chat_id,
        `❌ <b>رحلة ملغاة</b>\n\n` +
          `📍 من: ${ride.pickup_address || "?"}\n` +
          `📍 إلى: ${ride.dropoff_address || "?"}\n` +
          `📝 السبب: ${cancellation_reason || "بدون سبب"}\n\n` +
          `ℹ️ الإلغاء كان مبكراً — لم يتم منح تعويض.\n` +
          `الله يعوضك كابتن! 💪`
      );
    }
    return;
  }

  // حساب التعويض (25% من الأجرة المتوقعة، حد أدنى 1000 د.ع)
  const estimatedFare = ride.estimated_fare || 5000;
  const compensation = Math.max(Math.round(estimatedFare * 0.25), 1000);

  // إضافة التعويض لمحفظة السائق
  let compensationAdded = false;

  const { data: wallet } = await supabase
    .from("driver_wallets")
    .select("id, balance")
    .eq("driver_id", driver_id)
    .single();

  if (wallet) {
    const newBalance = (wallet.balance || 0) + compensation;

    // تحديث الرصيد
    await supabase
      .from("driver_wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    // تسجيل العملية المالية
    await supabase.from("wallet_transactions").insert({
      driver_id,
      wallet_id: wallet.id,
      ride_id,
      amount: compensation,
      balance_before: wallet.balance || 0,
      balance_after: newBalance,
      transaction_type: "compensation",
      status: "completed",
      description: `🛡️ تعويض إلغاء — الراكب ألغى بعد ${minutesSinceAccept.toFixed(0)} دقيقة`,
      metadata: {
        cancellation_reason,
        minutes_waited: minutesSinceAccept.toFixed(1),
        distance_to_pickup: distance_to_pickup_at_cancel,
      },
    });

    compensationAdded = true;
  } else {
    // احتياط: استخدام driver_wallet_transactions
    await supabase.from("driver_wallet_transactions").insert({
      driver_id,
      ride_id,
      amount: compensation,
      type: "compensation",
      description: `🛡️ تعويض إلغاء — الراكب ألغى بعد ${minutesSinceAccept.toFixed(0)} دقيقة`,
    });

    // تحديث wallet_balance في جدول drivers
    const { data: driverData } = await supabase
      .from("drivers")
      .select("wallet_balance")
      .eq("id", driver_id)
      .single();

    await supabase
      .from("drivers")
      .update({
        wallet_balance: (driverData?.wallet_balance || 0) + compensation,
      })
      .eq("id", driver_id);

    compensationAdded = true;
  }

  // إرسال تنبيه تلغرام للسائق
  if (driver?.telegram_chat_id) {
    const reasons = [];
    if (waitedLong)
      reasons.push(`⏱ انتظرت ${minutesSinceAccept.toFixed(0)} دقيقة`);
    if (driverMoved)
      reasons.push(
        `📏 تحركت ${distance_to_pickup_at_cancel?.toFixed(1)} كم باتجاه الراكب`
      );

    const alertMsg =
      `🛡️ <b>درع التعويض — تم حماية حقوقك!</b>\n\n` +
      `❌ الراكب ألغى الرحلة بعد قبولك\n\n` +
      `📍 من: ${ride.pickup_address || "?"}\n` +
      `📍 إلى: ${ride.dropoff_address || "?"}\n` +
      `📝 سبب الإلغاء: ${cancellation_reason || "بدون سبب"}\n\n` +
      `<b>سبب التعويض:</b>\n` +
      reasons.map((r) => `  ${r}`).join("\n") +
      `\n\n` +
      `💰 <b>التعويض: ${compensation.toLocaleString()} د.ع</b>\n` +
      (compensationAdded
        ? `✅ تمت إضافته لمحفظتك تلقائياً`
        : `⚠️ يتم معالجة التعويض`) +
      `\n\n` +
      `الله يعوضك خير كابتن! 💪🛡️`;

    await sendTelegram(driver.telegram_chat_id, alertMsg);
  }

  // تسجيل التنبيه
  await supabase.from("captain_alerts_log").insert({
    driver_id,
    ride_id,
    alert_type: "compensation_shield",
    message: `تعويض ${compensation} د.ع — انتظر ${minutesSinceAccept.toFixed(0)} دقيقة`,
  });

  console.log(
    `[CompensationShield] Compensated driver ${driver_id}: ${compensation} IQD for ride ${ride_id}`
  );
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
