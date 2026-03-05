#!/usr/bin/env node
/**
 * ران — سكريبت بث تحديث لجميع المستخدمين
 * RAAN Broadcast Script — Send update announcement to all bot users
 *
 * Usage:
 *   node scripts/broadcast-update.mjs
 *
 * Environment Variables (required):
 *   SUPABASE_URL           — e.g. https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY   — Supabase service_role key
 *
 * The script reads TELEGRAM_BOT_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID
 * from the system_configs table automatically.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ════════════════════════════════════════
// 📝 نص البث — Arabic Broadcast Message
// ════════════════════════════════════════
const BROADCAST_TEXT = `🎉 تحديث ضخم في تكسي ران! 🎉

أهلاً بك كابتن! يسعدنا أن نعلن عن إطلاق التحديث الجديد والمتكامل لبوت "ران"، صممناه خصيصاً ليكون أسرع، أذكى، ويوفر لك تجربة حجز خيالية! 🚕✨

شنو الجديد بهذا التحديث؟ 👇

🧠 ذكاء اصطناعي يفهمك فوراً:
بعد ماكو داعي تدز موقعك كأول خطوة! فقط اكتب أو دز بصمة صوتية (مثلاً: أريد تكسي من حي المعلمين لمول أم عمار)، والبوت راح يفهمك ويحسب السعر مباشرة!

💳 محفظة ران الذكية:
وفرنالك ميزة إضافة رصيد لمحفظتك بكل سهولة عبر (زين كاش، سوبر كي، كيو كارد). اشحن رصيدك واستخدمه برحلاتك القادمة.

🔄 رحلة العودة بضغطة زر:
خلصت مشوارك وتريد ترجع؟ ضفنا زر "رحلة عكسية" يرجعك لنفس نقطة انطلاقك بثانية وحدة وبدون ما تكتب شيء.

🎧 دعم فني مباشر للإدارة:
أي شكوى، استفسار سريع، أو نسيان غرض بالسيارة، صار يتحول فوراً للإدارة لضمان حقك وحل مشكلتك بأسرع وقت.

⚡ تسعير أدق:
ربط مباشر بأحدث أنظمة الخرائط لضمان دقة السعر وسرعة وصول أقرب كابتن لك.

نتمنى لك استخداماً ممتعاً ومميزاً.. نحن دائماً بخدمتك! ❤️

👉 جرب التحديث الآن، فقط أرسل "مرحبا" أو ابدأ حجزك فوراً!`;

// ════════════════════════════════════════
// ⚙️ Configuration
// ════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing env: SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");
  console.error("Usage: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/broadcast-update.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ════════════════════════════════════════
// 🔧 Helpers
// ════════════════════════════════════════

/** Small delay to respect rate limits */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch config values from system_configs table */
async function getConfigs(keys) {
  const { data, error } = await supabase
    .from("system_configs")
    .select("key_name, key_value")
    .in("key_name", keys);

  if (error) throw new Error(`Config fetch failed: ${error.message}`);
  const result = {};
  for (const row of data || []) {
    result[row.key_name] = row.key_value;
  }
  return result;
}

/** Fetch all unique bot_customers grouped by platform */
async function fetchAllUsers() {
  // Fetch all bot_customers (they have verified interactions)
  const { data, error } = await supabase
    .from("bot_customers")
    .select("id, platform, platform_id, full_name, phone_number, last_active")
    .order("last_active", { ascending: false });

  if (error) throw new Error(`User fetch failed: ${error.message}`);
  return data || [];
}

// ════════════════════════════════════════
// 📨 Telegram Broadcast
// ════════════════════════════════════════

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
  const result = await res.json();
  if (!result.ok) {
    throw new Error(`Telegram error ${result.error_code}: ${result.description}`);
  }
  return result;
}

