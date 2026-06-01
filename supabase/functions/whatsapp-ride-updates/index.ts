/**
 * ران — إشعارات تحديث الرحلة عبر واتساب (الراكب)
 * WhatsApp Ride Status Notifications — Strict State Machine
 *
 * يُستدعى من Database Webhook (trigger) كل ما يتغير status في rides
 * الشرط: trip_type = 'whatsapp' + تغيّر الحالة
 *
 * State Machine (Strict & Uninterruptible):
 *   pending    → البحث عن كابتن
 *   accepted   → رسالة بتفاصيل الكابتن + أزرار (📍 موقع + 💬 محادثة)
 *   arrived    → الكابتن وصل 🚨
 *   in_progress→ بدأت الرحلة
 *   completed  → إيصال + أزرار تقييم ⭐ (1-5)
 *   cancelled  → تم إلغاء الرحلة
 *
 * Parallel Actions (DO NOT alter ride state):
 *   - Live Driver Location (tracking link)
 *   - Proxy Chat (driver ↔ rider via bot)
 *
 * Updated: 2026-02-25
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let WHATSAPP_ACCESS_TOKEN = "";
let WHATSAPP_PHONE_ID = "";
let SITE_URL = "https://raanai.lovable.app";
let GRAPH_API = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, [
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_ID",
      "SITE_URL",
    ]);
    WHATSAPP_ACCESS_TOKEN = cfg["WHATSAPP_ACCESS_TOKEN"] || WHATSAPP_ACCESS_TOKEN;
    WHATSAPP_PHONE_ID = cfg["WHATSAPP_PHONE_ID"] || WHATSAPP_PHONE_ID;
    SITE_URL = cfg["SITE_URL"] || SITE_URL;
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
    _configLoaded = true;
    console.log("[whatsapp-ride-updates] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[whatsapp-ride-updates] ⚠️ Config load failed, using env fallbacks:", e);
    WHATSAPP_ACCESS_TOKEN = WHATSAPP_ACCESS_TOKEN || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
    WHATSAPP_PHONE_ID = WHATSAPP_PHONE_ID || Deno.env.get("WHATSAPP_PHONE_ID") || "";
    SITE_URL = SITE_URL || Deno.env.get("SITE_URL") || "https://raanai.lovable.app";
    GRAPH_API = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
  }
}
// ════════════════════════════════════════════════════════════
// WhatsApp Helpers
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

/**
 * إرسال رسالة تفاعلية مع أزرار (Interactive Buttons)
 * تُستخدم عند قبول الرحلة لعرض خيارات الموقع والمحادثة
 */
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
            reply: { id: b.id, title: b.title.substring(0, 20) },
          })),
        },
      },
    };

    console.log(`[WhatsAppRideUpdates] Sending interactive to ${to}:`, JSON.stringify(payload).substring(0, 500));

    const res = await fetch(GRAPH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    if (!res.ok) {
      console.error(`[WhatsAppRideUpdates] sendButtons FAILED (${res.status}) to ${to}:`, responseText);
    } else {
      console.log(`[WhatsAppRideUpdates] ✅ Interactive buttons sent to ${to}:`, responseText.substring(0, 200));
    }
  } catch (e) {
    console.error(`[WhatsAppRideUpdates] sendInteractiveButtons error:`, e);
  }
}

