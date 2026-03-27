/**
 * ران — خدمات الذكاء الاصطناعي (GPT-4o + Whisper)
 * RAAN AI Services — Destination Extraction, Intent Classification, Scheduling
 */

import { OPENAI_API_KEY } from "./config.ts";

// ════════════════════════════════════════
// Whisper: تحويل الصوت لنص
// ════════════════════════════════════════
export async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<string> {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("opus") ? "ogg" : "ogg";

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
// أنواع السيارات — مخزن مؤقت
// ════════════════════════════════════════
let _vehicleTypesCache: { types: Array<{ key: string; name_ar: string }>; fetchedAt: number } | null = null;

export async function getActiveVehicleTypes(supabase: any): Promise<Array<{ key: string; name_ar: string }>> {
  const now = Date.now();
  if (_vehicleTypesCache && (now - _vehicleTypesCache.fetchedAt) < 300_000) {
    return _vehicleTypesCache.types;
  }
  try {
    const { data } = await supabase
      .from("vehicle_types")
      .select("key, name_ar")
      .eq("is_active", true)
      .order("key");
    if (data && data.length > 0) {
      _vehicleTypesCache = { types: data, fetchedAt: now };
      return data;
    }
  } catch (e) {
    console.warn("[wa] Failed to fetch vehicle types:", e);
  }
  return [
    { key: "economy", name_ar: "اقتصادي" },
    { key: "comfort", name_ar: "مريح" },
    { key: "premium", name_ar: "فاخر" },
    { key: "women_only", name_ar: "نسائي" },
  ];
}

// ════════════════════════════════════════
// إعدادات انتظار الراكب — مخزن مؤقت
// ════════════════════════════════════════
export interface WaitSettings {
  max_wait_minutes: number;
  search_messages: Array<{ text: string; icon: string }>;
  warning_message: string;
  warning_threshold: number;
  auto_cancel_enabled: boolean;
  auto_cancel_message: string;
}
let _waitSettingsCache: { settings: WaitSettings; fetchedAt: number } | null = null;

export async function getWaitSettings(supabase: any): Promise<WaitSettings> {
  const now = Date.now();
  if (_waitSettingsCache && (now - _waitSettingsCache.fetchedAt) < 300_000) {
    return _waitSettingsCache.settings;
  }
  const defaults: WaitSettings = {
    max_wait_minutes: 10,
    search_messages: [
      { text: "جاري البحث عن أفضل سائق لك...", icon: "🔍" },
      { text: "سائقونا في الطريق إليك...", icon: "🚗" },
      { text: "لحظات قليلة وسيتم إيجاد سائق...", icon: "⏳" },
      { text: "نبحث في منطقتك عن سائق متاح...", icon: "📍" },
      { text: "شكراً لصبرك، نحن نعمل على ذلك...", icon: "💚" },
      { text: "سيتم إعلامك فور قبول السائق...", icon: "🔔" },
    ],
    warning_message: "سيتم الإلغاء التلقائي قريباً",
    warning_threshold: 0.8,
    auto_cancel_enabled: true,
    auto_cancel_message: "لم يتم العثور على سائق متاح خلال الوقت المحدد",
  };
  try {
    const { data } = await supabase
      .from("rider_wait_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      const settings: WaitSettings = {
        max_wait_minutes: data.max_wait_minutes ?? defaults.max_wait_minutes,
        search_messages: Array.isArray(data.search_messages) ? data.search_messages : defaults.search_messages,
        warning_message: data.warning_message ?? defaults.warning_message,
        warning_threshold: data.warning_threshold ?? defaults.warning_threshold,
        auto_cancel_enabled: data.auto_cancel_enabled ?? defaults.auto_cancel_enabled,
        auto_cancel_message: data.auto_cancel_message ?? defaults.auto_cancel_message,
      };
      _waitSettingsCache = { settings, fetchedAt: now };
      return settings;
    }
  } catch (e) {
    console.warn("[wa] Failed to fetch wait settings:", e);
  }
  return defaults;
}

// ════════════════════════════════════════
// GPT-4o: استخراج الوجهة فقط
// ════════════════════════════════════════
export interface ExtractedDestination {
  destination_search_query: string;
  vehicle_type: string;
  notes: string | null;
  is_destination: boolean;
  conversation_reply: string | null;
}

