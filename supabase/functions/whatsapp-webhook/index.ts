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
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

// ════════════════════════════════════════
// المتغيرات — تُحمّل ديناميكياً من system_configs
// (مع احتياط من متغيرات البيئة عبر config helper)
// ════════════════════════════════════════
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let VERIFY_TOKEN = "";
let WHATSAPP_ACCESS_TOKEN = "";
let WHATSAPP_PHONE_ID = "";
let OPENAI_API_KEY = "";
let GOOGLE_MAPS_KEY = "";
let SITE_URL = "https://raanai.lovable.app";
let GRAPH_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_ID",
      "OPENAI_API_KEY",
      "GOOGLE_MAPS_KEY",
      "SITE_URL",
    ]);
    VERIFY_TOKEN = cfg["WHATSAPP_VERIFY_TOKEN"] || VERIFY_TOKEN;
    WHATSAPP_ACCESS_TOKEN = cfg["WHATSAPP_ACCESS_TOKEN"] || WHATSAPP_ACCESS_TOKEN;
    WHATSAPP_PHONE_ID = cfg["WHATSAPP_PHONE_ID"] || WHATSAPP_PHONE_ID;
    OPENAI_API_KEY = cfg["OPENAI_API_KEY"] || OPENAI_API_KEY;
    GOOGLE_MAPS_KEY = cfg["GOOGLE_MAPS_KEY"] || GOOGLE_MAPS_KEY;
    SITE_URL = cfg["SITE_URL"] || SITE_URL;
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    _configLoaded = true;
    console.log("[wa] ✅ Dynamic config loaded from system_configs");
  } catch (e) {
    console.warn("[wa] ⚠️ Config load failed, using env fallbacks:", e);
    // احتياط: متغيرات البيئة
    VERIFY_TOKEN = VERIFY_TOKEN || Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
    WHATSAPP_ACCESS_TOKEN = WHATSAPP_ACCESS_TOKEN || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    WHATSAPP_PHONE_ID = WHATSAPP_PHONE_ID || Deno.env.get("WHATSAPP_PHONE_ID") || "";
    OPENAI_API_KEY = OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY") || "";
    GOOGLE_MAPS_KEY = GOOGLE_MAPS_KEY || Deno.env.get("GOOGLE_MAPS_KEY") || "";
    SITE_URL = SITE_URL || Deno.env.get("SITE_URL") || "https://raanai.lovable.app";
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
  }
}

