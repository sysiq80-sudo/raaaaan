/**
 * ران — إدارة المستخدمين والجلسات
 * RAAN User Management & Session Handling
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config.ts";

// ════════════════════════════════════════
// البحث عن / إنشاء مستخدم واتساب
// ════════════════════════════════════════
export async function findOrCreateWhatsAppUser(
  supabase: any,
  phoneNumber: string,
  profileName: string | null
): Promise<string> {
  const waRef = `wa_${phoneNumber}`;
  const email = `wa_${phoneNumber}@whatsapp.raan.app`;
  const displayName = profileName || "راكب واتساب";

  // 0. فحص الأسماء المحظورة
  if (displayName && displayName !== "راكب واتساب") {
    try {
      const { data: banned } = await supabase
        .from("banned_names")
        .select("name")
        .eq("is_active", true);
      if (banned && banned.length > 0) {
        const nameLower = displayName.toLowerCase().trim();
        const isBanned = banned.some((b: any) => {
          const bannedLower = (b.name || "").toLowerCase().trim();
          return nameLower === bannedLower || nameLower.includes(bannedLower) || bannedLower.includes(nameLower);
        });
        if (isBanned) {
          console.warn(`[auth] ⛔ Banned name detected: "${displayName}"`);
          profileName = null;
        }
      }
    } catch (e) {
      console.warn("[auth] Failed to check banned names:", e);
    }
  }
  const finalName = profileName || "راكب واتساب";

  // 1. البحث في profiles
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .or(`phone.eq.${waRef},email.eq.${email}`)
    .limit(1)
    .maybeSingle();

  if (existing?.user_id) {
    console.log(`[auth] Found existing WA user: ${existing.user_id}`);
    return existing.user_id;
  }

  // 2. إنشاء مستخدم جديد
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: {
      full_name: finalName,
      source: "whatsapp",
      whatsapp_phone: phoneNumber,
    },
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already been registered")) {
      const lookupRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      const lookupData = await lookupRes.json();
      const foundUser = lookupData.users?.[0];
      if (!foundUser?.id) throw new Error("WA user registered but not found in admin lookup");
      userId = foundUser.id;
      console.log(`[auth] Found WA user via GoTrue: ${userId}`);
    } else {
      throw new Error(`Failed to create WA auth user: ${authError.message}`);
    }
  } else if (!authData?.user) {
    throw new Error("Failed to create WA auth user: no user returned");
  } else {
    userId = authData.user.id;
    console.log(`[auth] Created new WA auth user: ${userId}`);
  }

  // إنشاء/تحديث profile
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: finalName,
    phone: waRef,
    email,
    status: "active",
  });

  return userId;
}

// ════════════════════════════════════════
// إدارة الحالة: البحث عن draft session
// ════════════════════════════════════════
export interface PendingSession {
  ride_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
}

export async function findPendingSession(
  supabase: any,
  riderId: string
): Promise<PendingSession | null> {
  const { data } = await supabase
    .from("rides")
    .select("id, pickup_location, pickup_address, dropoff_address")
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
    .is("dropoff_address", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const pickup = data.pickup_location as { lat: number; lng: number } | null;
  if (!pickup?.lat) return null;

  return {
    ride_id: data.id,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    pickup_address: data.pickup_address || "موقعك",
  };
}

// ════════════════════════════════════════
// إنشاء جلسة حجز جديدة (pickup session)
// ════════════════════════════════════════
export async function createPickupSession(
  supabase: any,
  riderId: string,
  lat: number,
  lng: number,
  address: string
): Promise<string> {
  // 🔥 SECURITY: إلغاء أي رحلات نشطة سابقة
  const { data: cancelledRides } = await supabase
    .from("rides")
    .update({ status: "cancelled", cancelled_by: "system", cancellation_reason: "تم إلغاؤها تلقائياً: طلب رحلة جديدة" })
    .eq("rider_id", riderId)
    .in("status", ["pending", "accepted", "arrived", "in_progress"])
    .select("id");

  if (cancelledRides && cancelledRides.length > 0) {
    console.log(`[wa] 🔥 Auto-cancelled ${cancelledRides.length} active ride(s) for rider ${riderId}:`, cancelledRides.map((r: any) => r.id));
  }

  // حذف drafts قديمة
  await supabase
    .from("rides")
    .delete()
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
    .is("dropoff_address", null);

  // مسح sub-state الدردشة
  try {
    await supabase.from("bot_customers").update({ last_intent: null })
      .eq("platform", "whatsapp")
      .ilike("platform_id", `%`)
      .eq("last_intent", `chatting_with_driver:%`);
  } catch { } // صامت

  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_id: riderId,
      status: "draft",
      pickup_location: { lat, lng },
      pickup_address: address,
      dropoff_location: { lat: 0, lng: 0 },
      dropoff_address: null,
      vehicle_type: "economy",
      payment_method: "cash",
      trip_type: "whatsapp",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create WA session: ${error.message}`);
  return data.id;
}

// ════════════════════════════════════════
// 🔍 فحص الرحلات النشطة
// ════════════════════════════════════════
export async function checkActiveRide(
  supabase: any,
  riderId: string
): Promise<{ id: string; status: string; pickup_address: string | null; dropoff_address: string | null; created_at: string } | null> {
  const { data } = await supabase
    .from("rides")
    .select("id, status, pickup_address, dropoff_address, created_at")
    .eq("rider_id", riderId)
    .in("status", ["pending", "accepted", "arrived", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
