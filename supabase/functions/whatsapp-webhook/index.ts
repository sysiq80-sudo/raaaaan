/**
 * ران - واتساب كلاود API — الحجز الذكي بالصوت والنص
 * RAAN WhatsApp AI Dispatcher — Ramadi Edition (Phase 2)
 *
 * التدفق:
 * 1. المستخدم يرسل موقعه GPS → يُحفظ كنقطة انطلاق (draft)
 * 2. المستخدم يرسل صوت/نص → Whisper + GPT-4o → Geocoding → حساب الأجرة
 * 3. أزرار تأكيد/إلغاء → draft → pending → match-ride
 *
 * ملاحظة: GET = Meta Webhook Verification, POST = Incoming Messages
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════
// المتغيرات البيئية
// ════════════════════════════════════════
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GRAPH_API = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

// ════════════════════════════════════════
// الرسائل العربية الثابتة
// ════════════════════════════════════════
const MESSAGES = {
  welcome: `هلا بيك في ران! 🚕\nعلمود نحسب لك السعر المضبوط، دز لنا موقعك الحالي:\n📍 اضغط على مشبك الملفات 📎 ثم اختر "الموقع" وشارك موقعك الحالي.`,

  locationReceived: (address: string) =>
    `✅ عاشت ايدك، حددنا مكانك:\n${address}\n\nهسة دز رسالة صوتية 🎙️ وكول وين تريد تروح؟\nأو اكتب اسم الوجهة بالنص.`,

  needLocationFirst: `عفواً، لازم تدز موقعك أول شي! 📍\nاضغط على 📎 ثم اختر "الموقع" وشارك موقعك الحالي.`,

  processing: "جاري تحليل طلبك... 🤖",

  noTranscript: "❌ ما كدرت أفهم الصوت. جرب مرة ثانية بصوت أوضح.",

  noDestination: `❌ ما فهمت الوجهة. كول مثلاً:\n"أريد أروح لجامعة الأنبار"\nأو اكتبها بالنص.`,

  geocodeFailed: (place: string) =>
    `❌ ما كدرت ألاقي "${place}" على الخريطة بالرمادي. جرب تكول اسم أوضح.`,

  confirmationPrompt: (origin: string, destination: string, fare: number, distanceKm: number) =>
    `🚕 *تأكيد الرحلة*\n\n📍 *من:* ${origin}\n🏁 *إلى:* ${destination}\n📏 *المسافة:* ${distanceKm.toFixed(1)} كم\n💰 *السعر التقديري:* ${fare.toLocaleString()} د.ع\n\nهل تريد تأكيد الرحلة؟ 👇`,

  rideConfirmed: `✅ *تم تأكيد الطلب!*\nجاري إبلاغ أقرب كابتن عليك... 🚗`,

  rideCancelled: `🚫 *تم إلغاء الطلب.*\nتكدر تطلب رحلة جديدة بأي وقت! 🚕`,

  activeRidePending: (pickup: string, dropoff: string) =>
    `⏳ أنت في رحلة حالياً (جاري البحث عن كابتن).\n\n📍 من: ${pickup}\n🏁 إلى: ${dropoff}\n\nهل تريد إلغاء الرحلة؟`,

  activeRideWithDriver: (status: string) =>
    `🚕 لديك رحلة نشطة حالياً مع الكابتن.\n📍 الحالة: ${status}\n\nالرجاء إتمامها أولاً.`,

  error: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى. ⚠️",

  locationTooFar: "⚠️ موقعك يبين بعيد عن الرمادي. التطبيق حالياً يخدم الرمادي فقط.\n\nدز موقعك من داخل الرمادي 📍",
};

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال رسالة نصية
// ════════════════════════════════════════
async function sendTextMessage(to: string, text: string) {
  try {
    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendText (${res.status}): ${result.substring(0, 300)}`);
  } catch (e) {
    console.error("[wa] sendTextMessage failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال رسالة مع أزرار (Interactive)
// ════════════════════════════════════════
async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  try {
    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendButtons (${res.status}): ${result.substring(0, 300)}`);
  } catch (e) {
    console.error("[wa] sendInteractiveButtons failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: تحميل ملف صوتي (خطوتين)
// ════════════════════════════════════════
async function downloadWhatsAppMedia(mediaId: string): Promise<Uint8Array> {
  // الخطوة 1: جلب URL الملف
  const metaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Failed to get media URL (${metaRes.status}): ${err}`);
  }

  const metaData = await metaRes.json();
  const mediaUrl = metaData.url;

  if (!mediaUrl) {
    throw new Error("No media URL returned from Meta");
  }

  console.log(`[wa] Media URL retrieved: ${mediaUrl.substring(0, 80)}...`);

  // الخطوة 2: تحميل الملف الفعلي (يتطلب Authorization مرة أخرى!)
  const audioRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });

  if (!audioRes.ok) {
    const err = await audioRes.text();
    throw new Error(`Failed to download media (${audioRes.status}): ${err}`);
  }

  return new Uint8Array(await audioRes.arrayBuffer());
}

// ════════════════════════════════════════
// Whisper: تحويل الصوت لنص
// ════════════════════════════════════════
async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<string> {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("opus") ? "ogg" : "ogg";

  const formData = new FormData();
  formData.append("file", new Blob([audioBytes], { type: mimeType }), `voice.${ext}`);
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

async function extractDestination(transcript: string): Promise<ExtractedDestination> {
  const systemPrompt = `You are an intelligent taxi dispatcher for the city of Ramadi (الرمادي), Al Anbar (الأنبار), Iraq.
The user has ALREADY shared their GPS pickup location. Now they are telling you their DESTINATION only.
The user speaks in Iraqi Arabic dialect.

Your ONLY job: Extract the destination name EXACTLY as the user says it.

⚠️ STRICT RULE — NUMBERED STREETS:
If the user provides a numbered street (e.g., "شارع 20", "شارع 60", "شارع 17"), YOU MUST KEEP IT EXACTLY AS IS.
DO NOT convert it to a famous landmark or a different street name.

Critical Rules:
1. Every landmark mentioned is in RAMADI — never assume another city.
2. Output the destination name as a clean Arabic search query — do NOT add "الرمادي" yourself.
3. If the user says "أريد أروح" or "وديني" or "لـ" → what follows is the destination.
4. If the user just says a place name, that IS the destination.
5. Keep the name natural: "جامعة الأنبار" not "جامعة الأنبار، الرمادي، العراق".
6. If the user mentions vehicle preference: فخمة/فاخرة → premium, مريحة → comfort, نسائي/بنات → women_only. Otherwise "economy".
7. Extract any notes (مستعجل، قرب الصيدلية، etc).
8. NEVER return an error message. ALWAYS try to extract a destination.
9. NEVER rename, translate, or "correct" the user's destination. Return their words verbatim.

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
// Geocoding: قاعدة بيانات أماكن الرمادي + Nominatim + Google
// ════════════════════════════════════════
interface ResolvedLocation {
  lat: number;
  lng: number;
  address: string;
}

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

  // مطابقة مباشرة
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    if (q === name.toLowerCase() || q === name.toLowerCase().replace("حي ", "")) {
      console.log(`[geocode] LOCAL MATCH (exact): "${query}" → ${name}`);
      return { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
  }

  // مطابقة بالاسماء البديلة
  for (const [name, loc] of Object.entries(RAMADI_LANDMARKS)) {
    for (const alias of loc.aliases) {
      if (q === alias.toLowerCase() || q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
        console.log(`[geocode] LOCAL MATCH (alias "${alias}"): "${query}" → ${name}`);
        return { lat: loc.lat, lng: loc.lng, address: loc.address };
      }
    }
  }

  // مطابقة جزئية بالكلمات
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

async function nominatimGeocode(query: string): Promise<ResolvedLocation | null> {
  try {
    const searches = [
      `${query}, الرمادي, العراق`,
      `${query}, Ramadi, Iraq`,
      query + " الرمادي",
    ];
    for (const searchText of searches) {
      const params = new URLSearchParams({
        q: searchText, format: "json", limit: "3", countrycodes: "iq",
        viewbox: "43.00,33.20,43.55,33.65", bounded: "1", "accept-language": "ar",
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "RAAN-Taxi-App/1.0" },
      });
      if (!response.ok) continue;
      const results = await response.json();
      if (results.length > 0) {
        const best = results[0];
        const lat = parseFloat(best.lat);
        const lng = parseFloat(best.lon);
        const dist = haversineDistance(lat, lng, 33.4233, 43.2974);
        if (dist <= 60) {
          console.log(`[nominatim] MATCH: ${best.display_name} (${dist.toFixed(1)} km)`);
          return { lat, lng, address: best.display_name?.split(",").slice(0, 3).join("،") || query };
        }
      }
    }
  } catch (err) {
    console.error("[nominatim] Error:", err);
  }
  return null;
}

async function resolveRamadiLocation(query: string): Promise<ResolvedLocation | null> {
  const cleanQuery = query.replace(/[.,،]/g, "").trim();
  console.log(`[geocode] Resolving: "${cleanQuery}"`);

  // استراتيجية 0: محلي
  const localMatch = matchLocalLandmark(cleanQuery);
  if (localMatch) return localMatch;

  // استراتيجية 1: Nominatim
  const nominatimResult = await nominatimGeocode(cleanQuery);
  if (nominatimResult) return nominatimResult;

  // استراتيجيات 2-4: Google Geocoding
  const strategies = [
    cleanQuery,
    `${cleanQuery} الرمادي`,
    `${cleanQuery} الأنبار العراق`,
  ];

  for (const addr of strategies) {
    const params = new URLSearchParams({
      address: addr, key: GOOGLE_MAPS_KEY, language: "ar",
      components: "country:IQ", bounds: "33.20,43.00|33.65,43.55",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) {
      const result = data.results[0];
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;
      const dist = haversineDistance(lat, lng, 33.4233, 43.2974);
      if (dist <= 60) {
        return { lat, lng, address: result.formatted_address };
      }
    }
  }

  // استراتيجية 5: Google Places Text Search
  try {
    const placesParams = new URLSearchParams({
      query: `${cleanQuery} الرمادي العراق`, key: GOOGLE_MAPS_KEY,
      language: "ar", location: "33.4233,43.2974", radius: "50000",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${placesParams}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) {
      const place = data.results[0];
      return { lat: place.geometry.location.lat, lng: place.geometry.location.lng, address: place.formatted_address || place.name };
    }
  } catch {}

  console.error(`[geocode] ALL strategies failed for: "${query}"`);
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: GOOGLE_MAPS_KEY, language: "ar" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) return data.results[0].formatted_address;
  } catch (e) {
    console.error("[reverse-geocode] Error:", e);
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ════════════════════════════════════════
// Haversine + حساب الأجرة
// ════════════════════════════════════════
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function estimateFare(distanceKm: number): number {
  const baseFare = 2000;
  const perKmRate = 1000;
  const raw = baseFare + distanceKm * perKmRate;
  return Math.ceil(raw / 250) * 250;
}

// ════════════════════════════════════════
// البحث عن / إنشاء مستخدم واتساب
// ════════════════════════════════════════
async function findOrCreateWhatsAppUser(
  supabase: ReturnType<typeof createClient>,
  phoneNumber: string,
  profileName: string | null
): Promise<string> {
  const waRef = `wa_${phoneNumber}`;
  const email = `wa_${phoneNumber}@whatsapp.raan.app`;
  const displayName = profileName || "راكب واتساب";

  // 1. البحث في profiles
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .or(`phone.eq.${waRef},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (existing?.user_id) {
    console.log(`[auth] Found existing WA user: ${existing.user_id}`);
    return existing.user_id;
  }

  // 2. إنشاء مستخدم جديد
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      source: "whatsapp",
      whatsapp_phone: phoneNumber,
    },
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already been registered")) {
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
      if (!foundUser?.id) throw new Error("WA user registered but not found in admin lookup");
      userId = foundUser.id;
      console.log(`[auth] Found WA user via GoTrue: ${userId}`);
    } else {
      throw new Error(`Failed to create WA auth user: ${authError.message}`);
    }
  } else if (!authData?.user) {
    throw new Error("Failed to create WA auth user: no user returned");
  } else {
    userId = authData.user.id;
    console.log(`[auth] Created new WA auth user: ${userId}`);
  }

  // إنشاء/تحديث profile
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: displayName,
    phone: waRef,
    email,
    status: "active",
  });

  return userId;
}

// ════════════════════════════════════════
// إدارة الحالة: البحث عن draft session
// ════════════════════════════════════════
interface PendingSession {
  ride_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
}

async function findPendingSession(
  supabase: ReturnType<typeof createClient>,
  riderId: string
): Promise<PendingSession | null> {
  const { data } = await supabase
    .from("rides")
    .select("id, pickup_location, pickup_address, dropoff_address")
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
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

async function createPickupSession(
  supabase: ReturnType<typeof createClient>,
  riderId: string,
  lat: number,
  lng: number,
  address: string
): Promise<string> {
  // حذف drafts قديمة
  await supabase
    .from("rides")
    .delete()
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
    .is("dropoff_address", null);

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
      trip_type: "whatsapp",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create WA session: ${error.message}`);
  return data.id;
}

// ════════════════════════════════════════
// 🔍 فحص الرحلات النشطة
// ════════════════════════════════════════
async function checkActiveRide(
  supabase: ReturnType<typeof createClient>,
  riderId: string
): Promise<{ id: string; status: string; pickup_address: string | null; dropoff_address: string | null } | null> {
  const { data } = await supabase
    .from("rides")
    .select("id, status, pickup_address, dropoff_address")
    .eq("rider_id", riderId)
    .in("status", ["pending", "accepted", "arrived", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

// ════════════════════════════════════════
// ════════════════════════════════════════
// Handler الرئيسي
// ════════════════════════════════════════
// ════════════════════════════════════════
serve(async (req) => {
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

  // CRITICAL: Always return 200 fast to Meta
  let body: any;
  try {
    body = await req.json();
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ═══════════════════════════════════
    // 🔘 Interactive Button Reply (تأكيد / إلغاء)
    // ═══════════════════════════════════
    if (msgType === "interactive") {
      const buttonReply = message.interactive?.button_reply;
      if (!buttonReply) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const buttonId = buttonReply.id;
      console.log(`[wa] Button press: ${buttonId}`);

      // ── تأكيد الرحلة ──
      const confirmMatch = buttonId.match(/^confirm_ride_([a-f0-9\-]+)$/);
      if (confirmMatch) {
        const rideId = confirmMatch[1];
        const { data: ride } = await supabase
          .from("rides")
          .select("id, status, dropoff_address")
          .eq("id", rideId)
          .maybeSingle();

        if (!ride || ride.status !== "draft" || !ride.dropoff_address) {
          await sendTextMessage(phoneNumber, "⚠️ هذه الرحلة تم معالجتها مسبقاً.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        // draft → pending
        const { error: statusError } = await supabase
          .from("rides")
          .update({ status: "pending" })
          .eq("id", rideId)
          .eq("status", "draft");

        if (statusError) {
          console.error("[wa] Confirm status update error:", statusError);
          await sendTextMessage(phoneNumber, "⚠️ حدث خطأ تقني. حاول مرة أخرى.");
          return new Response("EVENT_RECEIVED", { status: 200 });
        }

        console.log(`[wa] Ride ${rideId}: draft → pending`);

        // match-ride
        try {
          await supabase.functions.invoke("match-ride", { body: { ride_id: rideId } });
          console.log(`[wa] match-ride invoked for ${rideId}`);
        } catch (matchErr) {
          console.warn("[wa] match-ride failed (non-critical):", matchErr);
        }

        await sendTextMessage(phoneNumber, MESSAGES.rideConfirmed);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── إلغاء الرحلة ──
      const cancelMatch = buttonId.match(/^cancel_ride_([a-f0-9\-]+)$/);
      if (cancelMatch) {
        const rideId = cancelMatch[1];
        await supabase
          .from("rides")
          .update({ status: "cancelled", cancellation_reason: "ألغيت من قبل الراكب (واتساب)" })
          .eq("id", rideId)
          .in("status", ["draft", "pending"]);

        await sendTextMessage(phoneNumber, MESSAGES.rideCancelled);
        console.log(`[wa] Ride ${rideId} cancelled`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── استمر بالبحث ──
      if (buttonId === "keep_searching") {
        await sendTextMessage(phoneNumber, "👌 ما يخالف، نستمر بالبحث عن كابتن.");
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

      // التحقق: داخل الرمادي؟
      const distFromCenter = haversineDistance(lat, lng, 33.4233, 43.2974);
      if (distFromCenter > 60) {
        await sendTextMessage(phoneNumber, MESSAGES.locationTooFar);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      const address = await reverseGeocode(lat, lng);
      console.log(`[wa] Reverse geocoded: ${address}`);

      const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
      const sessionId = await createPickupSession(supabase, riderId, lat, lng, address);
      console.log(`[wa] Session created: ${sessionId}`);

      await sendTextMessage(phoneNumber, MESSAGES.locationReceived(address));
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ═══════════════════════════════════
    // 🎤 صوت أو ✏️ نص
    // ═══════════════════════════════════
    const hasAudio = msgType === "audio";
    const hasText = msgType === "text" && !!message.text?.body;

    if (!hasAudio && !hasText) {
      // نوع غير مدعوم (صورة، فيديو، ملصق...)
      await sendTextMessage(phoneNumber, MESSAGES.welcome);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── إذا أرسل المستخدم "ران" أو أي تحية → رسالة ترحيب ──
    if (hasText) {
      const txt = message.text.body.trim().toLowerCase();
      if (["ران", "raan", "start", "مرحبا", "مرحبه", "هلا", "هلو", "اهلا", "السلام عليكم", "hi", "hello"].includes(txt)) {
        await sendTextMessage(phoneNumber, MESSAGES.welcome);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    }

    // ── فحص إذا المستخدم موجود ──
    const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);

    // ── 🧠 ذاكرة الرحلة النشطة ──
    const activeRide = await checkActiveRide(supabase, riderId);
    if (activeRide) {
      console.log(`[wa] Active ride: ${activeRide.id} (${activeRide.status})`);

      if (activeRide.status === "pending") {
        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.activeRidePending(activeRide.pickup_address || "موقعك", activeRide.dropoff_address || "الوجهة"),
          [
            { id: `cancel_ride_${activeRide.id}`, title: "❌ إلغاء الرحلة" },
            { id: "keep_searching", title: "🔄 استمر بالبحث" },
          ]
        );
      } else {
        const statusText = activeRide.status === "accepted" ? "الكابتن في الطريق إليك" :
                          activeRide.status === "arrived" ? "الكابتن وصل" : "الرحلة جارية";
        await sendTextMessage(phoneNumber, MESSAGES.activeRideWithDriver(statusText));
      }
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── هل يوجد session (draft بدون وجهة)؟ ──
    const session = await findPendingSession(supabase, riderId);

    if (!session) {
      // لا يوجد session — اطلب الموقع أولاً
      await sendTextMessage(phoneNumber, MESSAGES.needLocationFirst);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    console.log(`[wa] Session found: ${session.ride_id}`);
    await sendTextMessage(phoneNumber, MESSAGES.processing);

    // ── الحصول على نص الوجهة ──
    let userText = "";

    if (hasAudio) {
      const mediaId = message.audio.id;
      const mimeType = message.audio.mime_type || "audio/ogg; codecs=opus";
      console.log(`[wa] Downloading audio: ${mediaId}, mime: ${mimeType}`);

      const audioBytes = await downloadWhatsAppMedia(mediaId);
      console.log(`[wa] Downloaded ${audioBytes.length} bytes`);

      userText = await transcribeAudio(audioBytes, mimeType);
      console.log(`[whisper] Transcript: "${userText}"`);

      if (!userText || userText.trim().length < 2) {
        await sendTextMessage(phoneNumber, MESSAGES.noTranscript);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    } else {
      userText = message.text.body;
      console.log(`[wa] Text: "${userText}"`);
    }

    // ── GPT-4o: استخراج الوجهة ──
    console.log("[gpt4o] Extracting destination...");
    const intent = await extractDestination(userText);
    console.log("[gpt4o] Result:", JSON.stringify(intent));

    if (!intent.destination_search_query || intent.destination_search_query.trim().length < 2) {
      await sendTextMessage(phoneNumber, MESSAGES.noDestination);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── Geocoding ──
    const destination = await resolveRamadiLocation(intent.destination_search_query);
    if (!destination) {
      await sendTextMessage(phoneNumber, MESSAGES.geocodeFailed(intent.destination_search_query));
      return new Response("EVENT_RECEIVED", { status: 200 });
    }
    console.log(`[geocode] Resolved: ${destination.address} (${destination.lat}, ${destination.lng})`);

    // ── حساب المسافة والأجرة ──
    const distanceKm = haversineDistance(session.pickup_lat, session.pickup_lng, destination.lat, destination.lng);
    const fare = estimateFare(distanceKm);
    console.log(`[fare] Distance: ${distanceKm.toFixed(2)} km, Fare: ${fare} IQD`);

    // ── تحديث الرحلة بالوجهة ──
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
    } catch {}

    // Always return 200 so Meta doesn't retry
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
});
