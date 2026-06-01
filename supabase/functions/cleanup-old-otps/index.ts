import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, requireInternalSecret } from "../_shared/utils.ts";
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const internalDenied = requireInternalSecret(req, corsHeaders);
  if (internalDenied) return internalDenied;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting cleanup job...');

    // 1. Delete OTP verifications older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: otpDeleteError } = await supabase
      .from('otp_verifications')
      .delete()
      .lt('created_at', oneDayAgo);

    if (otpDeleteError) {
      console.error('Error deleting old OTPs:', otpDeleteError);
    } else {
      console.log('Deleted old OTP records');
    }

    // 2. Delete IP rate limits older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { error: rateLimitError } = await supabase
      .from('ip_rate_limits')
      .delete()
      .lt('window_start', twoHoursAgo);

    if (rateLimitError) {
      console.error('Error deleting old rate limits:', rateLimitError);
    } else {
      console.log('Deleted old rate limit records');
    }

    // 3. Unblock phones with expired blocks
    const { error: unblockError } = await supabase
      .from('blocked_phones')
      .delete()
      .eq('is_permanent', false)
      .lt('blocked_until', new Date().toISOString());

    if (unblockError) {
      console.error('Error unblocking expired phones:', unblockError);
    } else {
      console.log('Unblocked phones with expired blocks');
    }

    // 4. Delete SMS logs older than 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { error: smsLogsError } = await supabase
      .from('sms_logs')
      .delete()
      .lt('created_at', ninetyDaysAgo);

    if (smsLogsError) {
      console.error('Error deleting old SMS logs:', smsLogsError);
    } else {
      console.log('Deleted old SMS log records');
    }

    // 5. Reset daily failure counts for blocked phones (weekly reset)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: resetError } = await supabase
      .from('blocked_phones')
      .update({ failure_count: 0 })
      .lt('updated_at', sevenDaysAgo)
      .eq('is_permanent', false);

    if (resetError) {
      console.error('Error resetting failure counts:', resetError);
    } else {
      console.log('Reset weekly failure counts');
    }

    const summary = {
      cleanup_completed: true,
      timestamp: new Date().toISOString(),
    };

    console.log('Cleanup completed:', summary);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in cleanup-old-otps function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