async function broadcastTelegram(users, botToken) {
  console.log(`\n📱 بث تيليغرام — ${users.length} مستخدم`);
  console.log("─".repeat(50));

  let sent = 0;
  let failed = 0;
  let blocked = 0;
  const errors = [];

  for (const user of users) {
    const chatId = user.platform_id;
    try {
      await sendTelegramMessage(botToken, chatId, BROADCAST_TEXT);
      sent++;
      process.stdout.write(`\r  ✅ Sent: ${sent} | ❌ Failed: ${failed} | 🚫 Blocked: ${blocked}`);
      // Telegram rate limit: max 30 msgs/sec → 50ms delay (safe margin)
      await sleep(50);
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("403") || msg.includes("bot was blocked") || msg.includes("user is deactivated")) {
        blocked++;
      } else {
        failed++;
        errors.push({ chatId, name: user.full_name, error: msg });
      }
      process.stdout.write(`\r  ✅ Sent: ${sent} | ❌ Failed: ${failed} | 🚫 Blocked: ${blocked}`);
      await sleep(50);
    }
  }

  console.log(`\n\n  📊 نتيجة بث تيليغرام:`);
  console.log(`     ✅ نجاح: ${sent}`);
  console.log(`     🚫 محظور/معطل: ${blocked}`);
  console.log(`     ❌ فشل: ${failed}`);

  if (errors.length > 0) {
    console.log(`\n  أخطاء تيليغرام:`);
    errors.slice(0, 10).forEach((e) => console.log(`    - ${e.chatId} (${e.name}): ${e.error}`));
    if (errors.length > 10) console.log(`    ... و ${errors.length - 10} أخطاء أخرى`);
  }

  return { sent, failed, blocked };
}

// ════════════════════════════════════════
// 📨 WhatsApp Broadcast
// ════════════════════════════════════════

async function sendWhatsAppMessage(accessToken, phoneId, to, text) {
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  const result = await res.json();
  if (!res.ok) {
    const errMsg = result?.error?.message || JSON.stringify(result).substring(0, 200);
    throw new Error(`WhatsApp API ${res.status}: ${errMsg}`);
  }
  return result;
}

async function broadcastWhatsApp(users, accessToken, phoneId) {
  console.log(`\n📱 بث واتساب — ${users.length} مستخدم`);
  console.log("─".repeat(50));

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Split: active (within 24h) vs inactive
  const activeUsers = [];
  const inactiveUsers = [];

  for (const user of users) {
    const lastActive = user.last_active ? new Date(user.last_active).getTime() : 0;
    if (now - lastActive <= TWENTY_FOUR_HOURS) {
      activeUsers.push(user);
    } else {
      inactiveUsers.push(user);
    }
  }

  console.log(`  📨 مستخدمون نشطون (خلال 24 ساعة): ${activeUsers.length}`);
  console.log(`  📋 مستخدمون غير نشطين (خارج نافذة 24 ساعة): ${inactiveUsers.length}`);

  // Send to active users only
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const user of activeUsers) {
    const phone = user.platform_id || user.phone_number;
    if (!phone) continue;
    try {
      await sendWhatsAppMessage(accessToken, phoneId, phone, BROADCAST_TEXT);
      sent++;
      process.stdout.write(`\r  ✅ Sent: ${sent} | ❌ Failed: ${failed} / ${activeUsers.length}`);
      // WhatsApp: max 80 msgs/sec for business accounts → 100ms safe delay
      await sleep(100);
    } catch (err) {
      failed++;
      errors.push({ phone, name: user.full_name, error: err.message });
      process.stdout.write(`\r  ✅ Sent: ${sent} | ❌ Failed: ${failed} / ${activeUsers.length}`);
      await sleep(100);
    }
  }

  console.log(`\n\n  📊 نتيجة بث واتساب (نشطون فقط):`);
  console.log(`     ✅ نجاح: ${sent}`);
  console.log(`     ❌ فشل: ${failed}`);

  if (errors.length > 0) {
    console.log(`\n  أخطاء واتساب:`);
    errors.slice(0, 10).forEach((e) => console.log(`    - ${e.phone} (${e.name}): ${e.error}`));
    if (errors.length > 10) console.log(`    ... و ${errors.length - 10} أخطاء أخرى`);
  }

  // Save inactive users to CSV
  if (inactiveUsers.length > 0) {
    const csvDir = path.resolve("scripts");
    const csvPath = path.join(csvDir, `whatsapp_inactive_users_${new Date().toISOString().slice(0, 10)}.csv`);
    const csvHeader = "phone_number,full_name,last_active\n";
    const csvRows = inactiveUsers.map((u) => {
      const phone = u.platform_id || u.phone_number || "";
      const name = (u.full_name || "").replace(/,/g, " ");
      return `${phone},${name},${u.last_active || "unknown"}`;
    }).join("\n");
    fs.writeFileSync(csvPath, csvHeader + csvRows, "utf-8");
    console.log(`\n  📁 قائمة المستخدمين غير النشطين: ${csvPath}`);
    console.log(`     (${inactiveUsers.length} مستخدم — يحتاجون قوالب Meta المعتمدة للإرسال)`);
  }

  return { sent, failed, inactiveCount: inactiveUsers.length };
}

