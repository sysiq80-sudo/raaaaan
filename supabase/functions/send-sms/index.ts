import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

let OTPIQ_API_KEY = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["OTPIQ_API_KEY"]);
    OTPIQ_API_KEY = cfg["OTPIQ_API_KEY"] || Deno.env.get('OTPIQ_API_KEY') || "";
    _configLoaded = true;
    console.log("[send-sms] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[send-sms] ⚠️ Config load failed, using env fallback:", e);
    OTPIQ_API_KEY = Deno.env.get('OTPIQ_API_KEY') || "";
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSMSRequest {
  phone: string;
  message: string;
  messageType?: 'promotional' | 'notification' | 'transactional';
  provider?: 'whatsapp' | 'sms';
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
  return req.headers.get('x-real-ip') || 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadDynamicConfig();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OTPIQ_API_KEY) {
      throw new Error('OTPIQ_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get authorization header to verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'هذه الميزة متاحة للمدراء فقط' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, message, messageType = 'notification', provider = 'whatsapp' }: SendSMSRequest = await req.json();
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || 'admin';

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'رقم الهاتف والرسالة مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > 500) {
      return new Response(
        JSON.stringify({ error: 'الرسالة طويلة جداً (الحد الأقصى 500 حرف)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Admin ${user.id} sending ${messageType} message to ${formattedPhone}`);

    // Check if phone is blocked
    const { data: isBlocked } = await supabase.rpc('is_phone_blocked', { p_phone: formattedPhone });
    
    if (isBlocked) {
      return new Response(
        JSON.stringify({ error: 'هذا الرقم محظور' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send message via OTPIQ
    let sendSuccess = false;
    let externalId: string | undefined;
    let errorMessage: string | undefined;
    let usedProvider = provider;

    try {
      const response = await fetch('https://api.otpiq.com/api/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OTPIQ_API_KEY}`,
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          smsType: 'otp', // Using otp type for custom message
          message: message,
          provider: provider,
        }),
      });

      const result = await response.json();
      console.log('OTPIQ Response:', JSON.stringify(result));

      if (response.ok) {
        sendSuccess = true;
        externalId = result.id || result.messageId;
      } else {
        errorMessage = result.message || 'Failed to send';

        // Try SMS if WhatsApp failed
        if (provider === 'whatsapp') {
          console.log('Trying SMS fallback...');
          usedProvider = 'sms';

          const smsResponse = await fetch('https://api.otpiq.com/api/sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OTPIQ_API_KEY}`,
            },
            body: JSON.stringify({
              phoneNumber: formattedPhone,
              smsType: 'otp',
              message: message,
              provider: 'sms',
            }),
          });

          const smsResult = await smsResponse.json();
          if (smsResponse.ok) {
            sendSuccess = true;
            externalId = smsResult.id || smsResult.messageId;
            errorMessage = undefined;
          } else {
            errorMessage = smsResult.message || 'SMS also failed';
          }
        }
      }
    } catch (fetchError) {
      console.error('Network error:', fetchError);
      errorMessage = 'Network error';
    }

    // Log the message
    await supabase.from('sms_logs').insert({
      phone: formattedPhone,
      message_type: messageType,
      purpose: null,
      provider: usedProvider,
      status: sendSuccess ? 'sent' : 'failed',
      ip_address: clientIP,
      user_agent: userAgent,
      error_message: errorMessage,
      external_id: externalId,
      cost: usedProvider === 'whatsapp' ? 0.005 : 0.02,
    });

    if (!sendSuccess) {
      return new Response(
        JSON.stringify({ error: errorMessage || 'فشل في إرسال الرسالة' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `تم إرسال الرسالة عبر ${usedProvider === 'whatsapp' ? 'WhatsApp' : 'SMS'}`,
        external_id: externalId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-sms function:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