// ════════════════════════════════════════════════════════════
// Main Handler — Strict State Machine
// ════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[WhatsAppRideUpdates] ═══ FUNCTION INVOKED ═══");

  await loadDynamicConfig();

  // Debug: تحقق من الإعدادات
  console.log(`[WhatsAppRideUpdates] Config check: GRAPH_API=${GRAPH_API ? "SET" : "EMPTY"}, TOKEN=${WHATSAPP_ACCESS_TOKEN ? WHATSAPP_ACCESS_TOKEN.substring(0, 10) + "..." : "EMPTY"}, PHONE_ID=${WHATSAPP_PHONE_ID || "EMPTY"}`);

  try {
    const rawBody = await req.text();
    console.log(`[WhatsAppRideUpdates] Raw payload (first 500 chars):`, rawBody.substring(0, 500));

    const payload = JSON.parse(rawBody);

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
      distance_km,
      duration_minutes,
    } = payload;

    console.log(
      `[WhatsAppRideUpdates] ride=${ride_id} status: ${old_status} → ${new_status}, trip_type=${trip_type}, rider=${rider_id}, driver=${driver_id}`
    );

    // ── الشرط الأساسي: فقط رحلات واتساب مع تغيّر الحالة
    if (trip_type !== "whatsapp") {
      console.log(`[WhatsAppRideUpdates] ⚠️ NOT a whatsapp ride (trip_type=${trip_type}), skipping.`);
      return jsonOk({ skipped: true, reason: "not_whatsapp" });
    }
    if (new_status === old_status) {
      console.log("[WhatsAppRideUpdates] Status unchanged, skipping.");
      return jsonOk({ skipped: true, reason: "same_status" });
    }

    // ── التحقق من صحة انتقال الحالة (State Machine Validation)
    const validTransitions: Record<string, string[]> = {
      pending: ["accepted", "cancelled"],
      accepted: ["arrived", "cancelled"],
      arrived: ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
    };
    if (old_status && validTransitions[old_status]) {
      if (!validTransitions[old_status].includes(new_status)) {
        console.warn(
          `[WhatsAppRideUpdates] ⚠️ Invalid transition: ${old_status} → ${new_status}`
        );
        // نسمح بالمرور لكن نسجل التحذير
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // جلب رقم هاتف الراكب
    const phoneNumber = await resolveRiderPhone(supabase, rider_id);
    if (!phoneNumber) {
      console.error(`[WhatsAppRideUpdates] Could not resolve phone for rider ${rider_id}`);
      return jsonOk({ skipped: true, reason: "no_phone" });
    }

    // ══════════════════════════════════════════════
    // 1️⃣ ACCEPTED — تم قبول الطلب + أزرار تفاعلية
    // ══════════════════════════════════════════════
    if (new_status === "accepted" && driver_id) {
      const driver = await fetchDriverDetails(supabase, driver_id);

      // حساب ETA حقيقي من موقع السائق لنقطة الانطلاق
      let etaText = "خلال *5 دقائق* تقريباً";
      try {
        if (driver_id && ride_id) {
          const { data: driverData } = await supabase
            .from("drivers")
            .select("current_location")
            .eq("id", driver_id)
            .maybeSingle();

          const { data: rideData } = await supabase
            .from("rides")
            .select("pickup_location")
            .eq("id", ride_id)
            .maybeSingle();

          if (driverData?.current_location && rideData?.pickup_location) {
            const dLoc = driverData.current_location;
            const pLoc = rideData.pickup_location;
            const dLat = typeof dLoc.lat === "number" ? dLoc.lat : parseFloat(dLoc.lat);
            const dLng = typeof dLoc.lng === "number" ? dLoc.lng : parseFloat(dLoc.lng);
            const pLat = typeof pLoc.lat === "number" ? pLoc.lat : parseFloat(pLoc.lat);
            const pLng = typeof pLoc.lng === "number" ? pLoc.lng : parseFloat(pLoc.lng);

            // Haversine distance
            const R = 6371;
            const dLatR = ((pLat - dLat) * Math.PI) / 180;
            const dLngR = ((pLng - dLng) * Math.PI) / 180;
            const a =
              Math.sin(dLatR / 2) * Math.sin(dLatR / 2) +
              Math.cos((dLat * Math.PI) / 180) *
              Math.cos((pLat * Math.PI) / 180) *
              Math.sin(dLngR / 2) *
              Math.sin(dLngR / 2);
            const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const etaMinutes = Math.max(1, Math.round((distKm / 30) * 60));
            if (etaMinutes <= 1) {
              etaText = "خلال *دقيقة واحدة*";
            } else if (etaMinutes <= 3) {
              etaText = `خلال *${etaMinutes} دقائق*`;
            } else {
              etaText = `خلال *${etaMinutes} دقيقة* تقريباً`;
            }
            console.log(
              `[WhatsAppRideUpdates] Real ETA: ${distKm.toFixed(1)}km → ${etaMinutes} min`
            );
          }
        }
      } catch (etaErr) {
        console.warn("[WhatsAppRideUpdates] ETA calculation failed, using default:", etaErr);
      }

      // إنشاء رابط التتبع المباشر
      // الرسالة الرئيسية مع تفاصيل الكابتن
      const mainMessage =
        `🚕 *الكابتن ${driver?.full_name ?? "غير معروف"} في الطريق إليك!*\n\n` +
        `🚗 السيارة: ${driver?.vehicle_model ?? "—"} - ${driver?.vehicle_color ?? "—"}\n` +
        `🔢 اللوحة: ${driver?.vehicle_plate ?? "—"}\n\n` +
        `⏳ وقت الوصول: ${etaText}.\n` +
        `خليك جاهز!`;

      // إرسال رسالة مع زر محادثة تفاعلي
      // ⚠️ WhatsApp button title limit: 20 chars max!
      // ❌ تم إزالة زر التتبع مؤقتاً (track_) بسبب فشل إنشاء رابط التتبع في الإنتاج
      await sendInteractiveButtons(phoneNumber, mainMessage, [
        { id: `chat_${ride_id}`, title: "💬 راسل السائق" },
      ]);

      // حفظ حالة الراكب في ride metadata
      // (يُستخدم لاحقاً في whatsapp-webhook لمعرفة أن الراكب في رحلة نشطة)
      try {
        await supabase
          .from("rides")
          .update({
            metadata: {
              wa_buttons_sent: true,
              wa_accepted_at: new Date().toISOString(),
            },
          })
          .eq("id", ride_id);
      } catch (e) {
        console.warn("[WhatsAppRideUpdates] Failed to save ride metadata:", e);
      }

      return jsonOk({ sent: "accepted", buttons: true });
    }

    // ══════════════════════════════════════════════
    // 2️⃣ ARRIVED — الكابتن وصل 🚨
    // ══════════════════════════════════════════════
    if (new_status === "arrived") {
      await sendWhatsAppMessage(
        phoneNumber,
        `🚨 *الكابتن وصل وهو بانتظارك في الخارج!*\nيرجى التوجه للسيارة بأسرع وقت. 🚗`
      );
      return jsonOk({ sent: "arrived" });
    }

    // ══════════════════════════════════════════════
    // 3️⃣ IN_PROGRESS — بدأت الرحلة
    // ══════════════════════════════════════════════
    if (new_status === "in_progress") {
      await sendWhatsAppMessage(
        phoneNumber,
        `🚀 *أنت الآن في الرحلة!*\nنتمنى لك رحلة آمنة وممتعة. 🙏`
      );
      return jsonOk({ sent: "in_progress" });
    }

    // ══════════════════════════════════════════════
    // 4️⃣ COMPLETED — إيصال + تقييم ⭐
    // ══════════════════════════════════════════════
    if (new_status === "completed") {
      const fare = final_fare || estimated_fare || 0;
      const distText = distance_km ? `${Number(distance_km).toFixed(1)} كم` : "—";
      const durationText = duration_minutes ? `${duration_minutes} دقيقة` : "—";

      // إرسال الإيصال
      const receiptMessage =
        `✅ *الحمد لله على السلامة!*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🧾 *إيصال الرحلة*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📍 من: ${pickup_address || "—"}\n` +
        `🏁 إلى: ${dropoff_address || "—"}\n` +
        `📏 المسافة: ${distText}\n` +
        `⏱️ المدة: ${durationText}\n` +
        `💰 المبلغ: *${fare.toLocaleString()} د.ع*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `شكراً لاستخدامك *ران* 🚕`;

      await sendWhatsAppMessage(phoneNumber, receiptMessage);

      // إرسال أزرار التقييم (⚠️ button title max 20 chars!)
      await sendInteractiveButtons(
        phoneNumber,
        `شكراً لاستخدامك ران! الرحلة انتهت. كيف تقيم الكابتن؟ 👇`,
        [
          { id: `rate_${ride_id}_1`, title: "⭐ سيء" },
          { id: `rate_${ride_id}_3`, title: "⭐⭐⭐ جيد" },
          { id: `rate_${ride_id}_5`, title: "⭐⭐⭐⭐⭐ ممتاز" },
        ]
      );

      // 🔄 Phase 6: زر الرحلة العكسية
      await sendInteractiveButtons(
        phoneNumber,
        `هل تريد رحلة عكسية (العودة)؟ 🔄`,
        [
          { id: `reverse_ride_${ride_id}`, title: "🔄 رحلة عكسية" },
        ]
      );

      // 🔥 CRITICAL: مسح sub-state الدردشة عند اكتمال الرحلة
      try {
        await supabase.from("bot_customers").update({ last_intent: null })
          .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        console.log(`[WhatsAppRideUpdates] ✅ Cleared chat sub-state for ${phoneNumber} on completed`);
      } catch (e) {
        console.warn("[WhatsAppRideUpdates] Failed to clear sub-state on completed:", e);
      }

      return jsonOk({ sent: "completed", receipt: true, rating_buttons: true });
    }

    // ══════════════════════════════════════════════
    // 5️⃣ CANCELLED — تم الإلغاء + مسح context + أزرار تفاعلية
    // ══════════════════════════════════════════════
    if (new_status === "cancelled") {
      // 🔥 CRITICAL: مسح sub-state الدردشة فوراً عند الإلغاء
      try {
        await supabase.from("bot_customers").update({ last_intent: null })
          .eq("platform", "whatsapp").eq("platform_id", phoneNumber);
        console.log(`[WhatsAppRideUpdates] ✅ Cleared chat sub-state for ${phoneNumber} on cancelled`);
      } catch (e) {
        console.warn("[WhatsAppRideUpdates] Failed to clear sub-state on cancelled:", e);
      }

      const cancelledBy = payload.cancelled_by;

      let cancelMsg = `❌ *تم إلغاء الطلب بنجاح.*\n`;
      if (cancelledBy === "driver") {
        cancelMsg += `\nالسبب: السائق ألغى الرحلة.`;
      } else if (cancelledBy === "system") {
        cancelMsg += `\nالسبب: لم يتوفر سائق قريب.`;
      }
      cancelMsg += `\n\nتكدر تطلب رحلة جديدة بأي وقت! 🚕\nكيف يمكنني مساعدتك الآن؟`;

      // إرسال رسالة تفاعلية مع أزرار (حجز جديد + مساعدة)
      await sendInteractiveButtons(phoneNumber, cancelMsg, [
        { id: "action_book_ride", title: "🚗 حجز رحلة جديدة" },
        { id: "action_inquiry", title: "📞 المساعدة" },
      ]);

      return jsonOk({ sent: "cancelled", buttons: true });
    }

    console.log(`[WhatsAppRideUpdates] Unhandled status: ${new_status}, skipping.`);
    return jsonOk({ skipped: true, reason: "unhandled_status" });
  } catch (err) {
    console.error("[WhatsAppRideUpdates] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════
// Helper: جلب رقم هاتف الراكب من rider_id
// ════════════════════════════════════════════════════════════

async function resolveRiderPhone(
  supabase: any,
  riderId: string
): Promise<string | null> {
  if (!riderId) return null;

  console.log(`[WhatsAppRideUpdates] Resolving phone for rider: ${riderId}`);

  // ── Strategy 1: profiles.phone (بـ user_id)
  try {
    const { data: profile1 } = await supabase
      .from("profiles")
      .select("phone, email")
      .eq("user_id", riderId)
      .maybeSingle();

    if (profile1) {
      console.log(`[WhatsAppRideUpdates] Profile found (user_id): phone=${profile1.phone}, email=${profile1.email}`);

      // phone = "wa_964xxxxxxx" → استخرج الرقم
      if (profile1.phone?.startsWith("wa_")) {
        const waPhone = profile1.phone.replace("wa_", "");
        if (waPhone.length >= 10) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from wa_ prefix: ${waPhone}`);
          return waPhone;
        }
      }

      // phone = رقم عادي
      if (profile1.phone && !profile1.phone.startsWith("tg_")) {
        const cleanPhone = profile1.phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length >= 10) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from profile phone: ${cleanPhone}`);
          return cleanPhone;
        }
      }

      // email = "wa_964xxx@whatsapp.raan.app" → استخرج الرقم من الإيميل
      if (profile1.email?.includes("@whatsapp.raan.app")) {
        const phoneFromEmail = profile1.email.replace("wa_", "").replace("@whatsapp.raan.app", "");
        if (phoneFromEmail.length >= 10) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from email: ${phoneFromEmail}`);
          return phoneFromEmail;
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsAppRideUpdates] Strategy 1 (profiles.user_id) failed:", e);
  }

  // ── Strategy 2: profiles.phone (بـ id بدل user_id — بعض الإعدادات تختلف)
  try {
    const { data: profile2 } = await supabase
      .from("profiles")
      .select("phone, email")
      .eq("id", riderId)
      .maybeSingle();

    if (profile2) {
      console.log(`[WhatsAppRideUpdates] Profile found (id): phone=${profile2.phone}, email=${profile2.email}`);

      if (profile2.phone?.startsWith("wa_")) {
        const waPhone = profile2.phone.replace("wa_", "");
        if (waPhone.length >= 10) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from profile.id wa_: ${waPhone}`);
          return waPhone;
        }
      }

      if (profile2.phone && !profile2.phone.startsWith("tg_")) {
        const cleanPhone = profile2.phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length >= 10) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from profile.id phone: ${cleanPhone}`);
          return cleanPhone;
        }
      }

      if (profile2.email?.includes("@whatsapp.raan.app")) {
        const phoneFromEmail = profile2.email.replace("wa_", "").replace("@whatsapp.raan.app", "");
        if (phoneFromEmail.length >= 10) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from profile.id email: ${phoneFromEmail}`);
          return phoneFromEmail;
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsAppRideUpdates] Strategy 2 (profiles.id) failed:", e);
  }

  // ── Strategy 3: bot_customers — platform_id هو رقم الهاتف مباشرةً!
  try {
    // نحتاج نربط rider_id بـ bot_customers عبر الإيميل أو الهاتف
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, email")
      .or(`user_id.eq.${riderId},id.eq.${riderId}`)
      .maybeSingle();

    if (profile?.phone?.startsWith("wa_") || profile?.email?.includes("@whatsapp.raan.app")) {
      // استخرج platform_id من bot_customers
      const platformId = profile.phone?.replace("wa_", "") ||
        profile.email?.replace("wa_", "").replace("@whatsapp.raan.app", "");

      if (platformId) {
        const { data: botCustomer } = await supabase
          .from("bot_customers")
          .select("platform_id")
          .eq("platform", "whatsapp")
          .eq("platform_id", platformId)
          .maybeSingle();

        if (botCustomer?.platform_id) {
          console.log(`[WhatsAppRideUpdates] ✅ Resolved from bot_customers: ${botCustomer.platform_id}`);
          return botCustomer.platform_id;
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsAppRideUpdates] Strategy 3 (bot_customers) failed:", e);
  }

  // ── Strategy 4: auth user metadata
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(riderId);
    const phone = authUser?.user?.phone;
    const metadata = authUser?.user?.user_metadata;

    console.log(`[WhatsAppRideUpdates] Auth user: phone=${phone}, metadata.whatsapp_phone=${metadata?.whatsapp_phone}`);

    // من metadata: whatsapp_phone
    if (metadata?.whatsapp_phone) {
      const cleanPhone = String(metadata.whatsapp_phone).replace(/[^0-9]/g, "");
      if (cleanPhone.length >= 10) {
        console.log(`[WhatsAppRideUpdates] ✅ Resolved from auth metadata: ${cleanPhone}`);
        return cleanPhone;
      }
    }

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length >= 10) {
        console.log(`[WhatsAppRideUpdates] ✅ Resolved from auth phone: ${cleanPhone}`);
        return cleanPhone;
      }
    }
  } catch (e) {
    console.error("[WhatsAppRideUpdates] Strategy 4 (auth) failed:", e);
  }

  console.error(`[WhatsAppRideUpdates] ❌ ALL strategies failed for rider ${riderId}`);
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
  supabase: any,
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
