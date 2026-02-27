/**
 * ران — Messenger / Instagram Webhook
 * Facebook Messenger & Instagram DM integration
 *
 * GET  = Meta Webhook Verification (hub.verify_token)
 * POST = Incoming Messages from Messenger / Instagram
 *
 * يعمل بنفس مبدأ whatsapp-webhook لكن عبر Messenger Platform API
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════
// Environment
// ════════════════════════════════════════
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ════════════════════════════════════════
// HMAC SHA-256 signature verification
// ════════════════════════════════════════
async function verifySignature(
  rawBody: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expected = `sha256=${hex}`;
    return signature === expected;
  } catch {
    return false;
  }
}

// ════════════════════════════════════════
// Messenger Send API — إرسال رسالة
// ════════════════════════════════════════
async function sendMessage(
  recipientId: string,
  text: string,
  pageAccessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
          messaging_type: "RESPONSE",
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      console.error("[messenger] ❌ Send error:", data.error);
      return false;
    }
    console.log("[messenger] ✅ Sent to", recipientId);
    return true;
  } catch (err) {
    console.error("[messenger] ❌ Send exception:", err);
    return false;
  }
}

// ════════════════════════════════════════
// Messenger Send API — إرسال Quick Replies
// ════════════════════════════════════════
async function sendQuickReplies(
  recipientId: string,
  text: string,
  quickReplies: { title: string; payload: string }[],
  pageAccessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            text,
            quick_replies: quickReplies.map((qr) => ({
              content_type: "text",
              title: qr.title,
              payload: qr.payload,
            })),
          },
          messaging_type: "RESPONSE",
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      console.error("[messenger] ❌ Quick reply error:", data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[messenger] ❌ Quick reply exception:", err);
    return false;
  }
}

// ════════════════════════════════════════
// Messenger Send API — إرسال Generic Template (بطاقات)
// ════════════════════════════════════════
async function sendGenericTemplate(
  recipientId: string,
  elements: {
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons?: { type: string; title: string; payload?: string; url?: string }[];
  }[],
  pageAccessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements,
              },
            },
          },
          messaging_type: "RESPONSE",
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      console.error("[messenger] ❌ Template error:", data.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[messenger] ❌ Template exception:", err);
    return false;
  }
}

// ════════════════════════════════════════
// معالجة رسالة واردة
// ════════════════════════════════════════
async function handleIncomingMessage(
  senderId: string,
  pageId: string,
  messageText: string,
  messageId: string,
  isPostback: boolean,
  postbackPayload: string | null,
  supabaseClient: any
) {
  console.log(`[messenger] 📩 From ${senderId} to page ${pageId}: "${messageText || postbackPayload}"`);

  // 1. جلب حساب الصفحة
  const { data: account, error: accError } = await supabaseClient
    .from("messenger_accounts")
    .select("*")
    .eq("page_id", pageId)
    .eq("is_active", true)
    .single();

  if (accError || !account) {
    console.error("[messenger] ❌ No active account for page:", pageId, accError);
    return;
  }

  const token = account.page_access_token;

  // 2. تحديث إحصائيات الاستلام
  await supabaseClient
    .from("messenger_accounts")
    .update({
      messages_received: (account.messages_received || 0) + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  // 3. محاولة تشغيل Visual Workflow (إذا موجود)
  let handled = false;
  try {
    // جلب وضع البوت من system_configs
    const { data: configRow } = await supabaseClient
      .from("system_configs")
      .select("key_value")
      .eq("key_name", "bot_controller_mode")
      .maybeSingle();

    let botMode = "hardcoded";
    let activeWorkflowId: string | null = null;

    if (configRow?.key_value) {
      try {
        const parsed = JSON.parse(configRow.key_value);
        botMode = parsed.mode || "hardcoded";
        activeWorkflowId = parsed.active_workflow_id || null;
      } catch { /* keep defaults */ }
    }

    if ((botMode === "visual_workflow" || botMode === "hybrid") && activeWorkflowId) {
      // تشغيل التدفق المرئي
      const wfResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/run-visual-workflow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            workflow_id: activeWorkflowId,
            trigger_data: {
              platform: "messenger",
              sender_id: senderId,
              page_id: pageId,
              message: messageText || postbackPayload || "",
              message_id: messageId,
              is_postback: isPostback,
            },
            test_mode: false,
          }),
        }
      );

      if (wfResponse.ok) {
        const wfResult = await wfResponse.json();
        const totalActions = wfResult.actions_run || wfResult.totalSteps || 0;
        if (totalActions > 0) {
          handled = true;
          console.log(`[messenger] ✅ Visual workflow handled — ${totalActions} actions`);
        }
      }

      // في الوضع visual_workflow البحت، لا نستخدم الردود الافتراضية
      if (botMode === "visual_workflow") {
        handled = true;
      }
    }
  } catch (err) {
    console.error("[messenger] ⚠️ Visual workflow error:", err);
  }

  // 4. الرد الافتراضي إذا لم يتم التعامل مع الرسالة
  if (!handled) {
    const userMsg = (messageText || "").trim().toLowerCase();

    // Postback handling
    if (isPostback && postbackPayload) {
      switch (postbackPayload) {
        case "GET_STARTED":
          await sendMessage(
            senderId,
            "مرحباً بك في ران 🚕\n\nأنا بوت ران للتاكسي الذكي. كيف أقدر أساعدك؟",
            token
          );
          await sendQuickReplies(
            senderId,
            "اختر أحد الخيارات:",
            [
              { title: "🚗 حجز رحلة", payload: "BOOK_RIDE" },
              { title: "💰 الأسعار", payload: "CHECK_PRICES" },
              { title: "📞 تواصل معنا", payload: "CONTACT_US" },
            ],
            token
          );
          break;

        case "BOOK_RIDE":
          await sendMessage(
            senderId,
            "🚕 لحجز رحلة، أرسل لنا موقعك الحالي أو اكتب عنوان نقطة الانطلاق.",
            token
          );
          break;

        case "CHECK_PRICES":
          await sendMessage(
            senderId,
            "💰 الأسعار:\n\n🚗 اقتصادي: يبدأ من 2,500 د.ع\n🚙 مريح: يبدأ من 3,500 د.ع\n🚘 فاخر: يبدأ من 5,000 د.ع\n\nالسعر النهائي يعتمد على المسافة والوقت.",
            token
          );
          break;

        case "CONTACT_US":
          await sendMessage(
            senderId,
            "📞 للتواصل معنا:\n\nواتساب: +964 XXX XXX XXXX\nالموقع: raan.app\n\nأو اكتب رسالتك هنا وسنرد عليك قريباً.",
            token
          );
          break;

        default:
          await sendMessage(
            senderId,
            "شكراً لتواصلك! سيتم الرد عليك قريباً.",
            token
          );
      }
    } else {
      // رسالة نصية عادية
      if (userMsg.includes("مرحبا") || userMsg.includes("هلا") || userMsg.includes("السلام") || userMsg === "hi" || userMsg === "hello") {
        await sendMessage(
          senderId,
          "أهلاً وسهلاً! 🚕\n\nأنا بوت ران — خدمتك سريعة وذكية.\n\nأرسل /start للبدء",
          token
        );
      } else if (userMsg.includes("حجز") || userMsg.includes("رحلة") || userMsg.includes("تاكسي")) {
        await sendMessage(
          senderId,
          "🚗 لحجز رحلة، يرجى إرسال موقعك أو كتابة عنوان نقطة الانطلاق.",
          token
        );
      } else if (userMsg === "/start" || userMsg === "start") {
        await sendQuickReplies(
          senderId,
          "مرحباً بك في ران 🚕\nاختر أحد الخيارات:",
          [
            { title: "🚗 حجز رحلة", payload: "BOOK_RIDE" },
            { title: "💰 الأسعار", payload: "CHECK_PRICES" },
            { title: "📞 تواصل معنا", payload: "CONTACT_US" },
          ],
          token
        );
      } else {
        // رد عام
        await sendMessage(
          senderId,
          "شكراً لرسالتك! 😊\n\nيمكنك إرسال /start لعرض الخيارات المتاحة.\n\nللحجز: أرسل موقعك أو اكتب نقطة الانطلاق.",
          token
        );
      }
    }

    // تحديث عداد الإرسال
    await supabaseClient
      .from("messenger_accounts")
      .update({
        messages_sent: (account.messages_sent || 0) + 1,
      })
      .eq("id", account.id);
  }
}

