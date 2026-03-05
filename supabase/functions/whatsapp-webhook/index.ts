/**
 * ران - واتساب كلاود API — الحجز الذكي بالصوت والنص
 * RAAN WhatsApp AI Dispatcher — Ramadi Edition (Phase 2)
 *
 * ═══ MODULAR ARCHITECTURE ═══
 * تم تقسيم هذا الملف من 2400 سطر إلى modules:
 * - lib/config.ts        → إعدادات و Rate Limiting
 * - lib/messages.ts      → قوالب الرسائل العربية
 * - lib/whatsapp-api.ts  → WhatsApp Cloud API
 * - lib/ai-services.ts   → GPT-4o + Whisper
 * - lib/geocoding.ts     → Geocoding (محلي + Nominatim + Google)
 * - lib/fare.ts          → حساب الأجرة والمسافة
 * - lib/user-session.ts  → إدارة المستخدمين والجلسات
 *
 * التدفق:
 * 1. المستخدم يرسل موقعه GPS → يُحفظ كنقطة انطلاق (draft)
 * 2. المستخدم يرسل صوت/نص → Whisper + GPT-4o → Geocoding → حساب الأجرة
 * 3. أزرار تأكيد/إلغاء → draft → pending → match-ride
 *
 * ملاحظة: GET = Meta Webhook Verification, POST = Incoming Messages
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ═══ Module Imports ═══
import {
  loadDynamicConfig,
  VERIFY_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SITE_URL,
  OPENAI_API_KEY,
  ADMIN_TELEGRAM_BOT_TOKEN,
  ADMIN_GROUP_CHAT_ID,
  isRateLimited,
  isRateLimitedDB,
  getOrLoadSecuritySettings,
  createClient,
  getConfigBatch,
  createServiceClient,
} from "./lib/config.ts";

import { MESSAGES } from "./lib/messages.ts";

import {
  sendTextMessage,
  sendLocationRequest,
  sendInteractiveButtons,
  sendListMessage,
  downloadWhatsAppMedia,
} from "./lib/whatsapp-api.ts";

import {
  transcribeAudio,
  getActiveVehicleTypes,
  getWaitSettings,
  extractDestination,
  classifyAndRespond,
} from "./lib/ai-services.ts";

import {
  reverseGeocode,
  resolveRamadiLocation,
} from "./lib/geocoding.ts";

import {
  haversineDistance,
  calculateFareFromEdge,
} from "./lib/fare.ts";

import {
  findOrCreateWhatsAppUser,
  findPendingSession,
  createPickupSession,
  checkActiveRide,
} from "./lib/user-session.ts";

import {
  classifyLocally,
  extractDirectDestination,
  extractPickupAndDropoff,
} from "./lib/local-classifier.ts";

import {
  getCachedAIClassification,
  cacheAIClassification,
  getCachedDestination,
  cacheDestination,
  getCacheStats,
} from "./lib/cache.ts";

import {
  trackEvent,
  trackResponseTime,
  trackBookingFunnel,
  forceFlushEvents,
} from "./lib/analytics.ts";

// Import message logging utility
import { logIncomingBotMessage } from "../_shared/log-message.ts";

// Import receipt vision parser
import { parseReceiptImage, notifyAdminGroup } from "../_shared/receipt-vision.ts";

// ════════════════════════════════════════
// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
// ════════════════════════════════════════
serve(async (req) => {
  const _startTime = Date.now();
  // تحميل الإعدادات الديناميكية من system_configs
  await loadDynamicConfig();

  const url = new URL(req.url);

  // ════════════════════════════════
  // 1. GET — Meta Webhook Verification
  // ════════════════════════════════
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ WhatsApp Webhook verified!");
      return new Response(challenge, { status: 200 });
    } else {
      console.error("❌ Webhook verification failed.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // ════════════════════════════════
  // 2. POST — Incoming Messages
  // ════════════════════════════════
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── Webhook Signature Verification ──
  const rawBody = await req.text();
  const signature = req.headers.get("X-Hub-Signature-256");
  if (signature) {
    let appSecret: string | undefined;
    try {
      const svc = createServiceClient();
      const cfg = await getConfigBatch(svc, ["WHATSAPP_APP_SECRET"]);
      appSecret = cfg["WHATSAPP_APP_SECRET"] || Deno.env.get("WHATSAPP_APP_SECRET");
    } catch (sigErr) {
      console.warn("[wa] Config load failed during signature check, trying env fallback:", sigErr);
      appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    }

    if (appSecret) {
      // الـ secret موجود — التحقق إجباري
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
        const expectedSig = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (expectedSig !== signature) {
          console.error("[wa] ❌ Invalid webhook signature!");
          return new Response("Forbidden", { status: 403 });
        }
        console.log("[wa] ✅ Webhook signature verified");
      } catch (verifyErr) {
        console.error("[wa] ❌ Signature verification error:", verifyErr);
        return new Response("Internal Server Error", { status: 500 });
      }
    } else {
      // الـ secret غير مخزّن — تحذير ومتابعة (لا نوقف الخدمة)
      console.warn("[wa] ⚠️ WHATSAPP_APP_SECRET not configured — signature check SKIPPED. Set it in system_configs or env for security.");
    }
  }

  // CRITICAL: Always return 200 fast to Meta
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  console.log("[wa] ===== NEW WEBHOOK =====");
  console.log("[wa] Payload:", JSON.stringify(body).substring(0, 800));

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Status updates (sent, delivered, read) — acknowledge only
  if (value?.statuses) {
    console.log("[wa] Status update, ignoring.");
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  const message = value?.messages?.[0];
  if (!message) {
    console.log("[wa] No message in payload, skipping.");
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  const phoneNumber = message.from;
  const msgType = message.type;
  const profileName = value?.contacts?.[0]?.profile?.name || null;

  console.log(`[wa] 📩 [${msgType}] from ${phoneNumber} (${profileName})`);

  // ═══════════════════════════════════
  // 🛡️ Rate Limiting — تقييد عدد الرسائل
  // ═══════════════════════════════════
  let secSettings = await getOrLoadSecuritySettings();
  if (!secSettings) {
    secSettings = {
      whatsapp_rate_limit_per_minute: 10,
      whatsapp_voice_rate_limit_per_minute: 3,
      max_active_rides_per_user: 3,
      ride_creation_cooldown_seconds: 60,
      max_failed_match_attempts: 5,
    };
  }

  const isVoiceMsg = msgType === "audio";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Rate limiting عبر قاعدة البيانات (مع fallback للذاكرة)
  const rateLimited = await isRateLimitedDB(supabase, phoneNumber, isVoiceMsg, secSettings);
  if (rateLimited) {
    console.log(`[wa] ⚠️ Rate limited: ${phoneNumber} (voice=${isVoiceMsg})`);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  // ═══════════════════════════════════
  // 📊 تسجيل العميل في قاعدة التسويق (صامت)
  // ═══════════════════════════════════
  let botCustomerId: string | null = null;
  try {
    const { data: customer } = await supabase.from("bot_customers").upsert({
      platform: "whatsapp",
      platform_id: phoneNumber,
      full_name: profileName || "WhatsApp User",
      phone_number: phoneNumber,
      last_active: new Date().toISOString(),
      interaction_count: 1,
    }, {
      onConflict: "platform,platform_id",
    }).select("id").single();

    botCustomerId = customer?.id || null;

    await supabase.rpc("increment_bot_customer_interactions", {
      p_platform: "whatsapp",
      p_platform_id: phoneNumber,
    }).then(() => { }, () => { });
  } catch (e) {
    console.warn("[wa] bot_customers upsert failed (non-critical):", e);
  }

  // ═══════════════════════════════════
  // 📝 Log incoming message
  // ═══════════════════════════════════
  if (botCustomerId) {
    try {
      // Extract message content based on type
      let messageContent = "";
      const metadata: any = {
        message_type: msgType,
        message_id: message.id
      };

      if (msgType === "text") {
        messageContent = message.text?.body || "";
      } else if (msgType === "interactive") {
        const buttonReply = message.interactive?.button_reply;
        const listReply = message.interactive?.list_reply;
        messageContent = buttonReply?.id || listReply?.id || "[interactive]";
        metadata.button_title = buttonReply?.title || listReply?.title;
      } else if (msgType === "location") {
        messageContent = `[location: ${message.location?.latitude},${message.location?.longitude}]`;
        metadata.latitude = message.location?.latitude;
        metadata.longitude = message.location?.longitude;
      } else if (msgType === "audio") {
        messageContent = "[audio message]";
        metadata.media_id = message.audio?.id;
      } else {
        messageContent = `[${msgType} message]`;
      }

      await logIncomingBotMessage({
        botCustomerId,
        message: messageContent,
        platform: "whatsapp",
        messageId: message.id,
        metadata
      });
    } catch (logErr) {
      console.warn("[wa] Message logging failed (non-critical):", logErr);
    }
  }

  // ═══════════════════════════════════
  // 🤖 Bot Controller Mode — التحويل للتدفق المرئي
  // ═══════════════════════════════════
  let botMode = "hardcoded";
  let activeWorkflowId: string | null = null;
  try {
    const { data: modeRow } = await supabase
      .from("system_configs")
      .select("key_value")
      .eq("key_name", "bot_controller_mode")
      .maybeSingle();
    if (modeRow?.key_value) {
      const parsed = JSON.parse(modeRow.key_value);
      botMode = parsed.mode || "hardcoded";
      activeWorkflowId = parsed.active_workflow_id || null;
      console.log(`[wa] 🤖 Bot mode: ${botMode}, workflow: ${activeWorkflowId || 'auto'}`);
    }
  } catch (e) {
    console.warn("[wa] Failed to read bot_controller_mode, defaulting to hardcoded:", e);
  }

  if (botMode === "visual_workflow" || botMode === "hybrid") {
    try {
      const messageContent = msgType === "text" ? (message.text?.body || "") :
                             msgType === "interactive" ? (message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || "") :
                             msgType === "location" ? `location:${message.location?.latitude},${message.location?.longitude}` :
                             `[${msgType}]`;

      console.log(`[wa] 🔀 Routing to visual workflow engine (mode=${botMode})...`);

      // 5-second timeout to prevent webhook from hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const vwResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/run-visual-workflow`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            phone: phoneNumber,
            trigger_type: "message_received",
            ...(activeWorkflowId ? { workflow_id: activeWorkflowId } : {}),
            metadata: {
              message_content: messageContent,
              message_type: msgType,
              profile_name: profileName,
              source: "whatsapp",
              raw_message: message,
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      const vwResult = await vwResponse.json();
      console.log(`[wa] 🔀 Visual workflow result:`, JSON.stringify(vwResult).substring(0, 300));

      const wfRan = vwResponse.ok && vwResult.workflows?.length > 0;
      const totalActions = wfRan ? vwResult.workflows.reduce((sum: number, w: any) => sum + (w.actions_run ?? 0), 0) : 0;
      const totalSteps   = wfRan ? vwResult.workflows.reduce((sum: number, w: any) => sum + (w.steps   || 0), 0) : 0;

      if (totalActions > 0) {
        console.log(`[wa] ✅ Visual workflow sent ${totalActions} message(s) (${totalSteps} steps). Done.`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── Pure visual_workflow mode: NEVER fall through to hardcoded ──
      if (botMode === "visual_workflow") {
        console.log(`[wa] 🛑 visual_workflow mode: workflow ran ${totalSteps} steps, ${totalActions} sent. Stopping (no hardcoded fallback).`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── hybrid mode: fall through to hardcoded when workflow sent nothing ──
      console.log(`[wa] ⚠️ hybrid mode: visual workflow ran but sent 0 messages — falling through to hardcoded.`);
    } catch (vwErr) {
      console.error("[wa] ❌ Visual workflow error:", vwErr);
      // In pure visual mode don't fall through on error either
      if (botMode === "visual_workflow") {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
      // hybrid: fall through on error
    }
  }

  try {
    // ═══════════════════════════════════
    // 🔘 Interactive Button Reply (تأكيد / إلغاء)
    // ═══════════════════════════════════
    if (msgType === "interactive") {
      const buttonReply = message.interactive?.button_reply;
      const listReply = message.interactive?.list_reply;

      if (!buttonReply && !listReply) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const buttonId = buttonReply?.id || listReply?.id || "";
      console.log(`[wa] 🔘 Button pressed: ${buttonId}`);
      const userName = profileName || "عزيزي";

      // ── استفسار سريع ──
      if (buttonId === "action_inquiry") {
        await sendTextMessage(phoneNumber, MESSAGES.inquiryPrompt(userName), botCustomerId || undefined);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الترحيب: خيارات أخرى ──
      if (buttonId === "action_other_options") {
        const userName = profileName || "عزيزي";
        await sendListMessage(
          phoneNumber,
          `أستاذ ${userName}، اختر من القائمة 👇`,
          "📋 الخيارات",
          [
            {
              title: "خدمات إضافية",
              rows: [
                { id: "action_repeat_last", title: "🔁 نفس الرحلة", description: "كرر آخر رحلة بنقرة" },
                { id: "action_my_rides", title: "📒 رحلاتي", description: "عرض آخر 5 رحلات" },
                { id: "action_my_balance", title: "💰 رصيدي", description: "عرض الرصيد الحالي" },
                { id: "action_my_info", title: "ℹ️ معلوماتي", description: "بيانات حسابك" },
              ],
            },
          ],
          botCustomerId || undefined
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══ 🔁 نفس الرحلة (تكرار آخر رحلة مكتملة) ══
      if (buttonId === "action_repeat_last") {
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: lastRide } = await supabase
          .from("rides")
          .select("pickup_location, pickup_address, dropoff_location, dropoff_address, vehicle_type, estimated_fare, distance_km")
          .eq("rider_id", riderId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastRide) {
          await sendTextMessage(phoneNumber, `أستاذ ${userName}، ما عندك رحلات سابقة بعد. دز موقعك وبنساعدك بأول رحلة! 🚕`, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const pickup = lastRide.pickup_location as { lat: number; lng: number };
        const dropoff = lastRide.dropoff_location as { lat: number; lng: number };

        if (!pickup?.lat || !dropoff?.lat) {
          await sendTextMessage(phoneNumber, `⚠️ ما كدرنا نسترجع تفاصيل رحلتك السابقة. دز موقعك الحالي من جديد 📍`, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // إعادة حساب الأجرة (قد تتغير)
        const distKm = haversineDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
        const newFare = await calculateFareFromEdge(supabase, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, distKm, lastRide.vehicle_type || "economy");

        // إنشاء رحلة جديدة مع كل التفاصيل
        const { data: newRide, error: insertErr } = await supabase
          .from("rides")
          .insert({
            rider_id: riderId,
            status: "draft",
            pickup_location: pickup,
            pickup_address: lastRide.pickup_address,
            dropoff_location: dropoff,
            dropoff_address: lastRide.dropoff_address,
            vehicle_type: lastRide.vehicle_type || "economy",
            distance_km: Math.round(distKm * 100) / 100,
            estimated_fare: newFare,
            payment_method: "cash",
            trip_type: "whatsapp",
          })
          .select("id")
          .single();

        if (insertErr || !newRide) {
          console.error("[wa] Repeat ride failed:", insertErr);
          await sendTextMessage(phoneNumber, MESSAGES.error, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // إرسال أزرار التأكيد
        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.confirmationPrompt(lastRide.pickup_address || "نقطة الانطلاق", lastRide.dropoff_address || "الوجهة", newFare, distKm),
          [
            { id: `confirm_ride_${newRide.id}`, title: "✅ اعتمد الرحلة" },
            { id: `cancel_ride_${newRide.id}`, title: "❌ إلغاء" },
          ]
        );

        console.log(`[wa] 🔁 Repeat ride created: ${newRide.id}`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══ 🔄 رحلة عكسية (Reverse Ride — Phase 6) ══
      const reverseMatch = buttonId.match(/^reverse_ride_([a-f0-9\-]+)$/);
      if (reverseMatch) {
        const originalRideId = reverseMatch[1];
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: origRide } = await supabase
          .from("rides")
          .select("pickup_location, pickup_address, dropoff_location, dropoff_address, vehicle_type")
          .eq("id", originalRideId)
          .eq("status", "completed")
          .maybeSingle();

        if (!origRide) {
          await sendTextMessage(phoneNumber, `⚠️ ما كدرنا نسترجع تفاصيل الرحلة. دز موقعك من جديد 📍`, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // عكس الانطلاق والوجهة
        const newPickup = origRide.dropoff_location as { lat: number; lng: number };
        const newDropoff = origRide.pickup_location as { lat: number; lng: number };

        if (!newPickup?.lat || !newDropoff?.lat) {
          await sendTextMessage(phoneNumber, `⚠️ ما كدرنا نسترجع إحداثيات الرحلة. دز موقعك من جديد 📍`, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const distKm = haversineDistance(newPickup.lat, newPickup.lng, newDropoff.lat, newDropoff.lng);
        const newFare = await calculateFareFromEdge(supabase, newPickup.lat, newPickup.lng, newDropoff.lat, newDropoff.lng, distKm, origRide.vehicle_type || "economy");

        const { data: newRide, error: insertErr } = await supabase
          .from("rides")
          .insert({
            rider_id: riderId,
            status: "draft",
            pickup_location: newPickup,
            pickup_address: origRide.dropoff_address,
            dropoff_location: newDropoff,
            dropoff_address: origRide.pickup_address,
            vehicle_type: origRide.vehicle_type || "economy",
            distance_km: Math.round(distKm * 100) / 100,
            estimated_fare: newFare,
            payment_method: "cash",
            trip_type: "whatsapp",
          })
          .select("id")
          .single();

        if (insertErr || !newRide) {
          console.error("[wa] Reverse ride failed:", insertErr);
          await sendTextMessage(phoneNumber, MESSAGES.error, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.confirmationPrompt(origRide.dropoff_address || "نقطة الانطلاق", origRide.pickup_address || "الوجهة", newFare, distKm),
          [
            { id: `confirm_ride_${newRide.id}`, title: "✅ اعتمد الرحلة" },
            { id: `cancel_ride_${newRide.id}`, title: "❌ إلغاء" },
          ]
        );

        console.log(`[wa] 🔄 Reverse ride created: ${newRide.id} (from ${originalRideId})`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── رحلاتي السابقة ──
      if (buttonId === "action_my_rides") {
        const userName = profileName || "عزيزي";
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: rides } = await supabase
          .from("rides")
          .select("id, status, pickup_address, dropoff_address, estimated_fare, created_at")
          .eq("rider_id", riderId)
          .in("status", ["completed", "cancelled"])
          .order("created_at", { ascending: false })
          .limit(5);
        if (!rides || rides.length === 0) {
          await sendTextMessage(phoneNumber, `أستاذ ${userName}، ما عندك رحلات سابقة بعد 🚕`, botCustomerId || undefined);
        } else {
          let msg = `📒 *آخر ${rides.length} رحلات:*\n\n`;
          rides.forEach((r: any, i: number) => {
            const statusEmoji = r.status === "completed" ? "✅" : "❌";
            const date = new Date(r.created_at).toLocaleDateString("ar-IQ");
            msg += `${i + 1}. ${statusEmoji} *${r.pickup_address || "—"}* → *${r.dropoff_address || "—"}*\n   💰 ${r.estimated_fare?.toLocaleString() || "—"} د.ع | ${date}\n\n`;
          });
          await sendTextMessage(phoneNumber, msg, botCustomerId || undefined);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── رصيدي ──
      if (buttonId === "action_my_balance") {
        const userName = profileName || "عزيزي";
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("user_id", riderId)
          .maybeSingle();
        const balance = profile?.wallet_balance || 0;
        await sendInteractiveButtons(
          phoneNumber,
          `💰 رصيدك الحالي أستاذ ${userName}: *${balance.toLocaleString()} د.ع*`,
          [{ id: "action_add_balance", title: "➕ إضافة رصيد" }]
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── إضافة رصيد (اختيار طريقة الدفع) ──
      if (buttonId === "action_add_balance") {
        await sendInteractiveButtons(
          phoneNumber,
          `اختر طريقة الدفع المناسبة لك لشحن محفظتك:`,
          [
            { id: "topup_zaincash", title: "🟣 زين كاش" },
            { id: "topup_superqi", title: "🟡 سوبر كي" },
            { id: "topup_qicard", title: "💳 كيو كارد" },
          ]
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── تحويل عبر زين كاش ──
      if (buttonId === "topup_zaincash") {
        // حفظ اختيار طريقة الدفع في last_intent
        await supabase.from("bot_customers").update({ last_intent: "awaiting_receipt:zaincash" })
          .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        await sendTextMessage(
          phoneNumber,
          `لإضافة رصيد عبر 🟣 زين كاش، يرجى تحويل المبلغ المطلوب إلى الرقم أدناه، ثم إرسال صورة وصل التحويل هنا في المحادثة:`,
          botCustomerId || undefined
        );
        await sendTextMessage(phoneNumber, `07844446633`, botCustomerId || undefined);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── تحويل عبر سوبر كي ──
      if (buttonId === "topup_superqi") {
        await supabase.from("bot_customers").update({ last_intent: "awaiting_receipt:superqi" })
          .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        await sendTextMessage(
          phoneNumber,
          `لإضافة رصيد عبر 🟡 سوبر كي، يرجى تحويل المبلغ المطلوب إلى الرقم أدناه، ثم إرسال صورة وصل التحويل هنا في المحادثة:`,
          botCustomerId || undefined
        );
        await sendTextMessage(phoneNumber, `07844446633`, botCustomerId || undefined);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── تحويل عبر كيو كارد ──
      if (buttonId === "topup_qicard") {
        await supabase.from("bot_customers").update({ last_intent: "awaiting_receipt:qicard" })
          .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        await sendTextMessage(
          phoneNumber,
          `لإضافة رصيد عبر 💳 كيو كارد، يرجى تحويل المبلغ المطلوب إلى الرقم أدناه، ثم إرسال صورة وصل التحويل هنا في المحادثة:`,
          botCustomerId || undefined
        );
        await sendTextMessage(phoneNumber, `7117309554`, botCustomerId || undefined);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── معلوماتي ──
      if (buttonId === "action_my_info") {
        const userName = profileName || "عزيزي";
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, wallet_balance, created_at")
          .eq("user_id", riderId)
          .maybeSingle();
        if (profile) {
          const joinDate = new Date(profile.created_at).toLocaleDateString("ar-IQ");
          // عرض رقم الهاتف بشكل مقروء — تحويل wa_964xxx إلى 07xxx
          let displayPhone = profile.phone || "—";
          if (displayPhone.startsWith("wa_")) {
            const rawNum = displayPhone.replace("wa_", "");
            displayPhone = rawNum.startsWith("964") ? `0${rawNum.slice(3)}` : rawNum;
          }
          await sendTextMessage(phoneNumber,
            `ℹ️ *معلومات حسابك:*\n\n👤 الاسم: ${profile.full_name || "—"}\n📱 الهاتف: ${displayPhone}\n💰 الرصيد: ${(profile.wallet_balance || 0).toLocaleString()} د.ع\n📅 تاريخ الانضمام: ${joinDate}`,
            botCustomerId || undefined
          );
        } else {
          await sendTextMessage(phoneNumber, `عذراً أستاذ ${userName}، ما كدرنا نجيب معلوماتك حالياً ⚠️`, botCustomerId || undefined);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── تأكيد الرحلة ──
      const confirmMatch = buttonId.match(/^confirm_ride_([a-f0-9\-]+)$/);
      if (confirmMatch) {
        const rideId = confirmMatch[1];
        const { data: ride } = await supabase
          .from("rides")
          .select("id, status, dropoff_address")
          .eq("id", rideId)
          .maybeSingle();

        if (!ride || ride.status !== "draft") {
          await sendTextMessage(phoneNumber, "⚠️ هذا الطلب انتهت صلاحيته. دز موقعك من جديد.", botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const { error: updateErr } = await supabase
          .from("rides")
          .update({ status: "pending" })
          .eq("id", rideId)
          .eq("status", "draft");

        if (updateErr) {
          console.error("[wa] Failed to confirm ride:", updateErr);
          await sendTextMessage(phoneNumber, MESSAGES.error, botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // Auto-match via Edge Function
        try {
          await supabase.functions.invoke("match-ride", { body: { ride_id: rideId } });
          console.log(`[wa] match-ride invoked for ${rideId}`);
        } catch (matchErr) {
          console.warn("[wa] match-ride failed (non-critical):", matchErr);
        }

        // إرسال رسالة تأكيد مع معلومات الانتظار
        const waitSettings = await getWaitSettings(supabase);
        const confirmMsg = MESSAGES.rideConfirmed +
          `\n\n⏱️ أقصى وقت انتظار: ${waitSettings.max_wait_minutes} دقيقة`;
        await sendTextMessage(phoneNumber, confirmMsg, botCustomerId || undefined);
        trackBookingFunnel("confirm", phoneNumber, rideId);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── إلغاء الرحلة ──
      const cancelMatch = buttonId.match(/^cancel_ride_([a-f0-9\-]+)$/);
      if (cancelMatch) {
        const rideId = cancelMatch[1];

        const { data: rideToCancel } = await supabase
          .from("rides")
          .select("id, status")
          .eq("id", rideId)
          .maybeSingle();

        if (!rideToCancel) {
          await sendTextMessage(phoneNumber, "⚠️ هذا الطلب غير موجود.", botCustomerId || undefined);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // حساب غرامة الإلغاء للرحلات المقبولة
        let cancellationFee = 0;
        let feeMessage = "";
        if (["accepted", "arrived"].includes(rideToCancel.status)) {
          try {
            const { data: feeSettings } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "cancellation_fee")
              .maybeSingle();
            if (feeSettings?.value) {
              const feeCfg = typeof feeSettings.value === "string" ? JSON.parse(feeSettings.value) : feeSettings.value;
              cancellationFee = feeCfg.amount ?? feeCfg.fee ?? 0;
              if (cancellationFee > 0) {
                feeMessage = `\n\n⚠️ غرامة إلغاء: ${cancellationFee.toLocaleString()} د.ع (لأن الكابتن كان في الطريق)`;
              }
            }
          } catch { }
        }

        const updateData: any = {
          status: "cancelled",
          cancelled_by: "rider",
          cancellation_reason: "إلغاء من واتساب",
        };
        if (cancellationFee > 0) {
          updateData.cancellation_fee = cancellationFee;
        }

        await supabase
          .from("rides")
          .update(updateData)
          .eq("id", rideId)
          .in("status", ["draft", "pending", "accepted", "arrived"]);

        await sendTextMessage(phoneNumber, MESSAGES.rideCancelled + feeMessage, botCustomerId || undefined);
        console.log(`[wa] Ride ${rideId} cancelled (fee: ${cancellationFee})`);
        trackBookingFunnel("cancel", phoneNumber, rideId, { fee: cancellationFee });
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── استمر بالبحث ──
      if (buttonId === "keep_searching") {
        await sendTextMessage(phoneNumber, "👌 ما يخالف، نستمر بالبحث عن كابتن.", botCustomerId || undefined);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // 📍 PARALLEL ACTION: Track Driver (track_ button)
      // ══════════════════════════════════════════════════════════
      const trackMatch = buttonId.match(/^track_([a-f0-9\-]+)$/);
      if (trackMatch) {
        const rideId = trackMatch[1];
        console.log(`[wa] 📍 Track button pressed for ride: ${rideId}`);

        try {
          const { data: token } = await supabase
            .rpc("generate_ride_tracking_token", { p_ride_id: rideId });
          if (token) {
            const trackingUrl = `${SITE_URL}/track/${token}`;
            await sendTextMessage(phoneNumber,
              `📍 *تتبع موقع الكابتن مباشرة:*\n\n${trackingUrl}\n\nاضغط على الرابط لمتابعة موقعه بالوقت الحقيقي 🗺️`,
              botCustomerId || undefined
            );
          } else {
            await sendTextMessage(phoneNumber, "⚠️ ما كدرنا ننشئ رابط التتبع. حاول مرة ثانية.", botCustomerId || undefined);
          }
        } catch (e) {
          console.error("[wa] Track link generation failed:", e);
          await sendTextMessage(phoneNumber, "⚠️ حدث خطأ في إنشاء رابط التتبع.", botCustomerId || undefined);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // 💬 PARALLEL ACTION: Proxy Chat (chat_ button)
      // ══════════════════════════════════════════════════════════
      const chatMatch = buttonId.match(/^chat_([a-f0-9\-]+)$/);
      if (chatMatch) {
        const rideId = chatMatch[1];
        console.log(`[wa] 💬 Chat button pressed for ride: ${rideId}`);

        await supabase.from("bot_customers").update({
          last_intent: `chatting_with_driver:${rideId}`
        }).eq("platform", "whatsapp").eq("platform_id", phoneNumber);

        await sendTextMessage(phoneNumber,
          "اكتب رسالتك أدناه وراح تصل للكابتن فوراً 💬\n\nللخروج اكتب: خلص",
          botCustomerId || undefined
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // ⭐ PARALLEL ACTION: Driver Rating (rate_ button)
      // ══════════════════════════════════════════════════════════
      const rateMatch = buttonId.match(/^rate_([a-f0-9\-]+)_(\d+)$/);
      if (rateMatch) {
        const rideId = rateMatch[1];
        const rating = parseInt(rateMatch[2], 10);
        console.log(`[wa] ⭐ Rating: ${rating} stars for ride ${rideId}`);

        try {
          const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
          const { data: ride } = await supabase
            .from("rides")
            .select("driver_id")
            .eq("id", rideId)
            .maybeSingle();

          if (ride?.driver_id) {
            await supabase.from("ride_ratings").upsert({
              ride_id: rideId,
              rider_id: riderId,
              driver_id: ride.driver_id,
              rating,
              created_at: new Date().toISOString(),
            }, { onConflict: "ride_id,rider_id" });

            // تحديث متوسط تقييم السائق
            const { data: avgData } = await supabase
              .from("ride_ratings")
              .select("rating")
              .eq("driver_id", ride.driver_id);
            if (avgData && avgData.length > 0) {
              const avgRating = avgData.reduce((sum: number, r: any) => sum + r.rating, 0) / avgData.length;
              await supabase.from("drivers").update({ rating: Math.round(avgRating * 10) / 10 }).eq("id", ride.driver_id);
            }

            const stars = "⭐".repeat(rating);
            await sendTextMessage(phoneNumber,
              `${stars}\n\nشكراً لتقييمك! رأيك يهمنا ويساعدنا نتحسن 🙏`,
              botCustomerId || undefined
            );
          } else {
            await sendTextMessage(phoneNumber, "⚠️ ما كدرنا نحفظ التقييم. حاول مرة ثانية.", botCustomerId || undefined);
          }
        } catch (e) {
          console.error("[wa] Rating save failed:", e);
          await sendTextMessage(phoneNumber, "⚠️ حدث خطأ في حفظ التقييم. حاول مرة ثانية.");
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── اطلب رحلة → طلب الموقع ──
      if (buttonId === "action_book_ride") {
        await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ═══════════════════════════════════
    // 📍 موقع GPS
    // ═══════════════════════════════════
    if (msgType === "location") {
      const lat = message.location.latitude;
      const lng = message.location.longitude;
      console.log(`[wa] Location: ${lat}, ${lng}`);

      // التحقق: داخل نطاق الخدمة
      try {
        const { data: serviceCheckData } = await supabase.functions.invoke("check-service-area", {
          body: { lat, lng },
        });
        if (serviceCheckData && serviceCheckData.in_service_area === false) {
          await sendTextMessage(phoneNumber, MESSAGES.locationTooFar);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      } catch (e) {
        console.warn("[wa] Service area check failed, allowing:", e);
        // نسمح بالمتابعة حتى لو فشل الفحص
        const directDist = haversineDistance(lat, lng, 33.4233, 43.2974);
        if (directDist > 100) {
          await sendTextMessage(phoneNumber, MESSAGES.locationTooFar);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      }

      const address = await reverseGeocode(lat, lng);
      console.log(`[wa] Reverse geocoded: ${address}`);

      const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);

      // 🔒 إنشاء جلسة — محمي من الإلغاء العرضي للرحلات الجارية
      let sessionId: string;
      try {
        sessionId = await createPickupSession(supabase, riderId, lat, lng, address);
      } catch (sessionErr: any) {
        if (sessionErr?.message?.startsWith("IN_PROGRESS_RIDE:")) {
          console.warn(`[wa] Blocked: rider ${riderId} has in_progress ride, sending notice.`);
          await sendTextMessage(phoneNumber, MESSAGES.activeRideWithDriver("جارية 🚕"));
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        throw sessionErr;
      }
      console.log(`[wa] Session created: ${sessionId}`);

      const userName = profileName || "عزيزي";

      // ── Phase 5: فحص وجهة محفوظة مسبقاً (Scenario B completion) ──
      try {
        const { data: botCust } = await supabase
          .from("bot_customers")
          .select("last_intent")
          .eq("platform", "whatsapp")
          .eq("platform_id", phoneNumber)
          .maybeSingle();

        if (botCust?.last_intent?.startsWith("pending_dropoff:")) {
          const savedDropoff = botCust.last_intent.replace("pending_dropoff:", "");
          console.log(`[wa] 🎯 Phase 5: Found saved dropoff "${savedDropoff}" — auto-processing`);

          // مسح intent فوراً
          await supabase.from("bot_customers").update({ last_intent: null })
            .eq("platform", "whatsapp").eq("platform_id", phoneNumber);

          await sendTextMessage(phoneNumber, MESSAGES.autoProcessingDropoff(savedDropoff, userName));

          // Geocode الوجهة المحفوظة
          const dropoffLocation = await resolveRamadiLocation(savedDropoff, lat, lng);
          if (dropoffLocation) {
            const distanceKm = haversineDistance(lat, lng, dropoffLocation.lat, dropoffLocation.lng);
            const fare = await calculateFareFromEdge(supabase, lat, lng, dropoffLocation.lat, dropoffLocation.lng, distanceKm, "economy");

            await supabase.from("rides").update({
              dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
              dropoff_address: dropoffLocation.address,
              vehicle_type: "economy",
              distance_km: Math.round(distanceKm * 100) / 100,
              estimated_fare: fare,
            }).eq("id", sessionId);

            await sendInteractiveButtons(
              phoneNumber,
              MESSAGES.confirmationPrompt(address, dropoffLocation.address, fare, distanceKm),
              [
                { id: `confirm_ride_${sessionId}`, title: "✅ اعتمد الرحلة" },
                { id: `cancel_ride_${sessionId}`, title: "❌ إلغاء" },
              ]
            );
            trackBookingFunnel("destination", phoneNumber, sessionId, {
              destination: dropoffLocation.address, fare, distance_km: distanceKm, source: "saved_dropoff",
            });
            return new Response("EVENT_RECEIVED", { status: 200 });
          } else {
            console.warn(`[wa] Phase 5: Saved dropoff "${savedDropoff}" geocode failed — fallback to normal flow`);
            // لم نتمكن من ترميز الوجهة المحفوظة — نكمل التدفق العادي
          }
        }
      } catch (e) {
        console.warn("[wa] Phase 5: Saved dropoff check failed (non-critical):", e);
      }

      await sendTextMessage(phoneNumber, MESSAGES.locationReceived(address, userName));
      trackBookingFunnel("location", phoneNumber, sessionId, { address });
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ═══════════════════════════════════
    // 🎤 صوت أو ✏️ نص أو 🧾 صورة إيصال
    // ═══════════════════════════════════
    const hasText = msgType === "text" && message.text?.body;
    const hasAudio = msgType === "audio" && message.audio?.id;
    const hasImage = msgType === "image" && message.image?.id;

    // ═══════════════════════════════════
    // 🧾 معالجة صورة إيصال الدفع
    // ═══════════════════════════════════
    if (hasImage) {
      console.log(`[wa] 🧾 Image received from ${phoneNumber} — processing as receipt`);
      const userName = profileName || "عزيزي";

      try {
        // تحميل الصورة
        const imageBytes = await downloadWhatsAppMedia(message.image.id);
        if (!imageBytes || imageBytes.length === 0) {
          await sendTextMessage(phoneNumber, `عذراً أستاذ ${userName}، ما كدرنا نحمّل الصورة. حاول مرة ثانية 📷`);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
        console.log(`[wa] Downloaded image: ${imageBytes.length} bytes`);

        const mimeType = message.image.mime_type || "image/jpeg";

        // تحليل الإيصال بـ GPT-4o Vision
        await sendTextMessage(phoneNumber, "🔍 جاري تحليل الإيصال... لحظة واحدة");
        const receiptData = await parseReceiptImage(imageBytes, mimeType, OPENAI_API_KEY);
        console.log(`[wa] Receipt parsed:`, JSON.stringify(receiptData));

        if (!receiptData.is_valid_receipt) {
          await sendTextMessage(phoneNumber,
            `أستاذ ${userName}، هذي الصورة ما تبين إيصال دفع واضح 🤔\n\n` +
            `لو تريد تشحن رصيدك، أرسل لنا صورة واضحة لإيصال التحويل (زين كاش، كي كارد، الخ) 📸`
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // فحص التكرار
        if (receiptData.transaction_reference) {
          const { data: existingTxn } = await supabase
            .from("receipt_transactions")
            .select("id, status")
            .eq("transaction_reference", receiptData.transaction_reference)
            .maybeSingle();

          if (existingTxn) {
            const statusText = existingTxn.status === "approved" ? "تمت الموافقة عليها ✅" :
                               existingTxn.status === "rejected" ? "تم رفضها ❌" :
                               "قيد المراجعة ⏳";
            await sendTextMessage(phoneNumber,
              `أستاذ ${userName}، هذا الإيصال مسجل مسبقاً وحالته: ${statusText}\n\n` +
              `رقم المعاملة: ${receiptData.transaction_reference}`
            );
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
        }

        // البحث عن المستخدم المسجل
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);

        // استخراج المزود من last_intent (إذا اختار المستخدم طريقة دفع مسبقاً)
        let selectedProvider = receiptData.provider; // الافتراضي: ما استخرجه GPT
        try {
          const { data: bc } = await supabase.from("bot_customers")
            .select("last_intent")
            .eq("platform", "whatsapp").eq("platform_id", phoneNumber)
            .maybeSingle();
          if (bc?.last_intent?.startsWith("awaiting_receipt:")) {
            const providerKey = bc.last_intent.replace("awaiting_receipt:", "");
            const PROVIDER_MAP: Record<string, string> = {
              zaincash: "Zain Cash",
              superqi: "Super Qi",
              qicard: "QiCard",
            };
            selectedProvider = PROVIDER_MAP[providerKey] || selectedProvider;
            console.log(`[wa] Provider from last_intent: ${selectedProvider}`);
            // مسح الـ last_intent بعد الاستخدام
            await supabase.from("bot_customers").update({ last_intent: null })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
          }
        } catch (e) {
          console.warn("[wa] Failed to read provider from last_intent:", e);
        }

        // حفظ المعاملة في قاعدة البيانات
        const { data: txn, error: txnError } = await supabase
          .from("receipt_transactions")
          .insert({
            user_id: riderId,
            platform: "whatsapp",
            platform_user_id: phoneNumber,
            amount: receiptData.amount,
            transaction_reference: receiptData.transaction_reference,
            provider: selectedProvider,
            status: "pending",
            parsed_data: receiptData,
          })
          .select("id")
          .single();

        if (txnError) {
          console.error("[wa] Failed to save receipt transaction:", txnError);
          await sendTextMessage(phoneNumber, `عذراً أستاذ ${userName}، حدث خطأ تقني. حاول مرة ثانية ⚠️`);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        console.log(`[wa] Receipt transaction created: ${txn.id}`);

        // إشعار الأدمن عبر بوت تليجرام
        if (ADMIN_TELEGRAM_BOT_TOKEN && ADMIN_GROUP_CHAT_ID) {
          const adminMsgId = await notifyAdminGroup(
            ADMIN_TELEGRAM_BOT_TOKEN,
            ADMIN_GROUP_CHAT_ID,
            receiptData,
            txn.id,
            `${userName} (${phoneNumber})`,
            "whatsapp",
            imageBytes,
            mimeType
          );

          if (adminMsgId) {
            await supabase.from("receipt_transactions").update({
              admin_message_id: adminMsgId,
              admin_chat_id: ADMIN_GROUP_CHAT_ID,
            }).eq("id", txn.id);
          }
        } else {
          console.warn("[wa] Admin bot not configured — receipt saved but no admin notification");
        }

        // إشعار العميل
        const amountText = receiptData.amount ? `${receiptData.amount.toLocaleString()} د.ع` : "غير محدد";
        await sendTextMessage(phoneNumber,
          `✅ تم استلام إيصالك بنجاح أستاذ ${userName}!\n\n` +
          `💰 المبلغ: ${amountText}\n` +
          `🏦 المزود: ${receiptData.provider || "غير محدد"}\n` +
          `🔢 رقم المعاملة: ${receiptData.transaction_reference || "—"}\n\n` +
          `⏳ طلبك قيد المراجعة وسيتم إضافة الرصيد لحسابك بعد التأكد.\n` +
          `سنرسل لك إشعار فور الموافقة إن شاء الله 🙏`
        );

        return new Response("EVENT_RECEIVED", { status: 200 });
      } catch (imgErr) {
        console.error("[wa] Receipt processing error:", imgErr);
        const userName2 = profileName || "عزيزي";
        await sendTextMessage(phoneNumber, `عذراً أستاذ ${userName2}، ما كدرنا نحلل الإيصال. حاول مرة ثانية ⚠️`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    }

    if (!hasText && !hasAudio) {
      await sendLocationRequest(phoneNumber, MESSAGES.welcome);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const userName = profileName || "عزيزي";
    const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);

    // ══════════════════════════════════════════════════════════
    // 💬 PROXY CHAT SUB-STATE: Hard Purge + Smart Routing
    // ══════════════════════════════════════════════════════════
    if (hasText) {
      try {
        const { data: botCustomer } = await supabase
          .from("bot_customers")
          .select("last_intent")
          .eq("platform", "whatsapp")
          .eq("platform_id", phoneNumber)
          .maybeSingle();

        if (botCustomer?.last_intent?.startsWith("chatting_with_driver:")) {
          const chatRideId = botCustomer.last_intent.replace("chatting_with_driver:", "");
          const userText = message.text.body.trim();
          const userTextLower = userText.toLowerCase();

          // فحص الرحلة
          const { data: rideCheck } = await supabase
            .from("rides").select("id, status").eq("id", chatRideId).maybeSingle();
          const { data: anyActiveRide } = await supabase
            .from("rides").select("id")
            .eq("rider_id", riderId)
            .in("status", ["accepted", "arrived", "in_progress"])
            .limit(1)
            .maybeSingle();

          // كلمات الخروج
          const breakoutKeywords = [
            "خروج", "exit", "quit", "cancel", "الغاء", "إلغاء",
            "خلص", "انتهيت", "done", "stop",
          ];

          const isBreakoutCommand = breakoutKeywords.some(kw =>
            userTextLower === kw || userTextLower.includes(kw)
          );

          if (isBreakoutCommand) {
            console.log(`[wa] 🔥 Breakout keyword detected: "${userText}" — clearing chat state`);
            await supabase.from("bot_customers").update({ last_intent: null })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
            // لا نرجع — نكمل الـ flow العادي
          } else {
            if (
              !rideCheck ||
              !["accepted", "arrived", "in_progress"].includes(rideCheck.status) ||
              !anyActiveRide
            ) {
              // الرحلة انتهت — مسح sub-state
              console.log(`[wa] 🔥 Stale chat state — ride ${chatRideId} is ${rideCheck?.status || "missing"}`);
              await supabase.from("bot_customers").update({ last_intent: null })
                .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
              // لا نرجع — نكمل الـ flow العادي
            } else {
              // ✅ الرحلة نشطة فعلاً — ترحيل الرسالة
              const { error: msgError } = await supabase
                .from("ride_messages")
                .insert({
                  ride_id: chatRideId,
                  sender_id: riderId,
                  sender_type: "rider",
                  message: userText,
                  created_at: new Date().toISOString(),
                });
              if (msgError) {
                console.error("[wa] Failed to insert chat message:", msgError);
                await sendTextMessage(phoneNumber, "⚠️ ما كدرنا نرسل رسالتك. حاول مرة ثانية.");
              } else {
                await sendTextMessage(phoneNumber,
                  "✅ تم إرسال رسالتك للكابتن."
                );
              }
              return new Response("EVENT_RECEIVED", { status: 200 });
            }
          }
        }
      } catch (e) {
        console.warn("[wa] Proxy chat sub-state check failed:", e);
      }
    }

    // ── 🧠 ذاكرة الرحلة النشطة + ترحيل الدردشة ──
    const activeRide = await checkActiveRide(supabase, riderId);
    if (activeRide) {
      console.log(`[wa] Active ride: ${activeRide.id} (${activeRide.status})`);

      if (activeRide.status === "pending") {
        const waitSettings = await getWaitSettings(supabase);
        const elapsedMin = Math.floor((Date.now() - new Date(activeRide.created_at).getTime()) / 60000);
        const randomMsg = waitSettings.search_messages[Math.floor(Math.random() * waitSettings.search_messages.length)];
        let waitMsg = `${randomMsg.icon} ${randomMsg.text}`;
        if (activeRide.pickup_address || activeRide.dropoff_address) {
          waitMsg = `${randomMsg.icon} ${randomMsg.text}\n\n📍 من: ${activeRide.pickup_address || "موقعك"}\n🏁 إلى: ${activeRide.dropoff_address || "الوجهة"}\n⏱️ مضت ${elapsedMin} دقيقة`;
        }

        await sendInteractiveButtons(
          phoneNumber,
          waitMsg,
          [
            { id: `cancel_ride_${activeRide.id}`, title: "❌ إلغاء الرحلة" },
            { id: "keep_searching", title: "🔄 استمر بالبحث" },
          ]
        );
      } else {
        // accepted, arrived, in_progress — ترحيل الرسالة للسائق
        let userMessageText = "";
        if (hasText) {
          userMessageText = message.text.body;
        } else if (hasAudio) {
          try {
            const mediaUrl = await downloadWhatsAppMedia(message.audio.id);
            if (mediaUrl) {
              userMessageText = await transcribeAudio(mediaUrl, message.audio.mime_type || "audio/ogg");
            }
          } catch (e) {
            console.warn("[wa] Audio transcription failed for relay:", e);
          }
        }

        if (userMessageText && userMessageText.trim().length > 0) {
          const { error: msgError } = await supabase
            .from("ride_messages")
            .insert({
              ride_id: activeRide.id,
              sender_id: riderId,
              sender_type: "rider",
              message: userMessageText,
              created_at: new Date().toISOString(),
            });
          if (msgError) {
            console.error("[wa] Relay message insert failed:", msgError);
          } else {
            console.log(`[wa] Relay message inserted for ride ${activeRide.id}`);
            await sendTextMessage(phoneNumber, "✅ تم إرسال رسالتك للكابتن.");
          }
        } else {
          const statusText = activeRide.status === "accepted" ? "الكابتن في الطريق إليك" :
            activeRide.status === "arrived" ? "الكابتن وصل لموقعك" :
              "الرحلة جارية الآن";
          let trackingLine = "";
          try {
            const { data: trackToken } = await supabase
              .rpc("generate_ride_tracking_token", { p_ride_id: activeRide.id });
            if (trackToken) {
              trackingLine = `\n\n📍 تتبع الكابتن: ${SITE_URL}/track/${trackToken}`;
            }
          } catch (e) {
            console.warn("[wa] Failed to generate tracking link:", e);
          }

          await sendTextMessage(phoneNumber, MESSAGES.activeRideWithDriver(statusText) + trackingLine);
        }
      }
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── إذا أرسل المستخدم تحية أو طلب قائمة → قائمة ترحيب بأزرار ──
    if (hasText) {
      const txt = message.text.body.trim();
      const txtLower = txt.toLowerCase();
      const isGreeting =
        ["ران", "raan", "start"].includes(txtLower) ||
        /^(مرحب|هلا|اهلا|أهلا|السلام|وعليكم|هلو|hello|hi|سلام|مساء|صباح)/.test(txtLower) ||
        /^(خيارات|خياراتي|القائم[ةه]|المنيو|menu|options|مساعد[ةه]|ساعدني|help)$/i.test(txt) ||
        /(وين|اين|أين|فين).*(زر|خيارات|قائم[ةه]|منيو|ازرار|أزرار)/i.test(txt);

      if (isGreeting) {
        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.welcomeMenu(userName),
          [
            { id: "action_book_ride", title: "🚕 اطلب رحلة" },
            { id: "action_inquiry", title: "💬 استفسار سريع" },
            { id: "action_other_options", title: "📋 المزيد" },
          ]
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    }

    // ── هل يوجد session (draft بدون وجهة)؟ ──
    const session = await findPendingSession(supabase, riderId);

    if (!session) {
      // ═══════════════════════════════════════════════════════════
      // 🧠 Phase 5: Smart Initial Intent — لا يوجد session
      // بدلاً من طلب GPS فوراً، نحلل النص/الصوت أولاً
      // ═══════════════════════════════════════════════════════════
      const userName = profileName || "عزيزي";

      // ── الحصول على النص (من نص أو صوت مُحوّل) ──
      let userMsgText = "";
      if (hasText) {
        userMsgText = message.text.body;
      } else if (hasAudio) {
        // Phase 5: تحويل الصوت إلى نص حتى في حالة عدم وجود session
        try {
          const mediaBytes = await downloadWhatsAppMedia(message.audio.id);
          const mimeType = message.audio.mime_type || "audio/ogg";
          userMsgText = await transcribeAudio(mediaBytes, mimeType);
          console.log(`[whisper] 🎙️ Idle-state transcript: "${userMsgText}"`);
        } catch (e) {
          console.error("[whisper] Idle-state transcription failed:", e);
          await sendLocationRequest(phoneNumber, MESSAGES.needLocationFirst);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      }

      if (!userMsgText || userMsgText.trim().length < 2) {
        await sendLocationRequest(phoneNumber, MESSAGES.needLocationFirst);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── Step 1: تصنيف محلي — تحيات/شكاوى/FAQ/أوامر فقط ──
      const localResult = classifyLocally(userMsgText, userName);
      if (localResult.handled && localResult.intent !== "booking") {
        console.log(`[classify] ⚡ LOCAL: intent=${localResult.intent}`);
        trackEvent("classify_local", { intent: localResult.intent }, phoneNumber);

        // 🎯 أوامر مباشرة: رصيدي، رحلاتي، معلوماتي → أزرار القائمة
        if (localResult.intent === "balance" || localResult.intent === "my_rides" || localResult.intent === "my_info") {
          await sendInteractiveButtons(
            phoneNumber,
            `أستاذ ${userName}، اختر من القائمة 👇`,
            [
              { id: "action_my_balance", title: "💰 رصيدي" },
              { id: "action_my_rides", title: "📒 رحلاتي" },
              { id: "action_my_info", title: "ℹ️ معلوماتي" },
            ]
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // 🔥 Phase 6: شكاوى فقط → تحويل مباشر للإدارة
        // FAQ (أسئلة متكررة) لها رد جاهز ولا تُحوّل للإدارة
        if (localResult.intent === "complaint") {
          // جلب معرّف الرحلة النشطة (إن وجدت)
          let activeRideId: string | null = null;
          try {
            const { data: aRide } = await supabase
              .from("rides")
              .select("id")
              .eq("rider_id", riderId)
              .in("status", ["pending", "accepted", "arrived", "in_progress"])
              .limit(1)
              .maybeSingle();
            activeRideId = aRide?.id || null;
          } catch { }

          // تحويل للإدارة عبر بوت الأدمن
          if (ADMIN_TELEGRAM_BOT_TOKEN && ADMIN_GROUP_CHAT_ID) {
            const adminMsg =
              `🔴 شكوى جديدة من واتساب:\n\n` +
              `👤 الاسم: ${userName}\n` +
              `📱 الرقم: ${phoneNumber}\n` +
              (activeRideId ? `🚕 رحلة نشطة: ${activeRideId}\n` : "") +
              `\n💬 الرسالة:\n"${userMsgText}"`;

            try {
              await fetch(`https://api.telegram.org/bot${ADMIN_TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: ADMIN_GROUP_CHAT_ID, text: adminMsg }),
              });
              console.log(`[wa] ✅ Forwarded ${localResult.intent} to admin group`);
            } catch (e) {
              console.error("[wa] Admin forward failed:", e);
            }
          }

          await sendTextMessage(phoneNumber,
            "تم تحويل طلبك/شكواك مباشرة إلى الإدارة. نحن نتابع الأمر وسنتواصل معك فوراً لحل المشكلة. 🙏",
            botCustomerId || undefined
          );
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        if (localResult.reply) {
          await sendTextMessage(phoneNumber, localResult.reply);
        } else {
          await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── Step 2: محاولة استخراج نقطة الانطلاق والوجهة معاً (محلي) ──
      const fullBooking = extractPickupAndDropoff(userMsgText);
      if (fullBooking) {
        // 🎯 Scenario A: انطلاق + وجهة — حجز كامل بدون GPS!
        console.log(`[smart-intent] ✅ FULL BOOKING: "${fullBooking.pickup}" → "${fullBooking.dropoff}"`);
        trackEvent("smart_intent_full", { pickup: fullBooking.pickup, dropoff: fullBooking.dropoff }, phoneNumber);
        await sendTextMessage(phoneNumber, MESSAGES.processing);

        // Geocode الانطلاق
        const pickupLocation = await resolveRamadiLocation(fullBooking.pickup);
        if (!pickupLocation) {
          console.warn(`[smart-intent] Pickup geocode failed for "${fullBooking.pickup}"`);
          // حفظ الوجهة وطلب GPS بدلاً
          try {
            await supabase.from("bot_customers").update({ last_intent: `pending_dropoff:${fullBooking.dropoff}` })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
          } catch { }
          await sendLocationRequest(phoneNumber, MESSAGES.pickupGeocodeFailed(fullBooking.pickup));
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // فحص نطاق الخدمة
        const pickupDistFromCenter = haversineDistance(pickupLocation.lat, pickupLocation.lng, 33.4233, 43.2974);
        if (pickupDistFromCenter > 100) {
          await sendTextMessage(phoneNumber, MESSAGES.locationTooFar);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // إنشاء session بالانطلاق
        let sessionId: string;
        try {
          sessionId = await createPickupSession(supabase, riderId, pickupLocation.lat, pickupLocation.lng, pickupLocation.address);
        } catch (sessionErr: any) {
          if (sessionErr?.message?.startsWith("IN_PROGRESS_RIDE:")) {
            await sendTextMessage(phoneNumber, MESSAGES.activeRideWithDriver("جارية 🚕"));
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
          throw sessionErr;
        }

        // Geocode الوجهة
        const dropoffLocation = await resolveRamadiLocation(fullBooking.dropoff, pickupLocation.lat, pickupLocation.lng);
        if (!dropoffLocation) {
          // نجح الانطلاق لكن فشلت الوجهة — session مفتوح، يكمل المستخدم
          await sendTextMessage(phoneNumber, MESSAGES.locationReceived(pickupLocation.address, userName));
          await sendTextMessage(phoneNumber, MESSAGES.geocodeFailed(fullBooking.dropoff, userName));
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // حساب المسافة والأجرة
        const distanceKm = haversineDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
        const fare = await calculateFareFromEdge(supabase, pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng, distanceKm, fullBooking.vehicle_type);

        // تحديث الرحلة بالوجهة
        await supabase.from("rides").update({
          dropoff_location: { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          dropoff_address: dropoffLocation.address,
          vehicle_type: fullBooking.vehicle_type,
          distance_km: Math.round(distanceKm * 100) / 100,
          estimated_fare: fare,
        }).eq("id", sessionId);

        // إرسال أزرار التأكيد
        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.confirmationPrompt(pickupLocation.address, dropoffLocation.address, fare, distanceKm),
          [
            { id: `confirm_ride_${sessionId}`, title: "✅ اعتمد الرحلة" },
            { id: `cancel_ride_${sessionId}`, title: "❌ إلغاء" },
          ]
        );

        trackBookingFunnel("destination", phoneNumber, sessionId, {
          destination: dropoffLocation.address, fare, distance_km: distanceKm, source: "smart_full_booking",
        });
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── Step 3: محاولة استخراج وجهة فقط (محلي) ──
      const directDest = extractDirectDestination(userMsgText);
      const localDestHint = directDest?.destination || (localResult.handled && localResult.destination_hint) || null;

      if (localDestHint) {
        // 📍 Scenario B: وجهة فقط — نحفظها ونطلب GPS
        console.log(`[smart-intent] 📍 DROPOFF ONLY (local): "${localDestHint}"`);
        trackEvent("smart_intent_dropoff", { dropoff: localDestHint }, phoneNumber);
        try {
          await supabase.from("bot_customers").update({ last_intent: `pending_dropoff:${localDestHint}` })
            .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        } catch { }
        await sendLocationRequest(phoneNumber, MESSAGES.dropoffSavedAskPickup(localDestHint, userName));
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── Step 4: Cache للـ AI ──
      const cachedAI = getCachedAIClassification(userMsgText);
      if (cachedAI) {
        console.log(`[classify] 📦 CACHED: intent=${cachedAI.intent}`);
        trackEvent("classify_cached", { intent: cachedAI.intent }, phoneNumber);
        if (cachedAI.pickup_hint && cachedAI.destination_hint) {
          // Cached full booking — redirect to Scenario A processing would be complex, just save dropoff
          try {
            await supabase.from("bot_customers").update({ last_intent: `pending_dropoff:${cachedAI.destination_hint}` })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
          } catch { }
          await sendLocationRequest(phoneNumber, MESSAGES.dropoffSavedAskPickup(cachedAI.destination_hint, userName));
        } else if (cachedAI.destination_hint) {
          try {
            await supabase.from("bot_customers").update({ last_intent: `pending_dropoff:${cachedAI.destination_hint}` })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
          } catch { }
          await sendLocationRequest(phoneNumber, MESSAGES.dropoffSavedAskPickup(cachedAI.destination_hint, userName));
        } else if (cachedAI.intent === "booking") {
          await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
        } else {
          await sendTextMessage(phoneNumber, cachedAI.reply);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── Step 5: GPT-4o (fallback) ──
      const aiResponse = await classifyAndRespond(userMsgText, userName);
      console.log(`[classify] 🧠 GPT: intent=${aiResponse.intent}, pickup=${aiResponse.pickup_hint}, dest=${aiResponse.destination_hint}`);
      trackEvent("classify_gpt", { intent: aiResponse.intent, pickup: aiResponse.pickup_hint, hint: aiResponse.destination_hint }, phoneNumber);
      cacheAIClassification(userMsgText, aiResponse);

      if (aiResponse.pickup_hint && aiResponse.destination_hint) {
        // 🎯 Scenario A via GPT: full booking
        console.log(`[smart-intent] ✅ FULL BOOKING (GPT): "${aiResponse.pickup_hint}" → "${aiResponse.destination_hint}"`);
        await sendTextMessage(phoneNumber, MESSAGES.processing);

        const pickupLoc = await resolveRamadiLocation(aiResponse.pickup_hint);
        if (pickupLoc) {
          const pDistCenter = haversineDistance(pickupLoc.lat, pickupLoc.lng, 33.4233, 43.2974);
          if (pDistCenter <= 100) {
            let sId: string;
            try {
              sId = await createPickupSession(supabase, riderId, pickupLoc.lat, pickupLoc.lng, pickupLoc.address);
            } catch (se: any) {
              if (se?.message?.startsWith("IN_PROGRESS_RIDE:")) {
                await sendTextMessage(phoneNumber, MESSAGES.activeRideWithDriver("جارية 🚕"));
                return new Response("EVENT_RECEIVED", { status: 200 });
              }
              throw se;
            }

            const dLoc = await resolveRamadiLocation(aiResponse.destination_hint, pickupLoc.lat, pickupLoc.lng);
            if (dLoc) {
              const dKm = haversineDistance(pickupLoc.lat, pickupLoc.lng, dLoc.lat, dLoc.lng);
              const f = await calculateFareFromEdge(supabase, pickupLoc.lat, pickupLoc.lng, dLoc.lat, dLoc.lng, dKm, "economy");
              await supabase.from("rides").update({
                dropoff_location: { lat: dLoc.lat, lng: dLoc.lng },
                dropoff_address: dLoc.address,
                vehicle_type: "economy",
                distance_km: Math.round(dKm * 100) / 100,
                estimated_fare: f,
              }).eq("id", sId);
              await sendInteractiveButtons(phoneNumber,
                MESSAGES.confirmationPrompt(pickupLoc.address, dLoc.address, f, dKm),
                [
                  { id: `confirm_ride_${sId}`, title: "✅ اعتمد الرحلة" },
                  { id: `cancel_ride_${sId}`, title: "❌ إلغاء" },
                ]);
              trackBookingFunnel("destination", phoneNumber, sId, {
                destination: dLoc.address, fare: f, distance_km: dKm, source: "smart_gpt_full",
              });
              return new Response("EVENT_RECEIVED", { status: 200 });
            } else {
              // وجهة فشلت — session مفتوح
              await sendTextMessage(phoneNumber, MESSAGES.locationReceived(pickupLoc.address, userName));
              await sendTextMessage(phoneNumber, MESSAGES.geocodeFailed(aiResponse.destination_hint, userName));
              return new Response("EVENT_RECEIVED", { status: 200 });
            }
          }
        }
        // Pickup geocode failed — fallback to Scenario B
        try {
          await supabase.from("bot_customers").update({ last_intent: `pending_dropoff:${aiResponse.destination_hint}` })
            .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        } catch { }
        await sendLocationRequest(phoneNumber, MESSAGES.dropoffSavedAskPickup(aiResponse.destination_hint, userName));
      } else if (aiResponse.destination_hint) {
        // 📍 Scenario B via GPT: dropoff only
        console.log(`[smart-intent] 📍 DROPOFF ONLY (GPT): "${aiResponse.destination_hint}"`);
        try {
          await supabase.from("bot_customers").update({ last_intent: `pending_dropoff:${aiResponse.destination_hint}` })
            .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        } catch { }
        await sendLocationRequest(phoneNumber, MESSAGES.dropoffSavedAskPickup(aiResponse.destination_hint, userName));
      } else if (aiResponse.intent === "booking") {
        // Scenario C: نية حجز بدون أي مكان محدد
        await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
      } else {
        // ليس حجز — رد عادي
        await sendTextMessage(phoneNumber, aiResponse.reply);
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ═══════════════════════════════════
    // 🎯 Session موجود — معالجة الوجهة
    // ═══════════════════════════════════
    console.log(`[wa] Session found: ${session.ride_id}`);
    await sendTextMessage(phoneNumber, MESSAGES.processing);

    // ── الحصول على نص الوجهة ──
    let userText = "";

    if (hasAudio) {
      try {
        const mediaBytes = await downloadWhatsAppMedia(message.audio.id);
        const mimeType = message.audio.mime_type || "audio/ogg";
        userText = await transcribeAudio(mediaBytes, mimeType);
        console.log(`[whisper] Transcript: "${userText}"`);
      } catch (e) {
        console.error("[whisper] Failed:", e);
        await sendTextMessage(phoneNumber, MESSAGES.noTranscript);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    } else {
      userText = message.text.body;
    }

    if (!userText || userText.trim().length < 2) {
      await sendTextMessage(phoneNumber, MESSAGES.noDestination);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── استخراج الوجهة (3 مراحل: محلي → Cache → GPT-4o) ──
    const vehicleTypes = await getActiveVehicleTypes(supabase);

    // المرحلة 1: استخراج محلي مباشر (بدون GPT)
    const directDest = extractDirectDestination(userText);
    let intent;

    if (directDest) {
      console.log(`[extract] ⚡ LOCAL direct: "${directDest.destination}" (${directDest.vehicle_type})`);
      intent = {
        destination_search_query: directDest.destination,
        vehicle_type: directDest.vehicle_type,
        notes: null,
        is_destination: true,
        conversation_reply: null,
      };
    } else {
      // المرحلة 2: فحص الـ Cache
      const cachedDest = getCachedDestination(userText);
      if (cachedDest) {
        console.log(`[extract] 📦 CACHED: "${cachedDest.destination_search_query}"`);
        intent = cachedDest;
      } else {
        // المرحلة 3: GPT-4o (fallback)
        intent = await extractDestination(userText, userName, session.pickup_lat, session.pickup_lng, vehicleTypes);
        console.log("[gpt4o] 🧠 Result:", JSON.stringify(intent));
        cacheDestination(userText, intent);
      }
    }

    // إذا كان النص ليس وجهة
    if (!intent.is_destination && intent.conversation_reply) {
      await sendTextMessage(phoneNumber, intent.conversation_reply);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    if (!intent.destination_search_query || intent.destination_search_query.trim().length < 2) {
      await sendTextMessage(phoneNumber, MESSAGES.noDestination);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── Geocoding ──
    const destination = await resolveRamadiLocation(intent.destination_search_query, session.pickup_lat, session.pickup_lng);
    if (!destination) {
      await sendTextMessage(phoneNumber, MESSAGES.geocodeFailed(intent.destination_search_query, userName));
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
    console.log(`[geocode] Resolved: ${destination.address} (${destination.lat}, ${destination.lng})`);

    // ── حساب المسافة والأجرة ──
    const distanceKm = haversineDistance(session.pickup_lat, session.pickup_lng, destination.lat, destination.lng);
    const fare = await calculateFareFromEdge(supabase, session.pickup_lat, session.pickup_lng, destination.lat, destination.lng, distanceKm, intent.vehicle_type || "economy");
    console.log(`[fare] Distance: ${distanceKm.toFixed(2)} km, Fare: ${fare} IQD`);

    // ── تحديث الرحلة بالوجهة ──
    const updatePayload: Record<string, unknown> = {
      dropoff_location: { lat: destination.lat, lng: destination.lng },
      dropoff_address: destination.address,
      vehicle_type: intent.vehicle_type || "economy",
      distance_km: Math.round(distanceKm * 100) / 100,
      estimated_fare: fare,
    };
    if (intent.notes) {
      updatePayload.fare_adjustment_reason = `[ملاحظة واتساب] ${intent.notes}`;
    }
    const { error: updateError } = await supabase
      .from("rides")
      .update(updatePayload)
      .eq("id", session.ride_id);

    if (updateError) {
      console.error("[wa] Failed to update ride:", updateError);
      throw new Error(`Failed to update ride: ${updateError.message}`);
    }

    // ── إرسال أزرار التأكيد ──
    await sendInteractiveButtons(
      phoneNumber,
      MESSAGES.confirmationPrompt(session.pickup_address, destination.address, fare, distanceKm),
      [
        { id: `confirm_ride_${session.ride_id}`, title: "✅ اعتمد الرحلة" },
        { id: `cancel_ride_${session.ride_id}`, title: "❌ إلغاء" },
      ]
    );

    console.log(`[wa] Confirmation sent for ride ${session.ride_id}`);
    trackBookingFunnel("destination", phoneNumber, session.ride_id, {
      destination: destination.address,
      fare,
      distance_km: distanceKm,
    });
    trackResponseTime(_startTime, phoneNumber, "destination_flow");
    await forceFlushEvents();
    return new Response("EVENT_RECEIVED", { status: 200 });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[wa] CRITICAL ERROR:", errMsg);
    console.error("[wa] Stack:", error instanceof Error ? error.stack : "N/A");
    trackEvent("ai_error", { error: errMsg }, phoneNumber);

    try {
      await sendTextMessage(phoneNumber, MESSAGES.error);
    } catch { }

    trackResponseTime(_startTime, phoneNumber, "error");
    await forceFlushEvents();
    // Always return 200 so Meta doesn't retry
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
});
