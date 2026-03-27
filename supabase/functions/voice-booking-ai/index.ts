/**
 * ران - Voice Booking AI Edge Function v3
 * يقبل صوت أو نص → Whisper → GPT-4o → مواقع JSON
 * 
 * يدعم 3 أنماط إدخال:
 * 1. JSON { text: "..." } — وضع الكتابة
 * 2. FormData مع ملف صوت — وضع التسجيل الأساسي
 * 3. JSON { audio: "base64...", mimeType: "..." } — احتياطي للأجهزة التي لا تدعم FormData
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

let OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["OPENAI_API_KEY"]);
    OPENAI_API_KEY = cfg["OPENAI_API_KEY"] || OPENAI_API_KEY;
    _configLoaded = true;
    console.log("[voice-booking-ai] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[voice-booking-ai] ⚠️ Config load failed, using env fallback:", e);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================
// الخطوة 1: تحويل الصوت لنص
// ============================
async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<string> {
  const ext = mimeType.includes("webm") ? "webm"
    : mimeType.includes("mp4") || mimeType.includes("m4a") ? "mp4"
    : mimeType.includes("ogg") || mimeType.includes("oga") ? "ogg"
    : "webm";

  console.log(`[voice-booking-ai] Whisper: sending ${audioBytes.length} bytes as audio.${ext} (${mimeType})`);

  // إنشاء FormData مع اسم ملف صريح — ضروري لـ Whisper API
  const formData = new FormData();
  formData.append("file", new Blob([audioBytes.buffer as ArrayBuffer], { type: mimeType }), `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "ar");
  formData.append("prompt", "رحلة تاكسي في الرمادي، محافظة الأنبار، العراق. أماكن مثل جامعة الأنبار، مستشفى الرمادي التعليمي، شارع المستودع، حي التأميم، حي الحوز، تقاطع الزيوت، حي الملعب، البوعلوان، الشارع العام، حي العزيزية، السوق المركزي، خمسة كيلو، حي الضباط");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[voice-booking-ai] Whisper ${response.status}: ${errText}`);
    // رسالة واضحة للمستخدم بدل الخطأ التقني
    if (response.status === 400) {
      throw new Error("لم يتم التعرف على الصوت. تأكد من التحدث بوضوح وحاول مرة أخرى.");
    }
    throw new Error(`خطأ من خدمة التعرف على الصوت (${response.status})`);
  }

  const data = await response.json();
  return data.text || "";
}

// ============================
// Helper: استخراج البايتات من الطلب (FormData أو JSON)
// الاستراتيجية: نجرب FormData أولاً على نسخة (clone) — إذا فشل نجرب JSON
// لأن Supabase relay قد لا يمرر content-type بشكل صحيح
// ============================
async function extractAudioFromRequest(req: Request): Promise<{ audioBytes: Uint8Array; mimeType: string }> {
  const contentType = req.headers.get("content-type") || "";
  console.log(`[voice-booking-ai] Request content-type: "${contentType}"`);

  // ✅ محاولة 1: FormData مباشر — نستخدم clone() لحماية الـ body
  try {
    const cloned = req.clone();
    const formData = await cloned.formData();
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const mimeType = file.type || "audio/webm";
      const arrayBuffer = await file.arrayBuffer();
      console.log(`[voice-booking-ai] ✅ FormData upload: size=${file.size}, type=${mimeType}, name=${file.name}`);
      return { audioBytes: new Uint8Array(arrayBuffer), mimeType };
    }
  } catch (formErr) {
    console.log("[voice-booking-ai] FormData parse failed, trying JSON...", (formErr as Error).message);
  }

  // 🔄 محاولة 2: JSON مع base64 (للتوافق مع الأسلوب القديم)
  // نستخدم clone() هنا أيضاً لحماية الـ body الأصلي
  try {
    const cloned2 = req.clone();
    const body = await cloned2.json();
    if (body.audio) {
      const mimeType = body.mimeType || "audio/webm";
      const binaryString = atob(body.audio);
      const audioBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }
      const audioSizeKB = Math.round(audioBytes.length / 1024);
      console.log(`[voice-booking-ai] ✅ JSON/base64 upload: size=~${audioSizeKB}KB, type=${mimeType}`);
      return { audioBytes, mimeType };
    }
  } catch (jsonErr) {
    console.log("[voice-booking-ai] JSON parse also failed:", (jsonErr as Error).message);
  }

  // 🔄 محاولة 3: قراءة raw bytes مباشرة (Supabase relay قد يزيل content-type)
  try {
    const rawBytes = new Uint8Array(await req.arrayBuffer());
    if (rawBytes.length > 500) {
      console.log(`[voice-booking-ai] ✅ Raw binary fallback: ${rawBytes.length} bytes`);
      return { audioBytes: rawBytes, mimeType: "audio/webm" };
    }
  } catch (rawErr) {
    console.log("[voice-booking-ai] Raw read also failed:", (rawErr as Error).message);
  }

  throw new Error("لم يتم إرسال ملف صوتي — لا FormData ولا JSON ولا raw");
}

// ============================
// الخطوة 2: استخراج المواقع من النص
// ============================
interface ExtractedLocations {
  origin: { name: string; lat: number; lng: number } | null;
  destination: { name: string; lat: number; lng: number } | null;
  vehicleType: "economy" | "comfort" | "premium" | "women_only";
}

async function extractLocations(transcript: string): Promise<ExtractedLocations> {
  const systemPrompt = `أنت مساعد ذكي لتطبيق تاكسي يعمل حصرياً في مدينة الرمادي، محافظة الأنبار، العراق.
You are an AI assistant for a ride-hailing app operating ONLY in Ramadi, Al Anbar, Iraq.

مهمتك: تحليل ما يقوله الراكب واستخراج نقطة البداية (origin) ونقطة الوصول (destination).

قواعد حرجة:
1. عندما يذكر المستخدم شارعاً (مثل "شارع 17"، "المستودع")، أو حياً (مثل "التأميم"، "الحوز")، أو معلماً (مثل "جامعة الأنبار"، "مستشفى الرمادي التعليمي") → يجب أن تفترض أنه يقصد الموجود في الرمادي فقط.
2. أرفق "، الرمادي، العراق" مع كل اسم مكان في النتيجة لضمان دقة الـ Geocoding.
3. إذا قال المستخدم "أني يم" أو "أني عند" أو "موقعي" → هذا هو الـ origin.
4. إذا قال "أريد أروح" أو "أبي أروح" أو "وديني" أو "لـ" → ما بعدها هو الـ destination.
5. إذا ذكر مكان واحد فقط → اعتبره destination والـ origin = null (سيستخدم GPS).
6. إذا ذكر نوع سيارة (فخمة/فاخرة → premium، مريحة → comfort، نسائي/بنات → women_only) حددها.

أماكن الرمادي المعروفة مع إحداثيات تقريبية:
- جامعة الأنبار: 33.4050, 43.2700
- مستشفى الرمادي التعليمي: 33.4280, 43.3050
- دائرة صحة الأنبار: 33.4262, 43.2954
- حي التأميم: 33.4350, 43.2800
- حي الحوز: 33.4180, 43.3100
- حي الملعب: 33.4300, 43.2900
- حي الضباط: 33.4150, 43.2850
- حي العزيزية: 33.4100, 43.3000
- حي 5 كيلو (خمسة كيلو): 33.4400, 43.2750
- حي 20 (العشرين): 33.4200, 43.2700
- حي البكر: 33.4320, 43.3100
- حي الورار: 33.4100, 43.2600
- حي السلام: 33.4250, 43.2650
- تقاطع الزيوت: 33.4230, 43.2970
- شارع المستودع: 33.4200, 43.2950
- الشارع العام: 33.4233, 43.2974
- السوق المركزي: 33.4240, 43.2960
- البوعلوان: 33.4000, 43.3200
- حي المعلمين: 33.4350, 43.3050
- حي الأندلس: 33.4380, 43.2900
- الجسر الحديدي: 33.4210, 43.3020
- مبنى المحافظة: 33.4250, 43.2980
- ملعب الرمادي: 33.4300, 43.2880
- حي الثيلة: 33.4050, 43.3150
- حي القطانة: 33.4150, 43.3200
- حي السفحة: 33.4050, 43.2550
- حي البوذياب: 33.4500, 43.2800

أجب بـ JSON فقط بالشكل التالي:
{
  "origin": { "name": "اسم المكان، الرمادي، العراق", "lat": 33.xxxx, "lng": 43.xxxx } أو null,
  "destination": { "name": "اسم المكان، الرمادي، العراق", "lat": 33.xxxx, "lng": 43.xxxx } أو null,
  "vehicleType": "economy"
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
    throw new Error(`GPT-4o API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from GPT-4o");
  }

  return JSON.parse(content);
}

// ============================
// Handler الرئيسي
// ============================
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    // التحقق من وجود مفتاح API
    if (!OPENAI_API_KEY) {
      console.error("[voice-booking-ai] OPENAI_API_KEY is NOT set!");
      return new Response(
        JSON.stringify({ error: "مفتاح OpenAI غير مُعد. تواصل مع الدعم الفني." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[voice-booking-ai] API key available: ${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`);

    // ============================
    // التحقق من نوع الإدخال: نص مباشر أو صوت
    // ============================
    let transcript = "";
    const contentType = req.headers.get("content-type") || "";

    // محاولة قراءة نص مباشر من JSON (وضع الكتابة — بديل المايكروفون)
    let isTextInput = false;
    if (contentType.includes("application/json")) {
      try {
        const body = await req.clone().json();
        if (body.text && typeof body.text === "string" && body.text.trim().length >= 2) {
          transcript = body.text.trim();
          isTextInput = true;
          console.log(`[voice-booking-ai] ✅ Text input mode: "${transcript}"`);
        }
      } catch { /* not JSON or no text field — fall through to audio */ }
    }

    // إذا لم يكن نص مباشر → استخراج الصوت ومعالجته عبر Whisper
    if (!isTextInput) {
      // استخراج الصوت من الطلب (FormData أو JSON)
      let audioBytes: Uint8Array;
      let mimeType: string;
      try {
        const extracted = await extractAudioFromRequest(req);
        audioBytes = extracted.audioBytes;
        mimeType = extracted.mimeType;
      } catch (parseErr: any) {
        console.error("[voice-booking-ai] Failed to parse request body:", parseErr.message);
        return new Response(
          JSON.stringify({ error: parseErr.message || "فشل في قراءة الطلب" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[voice-booking-ai] Audio ready: ${audioBytes.length} bytes, mime: ${mimeType}`);

      // الخطوة 1: تحويل الصوت لنص
      console.log("[voice-booking-ai] Step 1: Transcribing audio via Whisper...");
      try {
        transcript = await transcribeAudio(audioBytes, mimeType);
        console.log(`[voice-booking-ai] Transcript: "${transcript}"`);
      } catch (whisperErr: any) {
        console.error("[voice-booking-ai] Whisper FAILED:", whisperErr.message);
        return new Response(
          JSON.stringify({ error: whisperErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!transcript || transcript.trim().length < 3) {
      return new Response(
        JSON.stringify({
          error: "لم نتمكن من فهم الكلام. حاول مرة أخرى بصوت أوضح.",
          transcript: "",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // الخطوة 2: استخراج المواقع
    console.log("[voice-booking-ai] Step 2: Extracting locations via GPT-4o...");
    let locations: ExtractedLocations;
    try {
      locations = await extractLocations(transcript);
      console.log(`[voice-booking-ai] Extracted:`, JSON.stringify(locations));
    } catch (gptErr: any) {
      console.error("[voice-booking-ai] GPT-4o FAILED:", gptErr.message);
      return new Response(
        JSON.stringify({
          error: "فشل في تحليل الوجهة. حاول مرة أخرى.",
          transcript,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // إرجاع النتيجة
    console.log("[voice-booking-ai] SUCCESS — returning result");
    return new Response(
      JSON.stringify({
        transcript,
        origin: locations.origin,
        destination: locations.destination,
        vehicleType: locations.vehicleType || "economy",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[voice-booking-ai] UNEXPECTED Error:", error.message, error.stack);
    return new Response(
      JSON.stringify({
        error: "حدث خطأ غير متوقع. حاول مرة أخرى.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