// ════════════════════════════════════════
// 🚀 Main Execution
// ════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   🚕 ران — بث تحديث لجميع المستخدمين           ║");
  console.log("║   RAAN Broadcast — Update Announcement          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Load credentials from system_configs
  console.log("⏳ جاري تحميل الإعدادات من system_configs...");
  const configs = await getConfigs([
    "TELEGRAM_BOT_TOKEN",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_ID",
  ]);

  const TELEGRAM_BOT_TOKEN = configs["TELEGRAM_BOT_TOKEN"];
  const WHATSAPP_ACCESS_TOKEN = configs["WHATSAPP_ACCESS_TOKEN"];
  const WHATSAPP_PHONE_ID = configs["WHATSAPP_PHONE_ID"];

  if (!TELEGRAM_BOT_TOKEN) console.warn("⚠️ TELEGRAM_BOT_TOKEN not found — Telegram broadcast will be skipped");
  if (!WHATSAPP_ACCESS_TOKEN) console.warn("⚠️ WHATSAPP_ACCESS_TOKEN not found — WhatsApp broadcast will be skipped");
  if (!WHATSAPP_PHONE_ID) console.warn("⚠️ WHATSAPP_PHONE_ID not found — WhatsApp broadcast will be skipped");

  console.log("✅ إعدادات محملة بنجاح\n");

  // 2. Fetch all bot users
  console.log("⏳ جاري جلب قائمة المستخدمين...");
  const allUsers = await fetchAllUsers();
  console.log(`✅ إجمالي المستخدمين: ${allUsers.length}\n`);

  const telegramUsers = allUsers.filter((u) => u.platform === "telegram");
  const whatsappUsers = allUsers.filter((u) => u.platform === "whatsapp");

  console.log(`   📱 تيليغرام: ${telegramUsers.length}`);
  console.log(`   📱 واتساب: ${whatsappUsers.length}`);

  // 3. Summary before send
  console.log("\n" + "═".repeat(50));
  console.log("📋 ملخص البث:");
  console.log(`   الرسالة: ${BROADCAST_TEXT.substring(0, 60)}...`);
  console.log(`   تيليغرام: ${telegramUsers.length} مستخدم`);
  console.log(`   واتساب: ${whatsappUsers.length} مستخدم (24h فقط)`);
  console.log("═".repeat(50));

  // Ask for confirmation
  console.log("\n⚠️  هل تريد المتابعة؟ (الإرسال سيبدأ خلال 5 ثوانٍ...)");
  console.log("   اضغط Ctrl+C للإلغاء\n");
  await sleep(5000);

  const results = { telegram: null, whatsapp: null };

  // 4. Telegram Broadcast
  if (TELEGRAM_BOT_TOKEN && telegramUsers.length > 0) {
    results.telegram = await broadcastTelegram(telegramUsers, TELEGRAM_BOT_TOKEN);
  } else {
    console.log("\n⏭️ تخطي بث تيليغرام (لا يوجد توكن أو مستخدمين)");
  }

  // 5. WhatsApp Broadcast
  if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_ID && whatsappUsers.length > 0) {
    results.whatsapp = await broadcastWhatsApp(whatsappUsers, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID);
  } else {
    console.log("\n⏭️ تخطي بث واتساب (لا يوجد توكن أو مستخدمين)");
  }

  // 6. Final Summary
  console.log("\n\n" + "═".repeat(50));
  console.log("📊 التقرير النهائي — ران بث التحديث");
  console.log("═".repeat(50));

  if (results.telegram) {
    console.log(`\n📱 تيليغرام:`);
    console.log(`   ✅ نجاح: ${results.telegram.sent}`);
    console.log(`   🚫 محظور: ${results.telegram.blocked}`);
    console.log(`   ❌ فشل: ${results.telegram.failed}`);
  }

  if (results.whatsapp) {
    console.log(`\n📱 واتساب:`);
    console.log(`   ✅ نجاح: ${results.whatsapp.sent}`);
    console.log(`   ❌ فشل: ${results.whatsapp.failed}`);
    console.log(`   📋 غير نشط (خارج 24h): ${results.whatsapp.inactiveCount}`);
  }

  console.log("\n═".repeat(50));
  console.log("تم الحمد لله رب العالمين ✅");
  console.log("═".repeat(50));
}

main().catch((err) => {
  console.error("\n❌ خطأ فادح:", err.message);
  process.exit(1);
});
