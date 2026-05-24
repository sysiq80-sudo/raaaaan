/**
 * ران — إدارة المستخدمين والجلسات
 * RAAN User Management & Session Handling
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config.ts";
import { normalizeToE164, generatePhoneVariants } from "../../_shared/phoneUtils.ts";

// ════════════════════════════════════════
// البحث عن / إنشاء مستخدم واتساب
// ════════════════════════════════════════
export async function findOrCreateWhatsAppUser(
  supabase: any,
  phoneNumber: string,
  profileName: string | null
): Promise<string> {
  const waRef = `wa_${phoneNumber}`;
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

  // ── تحويل رقم واتساب إلى E.164 الموحد ──
  const e164Phone = normalizeToE164(phoneNumber);
  const phoneVariants = generatePhoneVariants(e164Phone);

  // ══ 1. البحث الموحّد — Omnichannel Lookup ══
  // نبحث عن أي حساب موجود بأي صيغة من صيغ الرقم (تطبيق أو بوت قديم)
  const phoneOrFilter = phoneVariants.map(v => `phone.eq.${v}`).join(",");
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id, phone")
    .or(phoneOrFilter)
    .limit(1)
    .maybeSingle();

  if (existing?.user_id) {
    console.log(`[auth] 🔗 Omnichannel match! Bound WA session to existing user: ${existing.user_id} (profile phone: ${existing.phone})`);

    // ── تحديث الرقم إلى E.164 إذا كان بصيغة قديمة ──
    if (existing.phone !== e164Phone) {
      await supabase.from("profiles").update({ phone: e164Phone }).eq("user_id", existing.user_id);
      console.log(`[auth] 📱 Normalized phone from "${existing.phone}" to "${e164Phone}"`);
    }

    // ── تحديث user_metadata بمعلومات واتساب ──
    try {
      await supabase.auth.admin.updateUserById(existing.user_id, {
        user_metadata: {
          whatsapp_phone: phoneNumber,
          whatsapp_linked: true,
          whatsapp_linked_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.warn("[auth] Failed to update user metadata with WA info:", e);
    }

    return existing.user_id;
  }

  // ══ 2. إنشاء "حساب شبح" — Ghost Account ══
  // المستخدم جديد تماماً. نُنشئ حساب GoTrue حقيقي بكلمة مرور عشوائية.
  // عندما يُحمّل التطبيق لاحقاً، يستعيد الحساب عبر OTP ويضع كلمة مرور جديدة.
  const ghostPassword = crypto.randomUUID();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: e164Phone,
    password: ghostPassword,
    phone_confirm: true,
    user_metadata: {
      full_name: finalName,
      source: "whatsapp",
      whatsapp_phone: phoneNumber,
      role: "rider",
      is_ghost_account: true,
      ghost_created_at: new Date().toISOString(),
    },
  });

  if (authError) {
    console.error("[auth] Failed to create ghost account:", authError);
    throw authError;
  }

  if (!authData.user) {
    throw new Error("Failed to create user account");
  }

  // إنشاء profile بالرقم الموحد E.164
  const { error: profileError } = await supabase.from("profiles").insert({
    user_id: authData.user.id,
    full_name: finalName,
    phone: e164Phone, // E.164 موحد بدلاً من wa_xxx
    whatsapp_phone: phoneNumber,
  });

  if (profileError) {
    console.error("[auth] Failed to create profile:", profileError);
    // لا نحذف المستخدم — يمكن إصلاح الـ profile لاحقاً
  }

  console.log(`[auth] 👻 Created ghost account for WA user: ${authData.user.id} (phone: ${e164Phone})`);
  return authData.user.id;
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
  // � SAFETY: فحص الرحلات الجارية أولاً — لا يُلغى in_progress أبداً
  const { data: inProgressRide } = await supabase
    .from("rides")
    .select("id, pickup_address, dropoff_address")
    .eq("rider_id", riderId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (inProgressRide) {
    console.warn(`[wa] 🚫 Blocked createPickupSession — rider ${riderId} has active ride: ${inProgressRide.id}`);
    throw new Error(`IN_PROGRESS_RIDE:${inProgressRide.id}`);
  }

  // إلغاء الرحلات المعلّقة فقط (pending / accepted / arrived) — لا تمس الجارية
  const { data: cancelledRides } = await supabase
    .from("rides")
    .update({ status: "cancelled", cancelled_by: "system", cancellation_reason: "تم إلغاؤها تلقائياً: طلب رحلة جديدة" })
    .eq("rider_id", riderId)
    .in("status", ["pending", "accepted", "arrived"])
    .select("id");

  if (cancelledRides && cancelledRides.length > 0) {
    console.log(`[wa] 🔥 Auto-cancelled ${cancelledRides.length} pending/accepted/arrived ride(s) for rider ${riderId}:`, cancelledRides.map((r: any) => r.id));
  }

  // حذف drafts هذا الراكب القديمة
  await supabase
    .from("rides")
    .delete()
    .eq("rider_id", riderId)
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
    .is("dropoff_address", null);

  // تنظيف عام: حذف كل drafts عمرها أكثر من 30 دقيقة (orphaned sessions)
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  supabase
    .from("rides")
    .delete()
    .eq("status", "draft")
    .eq("trip_type", "whatsapp")
    .is("dropoff_address", null)
    .lt("created_at", staleThreshold)
    .then(() => {}, (e: any) => console.warn("[wa] Stale draft cleanup failed (non-critical):", e));

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
