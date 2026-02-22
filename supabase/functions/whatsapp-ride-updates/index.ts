/**
 * ران — إشعارات تحديث الرحلة عبر واتساب (الراكب)
 * WhatsApp Ride Status Notifications — Push Notifications
 *
 * يُستدعى من Database Webhook (trigger) كل ما يتغير status في rides
 * الشرط: trip_type = 'whatsapp' + تغيّر الحالة
 *
 * الحالات المدعومة:
 *   accepted   → رسالة بتفاصيل الكابتن + رابط التتبع المباشر 📍
 *   arrived    → الكابتن وصل
 *   in_progress→ بدأت الرحلة
 *   completed  → وصلت بالسلامة + الأجرة
 *   cancelled  → تم إلغاء الرحلة
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://rfrfrde.netlify.app";

const GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════
// WhatsApp Helper
// ════════════════════════════════════════════════════════════

async function sendWhatsAppMessage(to: string, text: string) {
  try {
    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[WhatsAppRideUpdates] Send failed to ${to}:`, err);
    } else {
      console.log(`[WhatsAppRideUpdates] Message sent to ${to}`);
    }
  } catch (e) {
    console.error(`[WhatsAppRideUpdates] Send error:`, e);
  }
}

// ════════════════════════════════════════════════════════════
// Main Handler
// ════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    const {
      ride_id,
      new_status,
      old_status,
      trip_type,
      rider_id,
      driver_id,
      final_fare,
      estimated_fare,
      pickup_address,
      dropoff_address,
    } = payload;

    console.log(
      `[WhatsAppRideUpdates] ride=${ride_id} status: ${old_status} → ${new_status}, trip_type=${trip_type}`
    );

    // الشرط الأساسي: فقط رحلات واتساب مع تغيّر الحالة
    if (trip_type !== "whatsapp") {
      console.log("[WhatsAppRideUpdates] Not a whatsapp ride, skipping.");
      return jsonOk({ skipped: true, reason: "not_whatsapp" });
    }
    if (new_status === old_status) {
      console.log("[WhatsAppRideUpdates] Status unchanged, skipping.");
      return jsonOk({ skipped: true, reason: "same_status" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // جلب رقم هاتف الراكب
    const phoneNumber = await resolveRiderPhone(supabase, rider_id);
    if (!phoneNumber) {
      console.error(`[WhatsAppRideUpdates] Could not resolve phone for rider ${rider_id}`);
      return jsonOk({ skipped: true, reason: "no_phone" });
    }

    // ══════════════════════════════════
    // 1️⃣ accepted — تم قبول الطلب + رابط التتبع
    // ══════════════════════════════════
    if (new_status === "accepted" && driver_id) {
      const driver = await fetchDriverDetails(supabase, driver_id);

      // إنشاء رابط التتبع المباشر
      let trackingLine = "";
      try {
        const { data: token } = await supabase
          .rpc("generate_ride_tracking_token", { p_ride_id: ride_id });
        if (token) {
          trackingLine = `\n\n📍 *تتبع مسار السيارة لحظة بلحظة:*\n${SITE_URL}/track/${token}`;
        }
      } catch (e) {
        console.warn("[WhatsAppRideUpdates] Failed to generate tracking link:", e);
      }

      await sendWhatsAppMessage(
        phoneNumber,
        `🚕 *الكابتن ${driver?.full_name ?? "غير معروف"} في الطريق إليك!*\n\n` +
          `🚗 السيارة: ${driver?.vehicle_model ?? "—"} - ${driver?.vehicle_color ?? "—"}\n` +
          `🔢 اللوحة: ${driver?.vehicle_plate ?? "—"}\n\n` +
          `⏳ وقت الوصول: خلال *5 دقائق* تقريباً.\n` +
          `خليك جاهز!` +
          trackingLine
      );

      return jsonOk({ sent: "accepted" });
    }

    // ══════════════════════════════════
    // 2️⃣ arrived — الكابتن وصل
    // ══════════════════════════════════
    if (new_status === "arrived") {
      await sendWhatsAppMessage(
        phoneNumber,
        `🔔 *الكابتن وصل للموقع!*\nهو بانتظارك الآن.. يرجى التوجه للسيارة. 🚗`
      );
      return jsonOk({ sent: "arrived" });
    }

    // ══════════════════════════════════
    // 3️⃣ in_progress — بدأت الرحلة
    // ══════════════════════════════════
    if (new_status === "in_progress") {
      await sendWhatsAppMessage(
        phoneNumber,
        `🚀 *أنت الآن في الرحلة!*\nنتمنى لك رحلة آمنة وممتعة. 🙏`
      );
      return jsonOk({ sent: "in_progress" });
    }

    // ══════════════════════════════════
    // 4️⃣ completed — وصلت بالسلامة
    // ══════════════════════════════════
    if (new_status === "completed") {
      const fare = final_fare || estimated_fare || 0;

      await sendWhatsAppMessage(
        phoneNumber,
        `✅ *الحمد لله على السلامة!*\n\n` +
          `💰 المبلغ المطلوب: *${fare.toLocaleString()} د.ع*\n\n` +
          `شكراً لاستخدامك *ران* 🚕\n` +
          `لطلب رحلة جديدة، أرسل موقعك الحالي 📍`
      );
      return jsonOk({ sent: "completed" });
    }

    // ══════════════════════════════════
    // 5️⃣ cancelled — تم الإلغاء
    // ══════════════════════════════════
    if (new_status === "cancelled") {
      const cancelledBy = payload.cancelled_by;

      let cancelMsg = `❌ *تم إلغاء الرحلة*\n`;
      if (cancelledBy === "driver") {
        cancelMsg += `\nالسبب: السائق ألغى الرحلة.`;
      } else if (cancelledBy === "system") {
        cancelMsg += `\nالسبب: لم يتوفر سائق قريب.`;
      }
      cancelMsg += `\n\nيمكنك طلب رحلة جديدة بإرسال موقعك مرة أخرى 📍`;

      await sendWhatsAppMessage(phoneNumber, cancelMsg);
      return jsonOk({ sent: "cancelled" });
    }

    console.log(`[WhatsAppRideUpdates] Unhandled status: ${new_status}, skipping.`);
    return jsonOk({ skipped: true, reason: "unhandled_status" });

  } catch (err) {
    console.error("[WhatsAppRideUpdates] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ════════════════════════════════════════════════════════════
// Helper: جلب رقم هاتف الراكب من rider_id
// ════════════════════════════════════════════════════════════

async function resolveRiderPhone(
  supabase: ReturnType<typeof createClient>,
  riderId: string
): Promise<string | null> {
  if (!riderId) return null;

  // 1. جلب من profiles.phone
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("user_id", riderId)
    .maybeSingle();

  if (profile?.phone && !profile.phone.startsWith("tg_")) {
    // تنسيق الرقم للواتساب (إزالة + وأي أحرف غير رقمية)
    const cleanPhone = profile.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length >= 10) {
      console.log(`[WhatsAppRideUpdates] Resolved phone from profile: ${cleanPhone}`);
      return cleanPhone;
    }
  }

  // 2. Fallback: try from auth.users
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(riderId);
    const phone = authUser?.user?.phone;
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      console.log(`[WhatsAppRideUpdates] Resolved phone from auth: ${cleanPhone}`);
      return cleanPhone;
    }
  } catch (e) {
    console.error("[WhatsAppRideUpdates] Failed to fetch auth user:", e);
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// Helper: جلب تفاصيل السائق
// ════════════════════════════════════════════════════════════

interface DriverDetails {
  full_name: string;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
}

async function fetchDriverDetails(
  supabase: ReturnType<typeof createClient>,
  driverId: string
): Promise<DriverDetails | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("full_name, vehicle_model, vehicle_color, vehicle_plate")
    .eq("id", driverId)
    .maybeSingle();

  if (error || !data) {
    console.error("[WhatsAppRideUpdates] Failed to fetch driver:", error?.message);
    return null;
  }

  return {
    full_name: data.full_name,
    vehicle_model: data.vehicle_model,
    vehicle_color: data.vehicle_color,
    vehicle_plate: data.vehicle_plate,
  };
}

// ════════════════════════════════════════════════════════════
// Helper: JSON Response
// ════════════════════════════════════════════════════════════

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
