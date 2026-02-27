/**
 * ران — Infobip Inbound SMS Webhook + Guest NLP Flow
 * sms-webhook — receives incoming SMS from Infobip, processes ride intents
 *
 * 🏗️ معمارية:
 *   - يستقبل POST من Infobip inbound forwarding
 *   - يسجل المستخدمين الجدد تلقائياً كـ "Guest SMS User"
 *   - يحلل نية الرسالة (NLP) ويرد فوراً عبر Infobip outbound
 *   - يحسب الأجرة ديناميكياً عبر calculate-fare Edge Function
 *   - يتعامل مع الأرقام المرقمة (1 للتأكيد، 2 للإلغاء)
 *
 * 🐛 Debug Mode: Aggressive console.log at EVERY step
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
// Landmarks Database (same as sms-booking)
// ════════════════════════════════════════════════════════════

const RAMADI_CENTER = { lat: 33.4233, lng: 43.2974 };

const LANDMARK_LIST = [
    { name: "جامعة الأنبار", lat: 33.4350, lng: 43.2650, aliases: ["جامعة", "الجامعة"] },
    { name: "مستشفى الرمادي", lat: 33.4280, lng: 43.3050, aliases: ["المستشفى", "مستشفى"] },
    { name: "حي التأميم", lat: 33.4350, lng: 43.3100, aliases: ["التأميم", "تأميم"] },
    { name: "حي الحوز", lat: 33.4200, lng: 43.3150, aliases: ["الحوز", "حوز"] },
    { name: "حي الملعب", lat: 33.4300, lng: 43.2900, aliases: ["الملعب", "ملعب"] },
    { name: "حي الضباط", lat: 33.4150, lng: 43.2850, aliases: ["الضباط", "ضباط"] },
    { name: "حي العزيزية", lat: 33.4180, lng: 43.3200, aliases: ["العزيزية", "عزيزية"] },
    { name: "حي 5 كيلو", lat: 33.4100, lng: 43.2750, aliases: ["5 كيلو", "خمسة كيلو"] },
    { name: "السوق المركزي", lat: 33.4235, lng: 43.3020, aliases: ["السوق", "سوق"] },
    { name: "مبنى المحافظة", lat: 33.4240, lng: 43.3040, aliases: ["المحافظة", "محافظة"] },
    { name: "تقاطع الزيوت", lat: 33.4240, lng: 43.3000, aliases: ["الزيوت", "زيوت"] },
    { name: "حي المعلمين", lat: 33.4150, lng: 43.3050, aliases: ["المعلمين", "معلمين"] },
    { name: "حي الأندلس", lat: 33.4100, lng: 43.3100, aliases: ["الأندلس", "اندلس"] },
    { name: "شارع 60", lat: 33.4200, lng: 43.2700, aliases: ["ستين", "شارع ستين"] },
    { name: "حي البكر", lat: 33.4280, lng: 43.2950, aliases: ["البكر", "بكر"] },
    { name: "حي الورار", lat: 33.4320, lng: 43.3200, aliases: ["الورار", "ورار"] },
    { name: "حي السلام", lat: 33.4250, lng: 43.2700, aliases: ["السلام", "سلام"] },
    { name: "الفلوجة", lat: 33.3530, lng: 43.7830, aliases: ["فلوجة"] },
    { name: "هيت", lat: 33.6390, lng: 42.8270, aliases: [] },
    { name: "حديثة", lat: 34.1370, lng: 42.3790, aliases: [] },
    // أماكن إضافية لتكامل NLP
    { name: "شارع المستودع الرمادي", lat: 33.4220, lng: 43.2980, aliases: ["المستودع", "شارع المستودع"] },
    { name: "مول ام عمار التأميم", lat: 33.4355, lng: 43.3105, aliases: ["مول ام عمار", "ام عمار", "أم عمار"] },
    { name: "ماركت اورجنل", lat: 33.4222, lng: 43.2985, aliases: ["اورجنل", "أورجنل", "ماركت اورجنال"] },
];

// ════════════════════════════════════════════════════════════
// Phone Formatting
// ════════════════════════════════════════════════════════════

function formatIraqiPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "964" + cleaned.substring(1);
    if (!cleaned.startsWith("964")) cleaned = "964" + cleaned;
    return cleaned;
}

// ════════════════════════════════════════════════════════════
// Location Resolution (Landmarks + Google Maps links)
// ════════════════════════════════════════════════════════════

function matchLandmark(text: string): { name: string; lat: number; lng: number } | null {
    const q = text.trim().toLowerCase().replace(/[.,،\-_]/g, "");

    // مطابقة بالاسم — الأطول أولاً لدقة أعلى
    const sorted = [...LANDMARK_LIST].sort((a, b) => b.name.length - a.name.length);
    for (const lm of sorted) {
        if (q.includes(lm.name.toLowerCase())) {
            return { name: lm.name, lat: lm.lat, lng: lm.lng };
        }
        for (const alias of lm.aliases) {
            if (q.includes(alias.toLowerCase())) {
                return { name: lm.name, lat: lm.lat, lng: lm.lng };
            }
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
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
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
// Infobip Outbound SMS (reply to user) — with FULL logging
// ════════════════════════════════════════════════════════════

async function replyViaSMS(phoneNumber: string, message: string): Promise<boolean> {
    const apiKey = Deno.env.get("INFOBIP_API_KEY");
    const sender = Deno.env.get("INFOBIP_SENDER") || "447491163443";

    console.log(`[sms-webhook] 📤 OUTBOUND — Preparing reply to ${phoneNumber}`);
    console.log(`[sms-webhook] 📤 OUTBOUND — API Key present: ${!!apiKey}, Sender: ${sender}`);
    console.log(`[sms-webhook] 📤 OUTBOUND — Message length: ${message.length} chars`);
    console.log(`[sms-webhook] 📤 OUTBOUND — Message preview: "${message.substring(0, 100)}..."`);

    if (!apiKey) {
        console.error("[sms-webhook] ❌ CRITICAL: INFOBIP_API_KEY not configured in environment!");
        return false;
    }

    const formattedPhone = formatIraqiPhone(phoneNumber);
    console.log(`[sms-webhook] 📤 OUTBOUND — Formatted phone: ${formattedPhone}`);

    const payload = {
        messages: [
            {
                destinations: [{ to: formattedPhone }],
                sender: sender,
                content: { text: message },
            },
        ],
    };

    console.log(`[sms-webhook] 📤 OUTBOUND — Payload: ${JSON.stringify(payload).substring(0, 300)}`);

    try {
        console.log(`[sms-webhook] 📤 OUTBOUND — Calling Infobip API: ${INFOBIP_API_URL}`);
        const res = await fetch(INFOBIP_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `App ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        const responseText = await res.text();
        console.log(`[sms-webhook] 📤 OUTBOUND — HTTP Status: ${res.status}`);
        console.log(`[sms-webhook] 📤 OUTBOUND — Response body: ${responseText.substring(0, 500)}`);

        if (res.ok) {
            try {
                const result = JSON.parse(responseText);
                const msgInfo = result?.messages?.[0];
                console.log(`[sms-webhook] ✅ OUTBOUND SUCCESS — messageId: ${msgInfo?.messageId}, status: ${msgInfo?.status?.name}`);
            } catch {
                console.log(`[sms-webhook] ✅ OUTBOUND SUCCESS (non-JSON response)`);
            }
            return true;
        }

        console.error(`[sms-webhook] ❌ OUTBOUND FAILED — HTTP ${res.status}: ${responseText}`);
        return false;
    } catch (e) {
        console.error(`[sms-webhook] ❌ OUTBOUND NETWORK ERROR:`, e);
        console.error(`[sms-webhook] ❌ Error name: ${(e as Error).name}, message: ${(e as Error).message}`);
        return false;
    }
}

// ════════════════════════════════════════════════════════════
// Session Management via bot_customers
// ════════════════════════════════════════════════════════════

interface SMSSession {
    state: "idle" | "pickup" | "dropoff" | "awaiting_confirm" | "active";
    rider_id?: string;
    ride_id?: string;
    pickup_lat?: number;
    pickup_lng?: number;
    pickup_address?: string;
    dropoff_lat?: number;
    dropoff_lng?: number;
    dropoff_address?: string;
    estimated_fare?: number;
    updated_at: string;
}

async function getSession(supabase: any, phone: string): Promise<SMSSession> {
    console.log(`[sms-webhook] 🔍 SESSION — Loading session for ${phone}`);
    const { data, error } = await supabase
        .from("bot_customers")
        .select("session_data")
        .eq("platform", "sms_infobip")
        .eq("platform_id", phone)
        .maybeSingle();

    if (error) console.error(`[sms-webhook] ❌ SESSION — DB error:`, error);

    if (data?.session_data) {
        const session = data.session_data as SMSSession;
        const updatedAt = new Date(session.updated_at).getTime();
        const ageMin = Math.round((Date.now() - updatedAt) / 60000);
        console.log(`[sms-webhook] 🔍 SESSION — Found: state=${session.state}, age=${ageMin}min`);
        if (Date.now() - updatedAt > 30 * 60 * 1000) {
            console.log(`[sms-webhook] 🔍 SESSION — Expired (>30min), resetting to idle`);
            return { state: "idle", updated_at: new Date().toISOString() };
        }
        return session;
    }
    console.log(`[sms-webhook] 🔍 SESSION — No existing session, starting idle`);
    return { state: "idle", updated_at: new Date().toISOString() };
}

async function saveSession(supabase: any, phone: string, session: SMSSession): Promise<void> {
    session.updated_at = new Date().toISOString();
    console.log(`[sms-webhook] 💾 SESSION — Saving: state=${session.state}, ride_id=${session.ride_id || "none"}`);

    const { error } = await supabase.from("bot_customers").upsert(
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
    if (error) console.error(`[sms-webhook] ❌ SESSION — Save error:`, error);
    else console.log(`[sms-webhook] 💾 SESSION — Saved OK`);
}

// ════════════════════════════════════════════════════════════
// Guest User Registration — with logging
// ════════════════════════════════════════════════════════════

async function findOrCreateGuestUser(
    supabase: any,
    phone: string,
    supabaseUrl: string,
    serviceKey: string
): Promise<string> {
    const smsRef = `sms_${phone}`;
    const email = `sms_${phone}@sms.raan.app`;
    console.log(`[sms-webhook] 👤 GUEST — Looking up user: ${smsRef}`);

    const { data: existing, error: lookupErr } = await supabase
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${smsRef},email.eq.${email}`)
        .limit(1)
        .maybeSingle();

    if (lookupErr) console.error(`[sms-webhook] ❌ GUEST — Lookup error:`, lookupErr);

    if (existing?.user_id) {
        console.log(`[sms-webhook] 👤 GUEST — Existing user found: ${existing.user_id}`);
        return existing.user_id;
    }

    console.log(`[sms-webhook] 👤 GUEST — Creating new guest user...`);
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
        console.error(`[sms-webhook] ❌ GUEST — Auth error: ${authError.message}`);
        if (authError.message.includes("already been registered")) {
            const lookupRes = await fetch(
                `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
                {
                    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
                }
            );
            const lookupData = await lookupRes.json();
            const foundUser = lookupData.users?.[0];
            if (!foundUser?.id) throw new Error("Guest SMS user registered but not found");
            userId = foundUser.id;
            console.log(`[sms-webhook] 👤 GUEST — Found existing auth user: ${userId}`);
        } else {
            throw new Error(`Failed to create guest user: ${authError.message}`);
        }
    } else if (!authData?.user) {
        throw new Error("Failed to create guest user: no user returned");
    } else {
        userId = authData.user.id;
        console.log(`[sms-webhook] 👤 GUEST — New auth user created: ${userId}`);
    }

    await supabase.from("profiles").upsert({
        user_id: userId,
        full_name: "ضيف SMS",
        phone: smsRef,
        email,
        status: "active",
    });

    console.log(`[sms-webhook] ✅ GUEST — User ready: ${userId}`);
    return userId;
}

// ════════════════════════════════════════════════════════════
// Dynamic Fare Calculation (via calculate-fare Edge Function)
// ════════════════════════════════════════════════════════════

async function calculateFare(
    supabase: any,
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number
): Promise<{ fare: number; distance_km: number; duration_min: number }> {
    console.log(`[sms-webhook] 💰 FARE — Calculating: (${pickupLat},${pickupLng}) → (${dropoffLat},${dropoffLng})`);

    try {
        const { data, error } = await supabase.functions.invoke("calculate-fare", {
            body: {
                pickup_lat: pickupLat,
                pickup_lng: pickupLng,
                dropoff_lat: dropoffLat,
                dropoff_lng: dropoffLng,
                vehicle_type: "economy",
            },
        });

        if (error) {
            console.error(`[sms-webhook] ❌ FARE — calculate-fare error:`, error);
        }

        if (data) {
            const fare = data.total_fare || data.estimated_fare || 0;
            const distance_km = data.distance_km || 0;
            const duration_min = data.duration_minutes || 0;
            console.log(`[sms-webhook] 💰 FARE — Result: fare=${fare} IQD, dist=${distance_km}km, dur=${duration_min}min`);
            if (fare > 0) return { fare, distance_km, duration_min };
        }
    } catch (e) {
        console.error(`[sms-webhook] ❌ FARE — Exception:`, e);
    }

    // Fallback: Haversine distance estimation
    console.log(`[sms-webhook] 💰 FARE — Using Haversine fallback...`);
    const R = 6371;
    const dLat = (dropoffLat - pickupLat) * Math.PI / 180;
    const dLng = (dropoffLng - pickupLng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLine = R * c;
    const distance_km = Math.round(straightLine * 1.3 * 10) / 10; // 1.3x road factor
    const duration_min = Math.round(distance_km * 3); // ~20km/h avg
    const baseFare = 2000;
    const perKm = 750;
    const fare = Math.max(2500, Math.round((baseFare + distance_km * perKm) / 500) * 500);

    console.log(`[sms-webhook] 💰 FARE — Fallback result: fare=${fare} IQD, dist=${distance_km}km, dur=${duration_min}min`);
    return { fare, distance_km, duration_min };
}

// ════════════════════════════════════════════════════════════
// NLP — Intent Parser (Arabic ride requests)
// ════════════════════════════════════════════════════════════

interface ParsedRideIntent {
    pickup: string;
    dropoff: string;
    pickupLocation: { lat: number; lng: number } | null;
    dropoffLocation: { lat: number; lng: number } | null;
}

function parseRideIntent(text: string): ParsedRideIntent | null {
    console.log(`[sms-webhook] 🧠 NLP — Parsing: "${text}"`);

    const patterns = [
        /(?:انا|أنا)\s+(?:في|ب|عند)\s+(.+?)\s+(?:اريد|أريد|ابي|أبي|بدي)\s+(?:الذهاب|الروحة|اروح|أروح)\s+(?:الى|إلى|ل|لـ)\s+(.+)/i,
        /(?:من)\s+(.+?)\s+(?:الى|إلى|ل)\s+(.+)/i,
        /^(.+?)\s+(?:الى|إلى)\s+(.+)$/i,
    ];

    for (const regex of patterns) {
        const match = text.trim().match(regex);
        if (match) {
            const pickupRaw = match[1].trim();
            const dropoffRaw = match[2].trim();
            console.log(`[sms-webhook] 🧠 NLP — Pattern matched: pickup="${pickupRaw}", dropoff="${dropoffRaw}"`);

            if (pickupRaw.length > 2 && dropoffRaw.length > 2) {
                const pickupLocation = resolveLocation(pickupRaw);
                const dropoffLocation = resolveLocation(dropoffRaw);
                console.log(`[sms-webhook] 🧠 NLP — Pickup resolved: ${pickupLocation ? pickupLocation.address : "NOT FOUND (using text)"}`);
                console.log(`[sms-webhook] 🧠 NLP — Dropoff resolved: ${dropoffLocation ? dropoffLocation.address : "NOT FOUND (using text)"}`);

                return {
                    pickup: pickupLocation?.address || pickupRaw,
                    dropoff: dropoffLocation?.address || dropoffRaw,
                    pickupLocation: pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null,
                    dropoffLocation: dropoffLocation ? { lat: dropoffLocation.lat, lng: dropoffLocation.lng } : null,
                };
            }
        }
    }

    console.log(`[sms-webhook] 🧠 NLP — No ride intent pattern matched`);
    return null;
}

// ════════════════════════════════════════════════════════════
// Start Keywords
// ════════════════════════════════════════════════════════════

const START_KEYWORDS = [
    "ران", "ran", "raan", "رحلة", "توصيل", "سيارة", "taxi", "تكسي", "taksi",
    "حجز", "ابي سيارة", "أبي سيارة", "اريد رحلة", "أريد رحلة",
];

function isStartKeyword(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return START_KEYWORDS.some(k => lower === k || lower.includes(k));
}

// ════════════════════════════════════════════════════════════
// Landmark Menu Builder
// ════════════════════════════════════════════════════════════

function buildLandmarkMenu(): string {
    let menu = "";
    LANDMARK_LIST.slice(0, 15).forEach((lm, i) => {
        menu += `${i + 1}. ${lm.name}\n`;
    });
    return menu;
}

// ════════════════════════════════════════════════════════════
// Main Webhook Handler
// ════════════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    console.log(`[sms-webhook] ═══════════════════════════════════════════════`);
    console.log(`[sms-webhook] ═══ INBOUND SMS WEBHOOK — ${new Date().toISOString()} ═══`);
    console.log(`[sms-webhook] ═══ Method: ${req.method}, URL: ${req.url}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const rawBody = await req.text();
        console.log(`[sms-webhook] 📨 PAYLOAD — Raw (${rawBody.length} chars): ${rawBody.substring(0, 1000)}`);

        let payload: any;
        try {
            payload = JSON.parse(rawBody);
            console.log(`[sms-webhook] 📨 PAYLOAD — Parsed JSON OK, keys: ${Object.keys(payload).join(", ")}`);
        } catch (jsonErr) {
            console.error(`[sms-webhook] ❌ PAYLOAD — Invalid JSON: ${jsonErr}`);
            return new Response(
                JSON.stringify({ error: "Invalid JSON payload" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ── Parse Infobip MO (Mobile Originated) payload ──
        let senderPhone = "";
        let messageText = "";
        let messageId = "";

        if (payload.results && Array.isArray(payload.results) && payload.results.length > 0) {
            const msg = payload.results[0];
            senderPhone = msg.from || "";
            messageText = msg.text || msg.cleanText || msg.message || "";
            messageId = msg.messageId || "";
            console.log(`[sms-webhook] 📨 FORMAT — Infobip standard MO (results[0])`);
        } else if (payload.from && (payload.text || payload.message)) {
            senderPhone = payload.from;
            messageText = payload.text || payload.message || "";
            messageId = payload.messageId || "";
            console.log(`[sms-webhook] 📨 FORMAT — Simple from/text format`);
        } else if (payload.phone && payload.message) {
            senderPhone = payload.phone;
            messageText = payload.message;
            console.log(`[sms-webhook] 📨 FORMAT — Internal phone/message format`);
        } else {
            console.error(`[sms-webhook] ❌ FORMAT — Unrecognized payload! Keys: ${JSON.stringify(Object.keys(payload))}`);
            console.error(`[sms-webhook] ❌ FORMAT — Full payload: ${rawBody.substring(0, 2000)}`);
            return new Response(
                JSON.stringify({ error: "Unrecognized payload format", keys: Object.keys(payload) }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!senderPhone || !messageText) {
            console.error(`[sms-webhook] ❌ Missing data: phone="${senderPhone}", text="${messageText}"`);
            return new Response(
                JSON.stringify({ error: "Missing sender phone or message text" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const phone = formatIraqiPhone(senderPhone);
        const text = messageText.trim();
        const textLower = text.toLowerCase();

        console.log(`[sms-webhook] 📩 PROCESSED — From: ${phone}, Text: "${text}", MsgId: ${messageId}`);

        // ── Log inbound message ──
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
            console.log(`[sms-webhook] 📝 LOG — Inbound logged to sms_logs`);
        } catch (logErr) {
            console.error(`[sms-webhook] ❌ LOG — Failed to log inbound:`, logErr);
        }

        // ── Load session ──
        let session = await getSession(supabase, phone);
        console.log(`[sms-webhook] 📋 STATE — Current: ${session.state}, rider_id: ${session.rider_id || "none"}`);

        // ══════════════════════════════════════════════════════════
        // Global commands: cancel, help (any state)
        // ══════════════════════════════════════════════════════════

        if (["الغاء", "الغي", "لا", "0", "الغ", "cancel", "إلغاء"].includes(textLower)) {
            console.log(`[sms-webhook] 🚫 ACTION — Cancel command detected`);
            if (session.ride_id) {
                await supabase.from("rides").update({
                    status: "cancelled",
                    cancelled_by: "rider",
                    cancellation_reason: "ألغيت من قبل الراكب (SMS Infobip)",
                }).eq("id", session.ride_id).in("status", ["draft", "pending"]);
            }
            session = { state: "idle", updated_at: new Date().toISOString() };
            await saveSession(supabase, phone, session);
            await replyViaSMS(phone, "تم الإلغاء ✅\nأرسل (ران) لطلب رحلة جديدة");
            return jsonOk({ action: "cancelled" });
        }

        if (["مساعدة", "مساعده", "help", "?", "؟"].includes(textLower)) {
            console.log(`[sms-webhook] ❓ ACTION — Help command detected`);
            await replyViaSMS(phone,
                `🚕 ران — خدمة التوصيل عبر SMS\n\n` +
                `لطلب رحلة أرسل:\n` +
                `"انا في [موقعك] اريد الذهاب الى [الوجهة]"\n` +
                `أو أرسل: "من [موقعك] الى [الوجهة]"\n\n` +
                `أو أرسل (ران) للبدء خطوة بخطوة\n` +
                `أرسل (الغاء) أو (0) للإلغاء`
            );
            return jsonOk({ action: "help" });
        }

        // ══════════════════════════════════════════════════════════
        // State: awaiting_confirm — Handle 1/2
        // ══════════════════════════════════════════════════════════

        if (session.state === "awaiting_confirm") {
            console.log(`[sms-webhook] ✅ STATE — awaiting_confirm, input: "${textLower}"`);

            if (textLower === "1" || textLower.includes("تأكيد") || textLower.includes("نعم")) {
                console.log(`[sms-webhook] ✅ ACTION — Ride CONFIRMED`);
                if (session.ride_id) {
                    const { error: updateErr } = await supabase.from("rides")
                        .update({ status: "pending" })
                        .eq("id", session.ride_id)
                        .eq("status", "draft");
                    if (updateErr) console.error(`[sms-webhook] ❌ DB — Update ride error:`, updateErr);
                    else console.log(`[sms-webhook] ✅ DB — Ride ${session.ride_id}: draft → pending`);

                    try {
                        await supabase.functions.invoke("match-ride", { body: { rideId: session.ride_id } });
                        console.log(`[sms-webhook] ✅ match-ride invoked`);
                    } catch (matchErr) {
                        console.warn(`[sms-webhook] ⚠️ match-ride failed:`, matchErr);
                    }

                    session.state = "active";
                    await saveSession(supabase, phone, session);
                    await replyViaSMS(phone,
                        `✅ تم تأكيد طلبك!\nجاري البحث عن سائق...\nسنرسل لك رسالة عند قبول السائق 🚗`
                    );
                    return jsonOk({ action: "ride_confirmed", ride_id: session.ride_id });
                }
            }

            if (textLower === "2" || textLower.includes("الغ") || textLower.includes("لا")) {
                console.log(`[sms-webhook] 🚫 ACTION — Ride CANCELLED from confirm`);
                if (session.ride_id) {
                    await supabase.from("rides").update({
                        status: "cancelled",
                        cancelled_by: "rider",
                        cancellation_reason: "رفض التأكيد (SMS Infobip)",
                    }).eq("id", session.ride_id).eq("status", "draft");
                }
                session = { state: "idle", updated_at: new Date().toISOString() };
                await saveSession(supabase, phone, session);
                await replyViaSMS(phone, "تم إلغاء الطلب ✅\nأرسل (ران) لطلب رحلة جديدة 🚕");
                return jsonOk({ action: "ride_cancelled" });
            }

            await replyViaSMS(phone, "للتأكيد ارسل 1\nللإلغاء ارسل 2");
            return jsonOk({ action: "confirm_retry" });
        }

        // ══════════════════════════════════════════════════════════
        // State: active — ride in progress
        // ══════════════════════════════════════════════════════════

        if (session.state === "active" && session.ride_id) {
            console.log(`[sms-webhook] 🚗 STATE — active ride: ${session.ride_id}`);
            const { data: ride } = await supabase.from("rides").select("status").eq("id", session.ride_id).maybeSingle();
            if (!ride || ["completed", "cancelled"].includes(ride?.status)) {
                console.log(`[sms-webhook] 🚗 Ride ended (${ride?.status || "not found"}), resetting session`);
                session = { state: "idle", updated_at: new Date().toISOString() };
                await saveSession(supabase, phone, session);
                // fall through to idle handling below
            } else {
                if (textLower === "2" || textLower.includes("الغ")) {
                    await supabase.from("rides").update({ status: "cancelled", cancelled_by: "rider" })
                        .eq("id", session.ride_id).in("status", ["pending", "accepted"]);
                    session = { state: "idle", updated_at: new Date().toISOString() };
                    await saveSession(supabase, phone, session);
                    await replyViaSMS(phone, "تم إلغاء الرحلة ✅\nأرسل (ران) لطلب رحلة جديدة");
                    return jsonOk({ action: "active_cancelled" });
                }
                await replyViaSMS(phone, `رحلتك لا تزال جارية 🚗\nللإلغاء أرسل 2`);
                return jsonOk({ action: "ride_still_active" });
            }
        }

        // ══════════════════════════════════════════════════════════
        // State: pickup — awaiting pickup location
        // ══════════════════════════════════════════════════════════

        if (session.state === "pickup") {
            console.log(`[sms-webhook] 📍 STATE — pickup, resolving: "${text}"`);
            const location = resolveLocation(text);
            if (!location) {
                console.log(`[sms-webhook] ❌ Location not resolved, asking again`);
                await replyViaSMS(phone,
                    `⚠️ ما عرفنا المكان "${text}"\n\n` +
                    `حاول مرة ثانية:\n` +
                    `- أرسل اسم المكان (مثل: الملعب)\n` +
                    `- أو رابط Google Maps\n\n(0) للإلغاء`
                );
                return jsonOk({ action: "pickup_retry" });
            }
            console.log(`[sms-webhook] ✅ Pickup resolved: ${location.address} (${location.lat},${location.lng})`);
            session.pickup_lat = location.lat;
            session.pickup_lng = location.lng;
            session.pickup_address = location.address;
            session.state = "dropoff";
            await saveSession(supabase, phone, session);
            await replyViaSMS(phone,
                `✅ الانطلاق: ${location.address}\n\n🎯 وين وجهتك؟\nأرسل اسم المكان أو رابط Maps\n\n(0) للإلغاء`
            );
            return jsonOk({ action: "ask_dropoff" });
        }

        // ══════════════════════════════════════════════════════════
        // State: dropoff — awaiting dropoff, then calculate fare
        // ══════════════════════════════════════════════════════════

        if (session.state === "dropoff") {
            console.log(`[sms-webhook] 📍 STATE — dropoff, resolving: "${text}"`);
            const location = resolveLocation(text);
            if (!location) {
                await replyViaSMS(phone,
                    `⚠️ ما عرفنا الوجهة "${text}"\nحاول مرة ثانية بأسم المكان أو رابط Maps\n\n(0) للإلغاء`
                );
                return jsonOk({ action: "dropoff_retry" });
            }
            console.log(`[sms-webhook] ✅ Dropoff resolved: ${location.address} (${location.lat},${location.lng})`);

            // Dynamic fare
            const fareResult = await calculateFare(supabase,
                session.pickup_lat!, session.pickup_lng!,
                location.lat, location.lng
            );

            // Create ride
            const riderId = session.rider_id || await findOrCreateGuestUser(supabase, phone, supabaseUrl, supabaseKey);
            const { data: ride, error: rideErr } = await supabase.from("rides").insert({
                rider_id: riderId,
                status: "draft",
                pickup_location: { lat: session.pickup_lat, lng: session.pickup_lng },
                pickup_address: session.pickup_address,
                dropoff_location: { lat: location.lat, lng: location.lng },
                dropoff_address: location.address,
                estimated_fare: fareResult.fare,
                distance_km: fareResult.distance_km,
                duration_minutes: fareResult.duration_min,
                vehicle_type: "economy",
                payment_method: "cash",
                trip_type: "sms",
            }).select("id").single();

            if (rideErr || !ride) {
                console.error(`[sms-webhook] ❌ Ride creation failed:`, rideErr);
                await replyViaSMS(phone, "⚠️ حدث خطأ تقني. حاول مرة أخرى لاحقاً.");
                return jsonOk({ action: "error" });
            }

            session.ride_id = ride.id;
            session.dropoff_lat = location.lat;
            session.dropoff_lng = location.lng;
            session.dropoff_address = location.address;
            session.estimated_fare = fareResult.fare;
            session.state = "awaiting_confirm";
            await saveSession(supabase, phone, session);

            const confirmMsg =
                `تم تأكيد طلبك\n` +
                `من : ${session.pickup_address}\n` +
                `الى : ${location.address}\n` +
                `المسافة : ${fareResult.distance_km} كم\n` +
                `المبلغ : ${fareResult.fare.toLocaleString()} دينار\n\n` +
                `للتأكيد ارسل 1 للإلغاء ارسل 2`;

            await replyViaSMS(phone, confirmMsg);
            return jsonOk({ action: "ask_confirm", ride_id: ride.id, fare: fareResult.fare });
        }

        // ══════════════════════════════════════════════════════════
        // State: idle — Start keyword OR NLP intent
        // ══════════════════════════════════════════════════════════

        console.log(`[sms-webhook] 🏠 STATE — idle, analyzing input: "${text}"`);

        // Rating response: 1-5 (from previous completed ride)
        if (/^[1-5]$/.test(textLower) && session.rider_id) {
            console.log(`[sms-webhook] ⭐ Checking if this is a rating...`);
            const { data: recentRide } = await supabase.from("rides")
                .select("id, driver_id, status")
                .eq("rider_id", session.rider_id)
                .eq("status", "completed")
                .eq("trip_type", "sms")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentRide) {
                const rating = parseInt(textLower);
                await supabase.from("rides").update({ driver_rating: rating }).eq("id", recentRide.id);
                console.log(`[sms-webhook] ⭐ Rating ${rating}/5 saved for ride ${recentRide.id}`);
                await replyViaSMS(phone, `شكراً على تقييمك ⭐ (${rating}/5)\nأرسل (ران) لطلب رحلة جديدة 🚕`);
                return jsonOk({ action: "rated", rating });
            }
        }

        // Ensure guest user exists
        const riderId = await findOrCreateGuestUser(supabase, phone, supabaseUrl, supabaseKey);
        session.rider_id = riderId;

        // Try NLP ride intent first
        const rideIntent = parseRideIntent(text);

        if (rideIntent) {
            console.log(`[sms-webhook] 🧠 NLP — Ride intent detected!`);
            console.log(`[sms-webhook] 🧠 NLP — Pickup: "${rideIntent.pickup}", Dropoff: "${rideIntent.dropoff}"`);

            // Get coordinates — from NLP resolution or Ramadi center fallback
            const pickupCoords = rideIntent.pickupLocation || RAMADI_CENTER;
            const dropoffCoords = rideIntent.dropoffLocation || { lat: 33.4350, lng: 43.3100 };

            console.log(`[sms-webhook] 📍 Pickup coords: (${pickupCoords.lat},${pickupCoords.lng})`);
            console.log(`[sms-webhook] 📍 Dropoff coords: (${dropoffCoords.lat},${dropoffCoords.lng})`);

            // Dynamic fare calculation
            const fareResult = await calculateFare(supabase,
                pickupCoords.lat, pickupCoords.lng,
                dropoffCoords.lat, dropoffCoords.lng
            );

            console.log(`[sms-webhook] 💰 Fare calculated: ${fareResult.fare} IQD`);

            // Create draft ride
            console.log(`[sms-webhook] 🚗 Creating ride in DB...`);
            const { data: ride, error: rideError } = await supabase.from("rides").insert({
                rider_id: riderId,
                status: "draft",
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

            if (rideError) {
                console.error(`[sms-webhook] ❌ DB — Ride creation error:`, rideError);
                await replyViaSMS(phone, "⚠️ حدث خطأ تقني. حاول مرة أخرى لاحقاً.");
                return jsonOk({ action: "error", error: rideError.message });
            }

            console.log(`[sms-webhook] ✅ DB — Ride created: ${ride.id}`);

            session.ride_id = ride.id;
            session.pickup_address = rideIntent.pickup;
            session.pickup_lat = pickupCoords.lat;
            session.pickup_lng = pickupCoords.lng;
            session.dropoff_address = rideIntent.dropoff;
            session.dropoff_lat = dropoffCoords.lat;
            session.dropoff_lng = dropoffCoords.lng;
            session.estimated_fare = fareResult.fare;
            session.state = "awaiting_confirm";
            await saveSession(supabase, phone, session);

            // Structured booking confirmation (client's exact format)
            const confirmMsg =
                `تم تأكيد طلبك\n` +
                `من : ${rideIntent.pickup}\n` +
                `الى : ${rideIntent.dropoff}\n` +
                `المسافة : ${fareResult.distance_km} كم\n` +
                `المبلغ : ${fareResult.fare.toLocaleString()} دينار\n\n` +
                `للتأكيد ارسل 1 للإلغاء ارسل 2`;

            console.log(`[sms-webhook] 📤 Sending confirmation reply...`);
            const sent = await replyViaSMS(phone, confirmMsg);
            console.log(`[sms-webhook] 📤 Confirmation sent: ${sent}`);

            // Log outbound
            try {
                await supabase.from("sms_logs").insert({
                    phone, message_type: "notification", purpose: "ride_booking_confirm",
                    provider: "infobip", status: sent ? "sent" : "failed", cost: 0.02,
                });
            } catch { }

            return jsonOk({ action: "ride_intent_parsed", ride_id: ride.id, fare: fareResult.fare });
        }

        // ── Start keyword (ران, RAAN, etc.) → step-by-step booking ──
        if (isStartKeyword(text)) {
            console.log(`[sms-webhook] 🚕 ACTION — Start keyword detected: "${text}"`);
            session.state = "pickup";
            session.rider_id = riderId;
            await saveSession(supabase, phone, session);

            const menu = buildLandmarkMenu();
            await replyViaSMS(phone,
                `🚕 أهلاً! وين موقعك (نقطة الانطلاق)؟\n\n` +
                `أرسل اسم المكان:\n${menu}\n` +
                `أو أرسل رابط Google Maps\n\n` +
                `(0) للإلغاء`
            );
            return jsonOk({ action: "ask_pickup" });
        }

        // ── No intent recognized — Welcome ──
        console.log(`[sms-webhook] 🏠 No intent recognized, sending welcome`);
        await replyViaSMS(phone,
            `أهلاً بك في ران 🚕\n` +
            `خدمة التوصيل عبر الرسائل القصيرة\n\n` +
            `لطلب رحلة أرسل مثل:\n` +
            `"انا في شارع المستودع اريد الذهاب الى مول ام عمار"\n\n` +
            `أو أرسل (ران) للبدء خطوة بخطوة\n` +
            `أو أرسل "من [موقعك] الى [وجهتك]"`
        );

        session.state = "idle";
        await saveSession(supabase, phone, session);
        return jsonOk({ action: "welcome" });

    } catch (error) {
        console.error(`[sms-webhook] ❌ FATAL ERROR:`, error);
        console.error(`[sms-webhook] ❌ Error type: ${(error as Error).constructor.name}`);
        console.error(`[sms-webhook] ❌ Error message: ${(error as Error).message}`);
        console.error(`[sms-webhook] ❌ Stack: ${(error as Error).stack}`);
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: errMsg }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// ════════════════════════════════════════════════════════════
// Helper
// ════════════════════════════════════════════════════════════

function jsonOk(data: Record<string, unknown>) {
    console.log(`[sms-webhook] ✅ RESPONSE: ${JSON.stringify(data)}`);
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
