/**
 * ران — Infobip Inbound SMS Webhook + Guest NLP Flow
 * sms-webhook — receives incoming SMS from Infobip, processes ride intents
 *
 * 🏗️ معمارية:
 *   - يستقبل POST من Infobip inbound forwarding
 *   - يسجل المستخدمين الجدد تلقائياً كـ "Guest SMS User"
 *   - يحلل نية الرسالة (NLP) ويرد فوراً عبر Infobip outbound
 *   - يتعامل مع الأرقام المرقمة (1 للتأكيد، 2 للإلغاء)
 *
 * Infobip Inbound Payload (MO message):
 *   { "results": [{ "from": "964...", "to": "447...", "text": "...", "messageId": "..." }] }
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
// Infobip Outbound SMS (reply to user)
// ════════════════════════════════════════════════════════════

function formatIraqiPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "964" + cleaned.substring(1);
    if (!cleaned.startsWith("964")) cleaned = "964" + cleaned;
    return cleaned;
}

async function replyViaSMS(phoneNumber: string, message: string): Promise<boolean> {
    const apiKey = Deno.env.get("INFOBIP_API_KEY");
    const sender = Deno.env.get("INFOBIP_SENDER") || "447491163443";

    if (!apiKey) {
        console.error("[sms-webhook] ❌ INFOBIP_API_KEY not configured");
        return false;
    }

    const formattedPhone = formatIraqiPhone(phoneNumber);

    try {
        const res = await fetch(INFOBIP_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `App ${apiKey}`,
            },
            body: JSON.stringify({
                messages: [
                    {
                        destinations: [{ to: formattedPhone }],
                        sender: sender,
                        content: { text: message },
                    },
                ],
            }),
        });

        const result = await res.json();
        if (res.ok) {
            console.log(`[sms-webhook] ✅ Reply sent to ${formattedPhone}`);
            return true;
        }

        const errorText = result?.requestError?.serviceException?.text || JSON.stringify(result);
        console.error(`[sms-webhook] ❌ Reply failed (${res.status}): ${errorText}`);
        return false;
    } catch (e) {
        console.error("[sms-webhook] ❌ Reply network error:", e);
        return false;
    }
}

// ════════════════════════════════════════════════════════════
// Session Management via bot_customers
// ════════════════════════════════════════════════════════════

interface SMSSession {
    state: "idle" | "awaiting_confirm" | "active";
    rider_id?: string;
    ride_id?: string;
    pickup_address?: string;
    dropoff_address?: string;
    estimated_fare?: number;
    updated_at: string;
}

async function getSession(supabase: any, phone: string): Promise<SMSSession> {
    const { data } = await supabase
        .from("bot_customers")
        .select("session_data")
        .eq("platform", "sms_infobip")
        .eq("platform_id", phone)
        .maybeSingle();

    if (data?.session_data) {
        const session = data.session_data as SMSSession;
        // Expire after 30 minutes
        const updatedAt = new Date(session.updated_at).getTime();
        if (Date.now() - updatedAt > 30 * 60 * 1000) {
            return { state: "idle", updated_at: new Date().toISOString() };
        }
        return session;
    }
    return { state: "idle", updated_at: new Date().toISOString() };
}

async function saveSession(supabase: any, phone: string, session: SMSSession): Promise<void> {
    session.updated_at = new Date().toISOString();

    await supabase.from("bot_customers").upsert(
        {
            platform: "sms_infobip",
            platform_id: phone,
            phone_number: phone,
            display_name: "ضيف SMS",
            session_data: session,
            last_seen: new Date().toISOString(),
        },
        { onConflict: "platform,platform_id" }
    );
}

// ════════════════════════════════════════════════════════════
// Guest User Registration
// ════════════════════════════════════════════════════════════

async function findOrCreateGuestUser(
    supabase: any,
    phone: string,
    supabaseUrl: string,
    serviceKey: string
): Promise<string> {
    const smsRef = `sms_${phone}`;
    const email = `sms_${phone}@sms.raan.app`;

    // البحث في profiles
    const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${smsRef},email.eq.${email}`)
        .limit(1)
        .maybeSingle();

    if (existing?.user_id) {
        console.log(`[sms-webhook] Existing user found: ${existing.user_id}`);
        return existing.user_id;
    }

    // إنشاء مستخدم ضيف جديد
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
            full_name: "ضيف SMS",
            source: "sms_infobip",
            sms_phone: phone,
        },
    });

    let userId: string;

    if (authError) {
        if (authError.message.includes("already been registered")) {
            // مستخدم موجود في auth لكن ليس في profiles
            const lookupRes = await fetch(
                `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
                {
                    headers: {
                        Authorization: `Bearer ${serviceKey}`,
                        apikey: serviceKey,
                    },
                }
            );
            const lookupData = await lookupRes.json();
            const foundUser = lookupData.users?.[0];
            if (!foundUser?.id) throw new Error("Guest SMS user registered but not found");
            userId = foundUser.id;
        } else {
            throw new Error(`Failed to create guest user: ${authError.message}`);
        }
    } else if (!authData?.user) {
        throw new Error("Failed to create guest user: no user returned");
    } else {
        userId = authData.user.id;
    }

    // إنشاء profile
    await supabase.from("profiles").upsert({
        user_id: userId,
        full_name: "ضيف SMS",
        phone: smsRef,
        email,
        status: "active",
    });

    console.log(`[sms-webhook] ✅ Created guest user: ${userId} for ${phone}`);
    return userId;
}

// ════════════════════════════════════════════════════════════
// NLP — Simple Intent Parser for ride requests
// ════════════════════════════════════════════════════════════

interface ParsedRideIntent {
    pickup: string;
    dropoff: string;
}

/**
 * يحاول استخراج نقطة الانطلاق والوجهة من رسالة حرة
 * أنماط مدعومة:
 *   "انا في X اريد الذهاب الى Y"
 *   "من X الى Y"
 *   "X الى Y"
 */
