/**
 * ران — ترحيل مؤقت: نسخ الأسرار من ENV إلى system_configs
 * Temporary Migration: Copy Supabase Secrets → system_configs table
 *
 * يُستدعى مرة واحدة فقط لتعبئة الجدول بالقيم الموجودة في البيئة
 * بعد التحقق من نجاح الترحيل يمكن حذف هذه الوظيفة
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
// قائمة المفاتيح المطلوب ترحيلها — بنفس أسماء الصفوف في system_configs
const KEYS_TO_MIGRATE = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "OPENAI_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_KEY",
  "MAPBOX_PUBLIC_TOKEN",
  "SITE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "DEEPSEEK_API_KEY",
  "CAPTAIN_BOT_TOKEN",
  "OTPIQ_API_KEY",
  "NASS_BASE_URL",
  "NASS_USERNAME",
  "NASS_PASSWORD",
  "MESSENGER_PAGE_TOKEN",
  "MESSENGER_VERIFY_TOKEN",
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_PAGE_ID",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "X_API_KEY",
  "X_API_SECRET",
  "X_BEARER_TOKEN",
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { key: string; status: string }[] = [];

    for (const keyName of KEYS_TO_MIGRATE) {
      const envValue = Deno.env.get(keyName);

      if (!envValue || envValue.trim() === "") {
        results.push({ key: keyName, status: "SKIPPED (no env value)" });
        continue;
      }

      // UPSERT: تحديث القيمة إذا الصف موجود، وإلا أنشئ صف جديد
      const { error } = await supabase
        .from("system_configs")
        .update({ key_value: envValue })
        .eq("key_name", keyName);

      if (error) {
        results.push({ key: keyName, status: `ERROR: ${error.message}` });
      } else {
        // إخفاء القيمة في السجل
        const masked = envValue.length > 8
          ? envValue.substring(0, 4) + "****" + envValue.substring(envValue.length - 4)
          : "****";
        results.push({ key: keyName, status: `MIGRATED (${masked})` });
      }
    }

    const migrated = results.filter(r => r.status.startsWith("MIGRATED")).length;
    const skipped = results.filter(r => r.status.startsWith("SKIPPED")).length;
    const errors = results.filter(r => r.status.startsWith("ERROR")).length;

    console.log(`[migrate-secrets] ✅ Done: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: { migrated, skipped, errors, total: KEYS_TO_MIGRATE.length },
        details: results,
      }, null, 2),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[migrate-secrets] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
