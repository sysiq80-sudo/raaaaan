/**
 * ران — إشعارات حالة الرحلة عبر SMS (Infobip حصرياً)
 * SMS Ride Updates — Infobip API Only (Strict Gateway Separation)
 *
 * يعمل مع trigger: sms_ride_status_notify
 * عند تغيير حالة رحلة trip_type='sms'
 *
 * 🏗️ فصل البوابات الصارم:
 *   - OTPIQ → فقط للتحقق من الهوية (OTP) في smsSender.ts
 *   - Infobip → حصرياً لإشعارات الرحلة والبوت التفاعلي (هذا الملف)
 *
 * Updated: 2026-02-27
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INFOBIP_API_URL = "https://rkgdry.api.infobip.com/sms/3/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════
// Infobip SMS Sender (Exclusive for Bot & Ride Updates)
// ════════════════════════════════════════════════════════════

/**
 * تنسيق رقم الهاتف العراقي (964...)
 */
function formatIraqiPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "964" + cleaned.substring(1);
  if (!cleaned.startsWith("964")) cleaned = "964" + cleaned;
  return cleaned;
}

/**
 * إرسال SMS عبر Infobip API
 * ⚠️ هذا المُرسل مخصص حصراً لإشعارات الرحلة والبوت التفاعلي
 *    لإرسال OTP استخدم _shared/smsSender.ts (OTPIQ)
 */
