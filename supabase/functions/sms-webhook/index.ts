/**
 * ران — Infobip Inbound SMS Webhook — PRODUCTION FLOW
 * sms-webhook — receives incoming SMS, creates REAL rides for driver dispatch
 *
 * 🏗️ Production Flow:
 *   1. User sends SMS → Infobip forwards to this webhook
 *   2. Guest user auto-registered if new
 *   3. NLP extracts pickup/dropoff (typo-tolerant, Iraqi dialect)
 *   4. Ride created as PENDING → broadcasts to drivers
 *   5. sms-ride-updates sends confirmation ONLY when driver accepts
 *
 * ⚠️ NO mock data, NO fake car details, NO immediate confirmation
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
// Landmarks Database
// ════════════════════════════════════════════════════════════

const RAMADI_CENTER = { lat: 33.4233, lng: 43.2974 };

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
    { name: "ماركت اورجنل", lat: 33.4222, lng: 43.2985, aliases: ["اورجنل", "أورجنل", "ماركت اورجنال", "اورجنال"] },
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
// Infobip Outbound SMS (reply to user) — with FULL logging
// ════════════════════════════════════════════════════════════

async function replyViaSMS(phoneNumber: string, message: string): Promise<boolean> {
    const apiKey = Deno.env.get("INFOBIP_API_KEY");
    const sender = Deno.env.get("INFOBIP_SENDER") || "447491163443";

    console.log(`[sms-webhook] 📤 OUTBOUND — To: ${phoneNumber}, ApiKey: ${!!apiKey}, Sender: ${sender}`);
    console.log(`[sms-webhook] 📤 OUTBOUND — Message (${message.length} chars): "${message.substring(0, 150)}..."`);

    if (!apiKey) {
        console.error("[sms-webhook] ❌ CRITICAL: INFOBIP_API_KEY not configured!");
        return false;
    }

    const formattedPhone = formatIraqiPhone(phoneNumber);
    const payload = {
        messages: [{
            destinations: [{ to: formattedPhone }],
            sender: sender,
            content: { text: message },
        }],
    };

    try {
        const res = await fetch(INFOBIP_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `App ${apiKey}` },
            body: JSON.stringify(payload),
        });
        const responseText = await res.text();
        console.log(`[sms-webhook] 📤 OUTBOUND — HTTP ${res.status}: ${responseText.substring(0, 300)}`);
        return res.ok;
    } catch (e) {
        console.error(`[sms-webhook] ❌ OUTBOUND ERROR:`, e);
        return false;
    }
}

// ════════════════════════════════════════════════════════════
// Location Resolution — Fuzzy / Typo-tolerant
// ════════════════════════════════════════════════════════════

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

function matchLandmark(text: string): { name: string; lat: number; lng: number } | null {
    const normalized = normalizeArabic(text);
    console.log(`[sms-webhook] 📍 LANDMARK — matching normalized: "${normalized}"`);

    // Sort by name length (longest first) for greedy matching
    const sorted = [...LANDMARK_LIST].sort((a, b) => b.name.length - a.name.length);
    for (const lm of sorted) {
        const normName = normalizeArabic(lm.name);
        if (normalized.includes(normName)) {
            console.log(`[sms-webhook] 📍 LANDMARK — matched: "${lm.name}"`);
            return { name: lm.name, lat: lm.lat, lng: lm.lng };
        }
        for (const alias of lm.aliases) {
            const normAlias = normalizeArabic(alias);
            if (normalized.includes(normAlias)) {
                console.log(`[sms-webhook] 📍 LANDMARK — matched alias "${alias}" → "${lm.name}"`);
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
// Session Management
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
    try {
        const { data } = await supabase
            .from("bot_customers")
            .select("session_data")
            .eq("platform", "sms_infobip")
            .eq("platform_id", phone)
            .maybeSingle();

        if (data?.session_data) {
            const session = data.session_data as SMSSession;
            const age = Date.now() - new Date(session.updated_at).getTime();
            console.log(`[sms-webhook] 🔍 SESSION — state=${session.state}, age=${Math.round(age / 60000)}min`);
            if (age > 30 * 60 * 1000) return { state: "idle", updated_at: new Date().toISOString() };
            return session;
        }
    } catch (e) {
        console.error(`[sms-webhook] ❌ SESSION load error:`, e);
    }
    return { state: "idle", updated_at: new Date().toISOString() };
}

async function saveSession(supabase: any, phone: string, session: SMSSession): Promise<void> {
    session.updated_at = new Date().toISOString();
    try {
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
        console.log(`[sms-webhook] 💾 SESSION saved: state=${session.state}`);
    } catch (e) {
        console.error(`[sms-webhook] ❌ SESSION save error:`, e);
    }
}

// ════════════════════════════════════════════════════════════
// Guest User Registration
// ════════════════════════════════════════════════════════════

async function findOrCreateGuestUser(supabase: any, phone: string, supabaseUrl: string, serviceKey: string): Promise<string> {
    const smsRef = `sms_${phone}`;
    const email = `sms_${phone}@sms.raan.app`;

    const { data: existing } = await supabase.from("profiles").select("user_id")
        .or(`phone.eq.${smsRef},email.eq.${email}`).limit(1).maybeSingle();
    if (existing?.user_id) {
        console.log(`[sms-webhook] 👤 Existing user: ${existing.user_id}`);
        return existing.user_id;
    }

    console.log(`[sms-webhook] 👤 Creating guest user...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email, password: crypto.randomUUID(), email_confirm: true,
        user_metadata: { full_name: "ضيف SMS", source: "sms_infobip", sms_phone: phone },
    });

    let userId: string;
    if (authError) {
        if (authError.message.includes("already been registered")) {
            const lookupRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
                { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } });
            const lookupData = await lookupRes.json();
            if (!lookupData.users?.[0]?.id) throw new Error("Guest user not found");
            userId = lookupData.users[0].id;
        } else throw new Error(`Auth error: ${authError.message}`);
    } else if (!authData?.user) throw new Error("No user returned");
    else userId = authData.user.id;

    await supabase.from("profiles").upsert({ user_id: userId, full_name: "ضيف SMS", phone: smsRef, email, status: "active" });
    console.log(`[sms-webhook] ✅ Guest user ready: ${userId}`);
    return userId;
}

// ════════════════════════════════════════════════════════════
// Dynamic Fare Calculation — with distance_km (REQUIRED by calculate-fare)
// ════════════════════════════════════════════════════════════

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calculateFare(
    supabase: any, pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number
): Promise<{ fare: number; distance_km: number; duration_min: number }> {
    // Calculate distance first (required by calculate-fare)
    const straightLine = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const distance_km = Math.round(straightLine * 1.3 * 10) / 10; // 1.3x road factor
    const duration_min = Math.round(distance_km * 3);

    console.log(`[sms-webhook] 💰 FARE — distance=${distance_km}km, duration≈${duration_min}min`);

    try {
        const { data, error } = await supabase.functions.invoke("calculate-fare", {
            body: {
                pickup_lat: pickupLat, pickup_lng: pickupLng,
                dropoff_lat: dropoffLat, dropoff_lng: dropoffLng,
                distance_km: distance_km, // REQUIRED parameter
                vehicle_type: "economy",
            },
        });

        if (!error && data && data.total_fare) {
            console.log(`[sms-webhook] 💰 FARE — API result: ${data.total_fare} IQD`);
            return { fare: data.total_fare, distance_km: data.distance_km || distance_km, duration_min };
        }
        console.warn(`[sms-webhook] ⚠️ FARE API failed:`, error || "no total_fare in response");
    } catch (e) {
        console.error(`[sms-webhook] ❌ FARE exception:`, e);
    }

    // Haversine fallback
    const baseFare = 2000;
    const perKm = 750;
    const fare = Math.max(2500, Math.round((baseFare + distance_km * perKm) / 500) * 500);
    console.log(`[sms-webhook] 💰 FARE fallback: ${fare} IQD`);
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

// Iraqi dialect pickup indicators
const PICKUP_INDICATORS = [
    "اني", "أني", "انا", "أنا", "مكاني", "موقعي", "انه",
    "بشارع", "في شارع", "عند", "يم", "قرب", "جنب", "مقابل",
    "في", "ب", "من",
];

// Dropoff/destination indicators
const DROPOFF_INDICATORS = [
    "الى", "إلى", "لـ", "ل", "اريد", "أريد", "ابي", "أبي", "بدي",
    "اروح", "أروح", "صوب", "باتجاه", "الذهاب",
    "مول", "مستشفى", "جامعة", "سوق", "شارع",
];

function parseRideIntent(text: string): ParsedRideIntent | null {
    console.log(`[sms-webhook] 🧠 NLP — Input: "${text}"`);
    const normalized = normalizeArabic(text);
    console.log(`[sms-webhook] 🧠 NLP — Normalized: "${normalized}"`);

    // Strategy 1: Regex patterns (flexible, typo-tolerant)
    const patterns = [
        // "اني بشارع X اريد الذهاب الى Y" / "انا في X اريد اروح Y"
        /(?:اني|أني|انا|أنا|انه)\s+(?:في|ب|عند|يم|قرب|جنب)?\s*(.+?)\s+(?:اريد|أريد|ابي|أبي|بدي)\s+(?:الذهاب|الروحه|الروحة|اروح|أروح)?\s*(?:الى|إلى|ل|لـ|صوب)?\s+(.+)/i,
        // "اني بX وريد اروح لY" (very flexible)
        /(?:اني|أني|انا|أنا|انه)\s+(.+?)\s+(?:و?ريد|واريد|وأريد|وابي|اريد|أريد)\s+(?:اروح|أروح|الذهاب)?\s*(?:الى|إلى|ل|لـ|صوب)?\s*(.+)/i,
        // "من X الى Y"
        /(?:من)\s+(.+?)\s+(?:الى|إلى|ل|لـ)\s+(.+)/i,
        // "X الى Y" (simplest)
        /^(.+?)\s+(?:الى|إلى)\s+(.+)$/i,
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = text.trim().match(patterns[i]);
        if (match) {
            let pickupRaw = match[1].trim();
            let dropoffRaw = match[2].trim();

            // Clean up common prefixes
            pickupRaw = pickupRaw.replace(/^(?:في|ب|عند|من)\s+/i, "").trim();
            dropoffRaw = dropoffRaw.replace(/^(?:الى|إلى|ل|لـ|صوب)\s+/i, "").trim();

            console.log(`[sms-webhook] 🧠 NLP — Pattern ${i + 1} matched: pickup="${pickupRaw}", dropoff="${dropoffRaw}"`);

            if (pickupRaw.length > 1 && dropoffRaw.length > 1) {
                const pickupLocation = resolveLocation(pickupRaw);
                const dropoffLocation = resolveLocation(dropoffRaw);
                console.log(`[sms-webhook] 🧠 NLP — Pickup: ${pickupLocation?.address || pickupRaw} (${pickupLocation ? "resolved" : "text only"})`);
                console.log(`[sms-webhook] 🧠 NLP — Dropoff: ${dropoffLocation?.address || dropoffRaw} (${dropoffLocation ? "resolved" : "text only"})`);

                return {
                    pickup: pickupLocation?.address || pickupRaw,
                    dropoff: dropoffLocation?.address || dropoffRaw,
                    pickupLocation: pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null,
                    dropoffLocation: dropoffLocation ? { lat: dropoffLocation.lat, lng: dropoffLocation.lng } : null,
                };
            }
        }
    }

    // Strategy 2: Keyword proximity — split by dropoff indicators
    for (const indicator of DROPOFF_INDICATORS.slice(0, 6)) {
        const idx = normalized.indexOf(normalizeArabic(indicator));
        if (idx > 3) { // There must be pickup text before
            const pickupRaw = text.substring(0, idx).trim()
                .replace(/^(?:اني|أني|انا|أنا|انه)\s+(?:في|ب|عند|يم|قرب|جنب|من)?\s*/i, "").trim();
            const dropoffRaw = text.substring(idx + indicator.length).trim()
                .replace(/^(?:الى|إلى|ل|لـ|صوب)\s*/i, "").trim();

            if (pickupRaw.length > 1 && dropoffRaw.length > 1) {
                console.log(`[sms-webhook] 🧠 NLP — Keyword split on "${indicator}": pickup="${pickupRaw}", dropoff="${dropoffRaw}"`);
                const pickupLocation = resolveLocation(pickupRaw);
                const dropoffLocation = resolveLocation(dropoffRaw);
                return {
                    pickup: pickupLocation?.address || pickupRaw,
                    dropoff: dropoffLocation?.address || dropoffRaw,
                    pickupLocation: pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null,
                    dropoffLocation: dropoffLocation ? { lat: dropoffLocation.lat, lng: dropoffLocation.lng } : null,
                };
            }
        }
    }

    console.log(`[sms-webhook] 🧠 NLP — No ride intent detected`);
    return null;
}

