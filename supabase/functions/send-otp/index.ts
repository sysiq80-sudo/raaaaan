import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OTPRequest {
  action: 'send' | 'verify' | 'resend';
  phone: string;
  purpose: 'rider_registration' | 'driver_registration' | 'login' | 'password_reset';
  code?: string;
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

// Log SMS to database
async function logSMS(
  supabase: any,
  phone: string,
  messageType: string,
  purpose: string,
  provider: string,
  status: string,
  ipAddress: string,
  userAgent: string,
  errorMessage?: string,
  externalId?: string
) {
  try {
    await supabase.from('sms_logs').insert({
      phone,
      message_type: messageType,
      purpose,
      provider,
      status,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: errorMessage,
      external_id: externalId,
      cost: provider === 'whatsapp' ? 0.005 : 0.02, // تقدير التكلفة
    });
  } catch (e) {
    console.error('Failed to log SMS:', e);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OTPIQ_API_KEY = Deno.env.get('OTPIQ_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OTPIQ_API_KEY) {
      throw new Error('OTPIQ_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { action, phone, purpose, code }: OTPRequest = await req.json();
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (!phone || !purpose) {
      return new Response(
        JSON.stringify({ error: 'رقم الهاتف والغرض مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Processing OTP request: action=${action}, phone=${formattedPhone}, purpose=${purpose}, ip=${clientIP}`);

    // ========== Security Checks ==========
    
    // 1. Check IP rate limit (50 requests per hour)
    const { data: ipAllowed } = await supabase.rpc('check_ip_rate_limit', {
      p_ip: clientIP,
      p_action: 'send_otp',
      p_max_requests: 50,
      p_window_minutes: 60
    });

    if (!ipAllowed) {
      console.log(`IP rate limit exceeded: ${clientIP}`);
      await logSMS(supabase, formattedPhone, 'otp', purpose, 'none', 'blocked', clientIP, userAgent, 'IP rate limit exceeded');
      return new Response(
        JSON.stringify({ error: 'تم تجاوز الحد المسموح. الرجاء المحاولة لاحقاً.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record IP request
    await supabase.rpc('record_ip_request', { p_ip: clientIP, p_action: 'send_otp' });

    // 2. Check if phone is blocked
    const { data: isBlocked } = await supabase.rpc('is_phone_blocked', { p_phone: formattedPhone });
    
    if (isBlocked) {
      console.log(`Phone is blocked: ${formattedPhone}`);
      await logSMS(supabase, formattedPhone, 'otp', purpose, 'none', 'blocked', clientIP, userAgent, 'Phone is blocked');
      return new Response(
        JSON.stringify({ error: 'هذا الرقم محظور مؤقتاً. يرجى التواصل مع الدعم.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send' || action === 'resend') {
      // === Check if user already exists in auth.users for registration ===
      if (purpose === 'rider_registration' || purpose === 'driver_registration') {
        const phoneEmail = `${formattedPhone}@raan.app`;
        console.log(`Checking if user exists: ${phoneEmail}`);
        
        // Try to find user by email in auth.users
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
        
        if (!listError && existingUsers?.users) {
          const userExists = existingUsers.users.some(
            (u: any) => u.email === phoneEmail || u.phone === formattedPhone
          );
          
          if (userExists) {
            console.log(`User already exists: ${phoneEmail}`);
            await logSMS(supabase, formattedPhone, 'otp', purpose, 'none', 'blocked', clientIP, userAgent, 'User already registered');
            return new Response(
              JSON.stringify({ 
                error: 'هذا الرقم مسجل مسبقاً. الرجاء تسجيل الدخول بدلاً من التسجيل.',
                user_exists: true 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
      
      // 3. Check phone rate limiting - max 3 OTPs per phone per 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('otp_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('phone', formattedPhone)
        .eq('purpose', purpose)
        .gte('created_at', tenMinutesAgo);

      if (count && count >= 3) {
        await logSMS(supabase, formattedPhone, 'otp', purpose, 'none', 'blocked', clientIP, userAgent, 'Phone rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'تم تجاوز الحد الأقصى للمحاولات. الرجاء الانتظار 10 دقائق.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Check daily failures for auto-blocking
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: dailyFailures } = await supabase
        .from('sms_logs')
        .select('*', { count: 'exact', head: true })
        .eq('phone', formattedPhone)
        .eq('status', 'failed')
        .gte('created_at', todayStart.toISOString());

      if (dailyFailures && dailyFailures >= 10) {
        // Auto-block the phone
        await supabase.rpc('auto_block_phone', { 
          p_phone: formattedPhone, 
          p_reason: 'Excessive daily failures' 
        });
        return new Response(
          JSON.stringify({ error: 'تم حظر هذا الرقم بسبب كثرة المحاولات الفاشلة.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      // Save OTP to database with IP tracking
      const { error: insertError } = await supabase
        .from('otp_verifications')
        .insert({
          phone: formattedPhone,
          code: otpCode,
          purpose,
          expires_at: expiresAt,
          ip_address: clientIP,
          user_agent: userAgent,
        });

      if (insertError) {
        console.error('Error saving OTP:', insertError);
        throw new Error('فشل في حفظ رمز التحقق');
      }

      // Send OTP via OTPIQ (WhatsApp first, then SMS fallback)
      console.log('Sending OTP via OTPIQ WhatsApp...');
      let provider = 'whatsapp';
      let sendSuccess = false;
      let externalId: string | undefined;
      let errorMessage: string | undefined;

      try {
        const otpiqResponse = await fetch('https://api.otpiq.com/api/sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OTPIQ_API_KEY}`,
          },
          body: JSON.stringify({
            phoneNumber: formattedPhone,
            smsType: 'verification',
            verificationCode: otpCode,
            provider: 'whatsapp',
          }),
        });

        const otpiqResult = await otpiqResponse.json();
        console.log('OTPIQ WhatsApp Response:', JSON.stringify(otpiqResult));

        if (otpiqResponse.ok) {
          sendSuccess = true;
          externalId = otpiqResult.id || otpiqResult.messageId;
        } else {
          console.error('OTPIQ WhatsApp Error:', otpiqResult);
          errorMessage = otpiqResult.message || 'WhatsApp failed';
          
          // Try SMS as fallback
          console.log('Trying SMS fallback...');
          provider = 'sms';
          
          const smsResponse = await fetch('https://api.otpiq.com/api/sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OTPIQ_API_KEY}`,
            },
            body: JSON.stringify({
              phoneNumber: formattedPhone,
              smsType: 'verification',
              verificationCode: otpCode,
              provider: 'sms',
            }),
          });

          const smsResult = await smsResponse.json();
          console.log('SMS Response:', JSON.stringify(smsResult));

          if (smsResponse.ok) {
            sendSuccess = true;
            externalId = smsResult.id || smsResult.messageId;
            errorMessage = undefined;
          } else {
            console.error('SMS Error:', smsResult);
            errorMessage = smsResult.message || 'SMS failed';
          }
        }
      } catch (fetchError) {
        console.error('Network error sending OTP:', fetchError);
        errorMessage = 'Network error';
      }

      // Log the attempt
      await logSMS(
        supabase,
        formattedPhone,
        'otp',
        purpose,
        provider,
        sendSuccess ? 'sent' : 'failed',
        clientIP,
        userAgent,
        errorMessage,
        externalId
      );

      if (!sendSuccess) {
        // Increment failure count for potential auto-blocking
        await supabase.rpc('auto_block_phone', { 
          p_phone: formattedPhone, 
          p_reason: 'OTP send failure' 
        });
        
        throw new Error(errorMessage || 'فشل في إرسال رمز التحقق');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: provider === 'whatsapp' ? 'تم إرسال رمز التحقق عبر WhatsApp' : 'تم إرسال رمز التحقق عبر SMS',
          expires_in: 300 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'رمز التحقق مطلوب' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check IP rate limit for verification
      const { data: verifyIpAllowed } = await supabase.rpc('check_ip_rate_limit', {
        p_ip: clientIP,
        p_action: 'verify_otp',
        p_max_requests: 20,
        p_window_minutes: 60
      });

      if (!verifyIpAllowed) {
        return new Response(
          JSON.stringify({ error: 'محاولات كثيرة جداً. الرجاء الانتظار.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.rpc('record_ip_request', { p_ip: clientIP, p_action: 'verify_otp' });

      // Find the most recent unexpired, unverified, unused OTP
      const { data: otpRecord, error: fetchError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('purpose', purpose)
        .eq('verified', false)
        .is('used_at', null) // Must not be used
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !otpRecord) {
        return new Response(
          JSON.stringify({ error: 'لا يوجد رمز تحقق صالح. الرجاء طلب رمز جديد.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check attempts
      if (otpRecord.attempts >= 3) {
        return new Response(
          JSON.stringify({ error: 'تم تجاوز عدد المحاولات. الرجاء طلب رمز جديد.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Increment attempts
      await supabase
        .from('otp_verifications')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      // Verify code
      if (otpRecord.code !== code) {
        // Log failed verification
        console.log(`Failed OTP verification for ${formattedPhone}, attempt ${otpRecord.attempts + 1}`);
        return new Response(
          JSON.stringify({ error: 'رمز التحقق غير صحيح' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as verified (don't mark used_at yet - that happens on password reset)
      await supabase
        .from('otp_verifications')
        .update({ verified: true })
        .eq('id', otpRecord.id);

      console.log(`OTP verified successfully for ${formattedPhone}`);

      return new Response(
        JSON.stringify({ success: true, message: 'تم التحقق بنجاح', verified: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'إجراء غير معروف' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-otp function:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