export async function extractDestination(
  transcript: string,
  userName: string,
  userLat = 33.4233,
  userLng = 43.2974,
  vehicleTypes?: Array<{ key: string; name_ar: string }>
): Promise<ExtractedDestination> {
  const vtypes = vehicleTypes || [
    { key: "economy", name_ar: "اقتصادي" },
    { key: "comfort", name_ar: "مريح" },
    { key: "premium", name_ar: "فاخر" },
    { key: "women_only", name_ar: "نسائي" },
  ];
  const vehicleTypeKeys = vtypes.map(v => v.key).join("|");
  const vehicleTypeMapping = vtypes.map(v => `${v.name_ar} → ${v.key}`).join(", ");

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
6. If the user mentions vehicle preference: ${vehicleTypeMapping}. Otherwise "economy".
7. Extract any notes (مستعجل، قرب الصيدلية، etc).
8. NEVER return an error message. ALWAYS try to extract a destination.
9. NEVER rename, translate, or "correct" the user's destination. Return their words verbatim.

═══ IF IT IS NOT A DESTINATION (set "is_destination": false): ═══
The user may be asking a question, complaining, or chatting. Respond with empathy in Iraqi dialect.

Behavioral Rules:
1. **Politeness & Empathy:** If the user complains ("تأخرت", "وين الكابتن", "أسرعوا") → respond with immense politeness: "حقك علينا أستاذ ${userName}، ثواني وأستعجل الكابتن، تدلل وما يصير خاطرك إلا طيب 🙏"
2. **Inquiries:** If asking about prices, how to use, service area → answer that prices are calculated dynamically based on distance, region and vehicle type. We serve Ramadi and Al Anbar Governorate. Do NOT reveal exact base fare numbers or per-km rates.
3. **Dialect:** Use warm Iraqi dialect (تدلل، على راسي، عيوني، كابتن، ما يخالف).
4. **Never be defensive.** Always apologize and be helpful.
5. Gently remind them they can send their destination whenever ready.

═══ STRICT CONFIDENTIALITY RULES (CRITICAL): ═══
Under NO circumstances should you reveal:
- Internal company metrics (driver count, ride volume, revenue, etc.)
- Pricing formulas, base fares, per-km rates, or commission percentages
- Algorithm details (matching, surge pricing, routing)
- Administrative dashboard operations or internal tools
- Database structure, API endpoints, or technical architecture
- Business strategies, partnerships, or internal decisions
If asked about any of the above, reply politely: "هذي معلومات داخلية للنظام أستاذ ${userName}، بس كدر أساعدك بحجز رحلة أو أي استفسار عن خدماتنا 🚕"

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
  "vehicle_type": "${vtypes[0]?.key || 'economy'}",
  "notes": null,
  "is_destination": true,
  "conversation_reply": null
}
Available vehicle_type values: ${vehicleTypeKeys}`;

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
export async function classifyAndRespond(
  userText: string,
  userName: string
): Promise<{
  intent: "booking" | "inquiry" | "complaint" | "greeting" | "unknown";
  reply: string;
  destination_hint: string | null;
  pickup_hint: string | null;
}> {
  const systemPrompt = `أنت "ران"، بوت تكسي عراقي ذكي ومهذب جداً يعمل في مدينة الرمادي، محافظة الأنبار، العراق.
اسم المستخدم: ${userName}

مهمتك: صنّف رسالة المستخدم وأجب عليها بلهجة عراقية دافئة ومحترمة.

القواعد السلوكية:
1. **الأدب والتعاطف**: إذا اشتكى المستخدم أو تضايق أو قال "تأخرت" أو "أسرعوا" أو "وين الكابتن" → رد بأدب شديد وتعاطف. مثال: "حقك علينا أستاذ ${userName}، ثواني وأستعجل الكابتن، تدلل وما يصير خاطرك إلا طيب 🙏"
2. **الاستفسارات**: إذا سأل سؤال عام (أسعار، كيف أستخدم، وين تخدمون، شنو ران) → أجب بأن الأسعار تُحسب تلقائياً حسب المسافة والمنطقة ونوع السيارة. لا تذكر أرقام محددة للتسعير. نخدم الرمادي ومحافظة الأنبار.
3. **المواقع الغامضة**: إذا ذكر مكان غامض → اطلب نقطة دالة.
4. **اللهجة**: استخدم لهجة عراقية دافئة ومحترمة (تدلل، على راسي، عيوني، كابتن، ما يخالف، إن شاء الله).
5. **الحجز**: إذا المستخدم يريد حجز رحلة أو ذكر وجهة → صنّفه كـ "booking" وكن ودوداً.
6. **لا تكن دفاعياً أبداً**: دائماً اعتذر واطلب السماح.

