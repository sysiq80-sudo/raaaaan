import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  phone: string;
  newPassword: string;
}

// Format phone number to international format
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '964' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('964')) {
    cleaned = '964' + cleaned;
  }
  return cleaned;
}

// Get client IP from request headers
function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    const { phone, newPassword }: ResetPasswordRequest = await req.json();
    const clientIP = getClientIP(req);

    if (!phone || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'رقم الهاتف وكلمة المرور الجديدة مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check IP rate limit for password reset
    const { data: ipAllowed } = await supabase.rpc('check_ip_rate_limit', {
      p_ip: clientIP,
      p_action: 'reset_password',
      p_max_requests: 10,
      p_window_minutes: 60
    });

    if (!ipAllowed) {
      console.log(`IP rate limit exceeded for password reset: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'محاولات كثيرة جداً. الرجاء الانتظار ساعة.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.rpc('record_ip_request', { p_ip: clientIP, p_action: 'reset_password' });

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Processing password reset for phone: ${formattedPhone}, ip: ${clientIP}`);

    // Verify that OTP was verified for password_reset (within 2 minutes for extra security)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone', formattedPhone)
      .eq('purpose', 'password_reset')
      .eq('verified', true)
      .is('used_at', null) // CRITICAL: Must not be already used
      .gte('created_at', twoMinutesAgo) // Tighter window: 2 minutes
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      console.log(`No valid OTP found for ${formattedPhone}`);
      return new Response(
        JSON.stringify({ error: 'يرجى التحقق من رقم الهاتف أولاً. الرمز منتهي الصلاحية أو مستخدم.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as used IMMEDIATELY to prevent reuse
    const { error: markUsedError } = await supabase
      .from('otp_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    if (markUsedError) {
      console.error('Failed to mark OTP as used:', markUsedError);
      // Continue anyway - but log it
    }

    // Get the phone email format
    const phoneEmail = `${formattedPhone}@raan.app`;

    // Find user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      throw new Error('فشل في البحث عن المستخدم');
    }

    const user = userData.users.find(u => u.email === phoneEmail);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على حساب بهذا الرقم' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('فشل في تحديث كلمة المرور');
    }

    // Delete all OTP records for this phone/purpose (cleanup)
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('phone', formattedPhone)
      .eq('purpose', 'password_reset');

    console.log(`Password reset successful for user: ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'تم تغيير كلمة المرور بنجاح' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in reset-password function:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
