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
  extractScheduledRideDetails,
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
} from "./lib/local-classifier.ts";

import {
  getCachedAIClassification,
  cacheAIClassification,
  getCachedDestination,
  cacheDestination,
  getCacheStats,
} from "./lib/cache.ts";

// ════════════════════════════════════════
// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
// ════════════════════════════════════════
serve(async (req) => {
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
    try {
      const svc = createServiceClient();
      const cfg = await getConfigBatch(svc, ["WHATSAPP_APP_SECRET"]);
      const appSecret = cfg["WHATSAPP_APP_SECRET"];
      if (appSecret) {
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
      }
    } catch (sigErr) {
      console.warn("[wa] Signature verification skipped:", sigErr);
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
  try {
    await supabase.from("bot_customers").upsert({
      platform: "whatsapp",
      platform_id: phoneNumber,
      full_name: profileName || "WhatsApp User",
      phone_number: phoneNumber,
      last_active: new Date().toISOString(),
      interaction_count: 1,
    }, {
      onConflict: "platform,platform_id",
    });
    await supabase.rpc("increment_bot_customer_interactions", {
      p_platform: "whatsapp",
      p_platform_id: phoneNumber,
    }).then(() => { }).catch(() => { });
  } catch (e) {
    console.warn("[wa] bot_customers upsert failed (non-critical):", e);
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
        await sendTextMessage(phoneNumber, MESSAGES.inquiryPrompt(userName));
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
                { id: "action_scheduled_ride", title: "🕒 حجز مجدول", description: "احجز رحلة مسبقاً" },
                { id: "action_my_rides", title: "📒 رحلاتي", description: "عرض آخر 5 رحلات" },
                { id: "action_my_balance", title: "💰 رصيدي", description: "عرض الرصيد الحالي" },
                { id: "action_my_info", title: "ℹ️ معلوماتي", description: "بيانات حسابك" },
              ],
            },
          ]
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
          await sendTextMessage(phoneNumber, `أستاذ ${userName}، ما عندك رحلات سابقة بعد. دز موقعك وبنساعدك بأول رحلة! 🚕`);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const pickup = lastRide.pickup_location as { lat: number; lng: number };
        const dropoff = lastRide.dropoff_location as { lat: number; lng: number };

        if (!pickup?.lat || !dropoff?.lat) {
          await sendTextMessage(phoneNumber, `⚠️ ما كدرنا نسترجع تفاصيل رحلتك السابقة. دز موقعك الحالي من جديد 📍`);
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
          await sendTextMessage(phoneNumber, MESSAGES.error);
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

      // ── حجز مجدول ──
      if (buttonId === "action_scheduled_ride") {
        const userName = profileName || "عزيزي";
        await supabase.from("bot_customers").update({
          last_intent: "awaiting_schedule"
        }).eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        await sendTextMessage(phoneNumber,
          `أستاذ ${userName}، اكتب تفاصيل رحلتك المجدولة بهذا الشكل:\n\n📍 من وين: (مثلاً: حي التأميم)\n🏁 لوين: (مثلاً: جامعة الأنبار)\n🕒 متى: (مثلاً: غداً الساعة 8 صباحاً)\n\nاكتب كل شي برسالة وحدة 👇`
        );
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
          await sendTextMessage(phoneNumber, `أستاذ ${userName}، ما عندك رحلات سابقة بعد 🚕`);
        } else {
          let msg = `📒 *آخر ${rides.length} رحلات:*\n\n`;
          rides.forEach((r: any, i: number) => {
            const statusEmoji = r.status === "completed" ? "✅" : "❌";
            const date = new Date(r.created_at).toLocaleDateString("ar-IQ");
            msg += `${i + 1}. ${statusEmoji} *${r.pickup_address || "—"}* → *${r.dropoff_address || "—"}*\n   💰 ${r.estimated_fare?.toLocaleString() || "—"} د.ع | ${date}\n\n`;
          });
          await sendTextMessage(phoneNumber, msg);
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
        await sendTextMessage(phoneNumber, `💰 رصيدك الحالي أستاذ ${userName}: *${balance.toLocaleString()} د.ع*`);
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
          await sendTextMessage(phoneNumber,
            `ℹ️ *معلومات حسابك:*\n\n👤 الاسم: ${profile.full_name || "—"}\n📱 الهاتف: ${profile.phone || "—"}\n💰 الرصيد: ${(profile.wallet_balance || 0).toLocaleString()} د.ع\n📅 تاريخ الانضمام: ${joinDate}`
          );
        } else {
          await sendTextMessage(phoneNumber, `عذراً أستاذ ${userName}، ما كدرنا نجيب معلوماتك حالياً ⚠️`);
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
          await sendTextMessage(phoneNumber, "⚠️ هذا الطلب انتهت صلاحيته. دز موقعك من جديد.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        const { error: updateErr } = await supabase
          .from("rides")
          .update({ status: "pending" })
          .eq("id", rideId)
          .eq("status", "draft");

        if (updateErr) {
          console.error("[wa] Failed to confirm ride:", updateErr);
          await sendTextMessage(phoneNumber, MESSAGES.error);
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
        await sendTextMessage(phoneNumber, confirmMsg);
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
          await sendTextMessage(phoneNumber, "⚠️ هذا الطلب غير موجود.");
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

        await sendTextMessage(phoneNumber, MESSAGES.rideCancelled + feeMessage);
        console.log(`[wa] Ride ${rideId} cancelled (fee: ${cancellationFee})`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── استمر بالبحث ──
      if (buttonId === "keep_searching") {
        await sendTextMessage(phoneNumber, "👌 ما يخالف، نستمر بالبحث عن كابتن.");
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
              `📍 *تتبع موقع الكابتن مباشرة:*\n\n${trackingUrl}\n\nاضغط على الرابط لمتابعة موقعه بالوقت الحقيقي 🗺️`
            );
          } else {
            await sendTextMessage(phoneNumber, "⚠️ ما كدرنا ننشئ رابط التتبع. حاول مرة ثانية.");
          }
        } catch (e) {
          console.error("[wa] Track link generation failed:", e);
          await sendTextMessage(phoneNumber, "⚠️ حدث خطأ في إنشاء رابط التتبع.");
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
          "اكتب رسالتك أدناه وراح تصل للكابتن فوراً 💬\n\nللخروج اكتب: خلص"
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
              `${stars}\n\nشكراً لتقييمك! رأيك يهمنا ويساعدنا نتحسن 🙏`
            );
          } else {
            await sendTextMessage(phoneNumber, "⚠️ ما كدرنا نحفظ التقييم. حاول مرة ثانية.");
          }
        } catch (e) {
          console.error("[wa] Rating save failed:", e);
          await sendTextMessage(phoneNumber, "⚠️ حدث خطأ في حفظ التقييم. حاول مرة ثانية.");
        }

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
      const sessionId = await createPickupSession(supabase, riderId, lat, lng, address);
      console.log(`[wa] Session created: ${sessionId}`);

      const userName = profileName || "عزيزي";
      await sendTextMessage(phoneNumber, MESSAGES.locationReceived(address, userName));
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ═══════════════════════════════════
    // 🎤 صوت أو ✏️ نص
    // ═══════════════════════════════════
    const hasText = msgType === "text" && message.text?.body;
    const hasAudio = msgType === "audio" && message.audio?.id;

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

    // ── إذا أرسل المستخدم تحية → قائمة ترحيب بأزرار ──
    if (hasText) {
      const txt = message.text.body.trim();
      const txtLower = txt.toLowerCase();
      const isGreeting =
        ["ران", "raan", "start"].includes(txtLower) ||
        /^(مرحب|هلا|اهلا|أهلا|السلام|وعليكم|هلو|hello|hi|سلام|مساء|صباح)/.test(txtLower);

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

    // ── "اطلب رحلة" button → طلب الموقع ──
    if (msgType === "interactive") {
      const buttonId = message.interactive?.button_reply?.id;
      if (buttonId === "action_book_ride") {
        await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    }

    // ── هل يوجد session (draft بدون وجهة)؟ ──
    const session = await findPendingSession(supabase, riderId);

    if (!session) {
      // لا يوجد session
      const userName = profileName || "عزيزي";

      // ── فحص حجز مجدول ──
      if (hasText) {
        const { data: botCustomer } = await supabase
          .from("bot_customers")
          .select("last_intent")
          .eq("platform", "whatsapp")
          .eq("platform_id", phoneNumber)
          .maybeSingle();

        if (botCustomer?.last_intent === "awaiting_schedule") {
          console.log("[wa] Awaiting schedule — processing scheduled ride request");
          const userMsgText = message.text.body;

          // مسح الـ intent
          await supabase.from("bot_customers").update({ last_intent: null })
            .eq("platform", "whatsapp").eq("platform_id", phoneNumber);

          const scheduleDetails = await extractScheduledRideDetails(userMsgText, userName);

          if (!scheduleDetails.is_valid) {
            await sendTextMessage(phoneNumber, scheduleDetails.error_reply || "عذراً، ما فهمت تفاصيل الرحلة. حاول مرة ثانية 🙏");
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          if (!scheduleDetails.scheduled_time) {
            await sendTextMessage(phoneNumber, `أستاذ ${userName}، يا ريت تحدد الوقت بالضبط. مثلاً: "غداً الساعة 8 صباحاً" أو "بعد ساعتين" 🕒`);
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          // Geocode
          const dropoffResolved = await resolveRamadiLocation(scheduleDetails.dropoff_query);
          if (!dropoffResolved) {
            await sendTextMessage(phoneNumber, MESSAGES.geocodeFailed(scheduleDetails.dropoff_query, userName));
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          let pickupLocation = { lat: 33.4233, lng: 43.2974 };
          let pickupAddress = scheduleDetails.pickup_query || "موقع المستخدم";
          if (scheduleDetails.pickup_query && scheduleDetails.pickup_query !== "موقع المستخدم") {
            const pickupResolved = await resolveRamadiLocation(scheduleDetails.pickup_query);
            if (pickupResolved) {
              pickupLocation = { lat: pickupResolved.lat, lng: pickupResolved.lng };
              pickupAddress = pickupResolved.address;
            }
          }

          const distanceKm = haversineDistance(pickupLocation.lat, pickupLocation.lng, dropoffResolved.lat, dropoffResolved.lng);
          const fare = await calculateFareFromEdge(supabase, pickupLocation.lat, pickupLocation.lng, dropoffResolved.lat, dropoffResolved.lng, distanceKm, scheduleDetails.vehicle_type);

          // إنشاء الحجز المجدول
          const { data: scheduledRide, error: schedError } = await supabase
            .from("scheduled_rides")
            .insert({
              rider_id: riderId,
              pickup_location: pickupLocation,
              pickup_address: pickupAddress,
              dropoff_location: { lat: dropoffResolved.lat, lng: dropoffResolved.lng },
              dropoff_address: dropoffResolved.address,
              scheduled_time: scheduleDetails.scheduled_time,
              vehicle_type: scheduleDetails.vehicle_type,
              estimated_fare: fare,
              notes: scheduleDetails.notes,
              status: "scheduled",
            })
            .select("id")
            .single();

          if (schedError) {
            console.error("[wa] Scheduled ride insert failed:", schedError);
            await sendTextMessage(phoneNumber, MESSAGES.error);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          const scheduledDate = new Date(scheduleDetails.scheduled_time!);
          const dateStr = scheduledDate.toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          const timeStr = scheduledDate.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

          await sendTextMessage(phoneNumber,
            `✅ *تم حجز رحلتك المجدولة بنجاح!*\n\n` +
            `📍 *من:* ${pickupAddress}\n` +
            `🏁 *إلى:* ${dropoffResolved.address}\n` +
            `📏 *المسافة:* ${distanceKm.toFixed(1)} كم\n` +
            `💰 *السعر التقديري:* ${fare.toLocaleString()} د.ع\n` +
            `📅 *الموعد:* ${dateStr}\n` +
            `🕒 *الساعة:* ${timeStr}\n\n` +
            `سيتم إشعارك وتأكيد الرحلة قبل الموعد إن شاء الله 🙏`
          );

          console.log(`[wa] Scheduled ride created: ${scheduledRide.id}`);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      }

      // ── لا يوجد session ولا awaiting_schedule — تصنيف النية ──
      if (hasText) {
        const userMsgText = message.text.body;

        // محاولة 1: تصنيف محلي (بدون GPT) — يوفـر ~60% من استدعاءات API
        const localResult = classifyLocally(userMsgText, userName);
        if (localResult.handled) {
          console.log(`[classify] ⚡ LOCAL: intent=${localResult.intent}`);
          if (localResult.intent === "booking") {
            await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
          } else if (localResult.reply) {
            await sendTextMessage(phoneNumber, localResult.reply);
          } else {
            // greeting — handled by the greeting check above
            await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
          }
        } else {
          // محاولة 2: Cache للـ AI
          const cachedAI = getCachedAIClassification(userMsgText);
          if (cachedAI) {
            console.log(`[classify] 📦 CACHED: intent=${cachedAI.intent}`);
            if (cachedAI.intent === "booking" || cachedAI.destination_hint) {
              await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
            } else {
              await sendTextMessage(phoneNumber, cachedAI.reply);
            }
          } else {
            // محاولة 3: GPT-4o (fallback)
            const aiResponse = await classifyAndRespond(userMsgText, userName);
            console.log(`[classify] 🧠 GPT: intent=${aiResponse.intent}, hint=${aiResponse.destination_hint}`);
            cacheAIClassification(userMsgText, aiResponse);

            if (aiResponse.intent === "booking" || aiResponse.destination_hint) {
              await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
            } else {
              await sendTextMessage(phoneNumber, aiResponse.reply);
            }
          }
        }
      } else {
        // صوت بدون session — اطلب الموقع
        await sendLocationRequest(phoneNumber, MESSAGES.needLocationFirst);
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
    return new Response("EVENT_RECEIVED", { status: 200 });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[wa] CRITICAL ERROR:", errMsg);
    console.error("[wa] Stack:", error instanceof Error ? error.stack : "N/A");

    try {
      await sendTextMessage(phoneNumber, MESSAGES.error);
    } catch { }

    // Always return 200 so Meta doesn't retry
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
});