// ════════════════════════════════════════
// 🚀 MAIN HANDLER
// ════════════════════════════════════════
serve(async (req) => {
  const url = new URL(req.url);
  const supabaseClient = createServiceClient();

  // ════════════════════════════════
  // 1. GET — Meta Webhook Verification
  // ════════════════════════════════
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("[messenger] 🔑 Verification request:", { mode, token: token?.slice(0, 8) + "..." });

    if (mode === "subscribe" && token) {
      // ابحث عن حساب بهذا الـ verify_token
      const { data: account } = await supabaseClient
        .from("messenger_accounts")
        .select("id, page_name, verify_token")
        .eq("verify_token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (account) {
        console.log(`[messenger] ✅ Webhook verified for page: ${account.page_name}`);

        // علّم الحساب كـ verified
        await supabaseClient
          .from("messenger_accounts")
          .update({ is_verified: true })
          .eq("id", account.id);

        return new Response(challenge, { status: 200 });
      }
    }

    console.error("[messenger] ❌ Verification failed — no matching token");
    return new Response("Forbidden", { status: 403 });
  }

  // ════════════════════════════════
  // 2. POST — Incoming Messages
  // ════════════════════════════════
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // ── Signature Verification (optional but recommended) ──
  const signature = req.headers.get("X-Hub-Signature-256");
  if (signature) {
    // جلب جميع الحسابات النشطة للتحقق من التوقيع
    const { data: activeAccounts } = await supabaseClient
      .from("messenger_accounts")
      .select("app_secret")
      .eq("is_active", true)
      .not("app_secret", "is", null);

    let sigValid = false;
    for (const acc of activeAccounts || []) {
      if (acc.app_secret && (await verifySignature(rawBody, signature, acc.app_secret))) {
        sigValid = true;
        break;
      }
    }

    if (!sigValid && activeAccounts && activeAccounts.length > 0) {
      console.warn("[messenger] ⚠️ Signature verification failed (but continuing)");
      // لا نوقف — قد يكون الحساب بدون app_secret
    }
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── التحقق من أنها رسالة Messenger ──
  if (body.object !== "page") {
    console.log("[messenger] ℹ️ Ignoring non-page object:", body.object);
    return new Response("OK", { status: 200 });
  }

  // ── معالجة الأحداث ──
  const entries = body.entry || [];
  for (const entry of entries) {
    const pageId = entry.id;
    const messaging = entry.messaging || [];

    for (const event of messaging) {
      const senderId = event.sender?.id;
      if (!senderId) continue;

      // تجاهل الرسائل المرسلة من الصفحة نفسها (echo)
      if (event.message?.is_echo) continue;

      let messageText = "";
      let messageId = "";
      let isPostback = false;
      let postbackPayload: string | null = null;

      if (event.message) {
        // رسالة عادية
        messageText = event.message.text || "";
        messageId = event.message.mid || "";

        // Quick Reply payload
        if (event.message.quick_reply?.payload) {
          isPostback = true;
          postbackPayload = event.message.quick_reply.payload;
        }
      } else if (event.postback) {
        // Postback (زر)
        isPostback = true;
        postbackPayload = event.postback.payload || "";
        messageId = event.postback.mid || `pb_${Date.now()}`;
      } else {
        // نوع غير مدعوم (قراءة، توصيل، إلخ)
        continue;
      }

      // معالجة الرسالة
      try {
        await handleIncomingMessage(
          senderId,
          pageId,
          messageText,
          messageId,
          isPostback,
          postbackPayload,
          supabaseClient
        );
      } catch (err) {
        console.error("[messenger] ❌ Error handling message:", err);
      }
    }
  }

  // Meta يتطلب 200 دائماً
  return new Response("EVENT_RECEIVED", { status: 200 });
});
