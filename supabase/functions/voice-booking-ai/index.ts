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
  formData.append("prompt", "رحلة تاكسي في بغداد العراق. أماكن عراقية مثل الكرادة، المنصور، اليرموك، الجادرية، زيونة، الكاظمية، الأعظمية، البياع، حي الجامعة، مطعم الساعة");

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
  const systemPrompt = `أنت مساعد ذكي لتطبيق تاكسي في بغداد، العراق.

مهمتك: تحليل ما يقوله الراكب واستخراج نقطة البداية (origin) ونقطة الوصول (destination).

قواعد مهمة:
1. إذا قال المستخدم "أني يم" أو "أني عند" أو "موقعي" → هذا هو الـ origin.
2. إذا قال "أريد أروح" أو "أبي أروح" أو "وديني" → ما بعدها هو الـ destination.
3. إذا ذكر مكان واحد فقط → اعتبره destination والـ origin = null (سيستخدم GPS).
4. أرجع إحداثيات تقريبية (lat, lng) لأماكن بغداد المعروفة.
5. إذا ذكر نوع سيارة (فخمة/فاخرة → premium، مريحة → comfort، نسائي/بنات → women_only) حددها.

أماكن بغداد المعروفة مع إحداثيات تقريبية:
- الكرادة: 33.3000, 44.4100
- المنصور: 33.3150, 44.3550
- اليرموك: 33.3100, 44.3400
- الجادرية: 33.2800, 44.3900
- زيونة: 33.3300, 44.4200
- الكاظمية: 33.3700, 44.3700
- الأعظمية: 33.3600, 44.3900
- البياع: 33.2900, 44.3500
- حي الجامعة: 33.3000, 44.3400
- الشعب: 33.3800, 44.4100
- المثنى/مطعم الساعة: 33.3350, 44.3850
- ساحة التحرير: 33.3380, 44.3950
- شارع فلسطين: 33.3250, 44.4000
- شارع أبو نؤاس: 33.3100, 44.4000
- المربعة: 33.3420, 44.3800
- ساحة الفردوس: 33.3200, 44.3950
- باب المعظم: 33.3500, 44.3800
- العلاوي: 33.3450, 44.3750
- الحارثية: 33.3250, 44.3600
- الدورة: 33.2700, 44.4100
- السيدية: 33.2800, 44.3600
- حي الحسين: 33.2850, 44.3700
- الطالبية: 33.3800, 44.4400
- مدينة الصدر: 33.3700, 44.4600
- بغداد الجديدة: 33.3500, 44.4500

أجب بـ JSON فقط بالشكل التالي:
{
  "origin": { "name": "اسم المكان", "lat": 33.xxxx, "lng": 44.xxxx } أو null,
  "destination": { "name": "اسم المكان", "lat": 33.xxxx, "lng": 44.xxxx } أو null,
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