// ════════════════════════════════════════
// الرسائل العربية الثابتة
// ════════════════════════════════════════
const MESSAGES = {
  welcome: `هلا بيك عميلنا العزيز! 🚕\nعلمود نحسب لك السعر المضبوط، دز لنا موقعك الحالي بالضغط على الزر الموجود جوة هذه الرسالة 👇`,

  welcomeMenu: (name: string) =>
    `أهلاً بك أستاذ ${name} في تكسي ران! 🚕\nشلون نكدر نخدمك اليوم؟`,

  inquiryPrompt: (name: string) =>
    `تفضل أستاذ ${name}، اسأل أي سؤال أو اكتب شكواك وإن شاء الله نساعدك 🙏`,

  askForLocation: (name: string) =>
    `على راسي أستاذ ${name}! 🚕\nعلمود نحسب لك السعر المضبوط، دز لنا موقعك الحالي بالضغط على الزر الموجود جوة هذه الرسالة 👇`,

  locationReceived: (address: string, name?: string) =>
    `✅ عاشت ايدك${name ? ` أستاذ ${name}` : ""}، حددنا مكانك في: 📍 ${address}\n\nهسة دز رسالة صوتية 🎙️ وكول وين تريد تروح؟\nأو اكتب اسم الوجهة بالنص.`,

  needLocationFirst: `عفواً، لازم تدز موقعك أول شي! 📍\nاضغط على الزر أدناه لمشاركة موقعك 👇`,

  needLocationWithButton: (name?: string) =>
    `عفواً${name ? ` أستاذ ${name}` : ""}، لازم تدز موقعك أول شي! 📍\nاضغط على الزر أدناه لمشاركة موقعك 👇`,

  processing: "جاري تحليل طلبك... 🤖",

  noTranscript: "❌ ما كدرت أفهم الصوت. جرب مرة ثانية بصوت أوضح.",

  noDestination: `❌ ما فهمت الوجهة. كول مثلاً:\n"أريد أروح لجامعة الأنبار"\nأو اكتبها بالنص.`,

  geocodeFailed: (place: string, name?: string) =>
    `على راسي${name ? ` أستاذ ${name}` : ""}، بس ما كدرت ألاقي "${place}" على الخريطة 🗺️\nيا ريت تنطيني أقرب نقطة دالة أو تضغط على زر إرسال الموقع حتى الكابتن يوصلك للباب بدون تأخير 🙏`,

  confirmationPrompt: (origin: string, destination: string, fare: number, distanceKm: number) =>
    `🚕 *تأكيد الرحلة*\n\n📍 *من:* ${origin}\n🏁 *إلى:* ${destination}\n📏 *المسافة:* ${distanceKm.toFixed(1)} كم\n💰 *السعر التقديري:* ${fare.toLocaleString()} د.ع\n\nهل تريد تأكيد الرحلة؟ 👇`,

  rideConfirmed: `✅ *تم تأكيد الطلب!*\nجاري البحث عن أقرب كابتن لك... 🚗`,

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
// WhatsApp Cloud API: طلب الموقع (زر إرسال الموقع الأصلي)
// ════════════════════════════════════════
async function sendLocationRequest(to: string, bodyText: string) {
  try {
    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "location_request_message",
          body: { text: bodyText },
          action: { name: "send_location" },
        },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendLocationRequest (${res.status}): ${result.substring(0, 300)}`);
  } catch (e) {
    console.error("[wa] sendLocationRequest failed:", e);
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
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id.substring(0, 256), title: b.title.substring(0, 20) },
          })),
        },
      },
    };

    console.log(`[wa] sendButtons payload to ${to}:`, JSON.stringify(payload).substring(0, 500));

    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await res.text();
    if (!res.ok) {
      console.error(`[wa] sendButtons FAILED (${res.status}) to ${to}:`, result);
    } else {
      console.log(`[wa] ✅ sendButtons OK to ${to}:`, result.substring(0, 200));
    }
  } catch (e) {
    console.error("[wa] sendInteractiveButtons failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: إرسال قائمة تفاعلية (List Message)
// ════════════════════════════════════════
async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
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
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      }),
    });
    const result = await res.text();
    console.log(`[wa] sendListMessage (${res.status}): ${result.substring(0, 300)}`);
  } catch (e) {
    console.error("[wa] sendListMessage failed:", e);
  }
}

// ════════════════════════════════════════
// WhatsApp Cloud API: تحميل ملف صوتي (خطوتين)
// ════════════════════════════════════════
async function downloadWhatsAppMedia(mediaId: string): Promise<Uint8Array> {
  // الخطوة 1: جلب URL الملف
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
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
  is_destination: boolean;
  conversation_reply: string | null;
}

async function extractDestination(transcript: string, userName: string, userLat = 33.4233, userLng = 43.2974): Promise<ExtractedDestination> {
  const systemPrompt = `You are 'Raan' (ران), a highly polite, cooperative, and smart Iraqi taxi dispatcher bot operating in Al Anbar Governorate (محافظة الأنبار), Iraq.
User Name: ${userName}

Context for this session:
- The user is currently located at coordinates: LAT ${userLat.toFixed(4)}, LNG ${userLng.toFixed(4)}.
- The operational area is the ENTIRE Al Anbar Governorate (e.g., Ramadi, Fallujah, Hit, Haditha, etc.).
- When the user asks to go to a named place (e.g., a restaurant, hospital, or market), you MUST assume they mean the branch or location NEAREST to their current coordinates. Do not assume Ramadi if they are starting from Fallujah.

The user has ALREADY shared their GPS pickup location. Now they are expected to tell you their DESTINATION.

FIRST: Determine if the user's message is actually a destination/ride request, or something else (question, complaint, chat).

═══ IF IT IS A DESTINATION (set "is_destination": true): ═══
Extract the destination name EXACTLY as the user says it.

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

═══ IF IT IS NOT A DESTINATION (set "is_destination": false): ═══
The user may be asking a question, complaining, or chatting. Respond with empathy in Iraqi dialect.

Behavioral Rules:
1. **Politeness & Empathy:** If the user complains ("تأخرت", "وين الكابتن", "أسرعوا") → respond with immense politeness: "حقك علينا أستاذ ${userName}، ثواني وأستعجل الكابتن، تدلل وما يصير خاطرك إلا طيب 🙏"
2. **Inquiries:** If asking about prices, how to use, service area → answer directly. Prices start at 2000 IQD + 1000 IQD/km. We serve Ramadi and surroundings.
3. **Dialect:** Use warm Iraqi dialect (تدلل، على راسي، عيوني، كابتن، ما يخالف).
4. **Never be defensive.** Always apologize and be helpful.
5. Gently remind them they can send their destination whenever ready.

═══ GEOGRAPHIC & OUT-OF-BOUNDS RULES (CRITICAL): ═══
You must analyze the user's requested location. If it is OUTSIDE Iraq, you MUST reject the ride using EXACTLY the following rules based on the region:

1. **Iran or Israel:** If the location is in Iran (إيران) or Israel (إسرائيل), reject with this exact phrase only: "لا نعمل هنا مطلقاً."
2. **Neighboring Countries (Jordan, Syria, Saudi Arabia, Kuwait, Turkey):** Reject politely: "نعتذر، لا نعمل الآن في [اسم الدولة]."
3. **Other Arab/Asian/Gulf Countries (UAE, Qatar, Egypt, Lebanon, etc.):** Reject playfully: "بعدنا ما فتحنا فرع في [اسم الدولة]! 😅 خدماتنا حالياً تقتصر على العراق وتحديداً الأنبار، بس نوصلكم ندزلك خبر!"
4. **Far Countries (Europe, Americas, Australia, etc.):** Reject with humor: "عذراً، ران إلى الآن لم تمتلك طائرة ✈️! خدماتنا مخصصة للسيارات داخل العراق فقط."

CRITICAL: Do NOT attempt to calculate prices or search for drivers if the location falls into any of the above 4 categories. Set is_destination to false and put the mapped response in conversation_reply.

Respond in JSON ONLY:
{
  "destination_search_query": "اسم الوجهة أو فارغ",
  "vehicle_type": "economy",
  "notes": null,
  "is_destination": true,
  "conversation_reply": null
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
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GPT-4o API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from GPT-4o");

  const parsed = JSON.parse(content);
  return {
    destination_search_query: parsed.destination_search_query || "",
    vehicle_type: parsed.vehicle_type || "economy",
    notes: parsed.notes || null,
    is_destination: parsed.is_destination !== false,
    conversation_reply: parsed.conversation_reply || null,
  };
}

// ════════════════════════════════════════
// 🤖 تصنيف النية والرد الذكي (بدون session)
// ════════════════════════════════════════
async function classifyAndRespond(
  userText: string,
  userName: string
): Promise<{
  intent: "booking" | "inquiry" | "complaint" | "greeting" | "unknown";
  reply: string;
  destination_hint: string | null;
}> {
  const systemPrompt = `أنت "ران"، بوت تكسي عراقي ذكي ومهذب جداً يعمل في مدينة الرمادي، محافظة الأنبار، العراق.
اسم المستخدم: ${userName}

مهمتك: صنّف رسالة المستخدم وأجب عليها بلهجة عراقية دافئة ومحترمة.

القواعد السلوكية:
1. **الأدب والتعاطف**: إذا اشتكى المستخدم أو تضايق أو قال "تأخرت" أو "أسرعوا" أو "وين الكابتن" → رد بأدب شديد وتعاطف. مثال: "حقك علينا أستاذ ${userName}، ثواني وأستعجل الكابتن، تدلل وما يصير خاطرك إلا طيب 🙏"
2. **الاستفسارات**: إذا سأل سؤال عام (أسعار، كيف أستخدم، وين تخدمون، شنو ران) → أجب مباشرة بأدب بدون بدء حجز. أسعارنا تبدأ من 2000 دينار عراقي + 1000 دينار لكل كيلومتر. نخدم الرمادي وضواحيها.
3. **المواقع الغامضة**: إذا ذكر مكان غامض → اطلب نقطة دالة: "على راسي أستاذ، بس يا ريت تنطيني أقرب نقطة دالة أو تضغط على زر إرسال الموقع حتى الكابتن يوصلك للباب بدون تأخير"
4. **اللهجة**: استخدم لهجة عراقية دافئة ومحترمة (تدلل، على راسي، عيوني، كابتن، ما يخالف، إن شاء الله).
5. **الحجز**: إذا المستخدم يريد حجز رحلة أو ذكر وجهة → صنّفه كـ "booking" وكن ودوداً.
6. **لا تكن دفاعياً أبداً**: دائماً اعتذر واطلب السماح.

═══ قواعد الموقع الجغرافي (حرجة): ═══
إذا ذكر المستخدم موقع أو دولة خارج العراق، يجب رفض الطلب حسب المنطقة:
1. **إيران أو إسرائيل**: الرد بالضبط: "لا نعمل هنا مطلقاً." — بدون أي مجاملات.
2. **دول مجاورة (الأردن، سوريا، السعودية، الكويت، تركيا)**: "نعتذر، لا نعمل الآن في [اسم الدولة]."
3. **دول عربية/آسيوية أخرى (الإمارات، قطر، مصر، لبنان...)**: "بعدنا ما فتحنا فرع في [اسم الدولة]! 😅 خدماتنا حالياً تقتصر على العراق وتحديداً الأنبار، بس نوصلكم ندزلك خبر!"
4. **دول بعيدة (أوروبا، أمريكا، أستراليا...)**: "عذراً، ران إلى الآن لم تمتلك طائرة ✈️! خدماتنا مخصصة للسيارات داخل العراق فقط."
مهم: لا تحاول حساب سعر أو بحث عن كابتن لمواقع خارج العراق. صنّف النية كـ "inquiry" واستخدم الرد المناسب.

أنواع النوايا:
- "booking": يريد حجز رحلة أو ذكر وجهة
- "inquiry": سؤال عام عن الخدمة أو الأسعار أو التطبيق
- "complaint": شكوى أو تذمر
- "greeting": تحية عامة (مرحبا، هلو، السلام عليكم)
- "unknown": غير واضح

أجب بـ JSON فقط:
{
  "intent": "نوع النية",
  "reply": "ردك بالعراقي — قصير ولطيف ومحترم",
  "destination_hint": "اسم الوجهة إذا ذكرها، أو null"
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
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error(`[classify] GPT-4o error: ${response.status}`);
      return { intent: "unknown", reply: `أهلاً أستاذ ${userName}، شلون نكدر نساعدك اليوم؟ 🚕`, destination_hint: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { intent: "unknown", reply: `أهلاً أستاذ ${userName}، شلون نكدر نساعدك؟ 🚕`, destination_hint: null };
    }

    const parsed = JSON.parse(content);
    return {
      intent: parsed.intent || "unknown",
      reply: parsed.reply || `تدلل أستاذ ${userName}، شلون نكدر نخدمك؟`,
      destination_hint: parsed.destination_hint || null,
    };
  } catch (err) {
    console.error("[classify] Error:", err);
    return { intent: "unknown", reply: `عذراً أستاذ ${userName}، ممكن توضح طلبك أكثر؟ 🙏`, destination_hint: null };
  }
}

// ════════════════════════════════════════
// 🕒 GPT-4o: استخراج تفاصيل الحجز المجدول
// ════════════════════════════════════════
interface ScheduledRideDetails {
  pickup_query: string;
  dropoff_query: string;
  scheduled_time: string | null; // ISO format
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
1. **pickup_query**: Where they want to be picked up (Arabic place name). If they say "بيتي" or "من عندي", return "موقع المستخدم" — they will share GPS later.
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
      console.error(`[schedule] GPT-4o error: ${response.status}`);
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

async function nominatimGeocode(query: string, userLat = 33.4233, userLng = 43.2974): Promise<ResolvedLocation | null> {
  try {
    // بناء viewbox ديناميكي حول موقع المستخدم (±0.25 درجة ≈ 25 كم)
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
        q: searchText, format: "json", limit: "3", countrycodes: "iq",
        viewbox, bounded: "0", "accept-language": "ar",
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
        const dist = haversineDistance(lat, lng, userLat, userLng);
        if (dist <= 80) {
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

async function resolveRamadiLocation(query: string, userLat = 33.4233, userLng = 43.2974): Promise<ResolvedLocation | null> {
  const cleanQuery = query.replace(/[.,،]/g, "").trim();
  console.log(`[geocode] Resolving: "${cleanQuery}" (user@${userLat.toFixed(4)},${userLng.toFixed(4)})`);

  // استراتيجية 0: محلي
  const localMatch = matchLocalLandmark(cleanQuery);
  if (localMatch) return localMatch;

  // استراتيجية 1: Nominatim (مع location bias)
  const nominatimResult = await nominatimGeocode(cleanQuery, userLat, userLng);
  if (nominatimResult) return nominatimResult;

  // بناء bounds ديناميكي حول موقع المستخدم
  const boundsStr = `${(userLat - 0.25).toFixed(2)},${(userLng - 0.35).toFixed(2)}|${(userLat + 0.25).toFixed(2)},${(userLng + 0.35).toFixed(2)}`;

  // استراتيجيات 2-4: Google Geocoding
  const strategies = [
    cleanQuery,
    `${cleanQuery} الأنبار`,
    `${cleanQuery} الأنبار العراق`,
  ];

  for (const addr of strategies) {
    const params = new URLSearchParams({
      address: addr, key: GOOGLE_MAPS_KEY, language: "ar",
      components: "country:IQ", bounds: boundsStr,
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) {
      const result = data.results[0];
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;
      const dist = haversineDistance(lat, lng, userLat, userLng);
      if (dist <= 80) {
        return { lat, lng, address: result.formatted_address };
      }
    }
  }

  // استراتيجية 5: Google Places Text Search (مع location bias)
  try {
    const placesParams = new URLSearchParams({
      query: `${cleanQuery} الأنبار العراق`, key: GOOGLE_MAPS_KEY,
      language: "ar", location: `${userLat},${userLng}`, radius: "50000",
    });
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${placesParams}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]) {
      const place = data.results[0];
      return { lat: place.geometry.location.lat, lng: place.geometry.location.lng, address: place.formatted_address || place.name };
    }
  } catch { }

  console.error(`[geocode] ALL strategies failed for: "${query}"`);
  return null;
}

/**
 * استخراج عنوان مختصر (حي + مدينة) من نتائج Google Geocoding
 * يرجع عنوان مثل: "حي التأميم، الرمادي" أو "شارع المستودع، الرمادي"
 */
function extractConciseAddress(results: any[]): string | null {
  try {
    const result = results[0];
    const components = result.address_components || [];

    // استخراج أجزاء العنوان حسب الأولوية
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
    // اختيار أفضل وصف للمنطقة: الحي > الشارع > المنطقة الفرعية
    const area = neighborhood || route || sublocality;

    if (area && city) return `${area}، ${city}`;
    if (area) return area;
    if (city) return city;

    // إذا ما لقينا أجزاء مناسبة، نرجع أقصر نتيجة من Google
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
    const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: GOOGLE_MAPS_KEY, language: "ar", result_type: "street_address|neighborhood|sublocality|locality" });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const concise = extractConciseAddress(data.results);
      if (concise) {
        console.log(`[reverse-geocode] Google concise: ${concise}`);
        return concise;
      }
      // fallback للعنوان الكامل من Google
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
        // أخذ أول جزئين من العنوان
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

async function calculateFareFromEdge(
  supabase: any,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  distanceKm: number,
  vehicleType: string = "economy"
): Promise<number> {
  try {
    const { data, error } = await supabase.functions.invoke("calculate-fare", {
      body: {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        distance_km: distanceKm,
        vehicle_type: vehicleType,
      },
    });
    if (error) throw error;
    if (data?.total_fare) return Math.ceil(data.total_fare / 250) * 250;
    // fallback
    return estimateFareLocal(distanceKm);
  } catch (e) {
    console.warn("[fare] Edge function failed, using local fallback:", e);
    return estimateFareLocal(distanceKm);
  }
}

function estimateFareLocal(distanceKm: number): number {
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
  // 🔥 SECURITY: إلغاء أي رحلات نشطة سابقة (راكب واحد = رحلة واحدة فقط)
  const { data: cancelledRides } = await supabase
    .from("rides")
    .update({ status: "cancelled", cancelled_by: "system", cancellation_reason: "تم إلغاؤها تلقائياً: طلب رحلة جديدة" })
    .eq("rider_id", riderId)
    .in("status", ["pending", "accepted", "arrived", "in_progress"])
    .select("id");

  if (cancelledRides && cancelledRides.length > 0) {
    console.log(`[wa] 🔥 Auto-cancelled ${cancelledRides.length} active ride(s) for rider ${riderId}:`, cancelledRides.map(r => r.id));
  }

  // حذف drafts قديمة
  await supabase
    .from("rides")
    .delete()
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
    .is("dropoff_address", null);

  // مسح sub-state الدردشة (إن وجد)
  try {
    await supabase.from("bot_customers").update({ last_intent: null })
      .eq("platform", "whatsapp")
      .ilike("platform_id", `%`)
      .eq("last_intent", `chatting_with_driver:%`);
  } catch { } // صامت

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    // تحديث عدد التفاعلات
    await supabase.rpc("increment_bot_customer_interactions", {
      p_platform: "whatsapp",
      p_platform_id: phoneNumber,
    }).then(() => { }).catch(() => { }); // صامت — إذا الدالة غير موجودة لا يأثر
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

      const buttonId = buttonReply?.id || listReply?.id;
      console.log(`[wa] Interactive reply: ${buttonId}`);

      // ── قائمة الترحيب: حجز رحلة ──
      if (buttonId === "action_book_ride") {
        const userName = profileName || "عزيزي";
        await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الترحيب: استفسار أو شكوى ──
      if (buttonId === "action_inquiry") {
        const userName = profileName || "عزيزي";
        await sendTextMessage(phoneNumber, MESSAGES.inquiryPrompt(userName));
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الترحيب: خيارات أخرى (قائمة تفاعلية) ──
      if (buttonId === "action_other_options") {
        const userName = profileName || "عزيزي";
        await sendListMessage(
          phoneNumber,
          `أستاذ ${userName}، اختر من القائمة 👇`,
          "📋 عرض الخيارات",
          [
            {
              title: "خدمات إضافية",
              rows: [
                { id: "action_scheduled_ride", title: "🗓️ حجز مجدول", description: "احجز رحلة بوقت محدد" },
                { id: "action_my_rides", title: "🚕 رحلاتي السابقة", description: "عرض سجل رحلاتك" },
                { id: "action_my_balance", title: "💰 رصيدي", description: "معرفة رصيدك الحالي" },
                { id: "action_my_info", title: "👤 معلوماتي", description: "عرض وتعديل بياناتك" },
              ],
            },
          ]
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الخيارات: حجز مجدول ──
      if (buttonId === "action_scheduled_ride") {
        const userName = profileName || "عزيزي";
        // حفظ حالة المستخدم كـ awaiting_schedule
        await supabase.from("bot_customers").update({
          last_intent: "awaiting_schedule",
        }).eq("platform", "whatsapp").eq("platform_id", phoneNumber);

        await sendTextMessage(phoneNumber,
          `ممتاز أستاذ ${userName}! 🕒\n\nأرسل لي موقعك والوجهة والوقت والتاريخ الذي تريد فيه السيارة.\n\n*مثال:* غداً الساعة 8 صباحاً من بيتي لجامعة الأنبار\n\nأو دز موقعك أول شي ثم اكتب الوجهة والوقت 📍`
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الخيارات: رحلاتي السابقة ──
      if (buttonId === "action_my_rides") {
        const userName = profileName || "عزيزي";
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: rides } = await supabase
          .from("rides")
          .select("id, pickup_address, dropoff_address, status, estimated_fare, created_at")
          .eq("rider_id", riderId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(3);

        if (!rides || rides.length === 0) {
          await sendTextMessage(phoneNumber, `لم تقم بأي رحلة معنا حتى الآن! 🚕`);
        } else {
          let msg = `🚕 *آخر رحلاتك يا أستاذ ${userName}:*\n\n`;
          rides.forEach((r, i) => {
            msg += `${i + 1}. من ${r.pickup_address || "—"} إلى ${r.dropoff_address || "—"} | السعر: ${r.estimated_fare?.toLocaleString() || "—"} د.ع ✅\n\n`;
          });
          await sendTextMessage(phoneNumber, msg);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الخيارات: رصيدي ──
      if (buttonId === "action_my_balance") {
        const userName = profileName || "عزيزي";
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", riderId)
          .maybeSingle();

        const balance = profile?.wallet_balance ?? 0;
        await sendTextMessage(phoneNumber, `رصيدك الحالي في محفظة ران هو: *${balance.toLocaleString()} دينار عراقي* 💰`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ── قائمة الخيارات: معلوماتي ──
      if (buttonId === "action_my_info") {
        const userName = profileName || "عزيزي";
        const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, created_at")
          .eq("id", riderId)
          .maybeSingle();

        // عدد الرحلات المكتملة
        const { count: ridesCount } = await supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("rider_id", riderId)
          .eq("status", "completed");

        if (profile) {
          await sendTextMessage(phoneNumber,
            `ملفك الشخصي 👤:\n\n` +
            `الاسم: ${profile.full_name || profileName || "غير محدد"}\n` +
            `رقم الهاتف: ${profile.phone || phoneNumber}\n` +
            `إجمالي رحلاتك: ${ridesCount ?? 0} رحلة 🚕`
          );
        } else {
          await sendTextMessage(phoneNumber, `أستاذ ${userName}، ما كدرنا نجيب معلوماتك حالياً. حاول مرة ثانية ⚠️`);
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

      // ══════════════════════════════════════════════════════════
      // 🚗 حجز رحلة جديدة (من قائمة الإلغاء)
      // ══════════════════════════════════════════════════════════
      if (buttonId === "action_book_ride") {
        await sendTextMessage(phoneNumber,
          "🚗 *حجز رحلة جديدة*\n\nأرسل موقعك الحالي 📍 وراح نبدأ بالبحث عن كابتن فوراً!"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // 📞 المساعدة والاستفسارات
      // ══════════════════════════════════════════════════════════
      if (buttonId === "action_inquiry") {
        await sendTextMessage(phoneNumber,
          "📞 *المساعدة والاستفسارات*\n\nللتواصل مع فريق الدعم:\n📱 واتساب: 07700000000\n📧 support@raantaxi.com\n\nأو أرسل سؤالك هنا وسنرد عليك بأسرع وقت! 🙏"
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // 📍 PARALLEL ACTION: Live Driver Location (track_ button)
      // لا يغيّر حالة الرحلة — فقط يرسل رابط التتبع
      // ══════════════════════════════════════════════════════════
      const trackMatch = buttonId.match(/^track_([a-f0-9\-]+)$/);
      if (trackMatch) {
        const rideId = trackMatch[1];
        console.log(`[wa] 📍 Track button pressed for ride: ${rideId}`);

        try {
          const { data: token } = await supabase
            .rpc("generate_ride_tracking_token", { p_ride_id: rideId });
          if (token) {
            await sendTextMessage(phoneNumber,
              `📍 *تتبع مسار الكابتن لحظة بلحظة:*\n\n${SITE_URL}/track/${token}\n\nافتح الرابط وراح تشوف موقع السيارة مباشرة على الخريطة! 🗺️`
            );
          } else {
            await sendTextMessage(phoneNumber, "⚠️ عذراً، ما كدرنا نولّد رابط التتبع. حاول مرة ثانية.");
          }
        } catch (e) {
          console.error("[wa] Track link generation failed:", e);
          await sendTextMessage(phoneNumber, "⚠️ حدث خطأ تقني. حاول مرة ثانية.");
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // 💬 PARALLEL ACTION: Proxy Chat (chat_ button)
      // يضع المستخدم في sub-state: chatting_with_driver
      // لا يغيّر حالة الرحلة — المحادثة مستقلة تماماً
      // ══════════════════════════════════════════════════════════
      const chatMatch = buttonId.match(/^chat_([a-f0-9\-]+)$/);
      if (chatMatch) {
        const rideId = chatMatch[1];
        console.log(`[wa] 💬 Chat button pressed for ride: ${rideId}`);

        // حفظ sub-state في bot_customers
        try {
          await supabase.from("bot_customers").update({
            last_intent: `chatting_with_driver:${rideId}`,
          }).eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        } catch (e) {
          console.warn("[wa] Failed to set chat sub-state:", e);
        }

        await sendTextMessage(phoneNumber,
          `💬 *اكتب رسالتك للكابتن الآن وسأقوم بإيصالها فوراً* 👇\n\n_(لإلغاء المحادثة أرسل "خلص" أو "انتهيت")_`
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // ══════════════════════════════════════════════════════════
      // ⭐ PARALLEL ACTION: Driver Rating (rate_ button)
      // يحفظ التقييم في ride_ratings — لا يغيّر حالة الرحلة
      // ══════════════════════════════════════════════════════════
      const rateMatch = buttonId.match(/^rate_([a-f0-9\-]+)_(\d+)$/);
      if (rateMatch) {
        const rideId = rateMatch[1];
        const rating = parseInt(rateMatch[2], 10);
        console.log(`[wa] ⭐ Rating: ${rating} stars for ride ${rideId}`);

        try {
          const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);

          // جلب driver_id من الرحلة
          const { data: ride } = await supabase
            .from("rides")
            .select("driver_id")
            .eq("id", rideId)
            .maybeSingle();

          if (ride?.driver_id) {
            // إدراج أو تحديث التقييم
            await supabase.from("ride_ratings").upsert({
              ride_id: rideId,
              rider_id: riderId,
              driver_id: ride.driver_id,
              rating: rating,
              created_at: new Date().toISOString(),
            }, {
              onConflict: "ride_id,rider_id",
            });

            // تحديث متوسط تقييم السائق
            const { data: avgData } = await supabase
              .from("ride_ratings")
              .select("rating")
              .eq("driver_id", ride.driver_id);

            if (avgData && avgData.length > 0) {
              const avgRating = avgData.reduce((sum: number, r: any) => sum + r.rating, 0) / avgData.length;
              await supabase.from("drivers")
                .update({ rating: Math.round(avgRating * 10) / 10 })
                .eq("id", ride.driver_id);
            }

            const stars = "⭐".repeat(rating);
            await sendTextMessage(phoneNumber,
              `${stars}\n\n✅ *شكراً لتقييمك!*\nتقييمك يساعدنا نقدم خدمة أفضل. 🙏\n\nلطلب رحلة جديدة، دز موقعك الحالي 📍`
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

      const userName = profileName || "عزيزي";
      await sendTextMessage(phoneNumber, MESSAGES.locationReceived(address, userName));
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ═══════════════════════════════════
    // 🎤 صوت أو ✏️ نص
    // ═══════════════════════════════════
    const hasAudio = msgType === "audio";
    const hasText = msgType === "text" && !!message.text?.body;

    if (!hasAudio && !hasText) {
      // نوع غير مدعوم (صورة، فيديو، ملصق...) — أرسل قائمة الترحيب
      const userName = profileName || "عزيزي";
      await sendInteractiveButtons(
        phoneNumber,
        MESSAGES.welcomeMenu(userName),
        [
          { id: "action_book_ride", title: "🚕 حجز رحلة الان" },
          { id: "action_inquiry", title: "💬 استفسار سريع" },
          { id: "action_other_options", title: "📋 المزيد" },
        ]
      );
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── إذا أرسل المستخدم تحية → قائمة ترحيب بأزرار ──
    // كشف التحية بـ regex لتغطية الاختلافات (هلوووو، مرحبااا، السلام عليكم ورحمة الله...)
    if (hasText) {
      const txt = message.text.body.trim();
      const txtLower = txt.toLowerCase();
      const isGreeting =
        // قائمة المطابقة الدقيقة
        ["ران", "raan", "start"].includes(txtLower) ||
        // أنماط التحية العربية (مع تكرار الحروف والتشكيل)
        /^(هلو+|هلا+|مرحبا+[ً]?[ه]?|مرحبتين|اهلا+[ً]?|أهلا+[ً]?|اهلين|سلام+|السلام\s*عليكم.*|صباح\s*(الخير|النور)|مساء\s*(الخير|النور)|شلون[كم]?|كيف[كم]?|هاي+|الو+|شخبار[كم]?|منور[ين]?)[\s!.؟?]*$/i.test(txt) ||
        // أنماط التحية الانجليزية
        /^(hi+|hello+|hey+|good\s*(morning|evening)|assalam[u]?\s*alaikum.*)[\s!.?]*$/i.test(txtLower);

      if (isGreeting) {
        console.log(`[wa] Greeting detected: "${txt}" → sending welcome menu`);
        const userName = profileName || "عزيزي";
        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.welcomeMenu(userName),
          [
            { id: "action_book_ride", title: "🚕 حجز رحلة الان" },
            { id: "action_inquiry", title: "💬 استفسار سريع" },
            { id: "action_other_options", title: "📋 المزيد" },
          ]
        );
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    }

    // ── فحص إذا المستخدم موجود ──
    const riderId = await findOrCreateWhatsAppUser(supabase, phoneNumber, profileName);

    // ══════════════════════════════════════════════════════════
    // 💬 PROXY CHAT SUB-STATE: Hard Purge + Smart Routing
    // 3 طبقات حماية ضد تسرب الحالة:
    //   1️⃣ Global keyword overrides (حجز، إلغاء → كسر فوري)
    //   2️⃣ Double verification (sub-state + active ride query)
    //   3️⃣ Auto-purge on stale state
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

          // ═══════════════════════════════════════════════════
          // 1️⃣ GLOBAL KEYWORD OVERRIDES — كسر فوري من chat state
          // هذه الكلمات تخرج المستخدم من المحادثة فوراً
          // ═══════════════════════════════════════════════════
          const breakoutKeywords = [
            // أوامر حجز
            "حجز", "اريد حجز", "ابي حجز", "ابغى حجز", "رحلة جديدة", "حجز جديد",
            "اريد رحلة", "ابي رحلة", "book", "new ride",
            // أوامر إلغاء
            "إلغاء", "الغاء", "cancel",
            // أوامر قائمة
            "قائمة", "menu", "مساعدة", "help",
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
            // ═══════════════════════════════════════════════════
            // 2️⃣ DOUBLE VERIFICATION — تحقق من الرحلة + رحلة نشطة
            // ═══════════════════════════════════════════════════
            const { data: rideCheck } = await supabase
              .from("rides")
              .select("status")
              .eq("id", chatRideId)
              .maybeSingle();

            // تحقق إضافي: هل المستخدم لديه أي رحلة نشطة أصلاً؟
            const { data: anyActiveRide } = await supabase
              .from("rides")
              .select("id")
              .eq("rider_id", riderId)
              .in("status", ["accepted", "arrived", "in_progress"])
              .limit(1)
              .maybeSingle();

            if (
              !rideCheck ||
              !["accepted", "arrived", "in_progress"].includes(rideCheck.status) ||
              !anyActiveRide
            ) {
              // ═══════════════════════════════════════════════════
              // 3️⃣ AUTO-PURGE — الرحلة منتهية، مسح تلقائي
              // ═══════════════════════════════════════════════════
              console.log(`[wa] 🔥 HARD PURGE: Stale chat state for ride ${chatRideId} (status: ${rideCheck?.status || "missing"}, hasActive: ${!!anyActiveRide}). Clearing.`);
              await supabase.from("bot_customers").update({ last_intent: null })
                .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
              // لا نرجع — نكمل الـ flow العادي
            } else {
              // ✅ الرحلة نشطة فعلاً — ترحيل الرسالة

              // إدراج الرسالة في ride_messages
              const { error: msgError } = await supabase
                .from("ride_messages")
                .insert({
                  ride_id: chatRideId,
                  sender_id: riderId,
                  sender_type: "rider",
                  message: userText,
                });

              if (msgError) {
                console.error("[wa] Proxy chat insert failed:", msgError.message);
                await sendTextMessage(phoneNumber, "⚠️ ما كدرنا نرسل رسالتك. حاول مرة ثانية.");
              } else {
                console.log(`[wa] 💬 Proxy chat: rider → driver for ride ${chatRideId}`);
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
        // نكمل الـ flow العادي
      }
    }

    // ── 🧠 ذاكرة الرحلة النشطة + ترحيل الدردشة ──
    const activeRide = await checkActiveRide(supabase, riderId);
    if (activeRide) {
      console.log(`[wa] Active ride: ${activeRide.id} (${activeRide.status})`);

      if (activeRide.status === "pending") {
        // رحلة منتظرة — عرض خيار الإلغاء
        await sendInteractiveButtons(
          phoneNumber,
          MESSAGES.activeRidePending(activeRide.pickup_address || "موقعك", activeRide.dropoff_address || "الوجهة"),
          [
            { id: `cancel_ride_${activeRide.id}`, title: "❌ إلغاء الرحلة" },
            { id: "keep_searching", title: "🔄 استمر بالبحث" },
          ]
        );
      } else {
        // ═══════════════════════════════════════════════════════
        // 💬 ترحيل الدردشة — الراكب يرسل رسالة للسائق عبر البوت
        // الحالات: accepted / arrived / in_progress
        // ═══════════════════════════════════════════════════════
        let userMessageText = "";

        // استخراج النص (نص عادي أو صوت مُحوّل)
        if (hasText) {
          userMessageText = message.text.body;
        } else if (hasAudio) {
          try {
            const mediaUrl = await downloadWhatsAppMedia(message.audio?.id || message.voice?.id);
            if (mediaUrl) {
              userMessageText = await transcribeAudio(mediaUrl);
            }
          } catch (e) {
            console.warn("[wa] Audio transcription failed for relay:", e);
          }
        }

        if (userMessageText && userMessageText.trim().length > 0) {
          // إدراج الرسالة في ride_messages (service_role يتجاوز RLS)
          const { error: msgError } = await supabase
            .from("ride_messages")
            .insert({
              ride_id: activeRide.id,
              sender_id: riderId,
              sender_type: "rider",
              message: userMessageText.trim(),
            });

          if (msgError) {
            console.error("[wa] Failed to insert ride_message:", msgError.message);
            await sendTextMessage(phoneNumber, "⚠️ عذراً، لم نتمكن من إرسال رسالتك للكابتن. حاول مرة أخرى.");
          } else {
            console.log(`[wa] Relay message inserted for ride ${activeRide.id}`);
            await sendTextMessage(phoneNumber, "✅ تم إرسال رسالتك للكابتن.");
          }
        } else {
          // لم يتم استخراج نص — عرض حالة الرحلة كالمعتاد
          const statusText = activeRide.status === "accepted" ? "الكابتن في الطريق إليك" :
            activeRide.status === "arrived" ? "الكابتن وصل" : "الرحلة جارية";

          let trackingLine = "";
          try {
            const { data: token } = await supabase
              .rpc("generate_ride_tracking_token", { p_ride_id: activeRide.id });
            if (token) {
              trackingLine = `\n\n📍 تتبع الكابتن مباشرة:\n${SITE_URL}/track/${token}`;
            }
          } catch (e) {
            console.warn("[wa] Failed to generate tracking link:", e);
          }

          await sendTextMessage(phoneNumber, MESSAGES.activeRideWithDriver(statusText) + trackingLine);
        }
      }
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── هل يوجد session (draft بدون وجهة)؟ ──
    const session = await findPendingSession(supabase, riderId);

    if (!session) {
      // لا يوجد session — تحقق من intent حجز مجدول أو صنف النية
      const userName = profileName || "عزيزي";

      // ── 🕒 فحص إذا المستخدم ينتظر إدخال تفاصيل حجز مجدول ──
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
            await sendTextMessage(phoneNumber, scheduleDetails.error_reply || `عذراً أستاذ ${userName}، ما فهمت طلبك. جرب كتابة الوجهة والوقت بشكل واضح 🙏`);
            // أعد الـ intent
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          if (!scheduleDetails.scheduled_time) {
            await sendTextMessage(phoneNumber, `أستاذ ${userName}، لازم تحدد الوقت والتاريخ! مثال: "غداً الساعة 8 صباحاً من بيتي لجامعة الأنبار" 🕒`);
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          // Geocode الوجهة
          const dropoffResolved = await resolveRamadiLocation(scheduleDetails.dropoff_query);
          if (!dropoffResolved) {
            await sendTextMessage(phoneNumber, MESSAGES.geocodeFailed(scheduleDetails.dropoff_query, userName));
            await supabase.from("bot_customers").update({ last_intent: "awaiting_schedule" })
              .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          // Geocode نقطة الانطلاق (إذا موجودة)
          let pickupLocation = { lat: 33.4233, lng: 43.2974 }; // وسط الرمادي كافتراضي
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
              scheduled_at: scheduleDetails.scheduled_time,
              vehicle_type: scheduleDetails.vehicle_type,
              estimated_fare: fare,
              status: "scheduled",
              notes: scheduleDetails.notes,
              trip_type: "whatsapp",
            })
            .select()
            .single();

          if (schedError) {
            console.error("[wa] Failed to create scheduled ride:", schedError);
            await sendTextMessage(phoneNumber, `عذراً أستاذ ${userName}، حدث خطأ تقني. حاول مرة ثانية ⚠️`);
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          const scheduledDate = new Date(scheduleDetails.scheduled_time);
          const dateStr = scheduledDate.toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          const timeStr = scheduledDate.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

          await sendTextMessage(phoneNumber,
            `✅ *تم حجز رحلتك المجدولة بنجاح!*\n\n` +
            `📍 *من:* ${pickupAddress}\n` +
            `🏁 *إلى:* ${dropoffResolved.address}\n` +
            `📅 *التاريخ:* ${dateStr}\n` +
            `🕐 *الوقت:* ${timeStr}\n` +
            `💰 *السعر التقديري:* ${fare.toLocaleString()} د.ع\n` +
            `🔖 *رقم الحجز:* ${scheduledRide.id.substring(0, 8)}\n\n` +
            `سنرسل لك تذكير قبل الموعد وننطلق بالبحث عن كابتن قبل 15-30 دقيقة من الموعد إن شاء الله 🚕`
          );

          console.log(`[wa] Scheduled ride created: ${scheduledRide.id}`);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      }

      // ── لا يوجد session ولا awaiting_schedule — استخدم الذكاء الاصطناعي لتصنيف النية ──
      if (hasText) {
        const userMsgText = message.text.body;
        console.log(`[wa] No session, classifying: "${userMsgText}"`);
        const aiResponse = await classifyAndRespond(userMsgText, userName);
        console.log(`[wa] AI intent: ${aiResponse.intent}`);

        if (aiResponse.intent === "booking") {
          // يريد حجز — اطلب الموقع
          await sendLocationRequest(phoneNumber, MESSAGES.askForLocation(userName));
        } else if (aiResponse.intent === "greeting") {
          // تحية — قائمة ترحيب
          await sendInteractiveButtons(
            phoneNumber,
            MESSAGES.welcomeMenu(userName),
            [
              { id: "action_book_ride", title: "🚕 حجز رحلة الان" },
              { id: "action_inquiry", title: "💬 استفسار سريع" },
              { id: "action_other_options", title: "📋 المزيد" },
            ]
          );
        } else {
          // استفسار / شكوى / غير واضح — رد الذكاء الاصطناعي
          await sendTextMessage(phoneNumber, aiResponse.reply);
        }
      } else {
        // صوت بدون session — اطلب الموقع
        await sendLocationRequest(phoneNumber, MESSAGES.needLocationFirst);
      }

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

    // ── GPT-4o: استخراج الوجهة (مع شخصية ران) ──
    const userName = profileName || "عزيزي";
    console.log("[gpt4o] Extracting destination...");
    const intent = await extractDestination(userText, userName, session.pickup_lat, session.pickup_lng);
    console.log("[gpt4o] Result:", JSON.stringify(intent));

    // إذا كان النص ليس وجهة (استفسار/شكوى) — رد الذكاء الاصطناعي
    if (!intent.is_destination && intent.conversation_reply) {
      await sendTextMessage(phoneNumber, intent.conversation_reply);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    if (!intent.destination_search_query || intent.destination_search_query.trim().length < 2) {
      await sendTextMessage(phoneNumber, MESSAGES.noDestination);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ── Geocoding (مع location bias حول موقع المستخدم) ──
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
    } catch { }

    // Always return 200 so Meta doesn't retry
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
});
