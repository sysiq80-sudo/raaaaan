// =============================================================
// بوت حارس الكابتن — Captain Guardian Support Bot
// @raan_c_bot — مساعد ذكي لسائقي ران
// الميزة 4: دعم فني ذكي بالذكاء الاصطناعي
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders, getCorsHeaders, requireInternalSecret } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let CAPTAIN_BOT_TOKEN = "";
let OPENAI_API_KEY = "";
let TELEGRAM_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "CAPTAIN_BOT_TOKEN",
      "OPENAI_API_KEY",
    ]);
    CAPTAIN_BOT_TOKEN = cfg["CAPTAIN_BOT_TOKEN"] || CAPTAIN_BOT_TOKEN;
    OPENAI_API_KEY = cfg["OPENAI_API_KEY"] || OPENAI_API_KEY;
    TELEGRAM_API = `https://api.telegram.org/bot${CAPTAIN_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[captain-support-bot] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[captain-support-bot] ⚠️ Config load failed, using env fallbacks:", e);
    CAPTAIN_BOT_TOKEN = CAPTAIN_BOT_TOKEN || Deno.env.get("CAPTAIN_BOT_TOKEN") || "";
    OPENAI_API_KEY = OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY") || "";
    TELEGRAM_API = `https://api.telegram.org/bot${CAPTAIN_BOT_TOKEN}`;
  }
}
// ==================== Telegram Helpers ====================

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
    console.error(`[SendMessage] Failed for chat ${chatId}:`, err);
  }
}

