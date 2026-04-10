/**
 * ════════════════════════════════════════════════════════════════════
 * 🛡️ بوت تليجرام الإداري — مراجعة إيصالات الدفع
 * Admin Telegram Webhook — Receipt Approval/Rejection Bot
 * ════════════════════════════════════════════════════════════════════
 *
 * يستقبل Callback Queries من أزرار الموافقة/الرفض في مجموعة الأدمن
 * ويقوم بـ:
 * 1. تحديث حالة المعاملة في قاعدة البيانات
 * 2. إضافة الرصيد لحساب العميل (عند الموافقة)
 * 3. إشعار العميل عبر المنصة الأصلية (واتساب/تليجرام)
 *
 * Token: يستخدم ADMIN_TELEGRAM_BOT_TOKEN (بوت مختلف عن بوت العملاء)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders } from "../_shared/utils.ts";

// ════════════════════════════════════════
// المتغيرات
// ════════════════════════════════════════
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let ADMIN_TELEGRAM_BOT_TOKEN = "";
let CUSTOMER_TELEGRAM_BOT_TOKEN = "";
let WHATSAPP_ACCESS_TOKEN = "";
let WHATSAPP_PHONE_ID = "";
let ADMIN_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "ADMIN_TELEGRAM_BOT_TOKEN",
      "TELEGRAM_BOT_TOKEN",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_ID",
    ]);
    ADMIN_TELEGRAM_BOT_TOKEN = cfg["ADMIN_TELEGRAM_BOT_TOKEN"] || ADMIN_TELEGRAM_BOT_TOKEN;
    CUSTOMER_TELEGRAM_BOT_TOKEN = cfg["TELEGRAM_BOT_TOKEN"] || CUSTOMER_TELEGRAM_BOT_TOKEN;
    WHATSAPP_ACCESS_TOKEN = cfg["WHATSAPP_ACCESS_TOKEN"] || WHATSAPP_ACCESS_TOKEN;
    WHATSAPP_PHONE_ID = cfg["WHATSAPP_PHONE_ID"] || WHATSAPP_PHONE_ID;
    ADMIN_API = `https://api.telegram.org/bot${ADMIN_TELEGRAM_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[admin-bot] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[admin-bot] ⚠️ Config fallback:", e);
    ADMIN_TELEGRAM_BOT_TOKEN = Deno.env.get("ADMIN_TELEGRAM_BOT_TOKEN") || "";
    CUSTOMER_TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") || "";
    ADMIN_API = `https://api.telegram.org/bot${ADMIN_TELEGRAM_BOT_TOKEN}`;
  }
}
// ════════════════════════════════════════
// Telegram Helpers
// ════════════════════════════════════════
async function answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false) {
  await fetch(`${ADMIN_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  });
}

async function editMessageCaption(chatId: string | number, messageId: number, caption: string) {
  await fetch(`${ADMIN_API}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: "Markdown",
    }),
  });
}

async function editMessageText(chatId: string | number, messageId: number, text: string) {
  await fetch(`${ADMIN_API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

async function sendAdminMessage(chatId: string | number, text: string) {
  await fetch(`${ADMIN_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

// ════════════════════════════════════════
// إشعار العميل عبر المنصة الأصلية
// ════════════════════════════════════════
async function notifyCustomer(
  platform: string,
  platformUserId: string,
  message: string
): Promise<boolean> {
  try {
    if (platform === "telegram") {
      const CUSTOMER_API = `https://api.telegram.org/bot${CUSTOMER_TELEGRAM_BOT_TOKEN}`;
      const resp = await fetch(`${CUSTOMER_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: platformUserId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
      return resp.ok;
    } else if (platform === "whatsapp") {
      const GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
      const resp = await fetch(GRAPH_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: platformUserId,
          type: "text",
          text: { body: message },
        }),
      });
      return resp.ok;
    }
    return false;
  } catch (err) {
    console.error(`[admin-bot] Failed to notify customer (${platform}):`, err);
    return false;
  }
}

// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
serve(async (req) => {
  await loadDynamicConfig();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GET = Webhook verification (if needed)
  if (req.method === "GET") {
    return new Response("Admin Bot Active ✅", { status: 200 });
  }

  try {
    const body = await req.json();
    console.log("[admin-bot] Received update:", JSON.stringify(body).substring(0, 500));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ════════════════════════════════════
    // معالجة Callback Query (أزرار)
    // ════════════════════════════════════
    const cbQuery = body.callback_query;
    if (cbQuery) {
      const cbData = cbQuery.data || "";
      const adminUser = cbQuery.from;
      const adminName = `${adminUser?.first_name || ""} ${adminUser?.last_name || ""}`.trim() || "Admin";
      const adminChatId = cbQuery.message?.chat?.id;
      const adminMsgId = cbQuery.message?.message_id;

      console.log(`[admin-bot] Callback: "${cbData}" from ${adminName}`);

      // ═══════════════════════════════════
      // ✅ موافقة على المعاملة
      // ═══════════════════════════════════
      const approveMatch = cbData.match(/^approve_([a-f0-9-]+)$/);
      if (approveMatch) {
        const txnId = approveMatch[1];
        await answerCallbackQuery(cbQuery.id, "جاري المعالجة...");

        // جلب المعاملة
        const { data: txn, error: txnErr } = await supabase
          .from("receipt_transactions")
          .select("*")
          .eq("id", txnId)
          .single();

        if (txnErr || !txn) {
          await answerCallbackQuery(cbQuery.id, "❌ المعاملة غير موجودة", true);
          return new Response("OK", { status: 200 });
        }

        if (txn.status !== "pending") {
          await answerCallbackQuery(cbQuery.id, `⚠️ تمت معالجة هذه المعاملة مسبقاً (${txn.status})`, true);
          return new Response("OK", { status: 200 });
        }

        const amount = txn.amount || 0;

        // تحديث حالة المعاملة
        const { error: updateErr } = await supabase
          .from("receipt_transactions")
          .update({
            status: "approved",
            reviewed_by: null, // Admin bot لا يملك user_id — نسجل الاسم في parsed_data
            reviewed_at: new Date().toISOString(),
            parsed_data: { ...(txn.parsed_data || {}), approved_by: adminName },
          })
          .eq("id", txnId);

        if (updateErr) {
          console.error("[admin-bot] Failed to update transaction:", updateErr);
          await sendAdminMessage(adminChatId, `❌ فشل تحديث المعاملة: ${updateErr.message}`);
          return new Response("OK", { status: 200 });
        }

        // إضافة الرصيد للمستخدم
        let walletUpdateSuccess = false;
        if (txn.user_id && amount > 0) {
          // جلب الرصيد الحالي — profiles PK هو user_id
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("wallet_balance")
            .eq("user_id", txn.user_id)
            .single();

          if (profileErr) {
            console.error("[admin-bot] Failed to fetch profile:", profileErr);
            await sendAdminMessage(adminChatId, `⚠️ تمت الموافقة لكن فشل جلب بيانات المستخدم: ${profileErr.message}\nuser_id: ${txn.user_id}`);
          } else {
            const currentBalance = profile?.wallet_balance || 0;
            const newBalance = currentBalance + amount;

            const { error: walletErr, count } = await supabase
              .from("profiles")
              .update({ wallet_balance: newBalance })
              .eq("user_id", txn.user_id);

            if (walletErr) {
              console.error("[admin-bot] Failed to update wallet:", walletErr);
              await sendAdminMessage(adminChatId, `⚠️ تمت الموافقة لكن فشل تحديث الرصيد: ${walletErr.message}\nuser_id: ${txn.user_id}`);
            } else {
              walletUpdateSuccess = true;
              console.log(`[admin-bot] ✅ Wallet updated: ${currentBalance} → ${newBalance} for user ${txn.user_id}`);
            }
          }

          // تسجيل في wallet_transactions
          if (walletUpdateSuccess) {
            await supabase.from("rider_wallet_transactions").insert({
              user_id: txn.user_id,
              amount: amount,
              type: "deposit",
              status: "completed",
              payment_method: txn.provider || "receipt",
              reference_id: txnId,
              description: `شحن رصيد — إيصال ${txn.transaction_reference || txnId.substring(0, 8)}`,
            }).then(() => {}, (e: unknown) => console.warn("[admin-bot] wallet_transactions insert:", e));
          }
        }

        // تحديث رسالة الأدمن
        const updatedCaption =
          `✅ *تمت الموافقة*\n\n` +
          `💰 المبلغ: ${amount.toLocaleString()} د.ع\n` +
          `🔢 المرجع: ${txn.transaction_reference || "—"}\n` +
          `👤 المراجع: ${adminName}\n` +
          `🕐 ${new Date().toLocaleString("ar-IQ")}`;

        try {
          await editMessageCaption(adminChatId, adminMsgId, updatedCaption);
        } catch {
          try {
            await editMessageText(adminChatId, adminMsgId, updatedCaption);
          } catch { }
        }

        // إشعار العميل — فقط إذا تم تحديث الرصيد بنجاح
        let notified = false;
        if (walletUpdateSuccess) {
          const customerMsg =
            `✅ تم شحن رصيدك بنجاح!\n\n` +
            `💰 المبلغ: ${amount.toLocaleString()} د.ع\n` +
            `🏦 المزود: ${txn.provider || "—"}\n` +
            `🔢 رقم المعاملة: ${txn.transaction_reference || "—"}\n\n` +
            `رصيدك الحالي متاح الآن. شكراً لاستخدامك ران! 🚕`;

          notified = await notifyCustomer(txn.platform, txn.platform_user_id, customerMsg);
        } else if (!txn.user_id || amount <= 0) {
          // لا يوجد user_id أو مبلغ — إشعار بسيط
          notified = await notifyCustomer(txn.platform, txn.platform_user_id,
            `✅ تمت مراجعة إيصالك. يرجى التواصل مع الإدارة لإضافة الرصيد.`);
        }

        await supabase.from("receipt_transactions").update({
          customer_notified: notified,
        }).eq("id", txnId);

        console.log(`[admin-bot] ✅ Transaction ${txnId} approved by ${adminName}, customer notified: ${notified}`);
        return new Response("OK", { status: 200 });
      }

      // ═══════════════════════════════════
      // ❌ رفض المعاملة
      // ═══════════════════════════════════
      const rejectMatch = cbData.match(/^reject_([a-f0-9-]+)$/);
      if (rejectMatch) {
        const txnId = rejectMatch[1];
        await answerCallbackQuery(cbQuery.id, "جاري المعالجة...");

        // جلب المعاملة
        const { data: txn, error: txnErr } = await supabase
          .from("receipt_transactions")
          .select("*")
          .eq("id", txnId)
          .single();

        if (txnErr || !txn) {
          await answerCallbackQuery(cbQuery.id, "❌ المعاملة غير موجودة", true);
          return new Response("OK", { status: 200 });
        }

        if (txn.status !== "pending") {
          await answerCallbackQuery(cbQuery.id, `⚠️ تمت معالجة هذه المعاملة مسبقاً (${txn.status})`, true);
          return new Response("OK", { status: 200 });
        }

        // تحديث حالة المعاملة
        const { error: updateErr } = await supabase
          .from("receipt_transactions")
          .update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
            rejection_reason: "رفض يدوي من الأدمن",
            parsed_data: { ...(txn.parsed_data || {}), rejected_by: adminName },
          })
          .eq("id", txnId);

        if (updateErr) {
          console.error("[admin-bot] Failed to reject transaction:", updateErr);
          await sendAdminMessage(adminChatId, `❌ فشل رفض المعاملة: ${updateErr.message}`);
          return new Response("OK", { status: 200 });
        }

        // تحديث رسالة الأدمن
        const updatedCaption =
          `❌ *تم الرفض*\n\n` +
          `💰 المبلغ: ${(txn.amount || 0).toLocaleString()} د.ع\n` +
          `🔢 المرجع: ${txn.transaction_reference || "—"}\n` +
          `👤 المراجع: ${adminName}\n` +
          `🕐 ${new Date().toLocaleString("ar-IQ")}`;

        try {
          await editMessageCaption(adminChatId, adminMsgId, updatedCaption);
        } catch {
          try {
            await editMessageText(adminChatId, adminMsgId, updatedCaption);
          } catch { }
        }

        // إشعار العميل
        const customerMsg =
          `❌ عذراً، تم رفض طلب شحن الرصيد.\n\n` +
          `🔢 رقم المعاملة: ${txn.transaction_reference || "—"}\n\n` +
          `السبب المحتمل: الإيصال غير واضح أو غير صالح.\n` +
          `يرجى إرسال إيصال جديد وواضح أو التواصل مع الدعم 📞`;

        const notified = await notifyCustomer(txn.platform, txn.platform_user_id, customerMsg);

        await supabase.from("receipt_transactions").update({
          customer_notified: notified,
        }).eq("id", txnId);

        console.log(`[admin-bot] ❌ Transaction ${txnId} rejected by ${adminName}, customer notified: ${notified}`);
        return new Response("OK", { status: 200 });
      }

      // ═══════════════════════════════════
      // 💰 تعديل المبلغ
      // ═══════════════════════════════════
      const editAmountMatch = cbData.match(/^edit_amount_([a-f0-9-]+)$/);
      if (editAmountMatch) {
        const txnId = editAmountMatch[1];
        await answerCallbackQuery(cbQuery.id, "📝 أرسل المبلغ الصحيح كرسالة نصية", true);

        // حفظ حالة الأدمن كـ awaiting_amount_edit
        try {
          // نستخدم متغير مؤقت في ذاكرة الـ message
          await sendAdminMessage(adminChatId,
            `📝 *تعديل المبلغ*\n\n` +
            `أرسل المبلغ الصحيح بالدينار العراقي (رقم فقط):\n\n` +
            `مثال: \`25000\`\n\n` +
            `🆔 المعاملة: \`${txnId.substring(0, 8)}\`\n\n` +
            `⚠️ بعد إرسال المبلغ، اضغط زر الموافقة مرة أخرى`
          );

          // تحديث المبلغ (نحتاج رسالة نصية من الأدمن — سيتم التعامل معها)
        } catch (e) {
          console.error("[admin-bot] Edit amount error:", e);
        }
        return new Response("OK", { status: 200 });
      }

      // Callback غير معروف
      await answerCallbackQuery(cbQuery.id, "⚠️ أمر غير معروف");
      return new Response("OK", { status: 200 });
    }

    // ════════════════════════════════════
    // معالجة الرسائل النصية (لتعديل المبلغ)
    // ════════════════════════════════════
    const message = body.message;
    if (message?.text) {
      const text = message.text.trim();
      const chatId = message.chat?.id;

      // فحص إذا الرسالة هي مبلغ لتعديل معاملة
      // الأدمن يرد بالمبلغ + معرف المعاملة
      const amountEditMatch = text.match(/^(\d+)\s+([a-f0-9-]+)$/i);
      if (amountEditMatch) {
        const newAmount = parseInt(amountEditMatch[1]);
        const txnIdPartial = amountEditMatch[2];

        // بحث عن المعاملة
        const { data: txns } = await supabase
          .from("receipt_transactions")
          .select("id, status")
          .ilike("id", `${txnIdPartial}%`)
          .eq("status", "pending")
          .limit(1);

        if (txns && txns.length > 0) {
          const txn = txns[0];
          await supabase.from("receipt_transactions").update({
            amount: newAmount,
          }).eq("id", txn.id);

          await sendAdminMessage(chatId,
            `✅ تم تعديل المبلغ إلى ${newAmount.toLocaleString()} د.ع\n\n` +
            `🆔 المعاملة: \`${txn.id.substring(0, 8)}\`\n\n` +
            `يمكنك الآن الضغط على زر الموافقة ✅`
          );
        } else {
          await sendAdminMessage(chatId, `⚠️ لم يتم العثور على معاملة معلقة بهذا المعرف`);
        }

        return new Response("OK", { status: 200 });
      }

      // رسالة /start أو أي رسالة أخرى
      if (text === "/start") {
        await sendAdminMessage(chatId,
          `🛡️ *بوت ران الإداري*\n\n` +
          `هذا البوت مخصص لمراجعة إيصالات الدفع المرسلة من العملاء.\n\n` +
          `📋 *كيفية الاستخدام:*\n` +
          `• سيصلك إيصال مع أزرار الموافقة/الرفض\n` +
          `• اضغط ✅ للموافقة وإضافة الرصيد\n` +
          `• اضغط ❌ للرفض\n` +
          `• اضغط 💰 لتعديل المبلغ قبل الموافقة\n\n` +
          `⚡ لتعديل المبلغ: أرسل المبلغ + معرف المعاملة\n` +
          `مثال: \`25000 abc12345\``
        );
        return new Response("OK", { status: 200 });
      }

      // التقاط chat_id المجموعة تلقائياً
      if (message.chat?.type === "group" || message.chat?.type === "supergroup") {
        const groupChatId = String(chatId);
        console.log(`[admin-bot] 📝 Group chat detected: ${groupChatId}`);

        // حفظ ADMIN_GROUP_CHAT_ID تلقائياً
        try {
          await supabase.from("system_configs").upsert({
            category: "admin_bot",
            key_name: "ADMIN_GROUP_CHAT_ID",
            key_value: groupChatId,
            is_secret: false,
            description: "معرف مجموعة الأدمن في تليجرام (تم التقاطه تلقائياً)",
          }, { onConflict: "key_name" });
          console.log(`[admin-bot] ✅ ADMIN_GROUP_CHAT_ID saved: ${groupChatId}`);
        } catch (e) {
          console.warn("[admin-bot] Failed to save group chat ID:", e);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[admin-bot] ERROR:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 200, // Always 200 for Telegram webhook
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
