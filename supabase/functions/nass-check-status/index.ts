import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";
import { corsHeaders, getCorsHeaders } from "../_shared/utils.ts";

let nassBaseUrl = "";
let nassUsername = "";
let nassPassword = "";
let _configLoaded = false;

async function loadDynamicConfig() {
  if (_configLoaded) return;
  try {
    const svc = createServiceClient();
    const cfg = await getConfigBatch(svc, ["NASS_BASE_URL", "NASS_USERNAME", "NASS_PASSWORD"]);
    nassBaseUrl = cfg["NASS_BASE_URL"] || Deno.env.get('NASS_BASE_URL') || "";
    nassUsername = cfg["NASS_USERNAME"] || Deno.env.get('NASS_USERNAME') || "";
    nassPassword = cfg["NASS_PASSWORD"] || Deno.env.get('NASS_PASSWORD') || "";
    _configLoaded = true;
    console.log("[nass-check-status] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[nass-check-status] ⚠️ Config load failed, using env fallbacks:", e);
    nassBaseUrl = Deno.env.get('NASS_BASE_URL') || "";
    nassUsername = Deno.env.get('NASS_USERNAME') || "";
    nassPassword = Deno.env.get('NASS_PASSWORD') || "";
  }
}
interface NassAuthResponse {
  access_token: string;
}

interface NassStatusResponse {
  success: boolean;
  code: number;
  status_code: number;
  data: {
    terminal: string;
    actionCode: string;
    responseCode: string;
    statusMsg: string;
    card: string;
    amount: string;
    currency: string;
    tranDate: string;
    rrn: string;
    intRef: string;
    nonce: string;
    orderId: string;
    timestamp: string;
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const externalGatewaysEnabled = Deno.env.get('ENABLE_EXTERNAL_PAYMENT_GATEWAYS') === 'true';
  if (!externalGatewaysEnabled) {
    return new Response(
      JSON.stringify({
        success: false,
        code: 'PAYMENT_GATEWAYS_DISABLED',
        error: 'بوابات الدفع الخارجية معطلة حالياً. الشحن متاح عبر كروت RAAN الداخلية فقط.',
      }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await loadDynamicConfig();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!nassBaseUrl || !nassUsername || !nassPassword) {
      console.error('Missing NASS credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'NASS credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking NASS payment status for order: ${orderId}`);

    // Step 1: Authenticate with NASS
    const authResponse = await fetch(`${nassBaseUrl}/auth/merchant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: nassUsername,
        password: nassPassword
      })
    });

    if (!authResponse.ok) {
      console.error('NASS auth failed:', authResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to authenticate with payment gateway' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData: NassAuthResponse = await authResponse.json();
    const accessToken = authData.access_token;

    // Step 2: Check transaction status
    const statusResponse = await fetch(`${nassBaseUrl}/transaction/${orderId}/checkStatus`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('NASS status check failed:', statusResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to check payment status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusData: NassStatusResponse = await statusResponse.json();
    console.log('NASS status response:', JSON.stringify(statusData));

    // Determine payment status
    const isSuccess = statusData.success && 
                      statusData.data?.responseCode === '00' && 
                      statusData.data?.actionCode === '0';

    const paymentStatus = isSuccess ? 'completed' : 'failed';

    // Update transaction in database
    const { data: transaction, error: fetchError } = await supabase
      .from('rider_wallet_transactions')
      .select('id, user_id, amount, status')
      .eq('reference_id', orderId)
      .single();

    if (fetchError) {
      console.error('Error fetching transaction:', fetchError);
    }

    if (transaction && transaction.status === 'pending') {
      // Update transaction status
      const { error: updateError } = await supabase
        .from('rider_wallet_transactions')
        .update({
          status: paymentStatus,
          description: isSuccess 
            ? `شحن ناجح - RRN: ${statusData.data?.rrn}` 
            : `فشل الدفع: ${statusData.data?.statusMsg || 'Unknown error'}`
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Error updating transaction:', updateError);
      }

      // If successful, update wallet balance
      if (isSuccess && transaction.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('user_id', transaction.user_id)
          .single();

        if (profile) {
          const newBalance = (profile.wallet_balance || 0) + transaction.amount;
          
          const { error: walletError } = await supabase
            .from('profiles')
            .update({ wallet_balance: newBalance })
            .eq('user_id', transaction.user_id);

          if (walletError) {
            console.error('Error updating wallet balance:', walletError);
          } else {
            console.log(`Wallet updated for user ${transaction.user_id}: ${newBalance} IQD`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          orderId: orderId,
          status: paymentStatus,
          statusMsg: statusData.data?.statusMsg || 'Unknown',
          amount: statusData.data?.amount,
          rrn: statusData.data?.rrn,
          card: statusData.data?.card,
          tranDate: statusData.data?.tranDate
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('NASS Check Status Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