async function sendContactKeyboard(chatId: number) {
  await sendMessage(
    chatId,
    "🚕 <b>مرحباً بك في بوت ران للكباتن!</b>\n\n" +
      "أنا حارسك الذكي — أحمي حقوقك وأساعدك بكل شي.\n\n" +
      "📱 لربط حسابك:\n" +
      "1️⃣ اضغط الزر أدناه لمشاركة رقمك\n" +
      "2️⃣ أو <b>اكتب رقمك المسجل بالتطبيق</b> (مثل: 07844446633)",
    {
      keyboard: [[{ text: "📱 مشاركة رقمي", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    }
  );
}

// ════════════════════════════════════════
// Telegram secret_token validation (constant-time)
// ════════════════════════════════════════
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function isValidTelegramRequest(req: Request): boolean {
  const expectedToken = Deno.env.get("CAPTAIN_TELEGRAM_WEBHOOK_SECRET") ||
                        Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (!expectedToken) {
    console.error("[captain-support-bot] Telegram webhook secret is not configured");
    return false;
  }
  const provided = req.headers.get("x-telegram-bot-api-secret-token") || "";
  return !!provided && constantTimeEqual(provided, expectedToken);
}

// ==================== Main Handler ====================

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    // ═══════════════════════════════════════════════════════
    // سيناريو: تعويض السائق (Compensation Shield)
    // يُستدعى من النظام عند إلغاء راكب بعد تحرك السائق
    // ═══════════════════════════════════════════════════════
    if (body.action === 'COMPENSATE_DRIVER') {
      const authError = requireInternalSecret(req, corsHeaders);
      if (authError) return authError;

      const { driver_id, amount, reason } = body.payload;

      // أ. إضافة الرصيد
      await supabase.rpc('add_driver_balance', {
        p_driver_id: driver_id,
        p_amount: amount,
      });

      // ب. إرسال إشعار تليغرام للسائق
      const { data: driverData } = await supabase
        .from('drivers')
        .select('telegram_chat_id, full_name')
        .eq('id', driver_id)
        .single();

      if (driverData?.telegram_chat_id) {
        await sendMessage(
          driverData.telegram_chat_id,
          `🛡️ <b>حقك محفوظ يا بطل:</b>\n\n` +
            `تم تعويضك بمبلغ <b>${amount.toLocaleString()} د.ع</b> لأن الراكب ألغى الرحلة بعد تحركك.\n` +
            `السبب: ${reason}`
        );
      }

      return new Response(
        JSON.stringify({ success: true, driver: driverData?.full_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════
    // سيناريو: تنبيه من راكب "لعوب" (Risk Radar)
    // يُستدعى عند إرسال طلب لسائق من راكب كثير الإلغاء
    // ═══════════════════════════════════════════════════════
    if (body.action === 'WARN_DRIVER_RISK') {
      const authError = requireInternalSecret(req, corsHeaders);
      if (authError) return authError;

      const { driver_id, rider_phone, cancellation_count } = body.payload;

      const { data: driverData } = await supabase
        .from('drivers')
        .select('telegram_chat_id')
        .eq('id', driver_id)
        .single();

      if (driverData?.telegram_chat_id) {
        await sendMessage(
          driverData.telegram_chat_id,
          `⚠️ <b>تنبيه عمليات:</b>\n\n` +
            `كابتن، هذا الراكب (<code>${rider_phone}</code>) قام بإلغاء ${
              cancellation_count ? cancellation_count + ' رحلات' : 'رحلات سابقة'
            } اليوم.\n` +
            `يرجى الاتصال به وتأكيد الطلب قبل التحرك.`
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Telegram webhook update
    if (body.message || body.callback_query) {
      if (!isValidTelegramRequest(req)) {
        console.warn("[captain-support-bot] Rejected: invalid or missing X-Telegram-Bot-Api-Secret-Token");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      await handleTelegramUpdate(supabase, body);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CaptainBot] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ==================== Telegram Update Router ====================

async function handleTelegramUpdate(supabase: any, update: any) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = message.text?.trim();
  const contact = message.contact;

  console.log(`[CaptainBot] Chat ${chatId}: ${contact ? "CONTACT" : text || "no-text"}`);

  // --- Contact sharing (phone verification) ---
  if (contact) {
    return await handleContactSharing(supabase, chatId, contact);
  }

  // --- /start command ---
  if (text === "/start") {
    return await handleStart(supabase, chatId);
  }

  // --- رقم هاتف مكتوب (07xx أو +964xx أو 964xx) ---
  if (text && /^(\+?964|0)[0-9\s\-]{8,14}$/.test(text.replace(/[\s\-]/g, ""))) {
    const cleanPhone = text.replace(/[\s\-]/g, "");
    return await handlePhoneText(supabase, chatId, cleanPhone);
  }

  // --- /help command ---
  if (text === "/help") {
    await sendMessage(
      chatId,
      "🆘 <b>مساعدة بوت ران للكباتن</b>\n\n" +
        "📊 /stats — عرض إحصائياتك\n" +
        "💰 /wallet — رصيد محفظتك\n" +
        "🚕 /rides — آخر رحلاتك\n" +
        "📱 /start — إعادة الربط\n\n" +
        "💬 <b>أو اكتبلي أي سؤال:</b>\n" +
        "• كم أرباحي اليوم؟\n" +
        "• عندي مشكلة بالتطبيق\n" +
        "• راكب ألغى عليّ\n" +
        "• كيف أزيد تقييمي؟\n" +
        "• شلون أسحب رصيدي؟"
    );
    return;
  }

  // --- Check if driver is linked ---
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, full_name, user_id")
    .eq("telegram_chat_id", chatId.toString())
    .single();

  if (!driver) {
    await sendContactKeyboard(chatId);
    return;
  }

  // --- Commands that require linked driver ---
  if (text === "/stats") {
    return await handleStats(supabase, chatId, driver);
  }

  if (text === "/wallet") {
    return await handleWallet(supabase, chatId, driver);
  }

  if (text === "/rides") {
    return await handleRecentRides(supabase, chatId, driver);
  }

  // --- AI Support Chat (Feature 4) ---
  if (text) {
    return await handleAIChat(supabase, chatId, driver, text);
  }
}

// ==================== /start Handler ====================

async function handleStart(supabase: any, chatId: number) {
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, full_name")
    .eq("telegram_chat_id", chatId.toString())
    .single();

  if (driver) {
    await sendMessage(
      chatId,
      `🚕 <b>أهلاً ${driver.full_name}!</b>\n\n` +
        "أنا حارسك الذكي في ران 🛡️\n\n" +
        "🔰 <b>خدماتي:</b>\n" +
        "🔴 رادار المخاطر — أنبهك من الركاب المشبوهين\n" +
        "⏰ مدرب الالتزام — تذكير بالرحلات المتأخرة\n" +
        "🛡️ درع التعويض — حماية حقوقك عند الإلغاء\n" +
        "🤖 دعم ذكي — أجاوب على أي سؤال\n\n" +
        "📊 /stats — إحصائياتك\n" +
        "💰 /wallet — محفظتك\n" +
        "🚕 /rides — آخر رحلاتك\n" +
        "🆘 /help — المساعدة\n\n" +
        "أو اكتبلي أي سؤال وراح أساعدك! 💬",
      { remove_keyboard: true }
    );
  } else {
    await sendContactKeyboard(chatId);
  }
}

// ==================== Contact Sharing (Phone Verification) ====================

async function handleContactSharing(supabase: any, chatId: number, contact: any) {
  let phone = contact.phone_number || "";
  // تنظيف رقم الهاتف
  phone = phone.replace(/[^0-9]/g, "");
  if (phone.startsWith("964")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  console.log(`[CaptainBot] Phone verification: ${phone}`);

  // البحث بجميع صيغ الرقم
  const phoneVariants = [
    phone,                             // 07xxxxxxxxx
    phone.replace(/^0/, "964"),        // 964xxxxxxxxx
    "+" + phone.replace(/^0/, "964"), // +964xxxxxxxxx
  ];

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, full_name, status, phone")
    .or(phoneVariants.map((p) => `phone.eq.${p}`).join(","))
    .limit(1);

  if (!drivers || drivers.length === 0) {
    await sendMessage(
      chatId,
      "❌ <b>لم يتم العثور على حساب سائق</b>\n\n" +
        `📱 الرقم: ${phone}\n\n` +
        "تأكد أنك مسجل كسائق في تطبيق ران أولاً.\n" +
        "إذا مسجل بس مو راضي يشتغل، تواصل مع الدعم."
    );
    return;
  }

  const driver = drivers[0];

  // ربط telegram_chat_id بالسائق
  await supabase
    .from("drivers")
    .update({ telegram_chat_id: chatId.toString() })
    .eq("id", driver.id);

  const statusText =
    driver.status === "approved"
      ? "✅ موافق"
      : driver.status === "pending"
      ? "⏳ قيد المراجعة"
      : driver.status === "rejected"
      ? "❌ مرفوض"
      : "⚠️ معلق";

  await sendMessage(
    chatId,
    `✅ <b>تم ربط حسابك بنجاح!</b>\n\n` +
      `👤 الاسم: ${driver.full_name}\n` +
      `📊 الحالة: ${statusText}\n\n` +
      "🛡️ الآن راح أرسلك تنبيهات ذكية:\n" +
      "🔴 تحذير من ركاب كثيري الإلغاء\n" +
      "⏰ تذكير بالرحلات المتأخرة\n" +
      "💰 تعويض تلقائي عند إلغاء ظالم\n\n" +
      "📊 /stats — إحصائياتك\n" +
      "💰 /wallet — محفظتك\n" +
      "💬 أو اكتبلي أي سؤال!",
    { remove_keyboard: true }
  );

  console.log(`[CaptainBot] Driver ${driver.id} linked to chat ${chatId}`);
}

// ==================== Phone Text Input (typing the number) ====================

async function handlePhoneText(supabase: any, chatId: number, rawPhone: string) {
  let phone = rawPhone.replace(/[^0-9]/g, "");
  if (phone.startsWith("964")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  console.log(`[CaptainBot] Phone text input: ${phone}`);

  const phoneVariants = [
    phone,
    phone.replace(/^0/, "964"),
    "+" + phone.replace(/^0/, "964"),
  ];

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, full_name, status, phone")
    .or(phoneVariants.map((p: string) => `phone.eq.${p}`).join(","))
    .limit(1);

  if (!drivers || drivers.length === 0) {
    await sendMessage(
      chatId,
      "❌ <b>لم يتم العثور على حساب سائق</b>\n\n" +
        `📱 الرقم: ${phone}\n\n` +
        "تأكد أنك مسجل كسائق في تطبيق ران أولاً.\n" +
        "إذا مسجل بس مو راضي يشتغل، تواصل مع الدعم."
    );
    return;
  }

  const driver = drivers[0];

  await supabase
    .from("drivers")
    .update({ telegram_chat_id: chatId.toString() })
    .eq("id", driver.id);

  const statusText =
    driver.status === "approved"
      ? "✅ موافق"
      : driver.status === "pending"
      ? "⏳ قيد المراجعة"
      : driver.status === "rejected"
      ? "❌ مرفوض"
      : "⚠️ معلق";

  await sendMessage(
    chatId,
    `✅ <b>تم ربط حسابك بنجاح!</b>\n\n` +
      `👤 الاسم: ${driver.full_name}\n` +
      `📊 الحالة: ${statusText}\n\n` +
      "🛡️ الآن راح أرسلك تنبيهات ذكية:\n" +
      "🔴 تحذير من ركاب كثيري الإلغاء\n" +
      "⏰ تذكير بالرحلات المتأخرة\n" +
      "💰 تعويض تلقائي عند إلغاء ظالم\n\n" +
      "📊 /stats — إحصائياتك\n" +
      "💰 /wallet — محفظتك\n" +
      "💬 أو اكتبلي أي سؤال!",
    { remove_keyboard: true }
  );

  console.log(`[CaptainBot] Driver ${driver.id} linked via text phone to chat ${chatId}`);
}

// ==================== /stats Handler ====================

async function handleStats(supabase: any, chatId: number, driver: any) {
  const today = new Date().toISOString().split("T")[0];

  // إحصائيات اليوم
  const { data: todayRides } = await supabase
    .from("rides")
    .select("id, status, final_fare, estimated_fare")
    .eq("driver_id", driver.id)
    .gte("created_at", today + "T00:00:00")
    .lte("created_at", today + "T23:59:59");

  const completed =
    todayRides?.filter((r: any) => r.status === "completed") || [];
  const cancelled =
    todayRides?.filter((r: any) => r.status === "cancelled") || [];
  const totalEarnings = completed.reduce(
    (sum: number, r: any) => sum + (r.final_fare || r.estimated_fare || 0),
    0
  );

  // إجمالي الرحلات
  const { count: totalCompleted } = await supabase
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", driver.id)
    .eq("status", "completed");

  // تقييم السائق
  const { data: driverInfo } = await supabase
    .from("drivers")
    .select("rating, total_rides")
    .eq("id", driver.id)
    .single();

  await sendMessage(
    chatId,
    `📊 <b>إحصائيات ${driver.full_name}</b>\n\n` +
      `━━━ اليوم ━━━\n` +
      `🚕 رحلات مكتملة: ${completed.length}\n` +
      `❌ رحلات ملغاة: ${cancelled.length}\n` +
      `💰 أرباح اليوم: ${totalEarnings.toLocaleString()} د.ع\n\n` +
      `━━━ إجمالي ━━━\n` +
      `🏆 مجموع الرحلات: ${totalCompleted || 0}\n` +
      `⭐ التقييم: ${driverInfo?.rating?.toFixed(1) || "—"}`
  );
}

// ==================== /wallet Handler ====================

async function handleWallet(supabase: any, chatId: number, driver: any) {
  const { data: wallet } = await supabase
    .from("driver_wallets")
    .select("*")
    .eq("driver_id", driver.id)
    .single();

  if (!wallet) {
    // تحقق من رصيد drivers table مباشرة
    const { data: driverData } = await supabase
      .from("drivers")
      .select("wallet_balance, total_earnings")
      .eq("id", driver.id)
      .single();

    await sendMessage(
      chatId,
      `💰 <b>محفظتك</b>\n\n` +
        `💵 الرصيد: ${(driverData?.wallet_balance || 0).toLocaleString()} د.ع\n` +
        `📈 أرباح كلية: ${(driverData?.total_earnings || 0).toLocaleString()} د.ع`
    );
    return;
  }

  // آخر العمليات
  const { data: transactions } = await supabase
    .from("wallet_transactions")
    .select("amount, transaction_type, description, created_at")
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: false })
    .limit(5);

  let txList = "";
  if (transactions?.length) {
    txList = "\n\n━━━ آخر العمليات ━━━\n";
    for (const tx of transactions) {
      const sign = tx.amount >= 0 ? "➕" : "➖";
      const desc = tx.description || tx.transaction_type;
      txList += `${sign} ${Math.abs(tx.amount).toLocaleString()} — ${desc}\n`;
    }
  }

  await sendMessage(
    chatId,
    `💰 <b>محفظتك</b>\n\n` +
      `💵 الرصيد: ${(wallet.balance || 0).toLocaleString()} د.ع\n` +
      `⏳ معلّق: ${(wallet.pending_balance || 0).toLocaleString()} د.ع\n` +
      `📈 أرباح كلية: ${(wallet.lifetime_earnings || 0).toLocaleString()} د.ع\n` +
      `🏷️ عمولة مدفوعة: ${(wallet.commission_paid || 0).toLocaleString()} د.ع\n` +
      `💸 مسحوبات: ${(wallet.total_withdrawn || 0).toLocaleString()} د.ع` +
      txList
  );
}

// ==================== /rides Handler ====================

async function handleRecentRides(supabase: any, chatId: number, driver: any) {
  const { data: rides } = await supabase
    .from("rides")
    .select(
      "pickup_address, dropoff_address, status, final_fare, estimated_fare, created_at"
    )
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!rides?.length) {
    await sendMessage(chatId, "🚕 لا توجد رحلات حتى الآن.");
    return;
  }

  const statusEmoji: Record<string, string> = {
    completed: "✅",
    cancelled: "❌",
    in_progress: "🔄",
    accepted: "📍",
    arrived: "🅿️",
    pending: "⏳",
  };

  let msg = "🚕 <b>آخر 5 رحلات</b>\n\n";
  for (const ride of rides) {
    const emoji = statusEmoji[ride.status] || "📋";
    const fare = ride.final_fare || ride.estimated_fare || 0;
    const date = new Date(ride.created_at).toLocaleDateString("ar-IQ");
    msg += `${emoji} ${ride.pickup_address || "?"} → ${ride.dropoff_address || "?"}\n`;
    msg += `   💰 ${fare.toLocaleString()} د.ع — ${date}\n\n`;
  }

  await sendMessage(chatId, msg);
}

// ==================== AI Support Chat (Feature 4) ====================

async function handleAIChat(
  supabase: any,
  chatId: number,
  driver: any,
  text: string
) {
  try {
    // جمع سياق السائق لإرسالها للذكاء الاصطناعي
    const today = new Date().toISOString().split("T")[0];

    const { data: todayRides } = await supabase
      .from("rides")
      .select("status")
      .eq("driver_id", driver.id)
      .gte("created_at", today + "T00:00:00");

    const completed =
      todayRides?.filter((r: any) => r.status === "completed").length || 0;
    const cancelled =
      todayRides?.filter((r: any) => r.status === "cancelled").length || 0;

    const { data: driverInfo } = await supabase
      .from("drivers")
      .select("rating, total_rides, wallet_balance, status, vehicle_type")
      .eq("id", driver.id)
      .single();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `أنت "حارس ران" — المساعد الذكي لسائقي تاكسي ران في مدينة الرمادي، العراق.

معلومات السائق:
- الاسم: ${driver.full_name}
- التقييم: ${driverInfo?.rating?.toFixed(1) || "جديد"}
- نوع المركبة: ${driverInfo?.vehicle_type || "غير محدد"}
- حالة الحساب: ${driverInfo?.status || "غير محدد"}
- رحلات اليوم المكتملة: ${completed}
- رحلات اليوم الملغاة: ${cancelled}
- الرصيد: ${(driverInfo?.wallet_balance || 0).toLocaleString()} د.ع

مهامك:
1. الإجابة على أسئلة السائق بلهجة عراقية ودودة
2. تقديم نصائح لزيادة الأرباح وتحسين التقييم
3. شرح سياسات ران (العمولة 15%، آلية التسعير، التعويضات)
4. المساعدة في حل المشاكل التقنية
5. الدعم النفسي والتحفيز — شجع السائق دائماً

قواعد مهمة:
- تكلم باللهجة العراقية الودودة (كابتن، هلا، يمعود)
- كن مختصراً (3-6 جمل كحد أقصى)
- إذا السؤال يحتاج تدخل الإدارة، قل "راح أحول طلبك للإدارة"
- لا تشارك معلومات عن ركاب أو سائقين آخرين
- لا تعطي وعود مالية كاذبة
- إذا ما تعرف الجواب، قل بصراحة وحوّله للدعم`,
          },
          { role: "user", content: text },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[AI Chat] OpenAI error:", JSON.stringify(result));
      await sendMessage(
        chatId,
        "⚠️ عذراً كابتن، صار خطأ بالنظام. حاول مرة ثانية بعد شوية."
      );
      return;
    }

    const reply =
      result.choices?.[0]?.message?.content ||
      "عذراً كابتن، ما كدرت أفهم سؤالك. حاول مرة ثانية.";

    await sendMessage(chatId, `🤖 ${reply}`);
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    await sendMessage(
      chatId,
      "⚠️ عذراً كابتن، صار خطأ. حاول مرة ثانية."
    );
  }
}
