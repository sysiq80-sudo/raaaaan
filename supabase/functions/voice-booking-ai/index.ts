/**
 * ران - Voice Booking AI Edge Function
 * يقبل ملف صوت → يحوله لنص (Whisper) → يستخرج المواقع (GPT-4o) → يرجع JSON
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================
// الخطوة 1: تحويل الصوت لنص
// ============================
async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  // تحويل base64 إلى Blob
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const ext = mimeType.includes("webm") ? "webm" : "mp4";

  // إنشاء FormData
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("language", "ar"); // العربية
  formData.append("prompt", "رحلة تاكسي في الرمادي، محافظة الأنبار، العراق. أماكن مثل جامعة الأنبار، مستشفى الرمادي التعليمي، شارع المستودع، حي التأميم، حي الحوز، تقاطع الزيوت، حي الملعب، البوعلوان، الشارع العام، حي العزيزية، السوق المركزي، خمسة كيلو، حي الضباط");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.text || "";
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

  try {
    // التحقق من وجود مفتاح API
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const { audio, mimeType } = await req.json();

    if (!audio) {
      return new Response(
        JSON.stringify({ error: "لم يتم إرسال ملف صوتي" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[voice-booking-ai] Received audio, mime: ${mimeType}, size: ~${Math.round(audio.length * 0.75 / 1024)}KB`);

    // الخطوة 1: تحويل الصوت لنص
    console.log("[voice-booking-ai] Step 1: Transcribing audio...");
    const transcript = await transcribeAudio(audio, mimeType || "audio/webm");
    console.log(`[voice-booking-ai] Transcript: "${transcript}"`);

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
    console.log("[voice-booking-ai] Step 2: Extracting locations...");
    const locations = await extractLocations(transcript);
    console.log(`[voice-booking-ai] Extracted:`, JSON.stringify(locations));

    // إرجاع النتيجة
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
    console.error("[voice-booking-ai] Error:", error.message);
    return new Response(
      JSON.stringify({
        error: "حدث خطأ أثناء معالجة الطلب الصوتي: " + error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
