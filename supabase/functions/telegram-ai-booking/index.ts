/**
 * ران - بوت تيليغرام للحجز الذكي بالصوت
 * RAAN AI Dispatcher Bot — Ramadi Edition
 * 
 * يستقبل رسائل تيليغرام الصوتية ← يحولها لنص (Whisper) ← يستخرج المواقع (GPT-4o)
 * ← يحدد الإحداثيات (Google Geocoding) ← يحسب الأجرة ← ينشئ رحلة في قاعدة البيانات
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════
// المتغيرات البيئية
// ════════════════════════════════════════
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════
// الرسائل العربية الثابتة
// ════════════════════════════════════════
const MESSAGES = {
  welcome: `هلا بيك بتطبيق ران 🚕
احنا أول تكسي ذكي بالرمادي.

شلون تطلب؟
بس دز بصمة صوتية 🎙️ وكول وين مكانك ووين رايح.
مثال: "أني يم شارع المستودع وأريد أروح لجامعة الأنبار"`,

  processing: "جاري تحليل الصوت... 🤖",

  noVoice: "📢 ارسل رسالة صوتية 🎙️ وكول للبوت وين مكانك ووين تريد تروح.\n\nمثال: \"أني يم تقاطع الزيوت وأريد أروح للمستشفى التعليمي\"",

  noTranscript: "❌ ما كدرت أفهم الصوت. جرب مرة ثانية بصوت أوضح.",

  noDestination: "❌ ما فهمت الوجهة. كول مثلاً: \"أريد أروح لجامعة الأنبار\"",

  geocodeFailed: (place: string) =>
    `❌ ما كدرت ألاقي "${place}" على الخريطة بالرمادي. جرب تكول اسم أوضح.`,

  outsideRamadi: (place: string) =>
    `⚠️ "${place}" يبين خارج الرمادي. التطبيق حالياً يخدم الرمادي فقط.`,

  bookingConfirmed: (origin: string, destination: string, fare: number) =>
    `✅ تم الحجز!
📍 من: ${origin}
🏁 إلى: ${destination}
💰 السعر التقديري: ${fare.toLocaleString()} د.ع

جاري إبلاغ أقرب كابتن عليك... 🚗`,

  error: "⚠️ صار خطأ، جرب مرة ثانية بعد شوية.",
};

// ════════════════════════════════════════
// مساعد: إرسال رسالة عبر تيليغرام
// ════════════════════════════════════════
async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

// ════════════════════════════════════════
// مساعد: تحميل ملف الصوت من تيليغرام
// ════════════════════════════════════════
async function downloadTelegramFile(fileId: string): Promise<Uint8Array> {
  // الخطوة 1: جلب مسار الملف
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error("فشل جلب معلومات الملف من تيليغرام");
  }

  // الخطوة 2: تحميل الملف
  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
  const audioRes = await fetch(downloadUrl);

  if (!audioRes.ok) {
    throw new Error("فشل تحميل الملف الصوتي من تيليغرام");
  }

  return new Uint8Array(await audioRes.arrayBuffer());
}

// ════════════════════════════════════════
// الأذن: تحويل الصوت لنص عبر Whisper
// ════════════════════════════════════════
async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<string> {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "ogg";

  const formData = new FormData();
  formData.append("file", new Blob([audioBytes], { type: mimeType }), `voice.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "ar");
  formData.append("prompt",
    "لهجة عراقية من مدينة الرمادي، محافظة الأنبار. أماكن مثل جامعة الأنبار، مستشفى الرمادي التعليمي، " +
    "شارع المستودع، حي التأميم، حي الحوز، تقاطع الزيوت، حي الملعب، البوعلوان، الشارع العام، " +
    "حي العزيزية، السوق المركزي، خمسة كيلو، حي الضباط، حي الورار، حي الأندلس، حي المعلمين، " +
    "الجسر الحديدي، مبنى المحافظة، حي القطانة، حي الثيلة، حي السفحة، حي البوذياب"
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
// الدماغ: استخراج النية من النص عبر GPT-4o
// ════════════════════════════════════════
interface ExtractedIntent {
  origin_search_query: string | null;
  destination_search_query: string | null;
  vehicle_type: "economy" | "comfort" | "premium" | "women_only";
  notes: string | null;
}

async function extractIntent(transcript: string): Promise<ExtractedIntent> {
  const systemPrompt = `You are an intelligent taxi dispatcher for the city of Ramadi, Al Anbar, Iraq.
The user will speak in Iraqi Arabic dialect.

Critical Rules:
1. If the user mentions a landmark (e.g., 'الملعب', 'شارع 17', 'الحوز', 'الجامع الكبير', 'جامعة الأنبار'), you MUST assume they mean the location in Ramadi, NOT Baghdad or any other city.
2. Extract the pickup location (origin) and dropoff location (destination) as search queries.
3. If the user says "أني يم" or "أني عند" or "موقعي" → that's the origin.
4. If the user says "أريد أروح" or "أبي أروح" or "وديني" or "لـ" → what follows is the destination.
5. If only one location is mentioned, treat it as the destination. Set origin to null (GPS will be used).
6. Always append "الرمادي" to every location name in your output for geocoding accuracy.
7. If the user mentions vehicle preference (فخمة/فاخرة → premium, مريحة → comfort, نسائي/بنات → women_only), set vehicle_type.
8. Extract any notes (مستعجل، قرب الصيدلية، etc).

Well-known Ramadi landmarks:
- جامعة الأنبار، مستشفى الرمادي التعليمي، دائرة صحة الأنبار
- حي التأميم، حي الحوز، حي الملعب، حي الضباط، حي العزيزية
- حي 5 كيلو، حي العشرين، حي البكر، حي الورار، حي السلام
- تقاطع الزيوت، شارع المستودع، الشارع العام، السوق المركزي
- البوعلوان، حي المعلمين، حي الأندلس، الجسر الحديدي
- مبنى المحافظة، ملعب الرمادي، حي الثيلة، حي القطانة، حي السفحة، حي البوذياب

Respond in JSON only:
{
  "origin_search_query": "اسم مكان الانطلاق، الرمادي" or null,
  "destination_search_query": "اسم الوجهة، الرمادي",
  "vehicle_type": "economy",
  "notes": "ملاحظات" or null
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
      max_tokens: 300,
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
// الخريطة: Geocoding مقيد بالرمادي فقط
// ════════════════════════════════════════
interface ResolvedLocation {
  lat: number;
  lng: number;
  address: string;
}

async function resolveRamadiLocation(query: string): Promise<ResolvedLocation | null> {
  // إلحاق "الرمادي، العراق" إذا لم تكن موجودة
  const searchQuery = query.includes("الرمادي") ? query : `${query}، الرمادي، العراق`;

  const params = new URLSearchParams({
    address: searchQuery,
    key: GOOGLE_MAPS_KEY,
    language: "ar",
    components: "country:IQ",
    // تحيز نحو مركز الرمادي (نطاق 10 كم)
    bounds: "33.35,43.10|33.55,43.45",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await response.json();

  if (data.status !== "OK" || !data.results?.[0]) {
    console.log(`[geocode] No results for: "${searchQuery}"`);
    return null;
  }

  // التحقق المزدوج: النتيجة فعلاً في محافظة الأنبار
  const addressComponents = data.results[0].address_components;
  const isAnbar = addressComponents.some((c: { long_name: string }) =>
    c.long_name.includes("Anbar") ||
    c.long_name.includes("الأنبار") ||
    c.long_name.includes("الرمادي") ||
    c.long_name.includes("Ramadi")
  );

  if (!isAnbar) {
    console.log(`[geocode] Rejected — outside Ramadi: ${data.results[0].formatted_address}`);
    return null;
  }

  return {
    lat: data.results[0].geometry.location.lat,
    lng: data.results[0].geometry.location.lng,
    address: data.results[0].formatted_address,
  };
}

// ════════════════════════════════════════
// مساعد: حساب المسافة بالكيلومتر (Haversine)
// ════════════════════════════════════════
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ════════════════════════════════════════
// مساعد: حساب أجرة تقديرية بسيطة
// ════════════════════════════════════════
function estimateFare(distanceKm: number): number {
  const baseFare = 2000; // دينار عراقي
  const perKmRate = 1000; // دينار لكل كم
  const raw = baseFare + distanceKm * perKmRate;
  // تقريب لأقرب 250
  return Math.ceil(raw / 250) * 250;
}

// ════════════════════════════════════════
// مساعد: البحث عن أو إنشاء مستخدم ضيف من تيليغرام
// ════════════════════════════════════════
async function findOrCreateTelegramUser(
  supabase: ReturnType<typeof createClient>,
  telegramUser: { id: number; first_name?: string; last_name?: string; username?: string }
): Promise<string> {
  // البحث عن مستخدم موجود بنفس telegram_id في phone field (مؤقت)
  const telegramRef = `tg_${telegramUser.id}`;

  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("phone", telegramRef)
    .maybeSingle();

  if (existing?.user_id) {
    console.log(`[auth] Found existing user: ${existing.user_id}`);
    return existing.user_id;
  }

  // إنشاء مستخدم جديد في Auth
  const email = `tg_${telegramUser.id}@telegram.raan.app`;
  const password = crypto.randomUUID(); // كلمة مرور عشوائية — المستخدم لن يستخدمها

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || "راكب تيليغرام",
      source: "telegram",
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username,
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`);
  }

  const userId = authData.user.id;

  // إنشاء profile
  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || "راكب تيليغرام",
    phone: telegramRef,
    email,
    status: "active",
  });

  if (profileError) {
    console.error("[auth] Profile creation error:", profileError);
  }

  console.log(`[auth] Created new telegram user: ${userId}`);
  return userId;
}

// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // تيليغرام يرسل POST فقط
  if (req.method !== "POST") {
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const update = await req.json();
    console.log("[telegram] Received update:", JSON.stringify(update).substring(0, 500));

    const message = update.message;
    if (!message) {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const chatId = message.chat.id;
    const telegramUser = message.from;

    // ═══════════════════ /start command ═══════════════════
    if (message.text === "/start") {
      await sendTelegramMessage(chatId, MESSAGES.welcome);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════ رسالة نصية عادية ═══════════════════
    if (message.text && !message.voice) {
      await sendTelegramMessage(chatId, MESSAGES.noVoice);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ═══════════════════ رسالة صوتية ═══════════════════
    if (!message.voice) {
      await sendTelegramMessage(chatId, MESSAGES.noVoice);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── إرسال رسالة "جاري التحليل" فوراً
    await sendTelegramMessage(chatId, MESSAGES.processing);

    // ── الخطوة 1: تحميل الصوت من تيليغرام
    console.log("[telegram] Downloading voice file:", message.voice.file_id);
    const audioBytes = await downloadTelegramFile(message.voice.file_id);
    console.log(`[telegram] Downloaded ${audioBytes.length} bytes`);

    // ── الخطوة 2: تحويل الصوت لنص (Whisper)
    console.log("[whisper] Transcribing...");
    const mimeType = message.voice.mime_type || "audio/ogg";
    const transcript = await transcribeAudio(audioBytes, mimeType);
    console.log(`[whisper] Transcript: "${transcript}"`);

    if (!transcript || transcript.trim().length < 3) {
      await sendTelegramMessage(chatId, MESSAGES.noTranscript);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── الخطوة 3: استخراج النية (GPT-4o)
    console.log("[gpt4o] Extracting intent...");
    const intent = await extractIntent(transcript);
    console.log("[gpt4o] Intent:", JSON.stringify(intent));

    if (!intent.destination_search_query) {
      await sendTelegramMessage(chatId, MESSAGES.noDestination);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ── الخطوة 4: Geocoding مقيد بالرمادي
    console.log("[geocode] Resolving locations...");

    // نقطة الوصول (إلزامية)
    const destination = await resolveRamadiLocation(intent.destination_search_query);
    if (!destination) {
      await sendTelegramMessage(chatId, MESSAGES.geocodeFailed(intent.destination_search_query));
      return new Response("OK", { status: 200, headers: corsHeaders });
    }
    console.log(`[geocode] Destination: ${destination.address} (${destination.lat}, ${destination.lng})`);

    // نقطة الانطلاق (اختيارية — إذا لم تُحدد يُستخدم مركز الرمادي كافتراضي)
    let origin: ResolvedLocation;
    if (intent.origin_search_query) {
      const resolved = await resolveRamadiLocation(intent.origin_search_query);
      if (!resolved) {
        await sendTelegramMessage(chatId, MESSAGES.geocodeFailed(intent.origin_search_query));
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      origin = resolved;
    } else {
      // افتراضي: مركز الرمادي — السائق سيتواصل مع الراكب
      origin = {
        lat: 33.4233,
        lng: 43.2974,
        address: "موقعك الحالي (الرمادي)",
      };
    }
    console.log(`[geocode] Origin: ${origin.address} (${origin.lat}, ${origin.lng})`);

    // ── الخطوة 5: حساب المسافة والأجرة التقديرية
    const distanceKm = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const estimatedFare = estimateFare(distanceKm);
    console.log(`[fare] Distance: ${distanceKm.toFixed(2)} km, Fare: ${estimatedFare} IQD`);

    // ── الخطوة 6: إنشاء/البحث عن مستخدم تيليغرام
    const riderId = await findOrCreateTelegramUser(supabase, telegramUser);

    // ── الخطوة 7: إنشاء الرحلة في قاعدة البيانات
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .insert({
        rider_id: riderId,
        status: "pending",
        pickup_location: { lat: origin.lat, lng: origin.lng },
        pickup_address: origin.address,
        dropoff_location: { lat: destination.lat, lng: destination.lng },
        dropoff_address: destination.address,
        vehicle_type: intent.vehicle_type || "economy",
        distance_km: Math.round(distanceKm * 100) / 100,
        estimated_fare: estimatedFare,
        payment_method: "cash",
        trip_type: "telegram", // مصدر الحجز
        cancellation_reason: intent.notes ? `[ملاحظة الراكب] ${intent.notes}` : null,
      })
      .select("id")
      .single();

    if (rideError) {
      console.error("[db] Ride insert error:", rideError);
      throw new Error(`Failed to create ride: ${rideError.message}`);
    }

    console.log(`[db] Ride created: ${ride.id}`);

    // ── الخطوة 8: محاولة مطابقة السائقين (اختيارية)
    try {
      await supabase.functions.invoke("match-ride", {
        body: { ride_id: ride.id },
      });
      console.log("[match] Match-ride invoked for:", ride.id);
    } catch (matchErr) {
      console.warn("[match] match-ride failed (non-critical):", matchErr);
    }

    // ── الخطوة 9: إرسال رسالة التأكيد للراكب
    await sendTelegramMessage(
      chatId,
      MESSAGES.bookingConfirmed(origin.address, destination.address, estimatedFare)
    );

    // سجل معلومات الرحلة للتتبع
    console.log(`[success] Ride ${ride.id} booked via Telegram by user ${telegramUser.id}`);

    return new Response(JSON.stringify({ ok: true, ride_id: ride.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[telegram-ai-booking] Error:", errMsg);

    // محاولة إرسال رسالة خطأ للمستخدم
    try {
      const update = await req.clone().json().catch(() => null);
      const chatId = update?.message?.chat?.id;
      if (chatId) {
        await sendTelegramMessage(chatId, MESSAGES.error);
      }
    } catch {
      // تجاهل — لا نستطيع إرسال رسالة للمستخدم
    }

    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