function parseRideIntent(text: string): ParsedRideIntent | null {
    const patterns = [
        // "انا في X اريد الذهاب الى Y" / "أنا في X أريد الذهاب إلى Y"
        /(?:انا|أنا)\s+(?:في|ب|عند)\s+(.+?)\s+(?:اريد|أريد|ابي|أبي|بدي)\s+(?:الذهاب|الروحة|اروح|أروح)\s+(?:الى|إلى|ل|لـ)\s+(.+)/i,
        // "من X الى Y"
        /(?:من)\s+(.+?)\s+(?:الى|إلى|ل)\s+(.+)/i,
        // "X الى Y" (simple)
        /^(.+?)\s+(?:الى|إلى)\s+(.+)$/i,
    ];

    for (const regex of patterns) {
        const match = text.trim().match(regex);
        if (match) {
            const pickup = match[1].trim();
            const dropoff = match[2].trim();
            if (pickup.length > 2 && dropoff.length > 2) {
                return { pickup, dropoff };
            }
        }
    }

    return null;
}

// ════════════════════════════════════════════════════════════
// Main Webhook Handler
// ════════════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    console.log("[sms-webhook] ═══ INBOUND SMS RECEIVED ═══");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const rawBody = await req.text();
        console.log(`[sms-webhook] Raw payload (first 500 chars):`, rawBody.substring(0, 500));

        const payload = JSON.parse(rawBody);

        // ── Parse Infobip MO (Mobile Originated) payload ──
        // Infobip sends: { "results": [{ "from": "964...", "to": "447...", "text": "...", ... }] }
        let senderPhone = "";
        let messageText = "";
        let messageId = "";

        if (payload.results && Array.isArray(payload.results) && payload.results.length > 0) {
            // Infobip standard MO format
            const msg = payload.results[0];
            senderPhone = msg.from || "";
            messageText = msg.text || msg.cleanText || "";
            messageId = msg.messageId || "";
        } else if (payload.from && payload.text) {
            // Simplified/custom format
            senderPhone = payload.from;
            messageText = payload.text;
            messageId = payload.messageId || "";
        } else if (payload.phone && payload.message) {
            // Internal call format (for testing)
            senderPhone = payload.phone;
            messageText = payload.message;
        } else {
            console.error("[sms-webhook] ❌ Unrecognized payload format");
            return new Response(
                JSON.stringify({ error: "Unrecognized payload format" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!senderPhone || !messageText) {
            return new Response(
                JSON.stringify({ error: "Missing sender phone or message text" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const phone = formatIraqiPhone(senderPhone);
        const text = messageText.trim();
        const textLower = text.toLowerCase();

        console.log(`[sms-webhook] 📩 From: ${phone}, Text: "${text}", MsgId: ${messageId}`);

        // ── Log incoming message ──
        try {
            await supabase.from("sms_logs").insert({
                phone,
                message_type: "inbound",
                purpose: "webhook_receive",
                provider: "infobip",
                status: "received",
                external_id: messageId || null,
                error_message: text.substring(0, 500),
                cost: 0,
            });
        } catch { }

        // ── Load session ──
        let session = await getSession(supabase, phone);

        // ══════════════════════════════════════════════════════════
        // Handle numbered responses (from sms-ride-updates menus)
        // ══════════════════════════════════════════════════════════

        // Rating response: 1-5
        if (session.state === "idle" && /^[1-5]$/.test(textLower)) {
            // Could be a rating — check if there's a recently completed ride
            const { data: recentRide } = await supabase
                .from("rides")
                .select("id, driver_id, status")
                .eq("rider_id", session.rider_id)
                .eq("status", "completed")
                .eq("trip_type", "sms")
                .order("completed_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentRide) {
                const rating = parseInt(textLower);
                try {
                    await supabase
                        .from("rides")
                        .update({ driver_rating: rating })
                        .eq("id", recentRide.id);

                    await replyViaSMS(phone, `شكراً على تقييمك ⭐ (${rating}/5)\nأرسل أي رسالة لطلب رحلة جديدة 🚕`);
                    return jsonOk({ action: "rated", rating, ride_id: recentRide.id });
                } catch { }
            }
        }

        // ══════════════════════════════════════════════════════════
        // State: awaiting_confirm — Handle 1 (confirm) / 2 (cancel)
        // ══════════════════════════════════════════════════════════

        if (session.state === "awaiting_confirm") {
            if (textLower === "1" || textLower.includes("تأكيد") || textLower.includes("نعم")) {
                // تأكيد الرحلة → pending
                if (session.ride_id) {
                    await supabase
                        .from("rides")
                        .update({ status: "pending" })
                        .eq("id", session.ride_id)
                        .eq("status", "draft");

                    // invoke match-ride
                    try {
                        await supabase.functions.invoke("match-ride", {
                            body: { rideId: session.ride_id },
                        });
                    } catch { }

                    session.state = "active";
                    await saveSession(supabase, phone, session);

                    await replyViaSMS(phone,
                        `✅ تم تأكيد طلبك!\n` +
                        `جاري البحث عن سائق...\n` +
                        `سنرسل لك رسالة عند قبول السائق 🚗`
                    );
                    return jsonOk({ action: "ride_confirmed", ride_id: session.ride_id });
                }
            }

            if (textLower === "2" || textLower.includes("الغ") || textLower.includes("لا")) {
                // إلغاء
                if (session.ride_id) {
                    await supabase
                        .from("rides")
                        .update({
                            status: "cancelled",
                            cancelled_by: "rider",
                            cancellation_reason: "ألغيت من قبل الراكب (SMS Infobip)",
                        })
                        .eq("id", session.ride_id)
                        .in("status", ["draft", "pending"]);
                }

                session = { state: "idle", updated_at: new Date().toISOString() };
                await saveSession(supabase, phone, session);
                await replyViaSMS(phone, "تم إلغاء الطلب ✅\nأرسل أي رسالة لطلب رحلة جديدة 🚕");
                return jsonOk({ action: "ride_cancelled" });
            }

            // غير مفهوم في حالة التأكيد
            await replyViaSMS(phone, "للتأكيد ارسل 1\nللإلغاء ارسل 2");
            return jsonOk({ action: "confirm_retry" });
        }

        // ══════════════════════════════════════════════════════════
        // State: active — Ride in progress
        // ══════════════════════════════════════════════════════════

        if (session.state === "active" && session.ride_id) {
            const { data: ride } = await supabase
                .from("rides")
                .select("status")
                .eq("id", session.ride_id)
                .maybeSingle();

            if (!ride || ["completed", "cancelled"].includes(ride?.status)) {
                session = { state: "idle", updated_at: new Date().toISOString() };
                await saveSession(supabase, phone, session);
                // Fall through to NLP parsing below
            } else {
                // Still active
                if (textLower === "2" || textLower.includes("الغ")) {
                    await supabase
                        .from("rides")
                        .update({
                            status: "cancelled",
                            cancelled_by: "rider",
                            cancellation_reason: "ألغيت أثناء الرحلة (SMS)",
                        })
                        .eq("id", session.ride_id)
                        .in("status", ["pending", "accepted"]);

                    session = { state: "idle", updated_at: new Date().toISOString() };
                    await saveSession(supabase, phone, session);
                    await replyViaSMS(phone, "تم إلغاء الرحلة ✅\nأرسل أي رسالة لطلب رحلة جديدة");
                    return jsonOk({ action: "active_ride_cancelled" });
                }

                await replyViaSMS(phone, `رحلتك لا تزال جارية 🚗\nللإلغاء أرسل 2`);
                return jsonOk({ action: "ride_still_active" });
            }
        }

        // ══════════════════════════════════════════════════════════
        // State: idle — NLP Ride Intent Parsing
        // ══════════════════════════════════════════════════════════

        // Ensure guest user exists
        const riderId = await findOrCreateGuestUser(supabase, phone, supabaseUrl, supabaseKey);
        session.rider_id = riderId;

        // Try to parse ride intent from the message
        const rideIntent = parseRideIntent(text);

        if (rideIntent) {
            console.log(`[sms-webhook] 🧠 NLP parsed: pickup="${rideIntent.pickup}", dropoff="${rideIntent.dropoff}"`);

            // Create draft ride with parsed addresses
            const { data: ride, error: rideError } = await supabase
                .from("rides")
                .insert({
                    rider_id: riderId,
                    status: "draft",
                    pickup_location: { lat: 33.4233, lng: 43.2974 },  // Ramadi center (placeholder)
                    pickup_address: rideIntent.pickup,
                    dropoff_location: { lat: 33.4350, lng: 43.3100 },  // placeholder
                    dropoff_address: rideIntent.dropoff,
                    estimated_fare: 5000,
                    vehicle_type: "economy",
                    payment_method: "cash",
                    trip_type: "sms",
                })
                .select("id")
                .single();

            if (rideError) {
                console.error("[sms-webhook] ❌ Failed to create ride:", rideError);
                await replyViaSMS(phone, "⚠️ حدث خطأ تقني. حاول مرة أخرى لاحقاً.");
                return jsonOk({ action: "error", error: rideError.message });
            }

            session.ride_id = ride.id;
            session.pickup_address = rideIntent.pickup;
            session.dropoff_address = rideIntent.dropoff;
            session.estimated_fare = 5000;
            session.state = "awaiting_confirm";
            await saveSession(supabase, phone, session);

            // Send immediate structured booking confirmation
            const confirmationMsg =
                `تم تأكيد طلبك\n` +
                `من : ${rideIntent.pickup}\n` +
                `الى : ${rideIntent.dropoff}\n` +
                `المبلغ : 5000 دينار\n` +
                `السيارة : هوندا الرقم : 121212\n` +
                `السائق بالطريق اليك\n\n` +
                `للتأكيد ارسل 1 للإلغاء ارسل 2`;

            await replyViaSMS(phone, confirmationMsg);

            // Log outbound
            try {
                await supabase.from("sms_logs").insert({
                    phone,
                    message_type: "notification",
                    purpose: "ride_booking_confirm",
                    provider: "infobip",
                    status: "sent",
                    cost: 0.02,
                });
            } catch { }

            return jsonOk({
                action: "ride_intent_parsed",
                ride_id: ride.id,
                pickup: rideIntent.pickup,
                dropoff: rideIntent.dropoff,
            });
        }

        // ── No ride intent detected — send welcome ──
        await replyViaSMS(phone,
            `أهلاً بك في ران 🚕\n` +
            `خدمة التوصيل عبر الرسائل القصيرة\n\n` +
            `لطلب رحلة أرسل رسالة مثل:\n` +
            `"انا في شارع المستودع اريد الذهاب الى مول ام عمار"\n\n` +
            `أو أرسل "من [موقعك] الى [وجهتك]"`
        );

        session.state = "idle";
        await saveSession(supabase, phone, session);

        return jsonOk({ action: "welcome" });

    } catch (error) {
        console.error("[sms-webhook] Error:", error);
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: errMsg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ════════════════════════════════════════════════════════════
// Helper: JSON OK Response
// ════════════════════════════════════════════════════════════

function jsonOk(data: Record<string, unknown>) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
