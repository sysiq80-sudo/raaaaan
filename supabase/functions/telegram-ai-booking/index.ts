/**
 * ران - بوت تيليغرام للحجز الذكي بالصوت
 * RAAN AI Dispatcher Bot — Ramadi Edition (v2 — Location First)
 *
 * التدفق الجديد:
 * 1. /start → يطلب من المستخدم مشاركة موقعه الحالي (GPS)
 * 2. مشاركة الموقع → يحفظ الموقع كنقطة انطلاق ويطلب الوجهة (صوت أو نص)
 * 3. صوت/نص → يستخرج الوجهة فقط (GPT-4o) → Geocoding → حساب الأجرة → إنشاء رحلة
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

// ════════════════════════════════════════
// المتغيرات — تُحمّل ديناميكياً من system_configs
// ════════════════════════════════════════
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let TELEGRAM_BOT_TOKEN = "";
let OPENAI_API_KEY = "";
let GOOGLE_MAPS_KEY = "";
let TELEGRAM_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "TELEGRAM_BOT_TOKEN",
      "OPENAI_API_KEY",
      "GOOGLE_MAPS_KEY",
    ]);
    TELEGRAM_BOT_TOKEN = cfg["TELEGRAM_BOT_TOKEN"] || TELEGRAM_BOT_TOKEN;
    OPENAI_API_KEY = cfg["OPENAI_API_KEY"] || OPENAI_API_KEY;
    GOOGLE_MAPS_KEY = cfg["GOOGLE_MAPS_KEY"] || GOOGLE_MAPS_KEY;
    TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    _configLoaded = true;
    console.log("[telegram] ✅ Dynamic config loaded from system_configs");
  } catch (e) {
    console.warn("[telegram] ⚠️ Config load failed, using env fallbacks:", e);
    TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN || Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    OPENAI_API_KEY = OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY") || "";
    GOOGLE_MAPS_KEY = GOOGLE_MAPS_KEY || Deno.env.get("GOOGLE_MAPS_KEY") || "";
    TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════
// الرسائل العربية الثابتة
// ════════════════════════════════════════
const MESSAGES = {
  welcome: `هلا بيك عميلنا العزيز! 🚕\nعلمود نحسب لك السعر المضبوط، دز لنا موقعك الحالي بالضغط على الزر الموجود جوة هذه الرسالة 👇`,

  locationReceived: (address: string) =>
    `✅ عاشت ايدك، حددنا مكانك في: 📍 ${address}\nهسة تكدر دز بصمة صوتية 🎙️ وكول وين تريد تروح؟ وتكدر تكتب همات.`,

  needLocationFirst: `عفواً، لازم تدز موقعك أول شي! 👇\nاضغط على زر "📍 مشاركة موقعي الحالي" الموجود بلوحة المفاتيح.`,

  processing: "جاري تحليل طلبك... 🤖",

  noTranscript: "❌ ما كدرت أفهم الصوت. جرب مرة ثانية بصوت أوضح.",

  noDestination: `❌ ما فهمت الوجهة. كول مثلاً:\n"أريد أروح لجامعة الأنبار"\nأو اكتبها بالنص.`,

  geocodeFailed: (place: string) =>
    `❌ ما كدرت ألاقي "${place}" على الخريطة بالرمادي. جرب تكول اسم أوضح.`,

  bookingConfirmed: (origin: string, destination: string, fare: number, rideId: string) =>
    `✅ تم الحجز بنجاح!\n📍 من: ${origin}\n🏁 إلى: ${destination}\n💰 السعر التقديري: ${fare.toLocaleString()} د.ع\n🔖 رقم الرحلة: ${rideId.substring(0, 8)}\n\nجاري إبلاغ أقرب كابتن عليك... 🚗`,

  confirmationPrompt: (origin: string, destination: string, fare: number, distanceKm: number) =>
    `🚕 <b>تأكيد الرحلة</b>\n\n📍 <b>من:</b> ${origin}\n🏁 <b>إلى:</b> ${destination}\n📏 <b>المسافة:</b> ${distanceKm.toFixed(1)} كم\n💰 <b>السعر التقديري:</b> ${fare.toLocaleString()} د.ع\n\nهل تريد تأكيد الرحلة؟ 👇`,

  rideConfirmed: `✅ <b>تم تأكيد الطلب!</b>\nجاري إبلاغ أقرب كابتن عليك... 🚗`,

  rideCancelled: `🚫 <b>تم إلغاء الطلب.</b>\nتكدر تطلب رحلة جديدة بأي وقت! 🚕`,

  newRide: `هل تريد رحلة جديدة؟ 🚕\nدز موقعك الحالي مرة ثانية 👇`,
};

// ════════════════════════════════════════
// مساعد: إرسال رسالة مع لوحة مفاتيح الموقع
// ════════════════════════════════════════
async function sendWithLocationKeyboard(chatId: number, text: string) {
  const url = `${TELEGRAM_API}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        keyboard: [
          [{ text: "📍 مشاركة موقعي الحالي", request_location: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }),
  });
  const result = await res.text();
  console.log(`[telegram] sendWithLocationKeyboard (${res.status}): ${result.substring(0, 200)}`);
}

// ════════════════════════════════════════
// مساعد: إرسال رسالة عادية
// ════════════════════════════════════════
async function directSend(chatId: number, text: string) {
  const url = `${TELEGRAM_API}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const result = await res.text();
    console.log(`[telegram] directSend (${res.status}): ${result.substring(0, 200)}`);
  } catch (e) {
    console.error("[telegram] Failed to send message:", e);
  }
}

// ════════════════════════════════════════
// مساعد: إرسال رسالة مع إزالة لوحة المفاتيح
// ════════════════════════════════════════
async function sendAndRemoveKeyboard(chatId: number, text: string) {
  const url = `${TELEGRAM_API}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { remove_keyboard: true },
    }),
  });
  const result = await res.text();
  console.log(`[telegram] sendAndRemoveKeyboard (${res.status}): ${result.substring(0, 200)}`);
}

// ════════════════════════════════════════
// مساعد: الرد على Callback Query
// ════════════════════════════════════════
async function answerCallbackQuery(callbackQueryId: string, text: string) {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (e) {
    console.error("[telegram] answerCallbackQuery failed:", e);
  }
}

// ════════════════════════════════════════
// مساعد: تعديل رسالة وإزالة الأزرار
// ════════════════════════════════════════
async function editMessageRemoveButtons(chatId: number, messageId: number, newText: string) {
  try {
    const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[telegram] editMessageText failed:", err);
    }
  } catch (e) {
    console.error("[telegram] editMessageRemoveButtons failed:", e);
  }
}

// ════════════════════════════════════════
// مساعد: إرسال رسالة مع أزرار inline
// ════════════════════════════════════════
async function sendInlineKeyboard(
  chatId: number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>
) {
  const url = `${TELEGRAM_API}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      }),
    });
    const result = await res.text();
    console.log(`[telegram] sendInlineKeyboard (${res.status}): ${result.substring(0, 200)}`);
  } catch (e) {
    console.error("[telegram] sendInlineKeyboard failed:", e);
  }
}

// ════════════════════════════════════════
// مساعد: تحميل ملف الصوت من تيليغرام
// ════════════════════════════════════════
async function downloadTelegramFile(fileId: string): Promise<Uint8Array> {
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error("فشل جلب معلومات الملف من تيليغرام");
  }

  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
  const audioRes = await fetch(downloadUrl);

  if (!audioRes.ok) {
    throw new Error("فشل تحميل الملف الصوتي من تيليغرام");
  }

  return new Uint8Array(await audioRes.arrayBuffer());
}

// ════════════════════════════════════════
// Whisper: تحويل الصوت لنص
// ════════════════════════════════════════
async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<string> {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "ogg";

  const formData = new FormData();
  formData.append("file", new Blob([audioBytes.buffer as ArrayBuffer], { type: mimeType }), `voice.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "ar");
  formData.append("prompt",
    "لهجة عراقية من مدينة الرمادي، محافظة الأنبار. " +
    "شوارع مرقمة: شارع 20، شارع 17، شارع 60، شارع 40، شارع 10، شارع 30. " +
    "أماكن مثل جامعة الأنبار، مستشفى الرمادي التعليمي، " +
    "شارع المستودع، حي التأميم، حي الحوز، تقاطع الزيوت، حي الملعب، البوعلوان، الشارع العام، " +
    "حي العزيزية، السوق المركزي، خمسة كيلو، حي الضباط، حي الورار، حي الأندلس، حي المعلمين، " +
    "الجسر الحديدي، مبنى المحافظة، حي القطانة، حي الثيلة، حي السفحة، حي البوذياب، " +
    "حي العشرين، حي البكر، حي الروضة، حي الجزيرة، شارع فلسطين، حي السلام"
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.text || "";
}

// ════════════════════════════════════════
// GPT-4o: استخراج الوجهة فقط (الموقع يأتي من GPS)
// ════════════════════════════════════════
interface ExtractedDestination {
  destination_search_query: string;
  vehicle_type: "economy" | "comfort" | "premium" | "women_only";
  notes: string | null;
}

async function extractDestination(transcript: string, userLat = 33.4233, userLng = 43.2974): Promise<ExtractedDestination> {
  const systemPrompt = `You are an intelligent taxi dispatcher for Al Anbar Governorate (محافظة الأنبار), Iraq.

Context for this session:
- The user is currently located at coordinates: LAT ${userLat.toFixed(4)}, LNG ${userLng.toFixed(4)}.
- The operational area is the ENTIRE Al Anbar Governorate (e.g., Ramadi, Fallujah, Hit, Haditha, etc.).
- When the user asks to go to a named place (e.g., a restaurant, hospital, or market), you MUST assume they mean the branch or location NEAREST to their current coordinates. Do not assume Ramadi if they are starting from Fallujah.

The user has ALREADY shared their GPS pickup location. Now they are telling you their DESTINATION only.
The user speaks in Iraqi Arabic dialect.

Your ONLY job: Extract the destination name EXACTLY as the user says it.

⚠️ STRICT RULE — NUMBERED STREETS:
If the user provides a numbered street (e.g., "شارع 20", "شارع 60", "شارع 17"), YOU MUST KEEP IT EXACTLY AS IS.
DO NOT convert it to a famous landmark or a different street name.
Examples:
  Input: "شارع 20" → Output: "شارع 20" (NOT "شارع المستودع" or anything else)
  Input: "شارع 17" → Output: "شارع 17"
  Input: "شارع 60" → Output: "شارع 60"
Only use famous landmark names if the user EXPLICITLY says them by name.

Critical Rules:
1. Every landmark mentioned is in RAMADI — never assume another city.
2. Output the destination name as a clean Arabic search query — do NOT add "الرمادي" yourself, the geocoding system handles that.
3. If the user says "أريد أروح" or "وديني" or "لـ" → what follows is the destination.
4. If the user just says a place name, that IS the destination.
5. Keep the name natural: "جامعة الأنبار" not "جامعة الأنبار، الرمادي، العراق".
6. If the user mentions vehicle preference: فخمة/فاخرة → premium, مريحة → comfort, نسائي/بنات → women_only. Otherwise "economy".
7. Extract any notes (مستعجل، قرب الصيدلية، etc).
8. NEVER return an error message. ALWAYS try to extract a destination. Even partial names are useful.
9. NEVER rename, translate, or "correct" the user's destination. Return their words verbatim.

═══ GEOGRAPHIC & OUT-OF-BOUNDS RULES (CRITICAL): ═══
You must analyze the user's requested destination. If it is OUTSIDE Iraq, you MUST reject the ride.
Do NOT extract it as a destination. Instead, set destination_search_query to "__OUT_OF_BOUNDS__" and put the rejection message in notes.

Rejection rules by region:
1. **Iran or Israel:** notes = "لا نعمل هنا مطلقاً."
2. **Neighboring Countries (Jordan, Syria, Saudi Arabia, Kuwait, Turkey):** notes = "نعتذر، لا نعمل الآن في [اسم الدولة]."
3. **Other Arab/Asian/Gulf Countries (UAE, Qatar, Egypt, Lebanon, etc.):** notes = "بعدنا ما فتحنا فرع في [اسم الدولة]! 😅 خدماتنا حالياً تقتصر على العراق وتحديداً الأنبار، بس نوصلكم ندزلك خبر!"
4. **Far Countries (Europe, Americas, Australia, etc.):** notes = "عذراً، ران إلى الآن لم تمتلك طائرة ✈️! خدماتنا مخصصة للسيارات داخل العراق فقط."

CRITICAL: Do NOT attempt to geocode or calculate prices for out-of-bounds locations.

Well-known Ramadi landmarks (for reference only — do NOT substitute user input with these):
جامعة الأنبار، مستشفى الرمادي التعليمي، دائرة صحة الأنبار، حي التأميم، حي الحوز، حي الملعب، حي الضباط، حي العزيزية، حي 5 كيلو، حي العشرين، حي البكر، حي الورار، حي السلام، تقاطع الزيوت، شارع المستودع، الشارع العام، السوق المركزي، البوعلوان، حي المعلمين، حي الأندلس، الجسر الحديدي، مبنى المحافظة، ملعب الرمادي، حي الثيلة، حي القطانة، حي السفحة، حي البوذياب، شارع 60، شارع فلسطين، حي الروضة، حي الجزيرة

Respond in JSON ONLY:
{
  "destination_search_query": "اسم الوجهة كما قالها المستخدم — حرفياً",
  "vehicle_type": "economy",
  "notes": null
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GPT-4o API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from GPT-4o");

  return JSON.parse(content);
}

// ════════════════════════════════════════
// 🕒 GPT-4o: استخراج تفاصيل الحجز المجدول
// ════════════════════════════════════════
interface ScheduledRideDetails {
  pickup_query: string;
  dropoff_query: string;
  scheduled_time: string | null;
  vehicle_type: "economy" | "comfort" | "premium" | "women_only";
  notes: string | null;
  is_valid: boolean;
  error_reply: string | null;
}

async function extractScheduledRideDetails(userText: string, userName: string): Promise<ScheduledRideDetails> {
  const now = new Date().toISOString();
  const systemPrompt = `You are 'Raan' (ران), a polite Iraqi taxi dispatcher bot in Ramadi, Al Anbar, Iraq.
User Name: ${userName}
Current Time: ${now}

The user wants to schedule a future ride. Extract:
1. **pickup_query**: Where they want to be picked up (Arabic place name). If they say "بيتي" or "من عندي", return "موقع المستخدم".
2. **dropoff_query**: Where they want to go (Arabic place name).
3. **scheduled_time**: The EXACT date+time in ISO 8601 format (Baghdad timezone UTC+3). Parse relative times:
   - "غداً الساعة 8 صباحاً" → tomorrow at 05:00 UTC (08:00 Baghdad)
   - "بعد ساعتين" → current time + 2 hours
   - "الخميس 3 العصر" → next Thursday at 12:00 UTC (15:00 Baghdad)
   If no time is given, set to null.
4. **vehicle_type**: فخمة/فاخرة → premium, مريحة → comfort, نسائي → women_only, otherwise "economy".
5. **notes**: Any extra info.
6. **is_valid**: true if both pickup and dropoff are extractable. false if message is too vague.
7. **error_reply**: If is_valid is false, provide a polite Iraqi dialect error asking for clarification.

Respond in JSON ONLY:
{
  "pickup_query": "",
  "dropoff_query": "",
  "scheduled_time": null,
  "vehicle_type": "economy",
  "notes": null,
  "is_valid": true,
  "error_reply": null
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      return { pickup_query: "", dropoff_query: "", scheduled_time: null, vehicle_type: "economy", notes: null, is_valid: false, error_reply: `عذراً أستاذ ${userName}، ما فهمت طلبك. جرب مرة ثانية 🙏` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { pickup_query: "", dropoff_query: "", scheduled_time: null, vehicle_type: "economy", notes: null, is_valid: false, error_reply: `عذراً أستاذ ${userName}، ما فهمت طلبك. جرب مرة ثانية 🙏` };
    }

    const parsed = JSON.parse(content);
    return {
      pickup_query: parsed.pickup_query || "",
      dropoff_query: parsed.dropoff_query || "",
      scheduled_time: parsed.scheduled_time || null,
      vehicle_type: parsed.vehicle_type || "economy",
      notes: parsed.notes || null,
      is_valid: parsed.is_valid !== false,
      error_reply: parsed.error_reply || null,
    };
  } catch (err) {
    console.error("[schedule] Error:", err);
    return { pickup_query: "", dropoff_query: "", scheduled_time: null, vehicle_type: "economy", notes: null, is_valid: false, error_reply: `عذراً أستاذ ${userName}، حدث خطأ تقني. حاول مرة ثانية ⚠️` };
  }
}

// ════════════════════════════════════════
// Geocoding: بحث متعدد الاستراتيجيات مقيد بالرمادي
// ════════════════════════════════════════
interface ResolvedLocation {
  lat: number;
  lng: number;
  address: string;
}

// ── قاعدة بيانات أماكن الرمادي المعروفة (الاستراتيجية 0) ──
const RAMADI_LANDMARKS: Record<string, { lat: number; lng: number; address: string; aliases: string[] }> = {
  "جامعة الأنبار": { lat: 33.4350, lng: 43.2650, address: "جامعة الأنبار، الرمادي", aliases: ["جامعة الانبار", "الجامعة", "جامعة انبار", "university of anbar", "جامعة"] },
  "مستشفى الرمادي التعليمي": { lat: 33.4280, lng: 43.3050, address: "مستشفى الرمادي التعليمي", aliases: ["المستشفى", "مستشفى الرمادي", "المستشفى التعليمي", "رمادي تعليمي"] },
  "دائرة صحة الأنبار": { lat: 33.4260, lng: 43.3010, address: "دائرة صحة الأنبار، الرمادي", aliases: ["صحة الانبار", "دائرة الصحة", "صحة الأنبار"] },
  "حي التأميم": { lat: 33.4350, lng: 43.3100, address: "حي التأميم، الرمادي", aliases: ["التأميم", "تأميم", "التاميم", "تاميم"] },
  "حي الحوز": { lat: 33.4200, lng: 43.3150, address: "حي الحوز، الرمادي", aliases: ["الحوز", "حوز"] },
  "حي الملعب": { lat: 33.4300, lng: 43.2900, address: "حي الملعب، الرمادي", aliases: ["الملعب", "ملعب الرمادي", "ملعب"] },
  "حي الضباط": { lat: 33.4150, lng: 43.2850, address: "حي الضباط، الرمادي", aliases: ["الضباط", "ضباط"] },
  "حي العزيزية": { lat: 33.4180, lng: 43.3200, address: "حي العزيزية، الرمادي", aliases: ["العزيزية", "عزيزية"] },
  "حي 5 كيلو": { lat: 33.4100, lng: 43.2750, address: "حي خمسة كيلو، الرمادي", aliases: ["5 كيلو", "خمسة كيلو", "خمس كيلو", "٥ كيلو", "5كيلو", "خمسه كيلو"] },
  "حي العشرين": { lat: 33.4220, lng: 43.2800, address: "حي العشرين، الرمادي", aliases: ["العشرين", "عشرين"] },
  "حي البكر": { lat: 33.4280, lng: 43.2950, address: "حي البكر، الرمادي", aliases: ["البكر", "بكر"] },
  "حي الورار": { lat: 33.4320, lng: 43.3200, address: "حي الورار، الرمادي", aliases: ["الورار", "ورار"] },
  "حي السلام": { lat: 33.4250, lng: 43.2700, address: "حي السلام، الرمادي", aliases: ["السلام", "سلام"] },
  "تقاطع الزيوت": { lat: 33.4240, lng: 43.3000, address: "تقاطع الزيوت، الرمادي", aliases: ["الزيوت", "زيوت", "تقاطع زيوت"] },
  "شارع المستودع": { lat: 33.4200, lng: 43.2950, address: "شارع المستودع، الرمادي", aliases: ["المستودع", "مستودع"] },
  "الشارع العام": { lat: 33.4230, lng: 43.3000, address: "الشارع العام، الرمادي", aliases: ["شارع عام"] },
  "السوق المركزي": { lat: 33.4235, lng: 43.3020, address: "السوق المركزي، الرمادي", aliases: ["السوق", "سوق الرمادي", "سوق مركزي"] },
  "البوعلوان": { lat: 33.4400, lng: 43.2800, address: "البوعلوان، الرمادي", aliases: ["بوعلوان", "بو علوان"] },
  "حي المعلمين": { lat: 33.4150, lng: 43.3050, address: "حي المعلمين، الرمادي", aliases: ["المعلمين", "معلمين"] },
  "حي الأندلس": { lat: 33.4100, lng: 43.3100, address: "حي الأندلس، الرمادي", aliases: ["الأندلس", "الاندلس", "أندلس", "اندلس"] },
  "الجسر الحديدي": { lat: 33.4230, lng: 43.3080, address: "الجسر الحديدي، الرمادي", aliases: ["جسر حديدي", "الجسر"] },
  "مبنى المحافظة": { lat: 33.4240, lng: 43.3040, address: "مبنى المحافظة، الرمادي", aliases: ["المحافظة", "محافظة الأنبار", "محافظة الانبار", "محافظة"] },
  "حي الثيلة": { lat: 33.4300, lng: 43.3150, address: "حي الثيلة، الرمادي", aliases: ["الثيلة", "ثيلة"] },
  "حي القطانة": { lat: 33.4270, lng: 43.3180, address: "حي القطانة، الرمادي", aliases: ["القطانة", "قطانة"] },
  "حي السفحة": { lat: 33.4350, lng: 43.3050, address: "حي السفحة، الرمادي", aliases: ["السفحة", "سفحة"] },
  "حي البوذياب": { lat: 33.4380, lng: 43.2900, address: "حي البوذياب، الرمادي", aliases: ["البوذياب", "بوذياب", "بو ذياب"] },
  "شارع 60": { lat: 33.4200, lng: 43.2700, address: "شارع 60، الرمادي", aliases: ["شارع ستين", "ستين"] },
  "شارع فلسطين": { lat: 33.4250, lng: 43.2950, address: "شارع فلسطين، الرمادي", aliases: ["فلسطين"] },
  "حي الروضة": { lat: 33.4180, lng: 43.2900, address: "حي الروضة، الرمادي", aliases: ["الروضة", "روضة"] },
  "حي الجزيرة": { lat: 33.4300, lng: 43.2800, address: "حي الجزيرة، الرمادي", aliases: ["الجزيرة", "جزيرة"] },
  "مكتب الرؤية": { lat: 33.4230, lng: 43.3010, address: "مكتب الرؤية، الرمادي", aliases: ["الرؤية", "رؤية", "مكتب رؤية"] },
  "حي التقدم": { lat: 33.4100, lng: 43.2650, address: "حي التقدم، الرمادي", aliases: ["التقدم", "تقدم"] },
  "حي الطيران": { lat: 33.4050, lng: 43.2800, address: "حي الطيران، الرمادي", aliases: ["الطيران", "طيران"] },
  "حي الصوفية": { lat: 33.4280, lng: 43.3100, address: "حي الصوفية، الرمادي", aliases: ["الصوفية", "صوفية"] },
  "حي الجمهوري": { lat: 33.4210, lng: 43.3060, address: "حي الجمهوري، الرمادي", aliases: ["الجمهوري", "جمهوري"] },
  "حي الشرطة": { lat: 33.4190, lng: 43.2980, address: "حي الشرطة، الرمادي", aliases: ["الشرطة", "شرطة"] },
  "حي المعاضيد": { lat: 33.4330, lng: 43.2970, address: "حي المعاضيد، الرمادي", aliases: ["المعاضيد", "معاضيد"] },
  "مجمع ران التجاري": { lat: 33.4225, lng: 43.2990, address: "مجمع ران التجاري، الرمادي", aliases: ["مجمع ران", "ران التجاري"] },
  "قضاء الفلوجة": { lat: 33.3530, lng: 43.7830, address: "الفلوجة، الأنبار", aliases: ["الفلوجة", "فلوجة"] },
  "قضاء هيت": { lat: 33.6390, lng: 42.8270, address: "هيت، الأنبار", aliases: ["هيت"] },
  "قضاء حديثة": { lat: 34.1370, lng: 42.3790, address: "حديثة، الأنبار", aliases: ["حديثة"] },
};

function matchLocalLandmark(query: string): ResolvedLocation | null {
  const q = query.trim().toLowerCase().replace(/[.,،\-_]/g, "");

  // مطابقة مباشرة بالاسم
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    if (q === name.toLowerCase() || q === name.toLowerCase().replace("حي ", "")) {
      console.log(`[geocode] LOCAL MATCH (exact): "${query}" → ${name}`);
      return { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
  }

  // مطابقة بـ aliases
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    for (const alias of loc.aliases) {
      if (q === alias.toLowerCase() || q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
        console.log(`[geocode] LOCAL MATCH (alias "${alias}"): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  // مطابقة جزئية — يحتوي الاسم على كلمات الاستعلام
  const words = q.split(/\s+/).filter((w: string) => w.length > 2);
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    const nameLower = name.toLowerCase();
    const allAliases = [nameLower, ...loc.aliases.map((a: string) => a.toLowerCase())];
    for (const target of allAliases) {
      if (words.every((w: string) => target.includes(w))) {
        console.log(`[geocode] LOCAL MATCH (partial): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  return null;
}

// ── Nominatim (OpenStreetMap) — بديل مجاني بدون مفتاح ──
async function nominatimGeocode(query: string, userLat = 33.4233, userLng = 43.2974): Promise<ResolvedLocation | null> {
  try {
    // بناء viewbox ديناميكي حول موقع المستخدم (±0.35/0.25 درجة ≈ 25-35 كم)
    const vbMinLng = (userLng - 0.35).toFixed(2);
    const vbMinLat = (userLat - 0.25).toFixed(2);
    const vbMaxLng = (userLng + 0.35).toFixed(2);
    const vbMaxLat = (userLat + 0.25).toFixed(2);
    const viewbox = `${vbMinLng},${vbMinLat},${vbMaxLng},${vbMaxLat}`;

    const searches = [
      `${query}, العراق`,
      `${query}, الأنبار, العراق`,
      `${query}, Anbar, Iraq`,
    ];

    for (const searchText of searches) {
      const params = new URLSearchParams({
        q: searchText,
        format: "json",
        limit: "3",
        countrycodes: "iq",
        viewbox,
        bounded: "0",
        "accept-language": "ar",
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "RAAN-Taxi-App/1.0" },
      });

      if (!response.ok) {
        console.log(`[nominatim] HTTP error: ${response.status}`);
        continue;
      }

      const results = await response.json();
      console.log(`[nominatim] "${searchText}": ${results.length} results`);

      if (results.length > 0) {
        const best = results[0];
        const lat = parseFloat(best.lat);
        const lng = parseFloat(best.lon);

        // التحقق من القرب من موقع المستخدم
        const dist = haversineDistance(lat, lng, userLat, userLng);
        if (dist <= 80) {
          console.log(`[nominatim] MATCH: ${best.display_name} (${dist.toFixed(1)} km from center)`);
          return {
            lat,
            lng,
            address: best.display_name?.split(",").slice(0, 3).join("،") || query,
          };
        }
        console.log(`[nominatim] Rejected — too far: ${dist.toFixed(1)} km`);
      }
    }
  } catch (err) {
    console.error("[nominatim] Error:", err);
  }
  return null;
}

async function resolveRamadiLocation(query: string, userLat = 33.4233, userLng = 43.2974): Promise<ResolvedLocation | null> {
  const cleanQuery = query.replace(/[.,،]/g, "").trim();
  console.log(`[geocode] Resolving: "${cleanQuery}" (user@${userLat.toFixed(4)},${userLng.toFixed(4)})`);

  // ── الاستراتيجية 0: قاعدة بيانات أماكن الرمادي المحلية (فوري)
  const localMatch = matchLocalLandmark(cleanQuery);
  if (localMatch) return localMatch;

  // ── الاستراتيجية 1: Nominatim (OpenStreetMap - مجاني مع location bias)
  console.log("[geocode] No local match, trying Nominatim...");
  const nominatimResult = await nominatimGeocode(cleanQuery, userLat, userLng);
  if (nominatimResult) return nominatimResult;

  // بناء bounds ديناميكي حول موقع المستخدم
  const boundsStr = `${(userLat - 0.25).toFixed(2)},${(userLng - 0.35).toFixed(2)}|${(userLat + 0.25).toFixed(2)},${(userLng + 0.35).toFixed(2)}`;

  // ── الاستراتيجية 2: Google Geocoding مباشرة
  console.log("[geocode] Nominatim failed, trying Google Geocoding...");
  let params = new URLSearchParams({
    address: cleanQuery,
    key: GOOGLE_MAPS_KEY,
    language: "ar",
    components: "country:IQ",
    bounds: boundsStr,
  });

  let response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  let data = await response.json();
  console.log(`[geocode] Google direct: status=${data.status}, results=${data.results?.length || 0}`);
  if (data.error_message) console.log(`[geocode] Google error: ${data.error_message}`);

  // ── الاستراتيجية 3: Google + "الأنبار"
  if (data.status !== "OK" || !data.results?.length) {
    params.set("address", `${cleanQuery} الأنبار`);
    response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    data = await response.json();
    console.log(`[geocode] Google +الأنبار: status=${data.status}, results=${data.results?.length || 0}`);
  }

  // ── الاستراتيجية 4: Google + "الأنبار العراق"
  if (data.status !== "OK" || !data.results?.length) {
    params.set("address", `${cleanQuery} الأنبار العراق`);
    response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    data = await response.json();
    console.log(`[geocode] Google +الأنبار: status=${data.status}, results=${data.results?.length || 0}`);
  }

  // ── الاستراتيجية 5: Google Places Text Search
  if (data.status !== "OK" || !data.results?.length) {
    console.log("[geocode] Trying Places Text Search...");
    const placesParams = new URLSearchParams({
      query: `${cleanQuery} الأنبار العراق`,
      key: GOOGLE_MAPS_KEY,
      language: "ar",
      location: `${userLat},${userLng}`,
      radius: "50000",
    });
    response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${placesParams}`);
    const placesData = await response.json();
    console.log(`[geocode] Places: status=${placesData.status}, results=${placesData.results?.length || 0}`);

    if (placesData.status === "OK" && placesData.results?.[0]) {
      const place = placesData.results[0];
      return {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        address: place.formatted_address || place.name,
      };
    }
  }

  // ── فشل كل المحاولات
  if (data.status !== "OK" || !data.results?.[0]) {
    console.error(`[geocode] ALL strategies failed for: "${query}"`);
    return null;
  }

  // ── التحقق: النتيجة في الأنبار/الرمادي أو قريبة جغرافياً
  const result = data.results[0];
  const addressComponents = result.address_components || [];
  const formattedAddress = result.formatted_address || "";

  const isAnbar = addressComponents.some(
    (c: { long_name: string }) =>
      c.long_name.includes("Anbar") ||
      c.long_name.includes("الأنبار") ||
      c.long_name.includes("الرمادي") ||
      c.long_name.includes("Ramadi")
  ) || formattedAddress.includes("الأنبار") || formattedAddress.includes("Anbar") || formattedAddress.includes("Ramadi");

  if (!isAnbar) {
    // فحص المسافة: هل الإحداثيات قريبة من موقع المستخدم (80 كم)؟
    const distFromCenter = haversineDistance(
      result.geometry.location.lat,
      result.geometry.location.lng,
      userLat,
      userLng
    );
    if (distFromCenter > 80) {
      console.log(`[geocode] Rejected — too far (${distFromCenter.toFixed(1)} km): ${formattedAddress}`);
      return null;
    }
    console.log(`[geocode] Not labeled Anbar but within ${distFromCenter.toFixed(1)} km, accepting.`);
  }

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    address: formattedAddress,
  };
}

// ════════════════════════════════════════
// Reverse Geocoding محسّن: إحداثيات → عنوان مختصر
// ════════════════════════════════════════

/**
 * استخراج عنوان مختصر (حي + مدينة) من نتائج Google Geocoding
 * يرجع عنوان مثل: "حي التأميم، الرمادي" أو "شارع المستودع، الرمادي"
 */