// ════════════════════════════════════════════════════════════
// Start Keywords
// ════════════════════════════════════════════════════════════

const START_KEYWORDS = [
    "ران", "ran", "raan", "رحلة", "رحله", "توصيل", "سيارة", "سياره",
    "taxi", "تكسي", "تاكسي", "taksi", "حجز", "1",
];

function isStartKeyword(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return START_KEYWORDS.some(k => lower === k);
}

function buildLandmarkMenu(): string {
    return LANDMARK_LIST.slice(0, 15).map((lm, i) => `${i + 1}. ${lm.name}`).join("\n");
}

// ════════════════════════════════════════════════════════════
// Main Webhook Handler — PRODUCTION FLOW
// ════════════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    console.log(`[sms-webhook] ═══ INBOUND — ${new Date().toISOString()} ═══`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const rawBody = await req.text();
        console.log(`[sms-webhook] 📨 RAW (${rawBody.length}c): ${rawBody.substring(0, 1000)}`);

        let payload: any;
        try { payload = JSON.parse(rawBody); }
        catch { return jsonErr("Invalid JSON", 400); }

        // ── Parse Infobip MO payload ──
        let senderPhone = "", messageText = "", messageId = "";

        if (payload.results?.length > 0) {
            const msg = payload.results[0];
            senderPhone = msg.from || "";
            messageText = msg.text || msg.cleanText || msg.message || "";
            messageId = msg.messageId || "";
        } else if (payload.from && (payload.text || payload.message)) {
            senderPhone = payload.from;
            messageText = payload.text || payload.message;
            messageId = payload.messageId || "";
        } else if (payload.phone && payload.message) {
            senderPhone = payload.phone;
            messageText = payload.message;
        } else {
            console.error(`[sms-webhook] ❌ Unknown format: ${JSON.stringify(Object.keys(payload))}`);
            return jsonErr("Unrecognized payload", 400);
        }

        if (!senderPhone || !messageText) return jsonErr("Missing phone/text", 400);

        const phone = formatIraqiPhone(senderPhone);
        const text = messageText.trim();
        const textLower = text.toLowerCase();

        console.log(`[sms-webhook] 📩 From: ${phone}, Text: "${text}"`);

        // Log inbound
        try {
            await supabase.from("sms_logs").insert({
                phone, message_type: "inbound", purpose: "webhook_receive",
                provider: "infobip", status: "received", external_id: messageId,
                error_message: text.substring(0, 500), cost: 0,
            });
        } catch { }

        // Load session
        let session = await getSession(supabase, phone);

        // ══════════════ Global: Cancel ══════════════
        if (["الغاء", "الغي", "لا", "0", "الغ", "cancel", "إلغاء"].includes(textLower)) {
            if (session.ride_id) {
                await supabase.from("rides").update({
                    status: "cancelled", cancelled_by: "rider",
                    cancellation_reason: "ألغيت من قبل الراكب (SMS)",
                }).eq("id", session.ride_id).in("status", ["draft", "pending", "accepted"]);
            }
            session = { state: "idle", updated_at: new Date().toISOString() };
            await saveSession(supabase, phone, session);
            await replyViaSMS(phone, "تم الإلغاء ✅\nأرسل (ران) لطلب رحلة جديدة");
            return jsonOk({ action: "cancelled" });
        }

        // ══════════════ Global: Help ══════════════
        if (["مساعدة", "مساعده", "help", "?", "؟"].includes(textLower)) {
            await replyViaSMS(phone,
                `🚕 ران — خدمة التوصيل عبر SMS\n\n` +
                `لطلب رحلة أرسل مثل:\n"اني بشارع المستودع اريد اروح مول ام عمار"\n\n` +
                `أو أرسل (ران) للبدء خطوة بخطوة\nأرسل (0) للإلغاء`
            );
            return jsonOk({ action: "help" });
        }

        // ══════════════ State: awaiting_confirm ══════════════
        if (session.state === "awaiting_confirm") {
            if (textLower === "1" || textLower.includes("تأكيد") || textLower.includes("نعم") || textLower.includes("اي")) {
                if (session.ride_id) {
                    await supabase.from("rides").update({ status: "pending" }).eq("id", session.ride_id).eq("status", "draft");
                    console.log(`[sms-webhook] ✅ Ride ${session.ride_id}: draft → pending`);
                    try { await supabase.functions.invoke("match-ride", { body: { rideId: session.ride_id } }); } catch { }
                    session.state = "active";
                    await saveSession(supabase, phone, session);
                    await replyViaSMS(phone, "✅ تم تأكيد طلبك!\nجاري البحث عن سائق...\nسنرسل لك رسالة عند قبول السائق 🚗");
                    return jsonOk({ action: "ride_confirmed", ride_id: session.ride_id });
                }
            }
            if (textLower === "2" || textLower.includes("الغ")) {
                if (session.ride_id) {
                    await supabase.from("rides").update({ status: "cancelled", cancelled_by: "rider" }).eq("id", session.ride_id);
                }
                session = { state: "idle", updated_at: new Date().toISOString() };
                await saveSession(supabase, phone, session);
                await replyViaSMS(phone, "تم إلغاء الطلب ✅\nأرسل (ران) لطلب رحلة جديدة");
                return jsonOk({ action: "cancelled" });
            }
            await replyViaSMS(phone, "للتأكيد ارسل 1\nللإلغاء ارسل 2");
            return jsonOk({ action: "confirm_retry" });
        }

        // ══════════════ State: active ══════════════
        if (session.state === "active" && session.ride_id) {
            const { data: ride } = await supabase.from("rides").select("status").eq("id", session.ride_id).maybeSingle();
            if (!ride || ["completed", "cancelled"].includes(ride?.status)) {
                session = { state: "idle", updated_at: new Date().toISOString() };
                await saveSession(supabase, phone, session);
            } else {
                if (textLower === "2" || textLower.includes("الغ")) {
                    await supabase.from("rides").update({ status: "cancelled", cancelled_by: "rider" })
                        .eq("id", session.ride_id).in("status", ["pending", "accepted"]);
                    session = { state: "idle", updated_at: new Date().toISOString() };
                    await saveSession(supabase, phone, session);
                    await replyViaSMS(phone, "تم إلغاء الرحلة ✅");
                    return jsonOk({ action: "cancelled" });
                }
                await replyViaSMS(phone, "رحلتك لا تزال جارية 🚗\nللإلغاء أرسل 2");
                return jsonOk({ action: "ride_active" });
            }
        }

        // ══════════════ State: pickup ══════════════
        if (session.state === "pickup") {
            const loc = resolveLocation(text);
            if (!loc) {
                await replyViaSMS(phone, `⚠️ ما عرفنا المكان "${text}"\nأرسل اسم المكان أو رابط Maps\n(0) للإلغاء`);
                return jsonOk({ action: "pickup_retry" });
            }
            session.pickup_lat = loc.lat; session.pickup_lng = loc.lng; session.pickup_address = loc.address;
            session.state = "dropoff";
            await saveSession(supabase, phone, session);
            await replyViaSMS(phone, `✅ الانطلاق: ${loc.address}\n\n🎯 وين وجهتك؟\nأرسل اسم المكان أو رابط Maps\n(0) للإلغاء`);
            return jsonOk({ action: "ask_dropoff" });
        }

        // ══════════════ State: dropoff → create ride ══════════════
        if (session.state === "dropoff") {
            const loc = resolveLocation(text);
            if (!loc) {
                await replyViaSMS(phone, `⚠️ ما عرفنا الوجهة "${text}"\nحاول مرة ثانية\n(0) للإلغاء`);
                return jsonOk({ action: "dropoff_retry" });
            }
            const riderId = session.rider_id || await findOrCreateGuestUser(supabase, phone, supabaseUrl, supabaseKey);
            const fareResult = await calculateFare(supabase, session.pickup_lat!, session.pickup_lng!, loc.lat, loc.lng);

            const { data: ride, error: rideErr } = await supabase.from("rides").insert({
                rider_id: riderId, status: "draft",
                pickup_location: { lat: session.pickup_lat, lng: session.pickup_lng },
                pickup_address: session.pickup_address,
                dropoff_location: { lat: loc.lat, lng: loc.lng },
                dropoff_address: loc.address,
                estimated_fare: fareResult.fare, distance_km: fareResult.distance_km,
                duration_minutes: fareResult.duration_min,
                vehicle_type: "economy", payment_method: "cash", trip_type: "sms",
            }).select("id").single();

            if (rideErr) {
                console.error(`[sms-webhook] ❌ Ride create error:`, rideErr);
                await replyViaSMS(phone, "⚠️ حدث خطأ. حاول مرة أخرى.");
                return jsonOk({ action: "error" });
            }
            session.ride_id = ride.id; session.dropoff_lat = loc.lat; session.dropoff_lng = loc.lng;
            session.dropoff_address = loc.address; session.estimated_fare = fareResult.fare;
            session.state = "awaiting_confirm";
            await saveSession(supabase, phone, session);
            await replyViaSMS(phone,
                `📋 ملخص الرحلة:\nمن: ${session.pickup_address}\nالى: ${loc.address}\n` +
                `المسافة: ${fareResult.distance_km} كم\nالمبلغ: ${fareResult.fare.toLocaleString()} دينار\n\n` +
                `للتأكيد ارسل 1\nللإلغاء ارسل 2`
            );
            return jsonOk({ action: "ask_confirm", ride_id: ride.id });
        }

        // ══════════════ State: idle ══════════════

        // Rating (1-5 after completed ride)
        if (/^[1-5]$/.test(textLower) && session.rider_id) {
            const { data: recent } = await supabase.from("rides").select("id")
                .eq("rider_id", session.rider_id).eq("status", "completed").eq("trip_type", "sms")
                .order("updated_at", { ascending: false }).limit(1).maybeSingle();
            if (recent) {
                await supabase.from("rides").update({ driver_rating: parseInt(textLower) }).eq("id", recent.id);
                await replyViaSMS(phone, `شكراً على تقييمك ⭐ (${textLower}/5)\nأرسل (ران) لرحلة جديدة`);
                return jsonOk({ action: "rated" });
            }
        }

        // Ensure guest user
        const riderId = await findOrCreateGuestUser(supabase, phone, supabaseUrl, supabaseKey);
        session.rider_id = riderId;

        // Try NLP — PRODUCTION: create ride as PENDING, no mock confirmation
        const rideIntent = parseRideIntent(text);
        if (rideIntent) {
            const pickupCoords = rideIntent.pickupLocation || RAMADI_CENTER;
            const dropoffCoords = rideIntent.dropoffLocation || { lat: 33.4350, lng: 43.3100 };
            const fareResult = await calculateFare(supabase, pickupCoords.lat, pickupCoords.lng, dropoffCoords.lat, dropoffCoords.lng);

            console.log(`[sms-webhook] 🚗 Creating PENDING ride...`);
            const { data: ride, error: rideErr } = await supabase.from("rides").insert({
                rider_id: riderId, status: "pending", // ⚡ PRODUCTION: straight to pending
                pickup_location: { lat: pickupCoords.lat, lng: pickupCoords.lng },
                pickup_address: rideIntent.pickup,
                dropoff_location: { lat: dropoffCoords.lat, lng: dropoffCoords.lng },
                dropoff_address: rideIntent.dropoff,
                estimated_fare: fareResult.fare, distance_km: fareResult.distance_km,
                duration_minutes: fareResult.duration_min,
                vehicle_type: "economy", payment_method: "cash", trip_type: "sms",
            }).select("id").single();

            if (rideErr) {
                console.error(`[sms-webhook] ❌ Ride creation error:`, rideErr);
                await replyViaSMS(phone, "⚠️ حدث خطأ تقني. حاول مرة أخرى.");
                return jsonOk({ action: "error" });
            }

            console.log(`[sms-webhook] ✅ Ride created: ${ride.id} (pending, fare=${fareResult.fare})`);

            // Invoke match-ride to broadcast to drivers
            try { await supabase.functions.invoke("match-ride", { body: { rideId: ride.id } }); } catch { }

            session.ride_id = ride.id;
            session.pickup_address = rideIntent.pickup;
            session.dropoff_address = rideIntent.dropoff;
            session.estimated_fare = fareResult.fare;
            session.state = "active";
            await saveSession(supabase, phone, session);

            // Minimal searching message — the REAL confirmation comes from sms-ride-updates when driver accepts
            await replyViaSMS(phone,
                `🚕 تم استلام طلبك!\n` +
                `من: ${rideIntent.pickup}\n` +
                `الى: ${rideIntent.dropoff}\n` +
                `المبلغ التقديري: ${fareResult.fare.toLocaleString()} دينار\n\n` +
                `جاري البحث عن سائق... ⏳\nسنرسل لك التفاصيل عند قبول السائق.`
            );

            try {
                await supabase.from("sms_logs").insert({
                    phone, message_type: "notification", purpose: "ride_searching",
                    provider: "infobip", status: "sent", cost: 0.02,
                });
            } catch { }

            return jsonOk({ action: "ride_dispatched", ride_id: ride.id, fare: fareResult.fare });
        }

        // Start keyword → step-by-step
        if (isStartKeyword(text)) {
            session.state = "pickup"; session.rider_id = riderId;
            await saveSession(supabase, phone, session);
            await replyViaSMS(phone,
                `🚕 أهلاً! وين موقعك؟\n\n${buildLandmarkMenu()}\n\nأو أرسل اسم المكان / رابط Maps\n(0) للإلغاء`
            );
            return jsonOk({ action: "ask_pickup" });
        }

        // Welcome
        await replyViaSMS(phone,
            `أهلاً بك في ران 🚕\n\n` +
            `لطلب رحلة أرسل مثل:\n"اني بشارع المستودع اريد اروح مول ام عمار"\n\n` +
            `أو أرسل (ران) للبدء خطوة بخطوة`
        );
        await saveSession(supabase, phone, session);
        return jsonOk({ action: "welcome" });

    } catch (error) {
        console.error(`[sms-webhook] ❌ FATAL:`, error);
        console.error(`[sms-webhook] ❌ Stack: ${(error as Error).stack}`);
        return new Response(JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});

function jsonOk(data: Record<string, unknown>) {
    console.log(`[sms-webhook] ✅ RESPONSE: ${JSON.stringify(data)}`);
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonErr(msg: string, status: number) {
    console.error(`[sms-webhook] ❌ ERROR ${status}: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
