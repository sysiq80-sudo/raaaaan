/**
 * ران — حجز الرحلات عبر SMS (الردود المرقمة التفاعلية)
 * RAAN SMS Booking — Interactive Numbered Responses
 *
 * التدفق:
 * 1. المستخدم يرسل SMS → OTPIQ inbound webhook يمرر الرسالة هنا
 *    أو: المستخدم يرسل SMS → نظام polling يجلب الرسائل
 *    أو: المستخدم يبدأ الحجز عبر رابط/QR code → يرسل "ران" أو "1"
 *
 * الجلسة (session states):
 *   idle       → المستخدم لم يبدأ أو أنهى الجلسة
 *   pickup     → ينتظر نقطة الانطلاق
 *   dropoff    → ينتظر الوجهة
 *   confirm    → ينتظر تأكيد/إلغاء الرحلة
 *   active     → رحلة جارية
 *
 * GPS عبر SMS:
 *   - اسم مكان: "جامعة الأنبار" → landmarks matching
 *   - رابط Google Maps: https://maps.google.com/... → extract lat/lng
 *   - رقم من القائمة: "3" → landmark من القائمة
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { sendSMS, formatIraqiPhone } from "../_shared/smsSender.ts";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";

// ════════════════════════════════════════
// التهيئة والثوابت
// ════════════════════════════════════════

const RAMADI_CENTER = { lat: 33.4233, lng: 43.2974 };

const LANDMARK_LIST = [
  { name: "جامعة الأنبار", lat: 33.4350, lng: 43.2650, aliases: ["جامعة", "الجامعة"] },
  { name: "مستشفى الرمادي", lat: 33.4280, lng: 43.3050, aliases: ["المستشفى", "مستشفى"] },
  { name: "حي التأميم", lat: 33.4350, lng: 43.3100, aliases: ["التأميم", "تأميم"] },
  { name: "حي الحوز", lat: 33.4200, lng: 43.3150, aliases: ["الحوز", "حوز"] },
  { name: "حي الملعب", lat: 33.4300, lng: 43.2900, aliases: ["الملعب", "ملعب"] },
  { name: "حي الضباط", lat: 33.4150, lng: 43.2850, aliases: ["الضباط", "ضباط"] },
  { name: "حي العزيزية", lat: 33.4180, lng: 43.3200, aliases: ["العزيزية", "عزيزية"] },
  { name: "حي 5 كيلو", lat: 33.4100, lng: 43.2750, aliases: ["5 كيلو", "خمسة كيلو"] },
  { name: "السوق المركزي", lat: 33.4235, lng: 43.3020, aliases: ["السوق", "سوق"] },
  { name: "مبنى المحافظة", lat: 33.4240, lng: 43.3040, aliases: ["المحافظة", "محافظة"] },
  { name: "تقاطع الزيوت", lat: 33.4240, lng: 43.3000, aliases: ["الزيوت", "زيوت"] },
  { name: "حي المعلمين", lat: 33.4150, lng: 43.3050, aliases: ["المعلمين", "معلمين"] },
  { name: "حي الأندلس", lat: 33.4100, lng: 43.3100, aliases: ["الأندلس", "اندلس"] },
  { name: "شارع 60", lat: 33.4200, lng: 43.2700, aliases: ["ستين", "شارع ستين"] },
  { name: "حي البكر", lat: 33.4280, lng: 43.2950, aliases: ["البكر", "بكر"] },
  { name: "حي الورار", lat: 33.4320, lng: 43.3200, aliases: ["الورار", "ورار"] },
  { name: "حي السلام", lat: 33.4250, lng: 43.2700, aliases: ["السلام", "سلام"] },
  { name: "الفلوجة", lat: 33.3530, lng: 43.7830, aliases: ["فلوجة"] },
  { name: "هيت", lat: 33.6390, lng: 42.8270, aliases: [] },
  { name: "حديثة", lat: 34.1370, lng: 42.3790, aliases: [] },
];

// Session state interface
interface SMSSession {
  state: "idle" | "pickup" | "dropoff" | "confirm" | "active";
  rider_id?: string;
  ride_id?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_address?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_address?: string;
  estimated_fare?: number;
  updated_at: string;
}

// ════════════════════════════════════════
// مطابقة المعالم
// ════════════════════════════════════════
function matchLandmark(text: string): { name: string; lat: number; lng: number } | null {
  const q = text.trim().toLowerCase().replace(/[.,،\-_]/g, "");

  // مطابقة بالرقم من القائمة
  const num = parseInt(q, 10);
  if (!isNaN(num) && num >= 1 && num <= LANDMARK_LIST.length) {
    const lm = LANDMARK_LIST[num - 1];
    return { name: lm.name, lat: lm.lat, lng: lm.lng };
  }

  // مطابقة بالاسم
  for (const lm of LANDMARK_LIST) {
    if (q === lm.name.toLowerCase() || q.includes(lm.name.toLowerCase())) {
      return { name: lm.name, lat: lm.lat, lng: lm.lng };
    }
    for (const alias of lm.aliases) {
      if (q === alias.toLowerCase() || q.includes(alias.toLowerCase())) {
        return { name: lm.name, lat: lm.lat, lng: lm.lng };
      }
    }
  }

  return null;
}

// استخراج إحداثيات من رابط Google Maps
function extractCoordsFromGoogleMaps(text: string): { lat: number; lng: number } | null {
  // https://maps.google.com/?q=33.4233,43.2974
  // https://www.google.com/maps/place/33.4233,43.2974
  // https://goo.gl/maps/xxx → لن نعالجها (مختصرة)
  const patterns = [
    /(?:maps\.google\.com|google\.com\/maps)[^\s]*[?&/@](-?\d+\.?\d*),(-?\d+\.?\d*)/i,
    /(-?\d{1,3}\.\d{3,8}),\s*(-?\d{1,3}\.\d{3,8})/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat > 29 && lat < 38 && lng > 38 && lng < 49) {
        return { lat, lng };
      }
    }
  }
  return null;
}

// حل الموقع من النص
function resolveLocation(text: string): { lat: number; lng: number; address: string } | null {
  // 1. Google Maps link
  const coords = extractCoordsFromGoogleMaps(text);
  if (coords) {
    return { ...coords, address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` };
  }

  // 2. Landmark match
  const lm = matchLandmark(text);
  if (lm) {
    return { lat: lm.lat, lng: lm.lng, address: lm.name };
  }

  return null;
}

// بناء قائمة المعالم المرقمة
function buildLandmarkMenu(): string {
  let menu = "";
  LANDMARK_LIST.forEach((lm, i) => {
    menu += `${i + 1}. ${lm.name}\n`;
  });
  return menu;
}

// ════════════════════════════════════════
// إدارة الجلسة عبر bot_customers
// ════════════════════════════════════════
async function getSession(supabase: any, phone: string): Promise<SMSSession> {
  const platformId = `sms_${phone}`;
  const { data } = await supabase
    .from("bot_customers")
    .select("session_data")
    .eq("platform", "sms")
    .eq("platform_id", platformId)
    .maybeSingle();

  if (data?.session_data) {
    // Check if session is stale (> 30 minutes)
    const sessionData = data.session_data as SMSSession;
    const updatedAt = new Date(sessionData.updated_at).getTime();
    if (Date.now() - updatedAt > 30 * 60 * 1000) {
      return { state: "idle", updated_at: new Date().toISOString() };
    }
    return sessionData;
  }
  return { state: "idle", updated_at: new Date().toISOString() };
}

async function saveSession(supabase: any, phone: string, session: SMSSession, name?: string): Promise<void> {
  const platformId = `sms_${phone}`;
  session.updated_at = new Date().toISOString();

  await supabase.from("bot_customers").upsert(
    {
      platform: "sms",
      platform_id: platformId,
      phone_number: phone,
      display_name: name || "راكب SMS",
      session_data: session,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "platform,platform_id" }
  );
}

// ════════════════════════════════════════
// إنشاء/إيجاد مستخدم SMS
// ════════════════════════════════════════
async function findOrCreateSMSUser(
  supabase: any,
  phone: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<string> {
  const smsRef = `sms_${phone}`;
  const email = `sms_${phone}@sms.raan.app`;

  // البحث في profiles
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .or(`phone.eq.${smsRef},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (existing?.user_id) return existing.user_id;

  // إنشاء مستخدم جديد
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      full_name: "راكب SMS",
      source: "sms",
      sms_phone: phone,
    },
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already been registered")) {
      const lookupRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        }
      );
      const lookupData = await lookupRes.json();
      const foundUser = lookupData.users?.[0];
      if (!foundUser?.id) throw new Error("SMS user registered but not found");
      userId = foundUser.id;
    } else {
      throw new Error(`Failed to create SMS user: ${authError.message}`);
    }
  } else if (!authData?.user) {
    throw new Error("Failed to create SMS user: no user returned");
  } else {
    userId = authData.user.id;
  }

  // إنشاء/تحديث profile
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: "راكب SMS",
    phone: smsRef,
    email,
    status: "active",
  });

  console.log(`[sms-booking] Created SMS user: ${userId} for ${phone}`);
  return userId;
}

// ════════════════════════════════════════
// الحساب API — الأجرة
// ════════════════════════════════════════
async function calculateFare(
  supabase: any,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): Promise<{ fare: number; distance_km: number; duration_min: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("calculate-fare", {
      body: {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        vehicle_type: "economy",
      },
    });

    if (error || !data) return null;
    return {
      fare: data.total_fare || data.estimated_fare || 0,
      distance_km: data.distance_km || 0,
      duration_min: data.duration_minutes || 0,
    };
  } catch {
    return null;
  }
}

// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { phone, message: rawMessage, sender_name } = body;

    if (!phone || !rawMessage) {
      return new Response(
        JSON.stringify({ error: "phone and message required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatIraqiPhone(phone);
    const message = rawMessage.trim();
    const messageLower = message.toLowerCase();

    console.log(`[sms-booking] 📩 From ${formattedPhone}: "${message}"`);

    // ── جلب الجلسة الحالية ──
    let session = await getSession(supabase, formattedPhone);

    // ════════════════════════════════════════
    // أوامر عامة (تعمل في أي حالة)
    // ════════════════════════════════════════

    // الغاء
    if (["الغاء", "الغي", "لا", "0", "الغ", "cancel", "إلغاء"].includes(messageLower)) {
      // إلغاء أي رحلة نشطة
      if (session.ride_id) {
        await supabase
          .from("rides")
          .update({
            status: "cancelled",
            cancelled_by: "rider",
            cancellation_reason: "ألغيت من قبل الراكب (SMS)",
          })
          .eq("id", session.ride_id)
          .in("status", ["draft", "pending"]);
      }

      session = { state: "idle", updated_at: new Date().toISOString() };
      await saveSession(supabase, formattedPhone, session, sender_name);
      await sendSMS(formattedPhone, "تم الإلغاء ✅\nأرسل (ران) أو (1) لطلب رحلة جديدة");
      return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // مساعدة
    if (["مساعدة", "مساعده", "help", "?", "؟"].includes(messageLower)) {
      await sendSMS(
        formattedPhone,
        `🚕 *ران - خدمة التوصيل بالـ SMS*\n\n` +
        `أرسل (ران) أو (1) لبدء رحلة\n` +
        `أرسل (الغاء) أو (0) للإلغاء\n` +
        `أرسل اسم المكان أو رقمه من القائمة\n` +
        `أو أرسل رابط Google Maps\n\n` +
        `مثال: "جامعة الأنبار" أو "3"`
      );
      return new Response(JSON.stringify({ success: true, action: "help" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // حالة: idle — بدء جلسة جديدة
    // ════════════════════════════════════════
    if (session.state === "idle") {
      const startKeywords = ["ران", "ran", "رحلة", "توصيل", "1", "سيارة", "taxi", "تكسي", "taksi"];
      const isStart = startKeywords.some(k => messageLower.includes(k));

      if (!isStart) {
        // قد تكون أول رسالة — أرسل ترحيب
        await sendSMS(
          formattedPhone,
          `أهلاً بك في ران 🚕\n` +
          `خدمة التوصيل عبر الرسائل القصيرة\n\n` +
          `أرسل (1) لطلب رحلة\n` +
          `أرسل (مساعدة) للمزيد`
        );
        return new Response(JSON.stringify({ success: true, action: "welcome" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // بدء جلسة حجز — طلب نقطة الانطلاق
      session.state = "pickup";

      // إنشاء المستخدم
      const riderId = await findOrCreateSMSUser(supabase, formattedPhone, supabaseUrl, supabaseKey);
      session.rider_id = riderId;

      await saveSession(supabase, formattedPhone, session, sender_name);

      // Track in bot_customers
      await supabase.from("bot_customers").upsert(
        {
          platform: "sms",
          platform_id: `sms_${formattedPhone}`,
          phone_number: formattedPhone,
          display_name: sender_name || "راكب SMS",
          session_data: session,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "platform,platform_id" }
      );

      const menu = buildLandmarkMenu();
      await sendSMS(
        formattedPhone,
        `🚕 أهلاً! وين موقعك (نقطة الانطلاق)؟\n\n` +
        `أرسل رقم المكان:\n${menu}\n` +
        `أو أرسل اسم المكان\n` +
        `أو أرسل رابط Google Maps\n\n` +
        `(0) للإلغاء`
      );

      return new Response(JSON.stringify({ success: true, action: "ask_pickup" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // حالة: pickup — استلام نقطة الانطلاق
    // ════════════════════════════════════════
    if (session.state === "pickup") {
      const location = resolveLocation(message);
      if (!location) {
        await sendSMS(
          formattedPhone,
          `⚠️ ما عرفنا المكان "${message}"\n\n` +
          `حاول مرة ثانية:\n` +
          `- أرسل رقم من القائمة (1-${LANDMARK_LIST.length})\n` +
          `- أو اسم المكان (مثلاً: الملعب)\n` +
          `- أو رابط Google Maps\n\n` +
          `(0) للإلغاء`
        );
        return new Response(JSON.stringify({ success: true, action: "pickup_retry" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      session.pickup_lat = location.lat;
      session.pickup_lng = location.lng;
      session.pickup_address = location.address;
      session.state = "dropoff";

      await saveSession(supabase, formattedPhone, session, sender_name);

      const menu = buildLandmarkMenu();
      await sendSMS(
        formattedPhone,
        `✅ الانطلاق: ${location.address}\n\n` +
        `🎯 وين وجهتك؟\n\n` +
        `أرسل رقم المكان:\n${menu}\n` +
        `أو أرسل اسم المكان/رابط Maps\n\n` +
        `(0) للإلغاء`
      );

      return new Response(JSON.stringify({ success: true, action: "ask_dropoff" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // حالة: dropoff — استلام الوجهة وحساب الأجرة
    // ════════════════════════════════════════
    if (session.state === "dropoff") {
      const location = resolveLocation(message);
      if (!location) {
        await sendSMS(
          formattedPhone,
          `⚠️ ما عرفنا الوجهة "${message}"\n\n` +
          `حاول مرة ثانية:\n` +
          `- أرسل رقم من القائمة (1-${LANDMARK_LIST.length})\n` +
          `- أو اسم المكان\n` +
          `- أو رابط Google Maps\n\n` +
          `(0) للإلغاء`
        );
        return new Response(JSON.stringify({ success: true, action: "dropoff_retry" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      session.dropoff_lat = location.lat;
      session.dropoff_lng = location.lng;
      session.dropoff_address = location.address;

      // حساب الأجرة
      const fareResult = await calculateFare(
        supabase,
        session.pickup_lat!, session.pickup_lng!,
        location.lat, location.lng
      );

      const fare = fareResult?.fare || 5000;
      const distance = fareResult?.distance_km || 0;
      const duration = fareResult?.duration_min || 0;
      session.estimated_fare = fare;

      // إنشاء الرحلة كـ draft
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .insert({
          rider_id: session.rider_id,
          status: "draft",
          pickup_location: { lat: session.pickup_lat, lng: session.pickup_lng },
          pickup_address: session.pickup_address,
          dropoff_location: { lat: location.lat, lng: location.lng },
          dropoff_address: location.address,
          estimated_fare: fare,
          distance_km: distance,
          duration_minutes: duration,
          vehicle_type: "economy",
          payment_method: "cash",
          trip_type: "sms",
        })
        .select("id")
        .single();

      if (rideError) {
        console.error("[sms-booking] Failed to create ride:", rideError);
        await sendSMS(formattedPhone, "⚠️ حدث خطأ تقني. حاول مرة أخرى لاحقاً.");
        session.state = "idle";
        await saveSession(supabase, formattedPhone, session, sender_name);
        return new Response(JSON.stringify({ success: false, error: rideError.message }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }

      session.ride_id = ride.id;
      session.state = "confirm";

      await saveSession(supabase, formattedPhone, session, sender_name);

      let confirmMsg =
        `📋 ملخص الرحلة:\n\n` +
        `من: ${session.pickup_address}\n` +
        `إلى: ${location.address}\n`;
      
      if (distance > 0) confirmMsg += `المسافة: ${distance.toFixed(1)} كم\n`;
      if (duration > 0) confirmMsg += `الوقت: ~${Math.round(duration)} دقيقة\n`;
      confirmMsg += `السعر: ${fare.toLocaleString()} دينار\n\n`;
      confirmMsg += `أرسل (1) للتأكيد ✅\nأرسل (0) للإلغاء ❌`;

      await sendSMS(formattedPhone, confirmMsg);

      return new Response(JSON.stringify({ success: true, action: "ask_confirm", ride_id: ride.id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // حالة: confirm — تأكيد أو إلغاء الرحلة
    // ════════════════════════════════════════
    if (session.state === "confirm") {
      const confirmKeywords = ["1", "نعم", "اي", "تأكيد", "اكيد", "أكيد", "yes", "ok", "اوك", "ايوه", "موافق"];
      const isConfirm = confirmKeywords.some(k => messageLower === k || messageLower.includes(k));

      if (!isConfirm) {
        // إلغاء
        if (session.ride_id) {
          await supabase
            .from("rides")
            .update({
              status: "cancelled",
              cancelled_by: "rider",
              cancellation_reason: "رفض التأكيد (SMS)",
            })
            .eq("id", session.ride_id)
            .eq("status", "draft");
        }

        session = { state: "idle", updated_at: new Date().toISOString() };
        await saveSession(supabase, formattedPhone, session, sender_name);
        await sendSMS(formattedPhone, "تم الإلغاء ✅\nأرسل (1) لطلب رحلة جديدة");
        return new Response(JSON.stringify({ success: true, action: "ride_cancelled" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // تأكيد → draft → pending
      if (!session.ride_id) {
        session = { state: "idle", updated_at: new Date().toISOString() };
        await saveSession(supabase, formattedPhone, session, sender_name);
        await sendSMS(formattedPhone, "⚠️ انتهت الجلسة. أرسل (1) لبدء رحلة جديدة.");
        return new Response(JSON.stringify({ success: true, action: "session_expired" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("rides")
        .update({ status: "pending" })
        .eq("id", session.ride_id)
        .eq("status", "draft");

      if (updateError) {
        console.error("[sms-booking] Confirm error:", updateError);
        await sendSMS(formattedPhone, "⚠️ حدث خطأ. حاول مرة أخرى.");
        return new Response(JSON.stringify({ success: false, error: updateError.message }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }

      console.log(`[sms-booking] Ride ${session.ride_id}: draft → pending`);

      // match-ride
      try {
        await supabase.functions.invoke("match-ride", {
          body: { rideId: session.ride_id },
        });
        console.log(`[sms-booking] match-ride invoked for ${session.ride_id}`);
      } catch (matchErr) {
        console.warn("[sms-booking] match-ride failed (non-critical):", matchErr);
      }

      session.state = "active";
      await saveSession(supabase, formattedPhone, session, sender_name);

      await sendSMS(
        formattedPhone,
        `✅ تم تأكيد طلبك!\n` +
        `جاري البحث عن سائق...\n` +
        `سنرسل لك رسالة عند قبول السائق 🚗\n\n` +
        `أرسل (0) للإلغاء`
      );

      return new Response(JSON.stringify({ success: true, action: "ride_confirmed", ride_id: session.ride_id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // حالة: active — رحلة جارية
    // ════════════════════════════════════════
    if (session.state === "active") {
      // التحقق من حالة الرحلة
      if (session.ride_id) {
        const { data: ride } = await supabase
          .from("rides")
          .select("status")
          .eq("id", session.ride_id)
          .maybeSingle();

        if (!ride || ["completed", "cancelled"].includes(ride?.status)) {
          session = { state: "idle", updated_at: new Date().toISOString() };
          await saveSession(supabase, formattedPhone, session, sender_name);
          await sendSMS(formattedPhone, "الرحلة انتهت.\nأرسل (1) لطلب رحلة جديدة 🚕");
          return new Response(JSON.stringify({ success: true, action: "ride_ended" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // الراكب أرسل رسالة أثناء الرحلة
        await sendSMS(
          formattedPhone,
          `رحلتك لا تزال جارية 🚗\n` +
          `الحالة: ${statusToArabic(ride.status)}\n\n` +
          `أرسل (0) لإلغاء الرحلة`
        );
      }

      return new Response(JSON.stringify({ success: true, action: "ride_active" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fallback
    await sendSMS(formattedPhone, "أرسل (1) لطلب رحلة أو (مساعدة) للمزيد 🚕");
    return new Response(JSON.stringify({ success: true, action: "fallback" }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[sms-booking] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════
// ترجمة الحالة
// ════════════════════════════════════════
function statusToArabic(status: string): string {
  const map: Record<string, string> = {
    pending: "جاري البحث عن سائق",
    accepted: "السائق في الطريق إليك",
    arrived: "السائق وصل",
    in_progress: "الرحلة جارية",
    completed: "اكتملت",
    cancelled: "ملغية",
  };
  return map[status] || status;
}
