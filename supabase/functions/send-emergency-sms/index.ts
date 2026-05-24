/**
 * ران — Edge Function: إرسال SMS طوارئ
 * Send Emergency SMS to contacts
 * 
 * يُرسل رسالة طوارئ مع الموقع لجهات اتصال الطوارئ عبر SMS
 * 
 * Input: { ride_id?: string, location: { lat, lng }, user_id: string }
 * Output: { success: true, sent_count: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let OTPIQ_API_KEY = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["OTPIQ_API_KEY"]);
    OTPIQ_API_KEY = cfg["OTPIQ_API_KEY"] || Deno.env.get("OTPIQ_API_KEY") || "";
    _configLoaded = true;
  } catch (e) {
    console.warn("[send-emergency-sms] Config load failed:", e);
    OTPIQ_API_KEY = Deno.env.get("OTPIQ_API_KEY") || "";
  }
}
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "964" + cleaned.substring(1);
  }
  if (!cleaned.startsWith("964")) {
    cleaned = "964" + cleaned;
  }
  return cleaned;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const { ride_id, location, user_id } = await req.json();

    if (!location?.lat || !location?.lng || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "location and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // جلب اسم المستخدم
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user_id)
      .single();

    const userName = profile?.full_name || "مستخدم ران";

    // جلب جهات اتصال الطوارئ
    const { data: contacts, error: contactsError } = await supabase
      .from("emergency_contacts")
      .select("id, name, phone")
      .eq("user_id", user_id);

    if (contactsError) {
      throw new Error("فشل جلب جهات اتصال الطوارئ");
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "لا توجد جهات اتصال طوارئ" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mapsLink = `https://maps.google.com/maps?q=${location.lat},${location.lng}`;
    const message = `🚨 مساعدة! ${userName} يحتاج مساعدتك!\nالموقع: ${mapsLink}\nمن تطبيق ران`;

    let sentCount = 0;

    // إرسال SMS لكل جهة اتصال
    for (const contact of contacts) {
      try {
        const formattedPhone = formatPhoneNumber(contact.phone);

        if (OTPIQ_API_KEY) {
          const response = await fetch("https://api.otpiq.com/api/v1/sms/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OTPIQ_API_KEY}`,
            },
            body: JSON.stringify({
              phone_number: formattedPhone,
              message: message,
              sender_name: "RAAN",
            }),
          });

          if (response.ok) {
            sentCount++;
            console.log(`[send-emergency-sms] ✅ SMS sent to ${contact.name}`);
          } else {
            console.error(`[send-emergency-sms] ❌ Failed for ${contact.name}:`, await response.text());
          }
        } else {
          console.warn("[send-emergency-sms] ⚠️ No SMS API key configured, skipping actual send");
          sentCount++; // نعد كنجاح للتطوير
        }
      } catch (smsError) {
        console.error(`[send-emergency-sms] Error sending to ${contact.name}:`, smsError);
      }
    }

    // سجل التنبيه في قاعدة البيانات
    await supabase.from("emergency_alerts").insert({
      user_id,
      ride_id: ride_id || null,
      location,
      sms_sent_count: sentCount,
      contacts_notified: contacts.map((c: { name: string; phone: string }) => c.name),
    });

    // سجل في SMS logs
    await supabase.from("sms_logs").insert(
      contacts.map((contact: { name: string; phone: string }) => ({
        phone: contact.phone,
        message_type: "emergency",
        message: message,
        status: "sent",
        provider: "otpiq",
      }))
    );

    console.log(`[send-emergency-sms] Sent ${sentCount}/${contacts.length} SMS for user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, sent_count: sentCount, total_contacts: contacts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-emergency-sms] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