═══ قواعد السرية الصارمة (حرجة): ═══
ممنوع نهائياً الكشف عن:
- إحصائيات الشركة الداخلية (عدد السائقين، حجم الرحلات، الإيرادات)
- معادلات التسعير، أسعار الأساس، أسعار الكيلومتر، نسب العمولة
- تفاصيل الخوارزميات (المطابقة، التسعير الديناميكي، التوجيه)
- عمليات لوحة التحكم أو الأدوات الداخلية
- بنية قاعدة البيانات أو نقاط الـ API أو البنية التقنية
- استراتيجيات العمل أو الشراكات أو القرارات الداخلية
إذا سُئلت عن أي مما سبق، أجب بأدب: "هذي معلومات داخلية للنظام أستاذ ${userName}، بس كدر أساعدك بحجز رحلة أو أي استفسار عن خدماتنا 🚕"

═══ قواعد الموقع الجغرافي (حرجة): ═══
إذا ذكر المستخدم موقع أو دولة خارج العراق، يجب رفض الطلب حسب المنطقة:
1. **إيران أو إسرائيل**: الرد بالضبط: "لا نعمل هنا مطلقاً." — بدون أي مجاملات.
2. **دول مجاورة (الأردن، سوريا، السعودية، الكويت، تركيا)**: "نعتذر، لا نعمل الآن في [اسم الدولة]."
3. **دول عربية/آسيوية أخرى**: "بعدنا ما فتحنا فرع في [اسم الدولة]! 😅 خدماتنا حالياً تقتصر على العراق وتحديداً الأنبار، بس نوصلكم ندزلك خبر!"
4. **دول بعيدة**: "عذراً، ران إلى الآن لم تمتلك طائرة ✈️! خدماتنا مخصصة للسيارات داخل العراق فقط."
مهم: لا تحاول حساب سعر أو بحث عن كابتن لمواقع خارج العراق. صنّف النية كـ "inquiry" واستخدم الرد المناسب.

أنواع النوايا:
- "booking": يريد حجز رحلة أو ذكر وجهة
- "inquiry": سؤال عام عن الخدمة أو الأسعار أو التطبيق
- "complaint": شكوى أو تذمر
- "greeting": تحية عامة (مرحبا، هلو، السلام عليكم)
- "unknown": غير واضح

🔑 قاعدة مهمة — استخراج الانطلاق والوجهة (حرجة):
إذا المستخدم ذكر "من" + مكان + "إلى/ل/لـ" + مكان آخر:
- مثال: "اريد رحلة من جامع بدر الكبرى إلى مول ام عمار"
  - pickup_hint: "جامع بدر الكبرى" (فقط اسم المكان بعد "من")
  - destination_hint: "مول ام عمار" (فقط اسم المكان بعد "إلى")
- مثال: "وديني من حي المعلمين لمستشفى الرمادي"
  - pickup_hint: "حي المعلمين"
  - destination_hint: "مستشفى الرمادي"
- ⛔ ممنوع نهائياً: إرجاع الجملة الكاملة كموقع واحد!
- ⛔ ممنوع: تضمين "اريد رحلة" أو "من" أو "إلى" ضمن اسم المكان!
إذا ذكر مكان واحد فقط بدون "من"، هذا destination_hint فقط و pickup_hint = null.

أجب بـ JSON فقط:
{
  "intent": "نوع النية",
  "reply": "ردك بالعراقي — قصير ولطيف ومحترم",
  "destination_hint": "اسم الوجهة إذا ذكرها، أو null",
  "pickup_hint": "اسم مكان الانطلاق إذا ذكره، أو null"
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
      return { intent: "unknown", reply: `أهلاً أستاذ ${userName}، شلون نكدر نساعدك اليوم؟ 🚕`, destination_hint: null, pickup_hint: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { intent: "unknown", reply: `أهلاً أستاذ ${userName}، شلون نكدر نساعدك؟ 🚕`, destination_hint: null, pickup_hint: null };
    }

    const parsed = JSON.parse(content);
    return {
      intent: parsed.intent || "unknown",
      reply: parsed.reply || `تدلل أستاذ ${userName}، شلون نكدر نخدمك؟`,
      destination_hint: parsed.destination_hint || null,
      pickup_hint: parsed.pickup_hint || null,
    };
  } catch (err) {
    console.error("[classify] Error:", err);
    return { intent: "unknown", reply: `عذراً أستاذ ${userName}، ممكن توضح طلبك أكثر؟ 🙏`, destination_hint: null, pickup_hint: null };
  }
}

// ════════════════════════════════════════
// 🕒 الحجز المجدول — تم إيقافه (Phase 3)
// ════════════════════════════════════════
// تم إزالة extractScheduledRideDetails — الميزة معطّلة مؤقتاً
