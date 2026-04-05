/**
 * ران — Infobip Inbound SMS Webhook — SILENT PRODUCTION MODE
 * sms-webhook — receives incoming SMS, creates rides, SENDS NO SMS BACK
 *
 * ⚡ SINGLE MESSAGE RULE:
 *   This webhook is SILENT. It does NOT send any SMS to the user.
 *   The ONLY SMS the user receives is from sms-ride-updates
 *   when a driver accepts the ride (status → accepted).
 *
 * Flow:
 *   1. Infobip forwards inbound SMS to this webhook
 *   2. Parse Iraqi dialect NLP (typo-tolerant)
 *   3. Auto-register guest user if new
 *   4. Create ride as PENDING → broadcasts to drivers
 *   5. Return 200 OK (SILENT — no reply SMS)
 *   6. sms-ride-updates sends the ONE confirmation when driver accepts
 *
 * Updated: 2026-02-27
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════
// Landmarks Database
// ════════════════════════════════════════════════════════════

const LANDMARK_LIST = [
    { name: "جامعة الأنبار", lat: 33.4350, lng: 43.2650, aliases: ["جامعة", "الجامعة", "جامعه"] },
    { name: "مستشفى الرمادي", lat: 33.4280, lng: 43.3050, aliases: ["المستشفى", "مستشفى", "مستشفا"] },
    { name: "حي التأميم", lat: 33.4350, lng: 43.3100, aliases: ["التأميم", "تأميم", "التاميم", "تاميم"] },
    { name: "حي الحوز", lat: 33.4200, lng: 43.3150, aliases: ["الحوز", "حوز"] },
    { name: "حي الملعب", lat: 33.4300, lng: 43.2900, aliases: ["الملعب", "ملعب"] },
    { name: "حي الضباط", lat: 33.4150, lng: 43.2850, aliases: ["الضباط", "ضباط"] },
    { name: "حي العزيزية", lat: 33.4180, lng: 43.3200, aliases: ["العزيزية", "عزيزية"] },
    { name: "حي 5 كيلو", lat: 33.4100, lng: 43.2750, aliases: ["5 كيلو", "خمسة كيلو", "٥ كيلو"] },
    { name: "السوق المركزي", lat: 33.4235, lng: 43.3020, aliases: ["السوق", "سوق"] },
    { name: "مبنى المحافظة", lat: 33.4240, lng: 43.3040, aliases: ["المحافظة", "محافظة"] },
    { name: "تقاطع الزيوت", lat: 33.4240, lng: 43.3000, aliases: ["الزيوت", "زيوت"] },
    { name: "حي المعلمين", lat: 33.4150, lng: 43.3050, aliases: ["المعلمين", "معلمين"] },
    { name: "حي الأندلس", lat: 33.4100, lng: 43.3100, aliases: ["الأندلس", "اندلس", "الاندلس"] },
    { name: "شارع 60", lat: 33.4200, lng: 43.2700, aliases: ["ستين", "شارع ستين"] },
    { name: "حي البكر", lat: 33.4280, lng: 43.2950, aliases: ["البكر", "بكر"] },
    { name: "حي الورار", lat: 33.4320, lng: 43.3200, aliases: ["الورار", "ورار"] },
    { name: "حي السلام", lat: 33.4250, lng: 43.2700, aliases: ["السلام", "سلام"] },
    { name: "الفلوجة", lat: 33.3530, lng: 43.7830, aliases: ["فلوجة", "فلوجه"] },
    { name: "هيت", lat: 33.6390, lng: 42.8270, aliases: [] },
    { name: "حديثة", lat: 34.1370, lng: 42.3790, aliases: ["حديثه"] },
    { name: "شارع المستودع", lat: 33.4220, lng: 43.2980, aliases: ["المستودع", "مستودع"] },
    { name: "مول ام عمار", lat: 33.4355, lng: 43.3105, aliases: ["مول ام عمار", "ام عمار", "أم عمار", "مول أم عمار"] },
    { name: "ماركت اورجنل", lat: 33.4222, lng: 43.2985, aliases: ["اورجنل", "أورجنل", "اورجنال"] },
];

const RAMADI_CENTER = { lat: 33.4233, lng: 43.2974 };

// ════════════════════════════════════════════════════════════
// Utils
// ════════════════════════════════════════════════════════════

function formatIraqiPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "964" + cleaned.substring(1);
    if (!cleaned.startsWith("964")) cleaned = "964" + cleaned;
    return cleaned;
}

function normalizeArabic(text: string): string {
    return text
        .replace(/[إأآا]/g, "ا")
        .replace(/[ة]/g, "ه")
        .replace(/[ى]/g, "ي")
        .replace(/[ؤ]/g, "و")
        .replace(/[ئ]/g, "ي")
        .replace(/[،,.\-_]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

// ════════════════════════════════════════════════════════════
// Location Resolution — Fuzzy / Typo-tolerant
// ════════════════════════════════════════════════════════════

function matchLandmark(text: string): { name: string; lat: number; lng: number } | null {
    const normalized = normalizeArabic(text);
    const sorted = [...LANDMARK_LIST].sort((a, b) => b.name.length - a.name.length);
    for (const lm of sorted) {
        if (normalized.includes(normalizeArabic(lm.name))) return { name: lm.name, lat: lm.lat, lng: lm.lng };
        for (const alias of lm.aliases) {
            if (normalized.includes(normalizeArabic(alias))) return { name: lm.name, lat: lm.lat, lng: lm.lng };
        }
    }
    return null;
}

function extractCoordsFromGoogleMaps(text: string): { lat: number; lng: number } | null {
    const patterns = [
        /(?:maps\.google\.com|google\.com\/maps)[^\s]*[?&/@](-?\d+\.?\d*),(-?\d+\.?\d*)/i,
        /(-?\d{1,3}\.\d{3,8}),\s*(-?\d{1,3}\.\d{3,8})/,
    ];
    for (const regex of patterns) {
        const match = text.match(regex);
        if (match) {
            const lat = parseFloat(match[1]), lng = parseFloat(match[2]);
            if (lat > 29 && lat < 38 && lng > 38 && lng < 49) return { lat, lng };
        }
    }
    return null;
}

function resolveLocation(text: string): { lat: number; lng: number; address: string } | null {
    const coords = extractCoordsFromGoogleMaps(text);
    if (coords) return { ...coords, address: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` };
    const lm = matchLandmark(text);
    if (lm) return { lat: lm.lat, lng: lm.lng, address: lm.name };
    return null;
}

// ════════════════════════════════════════════════════════════
// Guest User Registration
// ════════════════════════════════════════════════════════════

async function findOrCreateGuestUser(supabase: any, phone: string, supabaseUrl: string, serviceKey: string): Promise<string> {
    const smsRef = `sms_${phone}`;

    const { data: existing } = await supabase.from("profiles").select("user_id")
        .eq("phone", smsRef).limit(1).maybeSingle();
    if (existing?.user_id) {
        console.log(`[sms-webhook] 👤 Existing user: ${existing.user_id}`);
        return existing.user_id;
    }

    console.log(`[sms-webhook] 👤 Creating guest...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: `+0${phone}`,
        password: crypto.randomUUID(),
        phone_confirm: true,
        user_metadata: { full_name: "ضيف SMS", source: "sms_infobip", sms_phone: phone },
    });

    let userId: string;
    if (authError) {
        if (authError.message.includes("already been registered")) {
            const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(smsRef)}`,
                { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } });
            const data = await res.json();
            if (!data.users?.[0]?.id) throw new Error("Guest not found");
            userId = data.users[0].id;
        } else throw new Error(`Auth: ${authError.message}`);
    } else if (!authData?.user) throw new Error("No user returned");
    else userId = authData.user.id;

    await supabase.from("profiles").upsert({ user_id: userId, full_name: "ضيف SMS", phone: smsRef, status: "active" });
    console.log(`[sms-webhook] ✅ Guest ready: ${userId}`);
    return userId;
}

// ════════════════════════════════════════════════════════════
// Dynamic Fare Calculation
// ════════════════════════════════════════════════════════════

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calculateFare(supabase: any, pLat: number, pLng: number, dLat: number, dLng: number)
    : Promise<{ fare: number; distance_km: number; duration_min: number }> {

    const straightLine = haversineDistance(pLat, pLng, dLat, dLng);
    const distance_km = Math.round(straightLine * 1.3 * 10) / 10;
    const duration_min = Math.round(distance_km * 3);

    try {
        const { data, error } = await supabase.functions.invoke("calculate-fare", {
            body: { pickup_lat: pLat, pickup_lng: pLng, dropoff_lat: dLat, dropoff_lng: dLng, distance_km, vehicle_type: "economy" },
        });
        if (!error && data?.total_fare) {
            console.log(`[sms-webhook] 💰 Fare API: ${data.total_fare} IQD`);
            return { fare: data.total_fare, distance_km: data.distance_km || distance_km, duration_min };
        }
    } catch (e) { console.error(`[sms-webhook] ❌ Fare error:`, e); }

    const fare = Math.max(2500, Math.round((2000 + distance_km * 750) / 500) * 500);
    console.log(`[sms-webhook] 💰 Fare fallback: ${fare} IQD`);
    return { fare, distance_km, duration_min };
}

// ════════════════════════════════════════════════════════════
// Advanced NLP — Typo-Tolerant Iraqi Dialect Parser
// ════════════════════════════════════════════════════════════

interface ParsedRideIntent {
    pickup: string;
    dropoff: string;
    pickupLocation: { lat: number; lng: number } | null;
    dropoffLocation: { lat: number; lng: number } | null;
}

const DROPOFF_KEYWORDS = ["الى", "إلى", "لـ", "اريد", "أريد", "ابي", "أبي", "بدي", "اروح", "أروح", "صوب"];

function parseRideIntent(text: string): ParsedRideIntent | null {
    console.log(`[sms-webhook] 🧠 NLP — "${text}"`);

    // Flexible regex patterns for Iraqi dialect
    const patterns = [
        /(?:اني|أني|انا|أنا|انه)\s+(?:في|ب|عند|يم|قرب|جنب|مقابل)?\s*(.+?)\s+(?:اريد|أريد|ابي|أبي|بدي|وريد|واريد)\s+(?:الذهاب|الروحه|الروحة|اروح|أروح)?\s*(?:الى|إلى|ل|لـ|صوب)?\s+(.+)/i,
        /(?:اني|أني|انا|أنا|انه)\s+(.+?)\s+(?:و?ريد|واريد|وأريد|وابي|اريد|أريد)\s+(?:اروح|أروح|الذهاب)?\s*(?:الى|إلى|ل|لـ|صوب)?\s*(.+)/i,
        /(?:من)\s+(.+?)\s+(?:الى|إلى|ل|لـ)\s+(.+)/i,
        /^(.+?)\s+(?:الى|إلى)\s+(.+)$/i,
    ];

    for (const regex of patterns) {
        const match = text.trim().match(regex);
        if (match) {
            const pickupRaw = match[1].trim().replace(/^(?:في|ب|عند|من)\s+/i, "").trim();
            const dropoffRaw = match[2].trim().replace(/^(?:الى|إلى|ل|لـ|صوب)\s+/i, "").trim();
            if (pickupRaw.length > 1 && dropoffRaw.length > 1) {
                console.log(`[sms-webhook] 🧠 NLP — pickup="${pickupRaw}", dropoff="${dropoffRaw}"`);
                const pLoc = resolveLocation(pickupRaw);
                const dLoc = resolveLocation(dropoffRaw);
                return {
                    pickup: pLoc?.address || pickupRaw, dropoff: dLoc?.address || dropoffRaw,
                    pickupLocation: pLoc ? { lat: pLoc.lat, lng: pLoc.lng } : null,
                    dropoffLocation: dLoc ? { lat: dLoc.lat, lng: dLoc.lng } : null,
                };
            }
        }
    }

    // Fallback: keyword proximity split
    const normalized = normalizeArabic(text);
    for (const kw of DROPOFF_KEYWORDS) {
        const idx = normalized.indexOf(normalizeArabic(kw));
        if (idx > 3) {
            const pickupRaw = text.substring(0, idx).trim()
                .replace(/^(?:اني|أني|انا|أنا|انه)\s+(?:في|ب|عند|يم|قرب|جنب|مقابل|من)?\s*/i, "").trim();
            const dropoffRaw = text.substring(idx + kw.length).trim()
                .replace(/^(?:الى|إلى|ل|لـ|صوب)\s*/i, "").trim();
            if (pickupRaw.length > 1 && dropoffRaw.length > 1) {
                console.log(`[sms-webhook] 🧠 NLP fallback — pickup="${pickupRaw}", dropoff="${dropoffRaw}"`);
                const pLoc = resolveLocation(pickupRaw);
                const dLoc = resolveLocation(dropoffRaw);
                return {
                    pickup: pLoc?.address || pickupRaw, dropoff: dLoc?.address || dropoffRaw,
                    pickupLocation: pLoc ? { lat: pLoc.lat, lng: pLoc.lng } : null,
                    dropoffLocation: dLoc ? { lat: dLoc.lat, lng: dLoc.lng } : null,
                };
            }
        }
    }

    console.log(`[sms-webhook] 🧠 NLP — no intent detected`);
    return null;
}

