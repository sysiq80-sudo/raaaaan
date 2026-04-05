import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhoneDigits(phone: string): string {
  let cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = `964${cleaned.slice(1)}`;
  if (cleaned && !cleaned.startsWith("964")) cleaned = `964${cleaned}`;
  return cleaned;
}

function phoneVariants(phone: string): string[] {
  const normalized = normalizePhoneDigits(phone);
  const withoutCode = normalized.startsWith("964") ? normalized.slice(3) : normalized;
  const withZero = withoutCode ? `0${withoutCode}` : "";
  return [...new Set([normalized, withoutCode, withZero].filter(Boolean))];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: adminUser },
      error: adminAuthError,
    } = await supabaseAdmin.auth.getUser(token);

    if (adminAuthError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "المستخدم غير موجود" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "غير مصرح - يتطلب صلاحية أدمن" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("user_id", userId)
      .maybeSingle();

    const phone = profile?.phone || "";
    const variants = phone ? phoneVariants(phone) : [];

    // Rider-related cleanup
    await supabaseAdmin.from("saved_places").delete().eq("user_id", userId);
    await supabaseAdmin.from("scheduled_rides").delete().eq("rider_id", userId);
    await supabaseAdmin.from("delay_alerts").delete().eq("rider_id", userId);
    await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
    await supabaseAdmin.from("emergency_alerts").delete().eq("user_id", userId);
    await supabaseAdmin.from("ride_share_links").delete().eq("created_by", userId);

    // Keep ride history while unlinking deleted rider
    await supabaseAdmin.from("rides").update({ rider_id: null }).eq("rider_id", userId);

    // Remove rider profile rows (support both legacy and modern shape)
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    if (variants.length > 0) {
      await supabaseAdmin.from("blocked_phones").delete().in("phone", variants);
      await supabaseAdmin.from("otp_verifications").delete().in("phone", variants);
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return new Response(
        JSON.stringify({ error: `فشل حذف المستخدم من auth: ${deleteAuthError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
