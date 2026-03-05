/**
 * ران — إدارة المستخدمين والجلسات (Omnichannel Sync)
 * RAAN User Management & Session Handling
 *
 * ══ هندسة توحيد الحسابات (App ↔ Bot) ══
 * جميع الأرقام تُحفظ بصيغة E.164 الدولية (+964XXXXXXXXX)
 * عند وصول رسالة واتساب، نبحث أولاً عن حساب تطبيق موجود بنفس الرقم.
 * إذا لم نجد، نُنشئ "حساب شبح" (Ghost Account) حقيقي في auth.users
 * بكلمة مرور عشوائية. عندما يُحمّل المستخدم التطبيق لاحقاً،
 * يستعيد حسابه عبر OTP ويضع كلمة مرور جديدة.
 *
 * ══ تحضير لمطوري Flutter/React Native ══
 * عند محاولة مستخدم التسجيل/الدخول من التطبيق:
 * 1. استدعِ is_phone_registered RPC — إذا الرقم موجود (Ghost Account من البوت):
 *    - أرسل OTP عبر SMS أو واتساب للتحقق من الهوية
 *    - بعد التحقق، استخدم supabase.auth.updateUser({ password: new_password })
 *      لتفعيل وصول التطبيق بالكامل
 * 2. إذا الرقم غير موجود → تسجيل عادي (signUp)
 *
 * هذا يضمن: الرصيد + تاريخ الرحلات = متزامن 100% بين التطبيق والبوت
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config.ts";
import { normalizeToE164, generatePhoneVariants } from "../../_shared/phoneUtils.ts";

// ════════════════════════════════════════
// البحث عن / إنشاء مستخدم واتساب (Omnichannel)
// ════════════════════════════════════════
export async function findOrCreateWhatsAppUser(
  supabase: any,
  phoneNumber: string,
  profileName: string | null
): Promise<string> {
  // ── توحيد رقم الهاتف إلى E.164 (+964XXXXXXXXX) ──
  const e164Phone = normalizeToE164(phoneNumber);
  const phoneVariants = generatePhoneVariants(e164Phone);
  const waEmail = `wa_${phoneNumber}@whatsapp.raan.app`;
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

  // ══ 1. البحث الموحّد — Omnichannel Lookup ══
  // نبحث عن أي حساب موجود بأي صيغة من صيغ الرقم (تطبيق أو بوت قديم)
  const phoneOrFilter = phoneVariants.map(v => `phone.eq.${v}`).join(",");
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id, phone")
    .or(`${phoneOrFilter},email.eq.${waEmail}`)
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
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: waEmail,
    phone: e164Phone,
    password: crypto.randomUUID(),
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      full_name: finalName,
      source: "whatsapp",
      whatsapp_phone: phoneNumber,
      is_ghost_account: true,
      ghost_created_at: new Date().toISOString(),
    },
  });

  let userId: string;

  if (authError) {
    if (authError.message.includes("already been registered")) {
      const lookupRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(waEmail)}`,
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
    console.log(`[auth] 👻 Created Ghost Account: ${userId} | Phone: ${e164Phone}`);
  }

  // ── إنشاء/تحديث الملف الشخصي بصيغة E.164 الموحدة ──
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: finalName,
    phone: e164Phone,
    email: waEmail,
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