// ════════════════════════════════════════════════════════════
// Session Management
// ════════════════════════════════════════════════════════════

async function saveSession(supabase: any, phone: string, data: Record<string, unknown>): Promise<void> {
    try {
        await supabase.from("bot_customers").upsert({
            platform: "sms_infobip", platform_id: phone, phone_number: phone,
            display_name: "ضيف SMS", session_data: { ...data, updated_at: new Date().toISOString() },
            last_seen: new Date().toISOString(),
        }, { onConflict: "platform,platform_id" });
    } catch (e) { console.error(`[sms-webhook] ❌ Session save error:`, e); }
}

// ════════════════════════════════════════════════════════════
// Main Webhook Handler — FULLY SILENT (No outbound SMS)
// ════════════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    console.log(`[sms-webhook] ═══ INBOUND — ${new Date().toISOString()} ═══`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const rawBody = await req.text();
        console.log(`[sms-webhook] 📨 RAW (${rawBody.length}c): ${rawBody.substring(0, 500)}`);

        let payload: any;
        try { payload = JSON.parse(rawBody); }
        catch { return jsonOk({ error: "Invalid JSON" }); }

        // Parse Infobip MO payload
        let senderPhone = "", messageText = "", messageId = "";
        if (payload.results?.length > 0) {
            const msg = payload.results[0];
            senderPhone = msg.from || ""; messageText = msg.text || msg.cleanText || msg.message || ""; messageId = msg.messageId || "";
        } else if (payload.from && (payload.text || payload.message)) {
            senderPhone = payload.from; messageText = payload.text || payload.message; messageId = payload.messageId || "";
        } else if (payload.phone && payload.message) {
            senderPhone = payload.phone; messageText = payload.message;
        } else {
            console.error(`[sms-webhook] ❌ Unknown payload format`);
            return jsonOk({ error: "Unknown format" });
        }

        if (!senderPhone || !messageText) return jsonOk({ error: "Missing phone/text" });

        const phone = formatIraqiPhone(senderPhone);
        const text = messageText.trim();

        console.log(`[sms-webhook] 📩 From: ${phone}, Text: "${text}"`);

        // Log inbound
        try {
            await supabase.from("sms_logs").insert({
                phone, message_type: "inbound", purpose: "webhook_receive",
                provider: "infobip", status: "received", external_id: messageId,
                error_message: text.substring(0, 500), cost: 0,
            });
        } catch { }

        // ══════════════════════════════════════════════════════════
        // Cancel command — cancel any active ride (SILENT)
        // ══════════════════════════════════════════════════════════
        const textLower = text.toLowerCase();
        if (["الغاء", "الغي", "0", "الغ", "cancel", "إلغاء", "2"].includes(textLower)) {
            // Find active ride for this user
            const { data: profile } = await supabase.from("profiles")
                .select("user_id").eq("phone", `sms_${phone}`).maybeSingle();
            if (profile?.user_id) {
                await supabase.from("rides").update({
                    status: "cancelled", cancelled_by: "rider",
                    cancellation_reason: "ألغيت من قبل الراكب (SMS)",
                }).eq("rider_id", profile.user_id).in("status", ["draft", "pending", "accepted"]);
                console.log(`[sms-webhook] 🚫 Cancelled rides for ${profile.user_id}`);
            }
            await saveSession(supabase, phone, { state: "idle" });
            return jsonOk({ action: "cancelled" });
        }

        // Rating (1-5)
        if (/^[1-5]$/.test(textLower)) {
            const { data: profile } = await supabase.from("profiles")
                .select("user_id").eq("phone", `sms_${phone}`).maybeSingle();
            if (profile?.user_id) {
                const { data: recent } = await supabase.from("rides").select("id")
                    .eq("rider_id", profile.user_id).eq("status", "completed").eq("trip_type", "sms")
                    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
                if (recent) {
                    await supabase.from("rides").update({ driver_rating: parseInt(textLower) }).eq("id", recent.id);
                    console.log(`[sms-webhook] ⭐ Rating ${textLower}/5 for ride ${recent.id}`);
                    return jsonOk({ action: "rated", rating: parseInt(textLower) });
                }
            }
        }

        // ══════════════════════════════════════════════════════════
        // NLP — Parse ride intent → create PENDING ride (SILENT)
        // ══════════════════════════════════════════════════════════

        const rideIntent = parseRideIntent(text);

        if (rideIntent) {
            // Ensure guest user
            const riderId = await findOrCreateGuestUser(supabase, phone, supabaseUrl, supabaseKey);

            const pickupCoords = rideIntent.pickupLocation || RAMADI_CENTER;
            const dropoffCoords = rideIntent.dropoffLocation || { lat: 33.4350, lng: 43.3100 };

            // Dynamic fare
            const fareResult = await calculateFare(supabase, pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);

            // Create ride directly as PENDING
            console.log(`[sms-webhook] 🚗 Creating PENDING ride (SILENT — no SMS to user)...`);
            const { data: ride, error: rideErr } = await supabase.from("rides").insert({
                rider_id: riderId,
                status: "pending",
                pickup_location: { lat: pickupCoords.lat, lng: pickupCoords.lng },
                pickup_address: rideIntent.pickup,
                dropoff_location: { lat: dropoffCoords.lat, lng: dropoffCoords.lng },
                dropoff_address: rideIntent.dropoff,
                estimated_fare: fareResult.fare,
                distance_km: fareResult.distance_km,
                duration_minutes: fareResult.duration_min,
                vehicle_type: "economy",
                payment_method: "cash",
                trip_type: "sms",
            }).select("id").single();

            if (rideErr) {
                console.error(`[sms-webhook] ❌ Ride creation failed:`, rideErr);
                return jsonOk({ action: "error", error: rideErr.message });
            }

            console.log(`[sms-webhook] ✅ Ride ${ride.id} created as PENDING (fare=${fareResult.fare}, silent)`);

            // Match ride → broadcast to drivers
            try { await supabase.functions.invoke("match-ride", { body: { rideId: ride.id } }); } catch { }

            // Save session (for cancel/rating tracking)
            await saveSession(supabase, phone, {
                state: "active", rider_id: riderId, ride_id: ride.id,
                pickup_address: rideIntent.pickup, dropoff_address: rideIntent.dropoff,
                estimated_fare: fareResult.fare,
            });

            // ⚡ RETURN SILENTLY — sms-ride-updates will send the SMS when driver accepts
            return jsonOk({
                action: "ride_dispatched_silent",
                ride_id: ride.id,
                fare: fareResult.fare,
                pickup: rideIntent.pickup,
                dropoff: rideIntent.dropoff,
            });
        }

        // ══════════════════════════════════════════════════════════
        // No intent recognized — log and return SILENTLY
        // ══════════════════════════════════════════════════════════

        console.log(`[sms-webhook] ⚠️ No ride intent recognized for: "${text}" — SILENT (no reply)`);
        return jsonOk({ action: "no_intent", text });

    } catch (error) {
        console.error(`[sms-webhook] ❌ FATAL:`, error);
        return new Response(JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

function jsonOk(data: Record<string, unknown>) {
    console.log(`[sms-webhook] ✅ ${JSON.stringify(data)}`);
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