function extractConciseAddress(results: any[]): string | null {
  try {
    const result = results[0];
    const components = result.address_components || [];

    let neighborhood = "";
    let route = "";
    let sublocality = "";
    let locality = "";
    let adminArea = "";

    for (const comp of components) {
      const types = comp.types || [];
      if (types.includes("neighborhood")) neighborhood = comp.long_name;
      if (types.includes("route")) route = comp.long_name;
      if (types.includes("sublocality") || types.includes("sublocality_level_1")) sublocality = comp.long_name;
      if (types.includes("locality")) locality = comp.long_name;
      if (types.includes("administrative_area_level_1")) adminArea = comp.long_name;
    }

    const city = locality || adminArea || "الرمادي";
    const area = neighborhood || route || sublocality;

    if (area && city) return `${area}، ${city}`;
    if (area) return area;
    if (city) return city;

    const shortest = results
      .map((r: any) => r.formatted_address)
      .filter(Boolean)
      .sort((a: string, b: string) => a.length - b.length)[0];
    return shortest || null;
  } catch {
    return null;
  }
}

/**
 * Reverse Geocode محسّن:
 * 1. Google Maps Geocoding API (عنوان مختصر)
 * 2. Nominatim/OpenStreetMap كاحتياط مجاني
 * 3. إحداثيات خام كملاذ أخير
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // ── المحاولة 1: Google Maps Geocoding API ──
  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: GOOGLE_MAPS_KEY,
      language: "ar",
      result_type: "street_address|neighborhood|sublocality|locality",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const concise = extractConciseAddress(data.results);
      if (concise) {
        console.log(`[reverse-geocode] Google concise: ${concise}`);
        return concise;
      }
      return data.results[0].formatted_address;
    }
    console.warn(`[reverse-geocode] Google status: ${data.status}`, data.error_message || "");
  } catch (e) {
    console.error("[reverse-geocode] Google error:", e);
  }

  // ── المحاولة 2: Nominatim (OpenStreetMap) مجاني ──
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&zoom=18`;
    const response = await fetch(nominatimUrl, {
      headers: { "User-Agent": "RaanTaxiBot/1.0" },
    });
    const data = await response.json();
    if (data && data.address) {
      const addr = data.address;
      const area = addr.neighbourhood || addr.suburb || addr.road || addr.quarter || "";
      const city = addr.city || addr.town || addr.state || "الرمادي";
      if (area && city) {
        console.log(`[reverse-geocode] Nominatim: ${area}، ${city}`);
        return `${area}، ${city}`;
      }
      if (data.display_name) {
        const parts = data.display_name.split(",").map((s: string) => s.trim()).filter(Boolean);
        const short = parts.slice(0, 2).join("، ");
        console.log(`[reverse-geocode] Nominatim display: ${short}`);
        return short;
      }
    }
  } catch (e) {
    console.error("[reverse-geocode] Nominatim error:", e);
  }

  // ── الملاذ الأخير: إحداثيات خام ──
  console.warn(`[reverse-geocode] All strategies failed, returning raw coords`);
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ════════════════════════════════════════
// Haversine: حساب المسافة بالكيلومتر
// ════════════════════════════════════════
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ════════════════════════════════════════
// حساب أجرة تقديرية
// ════════════════════════════════════════
function estimateFare(distanceKm: number): number {
  const baseFare = 2000;
  const perKmRate = 1000;
  const raw = baseFare + distanceKm * perKmRate;
  return Math.ceil(raw / 250) * 250;
}

// ════════════════════════════════════════
// البحث عن أو إنشاء مستخدم تيليغرام
// ════════════════════════════════════════
async function findOrCreateTelegramUser(
  supabase: any,
  telegramUser: { id: number; first_name?: string; last_name?: string; username?: string }
): Promise<string> {
  const telegramRef = `tg_${telegramUser.id}`;
  const email = `tg_${telegramUser.id}@telegram.raan.app`;
  const displayName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || "راكب تيليغرام";

  // ── 1. البحث في profiles بالـ phone أو email
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .or(`phone.eq.${telegramRef},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (existing?.user_id) {
    console.log(`[auth] Found existing user in profiles: ${existing.user_id}`);
    return existing.user_id;
  }

  // ── 2. محاولة إنشاء مستخدم جديد
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      source: "telegram",
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username,
    },
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already been registered")) {
      // ── المستخدم موجود في auth لكن مو بـ profiles — ابحث عنه بـ GoTrue Admin API
      console.log(`[auth] User exists in auth, looking up via GoTrue filter...`);
      const lookupRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      const lookupData = await lookupRes.json();
      const foundUser = lookupData.users?.[0];

      if (!foundUser?.id) {
        console.error(`[auth] Could not find user by GoTrue filter. Response:`, JSON.stringify(lookupData));
        throw new Error("User registered but not found in admin lookup");
      }

      userId = foundUser.id;
      console.log(`[auth] Found via GoTrue: ${userId}`);
    } else {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }
  } else if (!authData?.user) {
    throw new Error("Failed to create auth user: no user returned");
  } else {
    userId = authData.user.id;
    console.log(`[auth] Created new auth user: ${userId}`);
  }

  // ── إنشاء/تحديث profile
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: displayName,
    phone: telegramRef,
    email,
    status: "active",
  });

  console.log(`[auth] Created new telegram user: ${userId}`);
  return userId;
}

// ════════════════════════════════════════
// إدارة الحالة: البحث عن session معلّقة
// (draft ride بدون dropoff_address = ينتظر الوجهة)
// ════════════════════════════════════════
interface PendingSession {
  ride_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
}

async function findPendingSession(
  supabase: any,
  riderId: string
): Promise<PendingSession | null> {
  const { data } = await supabase
    .from("rides")
    .select("id, pickup_location, pickup_address, dropoff_address")
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "telegram")
    .is("dropoff_address", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const pickup = data.pickup_location as { lat: number; lng: number } | null;
  if (!pickup?.lat) return null;

  return {
    ride_id: data.id,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    pickup_address: data.pickup_address || "موقعك",
  };
}

// ════════════════════════════════════════
// إنشاء session جديدة (رحلة draft بالموقع فقط — غير مرئية للسائقين)
// ════════════════════════════════════════
async function createPickupSession(
  supabase: any,
  riderId: string,
  lat: number,
  lng: number,
  address: string
): Promise<string> {
  // 🔥 SECURITY: إلغاء أي رحلات نشطة سابقة (راكب واحد = رحلة واحدة فقط)
  const { data: cancelledRides } = await supabase
    .from("rides")
    .update({ status: "cancelled", cancelled_by: "system", cancellation_reason: "تم إلغاؤها تلقائياً: طلب رحلة جديدة" })
    .eq("rider_id", riderId)
    .in("status", ["pending", "accepted", "arrived", "in_progress"])
    .select("id");

  if (cancelledRides && cancelledRides.length > 0) {
    console.log(`[telegram] 🔥 Auto-cancelled ${cancelledRides.length} active ride(s) for rider ${riderId}`);
  }

  // حذف sessions قديمة غير مكتملة (draft فقط)
  await supabase
    .from("rides")
    .delete()
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "telegram")
    .is("dropoff_address", null);

  // إنشاء session جديدة بحالة draft (لا تظهر للسائقين حتى التأكيد)
  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_id: riderId,
      status: "draft",
      pickup_location: { lat, lng },
      pickup_address: address,
      dropoff_location: { lat: 0, lng: 0 },
      dropoff_address: null,
      vehicle_type: "economy",
      payment_method: "cash",
      trip_type: "telegram",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data.id;
}

// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
serve(async (req) => {
  // تحميل الإعدادات الديناميكية من system_configs
  await loadDynamicConfig();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    console.error("[telegram] Failed to parse request body");
    return new Response("Bad Request", { status: 400, headers: corsHeaders });
  }

  console.log("[telegram] ===== NEW UPDATE =====");
  console.log("[telegram] Update:", JSON.stringify(update).substring(0, 800));

  // ═══════════════════════════════════
  // 🌟 معالجة Callback Query (تقييم الرحلة)
  // ═══════════════════════════════════
  if (update.callback_query) {
    const cbQuery = update.callback_query;
    const cbData = cbQuery.data || "";
    const cbChatId = cbQuery.message?.chat?.id;
    const cbMessageId = cbQuery.message?.message_id;

    console.log(`[telegram] Callback query: data="${cbData}", chat=${cbChatId}`);

    // rate_{ride_id}_{stars}
    const rateMatch = cbData.match(/^rate_([a-f0-9\-]+)_([1-5])$/);
    if (rateMatch && cbChatId) {
      const rideId = rateMatch[1];
      const stars = parseInt(rateMatch[2], 10);

      console.log(`[telegram] Rating: ride=${rideId}, stars=${stars}`);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        // 1. جلب تفاصيل الرحلة
        const { data: ride } = await supabase
          .from("rides")
          .select("rider_id, driver_id, status")
          .eq("id", rideId)
          .maybeSingle();

        if (!ride || ride.status !== "completed") {
          await answerCallbackQuery(cbQuery.id, "⚠️ الرحلة غير موجودة أو لم تكتمل بعد.");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        // 2. فحص تقييم سابق (بالـ ride_id فقط — unique constraint على ride_id)
        const { data: existingRating } = await supabase
          .from("ride_ratings")
          .select("id, rider_id")
          .eq("ride_id", rideId)
          .maybeSingle();

        if (existingRating) {
          // إذا الراكب سبق وقيّم — لا تعيد التقييم
          if (existingRating.rider_id === ride.rider_id) {
            await answerCallbackQuery(cbQuery.id, "✅ سبق وقيّمت هذه الرحلة!");
            await editMessageRemoveButtons(cbChatId, cbMessageId, "✅ سبق وقيّمت هذه الرحلة! شكراً لك 🌹");
            return new Response("OK", { status: 200, headers: corsHeaders });
          }

          // تقييم موجود (من السائق) — حدّثه بتقييم الراكب
          const { error: updateRatingError } = await supabase
            .from("ride_ratings")
            .update({
              rating: stars,
              rider_id: ride.rider_id,
              comment: "Telegram Rating",
            })
            .eq("id", existingRating.id);

          if (updateRatingError) {
            console.error("[telegram] Failed to update existing rating:", updateRatingError);
            await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ، حاول مرة أخرى.");
            return new Response("OK", { status: 200, headers: corsHeaders });
          }

          console.log(`[telegram] Updated existing rating for ride ${rideId}`);
        } else {
          // 3. لا يوجد تقييم سابق — أدرج جديد
          const { error: ratingError } = await supabase
            .from("ride_ratings")
            .insert({
              ride_id: rideId,
              rider_id: ride.rider_id,
              driver_id: ride.driver_id,
              rating: stars,
              comment: "Telegram Rating",
            });

          if (ratingError) {
            console.error("[telegram] Failed to insert rating:", ratingError);
            await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ، حاول مرة أخرى.");
            return new Response("OK", { status: 200, headers: corsHeaders });
          }
        }

        // 4. تحديث driver_rating في rides
        await supabase
          .from("rides")
          .update({ driver_rating: stars })
          .eq("id", rideId);

        // 5. تحديث متوسط تقييم السائق
        if (ride.driver_id) {
          const { data: allRatings } = await supabase
            .from("ride_ratings")
            .select("rating")
            .eq("driver_id", ride.driver_id);

          if (allRatings && allRatings.length > 0) {
            const avg = allRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / allRatings.length;
            await supabase
              .from("drivers")
              .update({ rating: Math.round(avg * 100) / 100 })
              .eq("id", ride.driver_id);
            console.log(`[telegram] Updated driver ${ride.driver_id} avg rating: ${avg.toFixed(2)}`);
          }
        }

        // 6. تعديل رسالة تيليغرام: إزالة الأزرار + رسالة شكر
        const starsText = "⭐".repeat(stars);
        await editMessageRemoveButtons(
          cbChatId,
          cbMessageId,
          `✅ <b>شكراً لتقييمك!</b> ${starsText}\n\nتقييمك يساعدنا نطور الخدمة. نتمنى نشوفك قريباً! 🌹`
        );

        await answerCallbackQuery(cbQuery.id, `شكراً! تقييمك ${stars} ⭐`);
        console.log(`[telegram] Rating saved: ride=${rideId}, stars=${stars}`);

      } catch (ratingErr) {
        console.error("[telegram] Rating error:", ratingErr);
        await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ تقني.");
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // ✅ تأكيد الرحلة
    // ═══════════════════════════════════
    const confirmMatch = cbData.match(/^confirm_ride_([a-f0-9\-]+)$/);
    if (confirmMatch && cbChatId) {
      const rideId = confirmMatch[1];
      console.log(`[telegram] Confirm ride: ${rideId}`);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        // التحقق من أن الرحلة لا تزال draft (بانتظار تأكيد الراكب)
        const { data: ride } = await supabase
          .from("rides")
          .select("id, status, dropoff_address")
          .eq("id", rideId)
          .maybeSingle();

        if (!ride) {
          await answerCallbackQuery(cbQuery.id, "⚠️ الرحلة غير موجودة.");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        if (ride.status !== "draft" || !ride.dropoff_address) {
          await answerCallbackQuery(cbQuery.id, "⚠️ هذه الرحلة تم معالجتها مسبقاً.");
          await editMessageRemoveButtons(cbChatId, cbMessageId, "⚠️ هذه الرحلة تم معالجتها مسبقاً.");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        // ✅ تغيير الحالة من draft إلى pending — الآن فقط يراها السائقون
        const { error: statusError } = await supabase
          .from("rides")
          .update({ status: "pending" })
          .eq("id", rideId)
          .eq("status", "draft");

        if (statusError) {
          console.error(`[telegram] Failed to update ride status to pending:`, statusError);
          await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ تقني.");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        console.log(`[telegram] Ride ${rideId} status changed: draft → pending`);

        // استدعاء match-ride لإيجاد سائق (الآن بعد أن أصبحت pending)
        try {
          await supabase.functions.invoke("match-ride", {
            body: { ride_id: rideId },
          });
          console.log(`[match] match-ride invoked for confirmed ride: ${rideId}`);
        } catch (matchErr) {
          console.warn("[match] match-ride failed (non-critical):", matchErr);
        }

        // تعديل الرسالة: إزالة الأزرار + رسالة تأكيد
        await editMessageRemoveButtons(cbChatId, cbMessageId, MESSAGES.rideConfirmed);
        await answerCallbackQuery(cbQuery.id, "✅ تم تأكيد الرحلة!");
        console.log(`[telegram] Ride ${rideId} confirmed by rider`);

      } catch (err) {
        console.error("[telegram] Confirm ride error:", err);
        await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ تقني.");
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // ❌ إلغاء الرحلة
    // ═══════════════════════════════════
    const cancelMatch = cbData.match(/^cancel_ride_([a-f0-9\-]+)$/);
    if (cancelMatch && cbChatId) {
      const rideId = cancelMatch[1];
      console.log(`[telegram] Cancel ride: ${rideId}`);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        // تحديث حالة الرحلة إلى cancelled (تعمل مع draft و pending)
        const { error: cancelError } = await supabase
          .from("rides")
          .update({
            status: "cancelled",
            cancellation_reason: "ألغيت من قبل الراكب قبل التأكيد (تيليغرام)",
          })
          .eq("id", rideId)
          .in("status", ["draft", "pending"]);

        if (cancelError) {
          console.error("[telegram] Cancel ride DB error:", cancelError);
        }

        // تعديل الرسالة: إزالة الأزرار + رسالة إلغاء
        await editMessageRemoveButtons(cbChatId, cbMessageId, MESSAGES.rideCancelled);
        await answerCallbackQuery(cbQuery.id, "🚫 تم إلغاء الطلب");
        console.log(`[telegram] Ride ${rideId} cancelled by rider before confirmation`);

      } catch (err) {
        console.error("[telegram] Cancel ride error:", err);
        await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ تقني.");
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // � حجز رحلة (من قائمة الترحيب)
    // ═══════════════════════════════════
    if (cbData === "action_book_ride" && cbChatId) {
      await answerCallbackQuery(cbQuery.id, "🚕");
      await sendWithLocationKeyboard(cbChatId, MESSAGES.welcome);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 💬 استفسار (من قائمة الترحيب)
    // ═══════════════════════════════════
    if (cbData === "action_inquiry" && cbChatId) {
      await answerCallbackQuery(cbQuery.id, "💬");
      const tgName = cbQuery.from?.first_name || "عزيزي";
      await directSend(cbChatId, `تفضل أستاذ ${tgName}، اسأل أي سؤال أو اكتب شكواك وإن شاء الله نساعدك 🙏`);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 💰 رصيدي (My Balance)
    // ═══════════════════════════════════
    if (cbData === "action_my_balance" && cbChatId) {
      await answerCallbackQuery(cbQuery.id, "💰");
      const tgName = cbQuery.from?.first_name || "عزيزي";
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        const riderId = await findOrCreateTelegramUser(supabase, cbQuery.from || { id: cbChatId });
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", riderId)
          .maybeSingle();

        const balance = profile?.wallet_balance ?? 0;
        await directSend(cbChatId, `رصيدك الحالي في محفظة ران هو: ${balance.toLocaleString()} دينار عراقي 💰`);
      } catch (e) {
        console.error("[telegram] action_my_balance error:", e);
        await directSend(cbChatId, "عذراً، حدث خطأ تقني. حاول مرة أخرى ⚠️");
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 👤 معلوماتي (My Info)
    // ═══════════════════════════════════
    if (cbData === "action_my_info" && cbChatId) {
      await answerCallbackQuery(cbQuery.id, "👤");
      const tgName = cbQuery.from?.first_name || "عزيزي";
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        const riderId = await findOrCreateTelegramUser(supabase, cbQuery.from || { id: cbChatId });
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, created_at")
          .eq("id", riderId)
          .maybeSingle();

        const { count: ridesCount } = await supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("rider_id", riderId)
          .eq("status", "completed");

        if (profile) {
          await directSend(cbChatId,
            `ملفك الشخصي 👤:\n\n` +
            `الاسم: ${profile.full_name || tgName}\n` +
            `رقم الهاتف: ${profile.phone || "غير محدد"}\n` +
            `إجمالي رحلاتك: ${ridesCount ?? 0} رحلة 🚕`
          );
        } else {
          await directSend(cbChatId, `أستاذ ${tgName}، ما كدرنا نجيب معلوماتك حالياً. حاول مرة ثانية ⚠️`);
        }
      } catch (e) {
        console.error("[telegram] action_my_info error:", e);
        await directSend(cbChatId, "عذراً، حدث خطأ تقني. حاول مرة أخرى ⚠️");
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 🚕 رحلاتي السابقة (My Rides)
    // ═══════════════════════════════════
    if (cbData === "action_my_rides" && cbChatId) {
      await answerCallbackQuery(cbQuery.id, "🚕");
      const tgName = cbQuery.from?.first_name || "عزيزي";
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        const riderId = await findOrCreateTelegramUser(supabase, cbQuery.from || { id: cbChatId });
        const { data: rides } = await supabase
          .from("rides")
          .select("id, pickup_address, dropoff_address, status, estimated_fare, created_at")
          .eq("rider_id", riderId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(3);

        if (!rides || rides.length === 0) {
          await directSend(cbChatId, `لم تقم بأي رحلة معنا حتى الآن! 🚕`);
        } else {
          let msg = `🚕 آخر رحلاتك يا أستاذ ${tgName}:\n\n`;
          rides.forEach((r: any, i: number) => {
            msg += `${i + 1}. من ${r.pickup_address || "—"} إلى ${r.dropoff_address || "—"} | السعر: ${r.estimated_fare?.toLocaleString() || "—"} د.ع ✅\n\n`;
          });
          await directSend(cbChatId, msg);
        }
      } catch (e) {
        console.error("[telegram] action_my_rides error:", e);
        await directSend(cbChatId, "عذراً، حدث خطأ تقني. حاول مرة أخرى ⚠️");
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 🗓️ حجز مجدول (Scheduled Ride)
    // ═══════════════════════════════════
    if (cbData === "action_scheduled_ride" && cbChatId) {
      await answerCallbackQuery(cbQuery.id, "🗓️");
      const tgName = cbQuery.from?.first_name || "عزيزي";
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // حفظ حالة المستخدم كـ awaiting_schedule
      try {
        await supabase.from("bot_customers").update({
          last_intent: "awaiting_schedule",
        }).eq("platform", "telegram").eq("platform_id", String(cbQuery.from?.id || cbChatId));
      } catch { } // صامت

      await directSend(cbChatId,
        `ممتاز أستاذ ${tgName}! 🕒\n\nأرسل لي موقعك والوجهة والوقت والتاريخ الذي تريد فيه السيارة.\n\nمثال: غداً الساعة 8 صباحاً من بيتي لجامعة الأنبار\n\nأو دز موقعك أول شي ثم اكتب الوجهة والوقت 📍`
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // �🔕 تجاهل (من أزرار "استمر بالبحث")
    // ═══════════════════════════════════
    if (cbData === "ignore_action") {
      await answerCallbackQuery(cbQuery.id, "👌");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 📍 موقع السائق المباشر (track_{ride_id})
    // ═══════════════════════════════════
    const trackMatch = cbData.match(/^track_([a-f0-9\-]+)$/);
    if (trackMatch && cbChatId) {
      const rideId = trackMatch[1];
      console.log(`[telegram] Track button pressed for ride: ${rideId}`);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        // محاولة 1: RPC function
        let token: string | null = null;

        const { data: rpcResult, error: rpcError } = await supabase.rpc("generate_ride_tracking_token", {
          p_ride_id: rideId,
        });

        if (rpcError) {
          console.error(`[telegram] RPC generate_ride_tracking_token FAILED:`, rpcError.message, rpcError.details, rpcError.hint);

          // محاولة 2: Fallback — إدراج مباشر في ride_share_links
          console.log(`[telegram] Trying direct insert fallback...`);
          const fallbackToken = crypto.randomUUID().replace(/-/g, "").substring(0, 24);

          const { error: insertError } = await supabase
            .from("ride_share_links")
            .insert({
              ride_id: rideId,
              token: fallbackToken,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              is_active: true,
            });

          if (insertError) {
            console.error(`[telegram] Direct insert also FAILED:`, insertError.message);
          } else {
            token = fallbackToken;
            console.log(`[telegram] ✅ Fallback token created: ${token}`);
          }
        } else {
          token = rpcResult;
          console.log(`[telegram] ✅ RPC token: ${token}`);
        }

        if (token) {
          const SITE_URL = Deno.env.get("SITE_URL") || "https://raan-taxi.vercel.app";
          const trackUrl = `${SITE_URL}/track/${token}`;
          await directSend(cbChatId,
            `📍 <b>موقع السائق المباشر:</b>\n\n${trackUrl}\n\nاضغط الرابط لمتابعة موقع الكابتن على الخريطة! 🗺️`
          );
          await answerCallbackQuery(cbQuery.id, "📍 تم إرسال الرابط");
        } else {
          await directSend(cbChatId, "⚠️ عذراً، ما كدرنا نولّد رابط التتبع. حاول مرة أخرى.");
          await answerCallbackQuery(cbQuery.id, "⚠️ خطأ");
        }

      } catch (e) {
        console.error("[telegram] Track button error:", e);
        await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ");
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 💬 مراسلة السائق (chat_{ride_id})
    // ═══════════════════════════════════
    const chatMatch = cbData.match(/^chat_([a-f0-9\-]+)$/);
    if (chatMatch && cbChatId) {
      const rideId = chatMatch[1];
      console.log(`[telegram] Chat button pressed for ride: ${rideId}`);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      try {
        // التحقق من أن الرحلة نشطة
        const { data: ride } = await supabase
          .from("rides")
          .select("status")
          .eq("id", rideId)
          .maybeSingle();

        if (!ride || !["accepted", "arrived", "in_progress"].includes(ride.status)) {
          await answerCallbackQuery(cbQuery.id, "⚠️ الرحلة غير نشطة");
          await directSend(cbChatId, "⚠️ هذه الرحلة لم تعد نشطة.");
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        // تعيين sub-state: chatting_with_driver
        const platformId = String(cbQuery.from?.id || cbChatId);
        await supabase.from("bot_customers").update({
          last_intent: `chatting_with_driver:${rideId}`,
        }).eq("platform", "telegram").eq("platform_id", platformId);

        await directSend(cbChatId,
          `💬 <b>وضع المحادثة مع الكابتن</b>\n\nاكتب رسالتك الآن وسأقوم بإيصالها للكابتن فوراً 👇`
        );

        await answerCallbackQuery(cbQuery.id, "💬 اكتب رسالتك");
      } catch (e) {
        console.error("[telegram] Chat button error:", e);
        await answerCallbackQuery(cbQuery.id, "⚠️ حدث خطأ");
      }
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // callback_query غير معروف
    await answerCallbackQuery(cbQuery.id, "");
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  const message = update.message;
  if (!message) {
    console.log("[telegram] No message in update, skipping");
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  const chatId = message.chat.id;
  const telegramUser = message.from;
  console.log(`[telegram] Chat: ${chatId}, User: ${telegramUser?.first_name} (${telegramUser?.id})`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ═══════════════════════════════════
  // 📊 تسجيل العميل في قاعدة التسويق (صامت)
  // ═══════════════════════════════════
  try {
    const tgName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || "Telegram User";
    await supabase.from("bot_customers").upsert({
      platform: "telegram",
      platform_id: String(telegramUser?.id || chatId),
      full_name: tgName,
      username: telegramUser?.username || null,
      last_active: new Date().toISOString(),
      interaction_count: 1,
    }, {
      onConflict: "platform,platform_id",
    });
    // تحديث عدد التفاعلات
    await supabase.rpc("increment_bot_customer_interactions", {
      p_platform: "telegram",
      p_platform_id: String(telegramUser?.id || chatId),
    }).then(() => { }, (e: any) => { console.warn("[tg] increment failed:", e); }); // صامت
  } catch (e) {
    console.warn("[tg] bot_customers upsert failed (non-critical):", e);
  }

  try {
    // 1️⃣ /start — قائمة ترحيب بأزرار inline
    if (message.text === "/start") {
      console.log("[telegram] /start → sending welcome menu");
      const tgName = telegramUser?.first_name || "عزيزي";
      await sendInlineKeyboard(
        chatId,
        `أهلاً بك أستاذ ${tgName} في تكسي ران! 🚕\nشلون نكدر نخدمك اليوم؟`,
        [
          [{ text: "🚕 حجز رحلة الان", callback_data: "action_book_ride" }],
          [{ text: "💬 استفسار سريع", callback_data: "action_inquiry" }],
          [
            { text: "🗓️ حجز مجدول", callback_data: "action_scheduled_ride" },
            { text: "🚕 رحلاتي", callback_data: "action_my_rides" },
          ],
          [
            { text: "💰 رصيدي", callback_data: "action_my_balance" },
            { text: "👤 معلوماتي", callback_data: "action_my_info" },
          ],
        ]
      );
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 🧠 ذاكرة الرحلة النشطة + ترحيل الدردشة
    // ═══════════════════════════════════
    {
      const telegramRef = `tg_${telegramUser?.id || chatId}`;
      const telegramEmail = `tg_${telegramUser?.id || chatId}@telegram.raan.app`;
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${telegramRef},email.eq.${telegramEmail}`)
        .limit(1)
        .maybeSingle();

      if (existingProfile?.user_id) {
        const { data: activeRide } = await supabase
          .from("rides")
          .select("id, status, driver_id, pickup_address, dropoff_address")
          .eq("rider_id", existingProfile.user_id)
          .in("status", ["pending", "accepted", "arrived", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeRide) {
          console.log(`[telegram] Active ride detected: ${activeRide.id} (${activeRide.status})`);

          if (activeRide.status === "pending") {
            // رحلة منتظرة — عرض خيار الإلغاء
            await sendInlineKeyboard(
              chatId,
              "⏳ أنت في رحلة حالياً (جاري البحث عن كابتن).\n\n" +
              `📍 من: ${activeRide.pickup_address || "موقعك"}\n` +
              `🏁 إلى: ${activeRide.dropoff_address || "الوجهة"}\n\n` +
              "هل تريد إلغاء الرحلة؟",
              [
                [
                  { text: "❌ إلغاء الرحلة", callback_data: `cancel_ride_${activeRide.id}` },
                  { text: "🔄 استمر بالبحث", callback_data: "ignore_action" },
                ],
              ]
            );
          } else {
            // ═══════════════════════════════════════════════════════
            // 💬 ترحيل الدردشة — الراكب يرسل رسالة للسائق عبر البوت
            // الحالات: accepted / arrived / in_progress
            // ═══════════════════════════════════════════════════════
            let userMessageText = "";

            // استخراج النص (نص عادي أو صوت مُحوّل)
            if (message.text && message.text !== "/start") {
              userMessageText = message.text;
            } else if (message.voice) {
              try {
                const audioBytes = await downloadTelegramFile(message.voice.file_id);
                const mimeType = message.voice.mime_type || "audio/ogg";
                userMessageText = await transcribeAudio(audioBytes, mimeType);
              } catch (e) {
                console.warn("[telegram] Audio transcription failed for relay:", e);
              }
            }

            if (userMessageText && userMessageText.trim().length > 0) {
              // إدراج الرسالة في ride_messages (service_role يتجاوز RLS)
              const { error: msgError } = await supabase
                .from("ride_messages")
                .insert({
                  ride_id: activeRide.id,
                  sender_id: existingProfile.user_id,
                  sender_type: "rider",
                  message: userMessageText.trim(),
                });

              if (msgError) {
                console.error("[telegram] Failed to insert ride_message:", msgError.message);
                await directSend(chatId, "⚠️ عذراً، لم نتمكن من إرسال رسالتك للكابتن. حاول مرة أخرى.");
              } else {
                console.log(`[telegram] Relay message inserted for ride ${activeRide.id}`);
                await directSend(chatId, "✅ تم إرسال رسالتك للكابتن.");
              }
            } else {
              // لم يتم استخراج نص — عرض حالة الرحلة
              await directSend(
                chatId,
                "🚕 لديك رحلة نشطة حالياً مع الكابتن.\n" +
                `📍 الحالة: ${activeRide.status === "accepted" ? "الكابتن في الطريق إليك" : activeRide.status === "arrived" ? "الكابتن وصل" : "الرحلة جارية"}\n\n` +
                "💬 يمكنك إرسال رسالة نصية أو صوتية للكابتن مباشرة من هنا."
              );
            }
          }

          return new Response("OK", { status: 200, headers: corsHeaders });
        }
      }
    }

    // ═══════════════════════════════════
    // 2️⃣ مشاركة الموقع (GPS) → حفظ نقطة الانطلاق
    // ═══════════════════════════════════
    if (message.location) {
      const lat = message.location.latitude;
      const lng = message.location.longitude;
      console.log(`[telegram] Location received: ${lat}, ${lng}`);

      // التحقق: هل الموقع ضمن الرمادي (60 كم)
      const distFromCenter = haversineDistance(lat, lng, 33.4233, 43.2974);
      if (distFromCenter > 60) {
        await directSend(chatId, "⚠️ موقعك يبين بعيد عن الرمادي. التطبيق حالياً يخدم الرمادي فقط.");
        await sendWithLocationKeyboard(chatId, "دز موقعك من داخل الرمادي 👇");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Reverse geocode
      const address = await reverseGeocode(lat, lng);
      console.log(`[telegram] Reverse geocoded: ${address}`);

      // إنشاء المستخدم + Session
      const riderId = await findOrCreateTelegramUser(supabase, telegramUser);
      const sessionId = await createPickupSession(supabase, riderId, lat, lng, address);
      console.log(`[telegram] Pickup session created: ${sessionId}`);

      // تأكيد + طلب الوجهة
      await sendAndRemoveKeyboard(chatId, MESSAGES.locationReceived(address));
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════════════════════
    // 3️⃣ صوت أو نص → استخراج الوجهة
    // ═══════════════════════════════════
    const hasVoice = !!message.voice;
    const hasText = !!message.text && message.text !== "/start";

    if (!hasVoice && !hasText) {
      await sendWithLocationKeyboard(chatId, MESSAGES.needLocationFirst);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── هل المستخدم شارك موقعه أولاً؟
    const riderId = await findOrCreateTelegramUser(supabase, telegramUser);
    const session = await findPendingSession(supabase, riderId);

    if (!session) {
      // ── 🕒 فحص إذا المستخدم ينتظر إدخال تفاصيل حجز مجدول ──
      if (hasText) {
        const tgPlatformId = String(telegramUser?.id || chatId);
        const { data: botCustomer } = await supabase
          .from("bot_customers")
          .select("last_intent")
          .eq("platform", "telegram")
          .eq("platform_id", tgPlatformId)
          .maybeSingle();

        if (botCustomer?.last_intent === "awaiting_schedule") {
          console.log("[telegram] Awaiting schedule — processing scheduled ride request");
          const userMsgText = message.text;
          const tgName = telegramUser?.first_name || "عزيزي";

          // مسح الـ intent
          await supabase.from("bot_customers").update({ last_intent: null })
            .eq("platform", "telegram").eq("platform_id", tgPlatformId);

          const scheduleDetails = await extractScheduledRideDetails(userMsgText, tgName);

          if (!scheduleDetails.is_valid) {
            await directSend(chatId, scheduleDetails.error_reply || `عذراً أستاذ ${tgName}، ما فهمت طلبك. جرب كتابة الوجهة والوقت بشكل واضح 🙏`);
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "telegram").eq("platform_id", tgPlatformId);
            return new Response("OK", { status: 200, headers: corsHeaders });
          }

          if (!scheduleDetails.scheduled_time) {
            await directSend(chatId, `أستاذ ${tgName}، لازم تحدد الوقت والتاريخ! مثال: "غداً الساعة 8 صباحاً من بيتي لجامعة الأنبار" 🕒`);
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "telegram").eq("platform_id", tgPlatformId);
            return new Response("OK", { status: 200, headers: corsHeaders });
          }

          // Geocode الوجهة
          const dropoffResolved = await resolveRamadiLocation(scheduleDetails.dropoff_query);
          if (!dropoffResolved) {
            await directSend(chatId, MESSAGES.geocodeFailed(scheduleDetails.dropoff_query));
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "telegram").eq("platform_id", tgPlatformId);
            return new Response("OK", { status: 200, headers: corsHeaders });
          }

          // Geocode نقطة الانطلاق
          let pickupLocation = { lat: 33.4233, lng: 43.2974 };
          let pickupAddress = scheduleDetails.pickup_query || "موقع المستخدم";
          if (scheduleDetails.pickup_query && scheduleDetails.pickup_query !== "موقع المستخدم") {
            const pickupResolved = await resolveRamadiLocation(scheduleDetails.pickup_query);
            if (pickupResolved) {
              pickupLocation = { lat: pickupResolved.lat, lng: pickupResolved.lng };
              pickupAddress = pickupResolved.address;
            }
          }

          // حساب المسافة والأجرة
          const distanceKm = haversineDistance(pickupLocation.lat, pickupLocation.lng, dropoffResolved.lat, dropoffResolved.lng);
          const fare = estimateFare(distanceKm);

          // إنشاء الحجز المجدول
          const { data: scheduledRide, error: schedError } = await supabase
            .from("scheduled_rides")
            .insert({
              rider_id: riderId,
              pickup_location: pickupLocation,
              pickup_address: pickupAddress,
              dropoff_location: { lat: dropoffResolved.lat, lng: dropoffResolved.lng },
              dropoff_address: dropoffResolved.address,
              scheduled_at: scheduleDetails.scheduled_time,
              vehicle_type: scheduleDetails.vehicle_type,
              estimated_fare: fare,
              status: "scheduled",
              notes: scheduleDetails.notes,
              trip_type: "telegram",
            })
            .select()
            .single();

          if (schedError) {
            console.error("[telegram] Failed to create scheduled ride:", schedError);
            await directSend(chatId, `عذراً أستاذ ${tgName}، حدث خطأ تقني. حاول مرة ثانية ⚠️`);
            return new Response("OK", { status: 200, headers: corsHeaders });
          }

          const scheduledDate = new Date(scheduleDetails.scheduled_time);
          const dateStr = scheduledDate.toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          const timeStr = scheduledDate.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

          await directSend(chatId,
            `✅ تم حجز رحلتك المجدولة بنجاح!\n\n` +
            `📍 من: ${pickupAddress}\n` +
            `🏁 إلى: ${dropoffResolved.address}\n` +
            `📅 التاريخ: ${dateStr}\n` +
            `🕐 الوقت: ${timeStr}\n` +
            `💰 السعر التقديري: ${fare.toLocaleString()} د.ع\n` +
            `🔖 رقم الحجز: ${scheduledRide.id.substring(0, 8)}\n\n` +
            `سنرسل لك تذكير قبل الموعد وننطلق بالبحث عن كابتن قبل 15-30 دقيقة من الموعد إن شاء الله 🚕`
          );

          console.log(`[telegram] Scheduled ride created: ${scheduledRide.id}`);
          return new Response("OK", { status: 200, headers: corsHeaders });
        }
      }

      console.log("[telegram] No pending session — asking for location first");
      await sendWithLocationKeyboard(chatId, MESSAGES.needLocationFirst);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    console.log(`[telegram] Found session: ${session.ride_id}, pickup: ${session.pickup_address}`);
    await directSend(chatId, MESSAGES.processing);

    // ── الحصول على نص الوجهة
    let userText = "";

    if (hasVoice) {
      console.log("[telegram] Downloading voice...");
      const audioBytes = await downloadTelegramFile(message.voice.file_id);
      console.log(`[telegram] Downloaded ${audioBytes.length} bytes`);

      const mimeType = message.voice.mime_type || "audio/ogg";
      userText = await transcribeAudio(audioBytes, mimeType);
      console.log(`[whisper] Transcript: "${userText}"`);

      if (!userText || userText.trim().length < 2) {
        await directSend(chatId, MESSAGES.noTranscript);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
    } else {
      userText = message.text!;
      console.log(`[telegram] Text input: "${userText}"`);
    }

    // ── GPT-4o: استخراج الوجهة
    console.log("[gpt4o] Extracting destination...");
    const intent = await extractDestination(userText, session.pickup_lat, session.pickup_lng);
    console.log("[gpt4o] Result:", JSON.stringify(intent));

    if (!intent.destination_search_query || intent.destination_search_query.trim().length < 2) {
      await directSend(chatId, MESSAGES.noDestination);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── فحص خارج الحدود (Out-of-Bounds)
    if (intent.destination_search_query === "__OUT_OF_BOUNDS__" && intent.notes) {
      await directSend(chatId, intent.notes);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── Geocoding (مع location bias حول موقع المستخدم)
    console.log(`[geocode] Resolving: "${intent.destination_search_query}"`);
    const destination = await resolveRamadiLocation(intent.destination_search_query, session.pickup_lat, session.pickup_lng);

    if (!destination) {
      await directSend(chatId, MESSAGES.geocodeFailed(intent.destination_search_query));
      return new Response("OK", { status: 200, headers: corsHeaders });
    }
    console.log(`[geocode] Resolved: ${destination.address} (${destination.lat}, ${destination.lng})`);

    // ── حساب المسافة والأجرة
    const distanceKm = haversineDistance(session.pickup_lat, session.pickup_lng, destination.lat, destination.lng);
    const fare = estimateFare(distanceKm);
    console.log(`[fare] Distance: ${distanceKm.toFixed(2)} km, Fare: ${fare} IQD`);

    // ── تحديث الرحلة بالوجهة
    const { error: updateError } = await supabase
      .from("rides")
      .update({
        dropoff_location: { lat: destination.lat, lng: destination.lng },
        dropoff_address: destination.address,
        vehicle_type: intent.vehicle_type || "economy",
        distance_km: Math.round(distanceKm * 100) / 100,
        estimated_fare: fare,
        cancellation_reason: intent.notes ? `[ملاحظة] ${intent.notes}` : null,
      })
      .eq("id", session.ride_id);

    if (updateError) {
      console.error("[db] Failed to update ride:", updateError);
      throw new Error(`Failed to update ride: ${updateError.message}`);
    }

    console.log(`[db] Ride ${session.ride_id} updated with destination`);

    // ── إرسال رسالة تأكيد مع أزرار (بدون مطابقة سائقين حتى يؤكد الراكب)
    await sendInlineKeyboard(
      chatId,
      MESSAGES.confirmationPrompt(session.pickup_address, destination.address, fare, distanceKm),
      [
        [
          { text: "✅ اعتمد الرحلة", callback_data: `confirm_ride_${session.ride_id}` },
          { text: "❌ إلغاء", callback_data: `cancel_ride_${session.ride_id}` },
        ],
      ]
    );

    // ملاحظة: match-ride يُستدعى فقط بعد ضغط الراكب على "اعتمد الرحلة"

    console.log(`[confirm] Waiting for rider confirmation on ride ${session.ride_id}`);
    return new Response(JSON.stringify({ ok: true, ride_id: session.ride_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[telegram] CRITICAL ERROR:", errMsg);
    console.error("[telegram] Stack:", error instanceof Error ? error.stack : "N/A");

    try {
      await directSend(chatId, "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى. ⚠️");
    } catch { }

    return new Response(JSON.stringify({ error: errMsg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