async function sendInfobipSMS(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("INFOBIP_API_KEY");
  const sender = Deno.env.get("INFOBIP_SENDER") || "447491163443";

  if (!apiKey) {
    console.error("[sms-ride-updates] ❌ INFOBIP_API_KEY not configured");
    return { success: false, error: "INFOBIP_API_KEY missing" };
  }

  const formattedPhone = formatIraqiPhone(phoneNumber);

  const payload = {
    messages: [
      {
        destinations: [{ to: formattedPhone }],
        sender: sender,
        content: { text: message },
      },
    ],
  };

  try {
    console.log(`[sms-ride-updates] 📤 Sending via Infobip to ${formattedPhone}...`);

    const res = await fetch(INFOBIP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `App ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.ok) {
      const msgInfo = result?.messages?.[0];
      const messageId = msgInfo?.messageId || "";
      const statusName = msgInfo?.status?.name || "UNKNOWN";
      console.log(`[sms-ride-updates] ✅ Infobip OK: status=${statusName}, messageId=${messageId}`);
      return { success: true, messageId };
    }

    const errorText = result?.requestError?.serviceException?.text || JSON.stringify(result);
    console.error(`[sms-ride-updates] ❌ Infobip error (${res.status}): ${errorText}`);
    return { success: false, error: errorText };
  } catch (e) {
    console.error("[sms-ride-updates] ❌ Infobip network error:", e);
    return { success: false, error: "Network error" };
  }
}

// ════════════════════════════════════════════════════════════
// Main Handler
// ════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    const {
      ride_id,
      new_status,
      old_status,
      rider_id,
      driver_id,
      final_fare,
      estimated_fare,
      pickup_address,
      dropoff_address,
      cancelled_by,
      cancellation_reason,
      distance_km,
      duration_minutes,
      vehicle_type,
      waiting_fare,
      waiting_minutes,
      // Direct SMS call (from cron-cancel-stale-rides)
      phone: directPhone,
      message: directMessage,
      status: directStatus,
    } = payload;

    // ── Direct message mode (for cron/other callers) ──
    if (directPhone && directMessage) {
      const result = await sendInfobipSMS(directPhone, directMessage);
      return new Response(JSON.stringify({ success: result.success }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Trigger mode: need ride_id + new_status ──
    if (!ride_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "ride_id and new_status required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sms-ride-updates] ═══ Ride ${ride_id}: ${old_status} → ${new_status} ═══`);

    // ── Resolve rider phone number ──
    let phoneNumber = "";

    // Strategy 1: bot_customers (most reliable for SMS bookings)
    const { data: botCustomer } = await supabase
      .from("bot_customers")
      .select("phone_number, platform_id")
      .eq("platform", "sms")
      .eq("session_data->>rider_id", rider_id)
      .maybeSingle();

    if (botCustomer?.phone_number) {
      phoneNumber = botCustomer.phone_number;
    }

    // Strategy 2: profiles table
    if (!phoneNumber && rider_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", rider_id)
        .maybeSingle();

      if (profile?.phone?.startsWith("sms_")) {
        phoneNumber = profile.phone.replace("sms_", "");
      }
    }

    if (!phoneNumber) {
      console.error(`[sms-ride-updates] ❌ Cannot resolve phone for rider ${rider_id}`);
      return new Response(
        JSON.stringify({ error: "Cannot resolve rider phone" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ══════════════════════════════════════════════════════════
    // State Machine — Build SMS text with numbered menus
    // ══════════════════════════════════════════════════════════

    let smsText = "";

    switch (new_status) {
      // ──────────────────────────────────────────────────────
      // 1️⃣ ACCEPTED — الكابتن في الطريق + قائمة مرقمة
      // ──────────────────────────────────────────────────────
      case "accepted": {
        let driverName = "سائقك";
        let driverVehicle = "";
        let driverPlate = "";

        if (driver_id) {
          const { data: driver } = await supabase
            .from("drivers")
            .select("full_name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_color, plate_number")
            .eq("id", driver_id)
            .maybeSingle();

          if (driver) {
            driverName = driver.full_name || "سائقك";
            driverVehicle = [driver.vehicle_color, driver.vehicle_make, driver.vehicle_model]
              .filter(Boolean)
              .join(" ");
            driverPlate = driver.plate_number || "";
          }
        }

        smsText =
          `كابتن ${driverName} في الطريق إليك! ` +
          `سيارة ${driverVehicle || "—"} لوحة ${driverPlate || "—"}.\n\n` +
          `لمعرفة موقع الكابتن أرسل رقم [1]\n` +
          `لمراسلة الكابتن أرسل [2]`;
        break;
      }

      // ──────────────────────────────────────────────────────
      // 2️⃣ ARRIVED — الكابتن وصل
      // ──────────────────────────────────────────────────────
      case "arrived":
        smsText = `🚗 سائقك وصل!\nيرجى التوجه لنقطة الانطلاق: ${pickup_address || "موقعك"}`;
        break;

      // ──────────────────────────────────────────────────────
      // 3️⃣ IN_PROGRESS — الرحلة بدأت
      // ──────────────────────────────────────────────────────
      case "in_progress":
        smsText = `🛣️ الرحلة بدأت!\nفي الطريق إلى: ${dropoff_address || "الوجهة"}`;
        break;

      // ──────────────────────────────────────────────────────
      // 4️⃣ COMPLETED — الإيصال + تقييم مرقم
      // ──────────────────────────────────────────────────────
      case "completed": {
        const fare = final_fare || estimated_fare || 0;
        smsText = `✅ وصلت بالسلامة!\n\n`;
        smsText += `📋 فاتورة الرحلة:\n`;
        smsText += `من: ${pickup_address || "—"}\n`;
        smsText += `إلى: ${dropoff_address || "—"}\n`;
        if (distance_km) smsText += `المسافة: ${Number(distance_km).toFixed(1)} كم\n`;
        if (duration_minutes) smsText += `المدة: ${Math.round(Number(duration_minutes))} دقيقة\n`;
        if (waiting_fare && Number(waiting_fare) > 0) {
          smsText += `انتظار: ${Number(waiting_fare).toLocaleString()} د.ع\n`;
        }
        smsText += `المبلغ: ${Number(fare).toLocaleString()} د.ع\n\n`;
        smsText += `كيف تقيم الكابتن؟ أرسل رقم من 1 إلى 5 (حيث 5 ممتاز).`;

        // Clear session
        try {
          await supabase
            .from("bot_customers")
            .update({
              session_data: { state: "idle", updated_at: new Date().toISOString() },
            })
            .eq("platform", "sms")
            .eq("phone_number", phoneNumber);
        } catch { }
        break;
      }

      // ──────────────────────────────────────────────────────
      // 5️⃣ CANCELLED — إلغاء + قائمة مرقمة
      // ──────────────────────────────────────────────────────
      case "cancelled": {
        smsText =
          `تم إلغاء الطلب.\n` +
          `لحجز رحلة جديدة أرسل [1]\n` +
          `للمساعدة أرسل [2]`;

        // Clear session
        try {
          await supabase
            .from("bot_customers")
            .update({
              session_data: { state: "idle", updated_at: new Date().toISOString() },
            })
            .eq("platform", "sms")
            .eq("phone_number", phoneNumber);
        } catch { }
        break;
      }

      default:
        console.log(`[sms-ride-updates] Unhandled status: ${new_status}`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "unhandled_status" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // ── Send SMS via Infobip ──
    if (smsText) {
      const result = await sendInfobipSMS(phoneNumber, smsText);
      console.log(`[sms-ride-updates] SMS → ${phoneNumber}: success=${result.success}`);

      // Log to sms_logs table
      try {
        await supabase.from("sms_logs").insert({
          phone: phoneNumber,
          message_type: "notification",
          purpose: `ride_${new_status}`,
          provider: "infobip",
          status: result.success ? "sent" : "failed",
          error_message: result.error || null,
          external_id: result.messageId || null,
          cost: 0.02,
        });
      } catch { }

      return new Response(
        JSON.stringify({ success: result.success, status: new_status, phone: phoneNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sms-ride-updates] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
