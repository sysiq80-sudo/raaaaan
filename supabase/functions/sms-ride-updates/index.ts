/**
 * ران — إشعارات حالة الرحلة عبر SMS
 * SMS Ride Updates — Receives trigger payload, sends SMS via OTPIQ
 *
 * يعمل مع trigger: sms_ride_status_notify
 * عند تغيير حالة رحلة trip_type='sms'
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, formatIraqiPhone } from "../_shared/smsSender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      const result = await sendSMS(directPhone, directMessage);
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

    console.log(`[sms-ride-updates] Ride ${ride_id}: ${old_status} → ${new_status}`);

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
      console.error(`[sms-ride-updates] Cannot resolve phone for rider ${rider_id}`);
      return new Response(
        JSON.stringify({ error: "Cannot resolve rider phone" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build status message ──
    let smsText = "";

    switch (new_status) {
      case "accepted": {
        // جلب معلومات السائق
        let driverName = "سائقك";
        let driverPhone = "";
        let driverVehicle = "";

        if (driver_id) {
          const { data: driver } = await supabase
            .from("drivers")
            .select("full_name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_color, plate_number")
            .eq("id", driver_id)
            .maybeSingle();

          if (driver) {
            driverName = driver.full_name || "سائقك";
            driverPhone = driver.phone || "";
            driverVehicle = [driver.vehicle_color, driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ");
          }
        }

        smsText = `✅ تم قبول طلبك!\n`;
        smsText += `السائق: ${driverName}\n`;
        if (driverVehicle) smsText += `السيارة: ${driverVehicle}\n`;
        if (driverPhone) smsText += `هاتف السائق: ${driverPhone}\n`;
        smsText += `\nمن: ${pickup_address || "—"}\nإلى: ${dropoff_address || "—"}`;
        break;
      }

      case "arrived":
        smsText = `🚗 سائقك وصل!\nيرجى التوجه لنقطة الانطلاق: ${pickup_address || "موقعك"}`;
        break;

      case "in_progress":
        smsText = `🛣️ الرحلة بدأت!\nفي الطريق إلى: ${dropoff_address || "الوجهة"}`;
        break;

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
        smsText += `المبلغ: ${Number(fare).toLocaleString()} د.ع\n`;
        smsText += `\nشكراً لاستخدامك ران 🚕\nأرسل (1) لرحلة جديدة`;

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

      case "cancelled": {
        const reason = cancellation_reason || "سبب غير محدد";
        const by = cancelled_by === "driver" ? "السائق" : cancelled_by === "system" ? "النظام" : "الراكب";
        smsText = `❌ تم إلغاء الرحلة\n`;
        smsText += `بواسطة: ${by}\n`;
        smsText += `السبب: ${reason}\n`;
        smsText += `\nأرسل (1) لطلب رحلة جديدة 🚕`;

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

    // ── Send SMS ──
    if (smsText) {
      const result = await sendSMS(phoneNumber, smsText);
      console.log(`[sms-ride-updates] SMS sent to ${phoneNumber}: ${result.success}`);

      // Log
      try {
        await supabase.from("sms_logs").insert({
          phone: phoneNumber,
          message_type: "notification",
          purpose: `ride_${new_status}`,
          provider: "sms",
          status: result.success ? "sent" : "failed",
          error_message: result.error || null,
          external_id: result.externalId || null,
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
