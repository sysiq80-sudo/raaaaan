import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DriverSignupRequest {
  phone: string;
  password: string;
  fullName: string;
  email?: string | null;
  gender?: "male" | "female";
  workCity?: string;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "964" + cleaned.substring(1);
  if (!cleaned.startsWith("964")) cleaned = "964" + cleaned;
  return cleaned;
}

function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP;
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body: DriverSignupRequest = await req.json();
    const clientIP = getClientIP(req);

    if (!body?.phone || !body?.password || !body?.fullName) {
      return new Response(
        JSON.stringify({ error: "رقم الهاتف وكلمة المرور والاسم مطلوبة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.password.length < 6) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // IP rate limit for signup attempts
    const { data: ipAllowed } = await supabase.rpc("check_ip_rate_limit", {
      p_ip: clientIP,
      p_action: "driver_signup",
      p_max_requests: 20,
      p_window_minutes: 60,
    });

    if (!ipAllowed) {
      return new Response(
        JSON.stringify({ error: "محاولات كثيرة جداً. الرجاء الانتظار." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.rpc("record_ip_request", { p_ip: clientIP, p_action: "driver_signup" });

    const formattedPhone = formatPhoneNumber(body.phone);
    const authEmail = `${formattedPhone}@driver.raan.app`;

    // Ensure OTP was verified very recently
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: otpRecord } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone", formattedPhone)
      .eq("purpose", "driver_registration")
      .eq("verified", true)
      .is("used_at", null)
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "يرجى التحقق من رقم الهاتف أولاً. الرمز منتهي الصلاحية أو مستخدم." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Block if driver already exists (covers most real cases)
    const { data: existingDrivers, error: existingDriversError } = await supabase.rpc(
      "find_driver_by_phone",
      { p_phone: formattedPhone },
    );

    if (!existingDriversError && Array.isArray(existingDrivers) && existingDrivers.length > 0) {
      return new Response(
        JSON.stringify({ error: "هذا الرقم مسجل مسبقاً. الرجاء تسجيل الدخول.", user_exists: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark OTP used to prevent reuse
    await supabase
      .from("otp_verifications")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    // Create auth user WITHOUT sending confirmation emails
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        phone: formattedPhone,
        role: "driver",
        provided_email: body.email ?? null,
        gender: body.gender ?? null,
        work_city: body.workCity ?? null,
      },
    });

    if (createError || !created?.user) {
      const msg = createError?.message || "فشل إنشاء المستخدم";
      // Normalize common duplicate case
      if (msg.toLowerCase().includes("already") || msg.includes("exists")) {
        return new Response(
          JSON.stringify({ error: "هذا الرقم مسجل مسبقاً. الرجاء تسجيل الدخول.", user_exists: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: created.user.id,
        authEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in driver-signup function:", error);
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
