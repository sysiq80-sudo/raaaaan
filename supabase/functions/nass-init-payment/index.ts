import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfigBatch, createServiceClient } from "../_shared/config.ts";

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
    console.log("[nass-init-payment] ✅ Dynamic config loaded");
  } catch (e) {
    console.warn("[nass-init-payment] ⚠️ Config load failed, using env fallbacks:", e);
    nassBaseUrl = Deno.env.get('NASS_BASE_URL') || "";
    nassUsername = Deno.env.get('NASS_USERNAME') || "";
    nassPassword = Deno.env.get('NASS_PASSWORD') || "";
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InitPaymentRequest {
  amount: number;
  orderDesc?: string;
  backRef?: string;
}

interface NassAuthResponse {
  access_token: string;
}

interface NassTransactionResponse {
  success: boolean;
  code: number;
  status_code: number;
  data: {
    url: string;
    pSign: string;
    transactionParams: Record<string, string>;
  };
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: InitPaymentRequest = await req.json();
    const { amount, orderDesc = 'شحن محفظة رعان', backRef = 'https://raan.app/payment/result' } = body;

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Initiating NASS payment for user ${userId}, amount: ${amount} IQD`);

    // Step 1: Authenticate with NASS
    console.log('Authenticating with NASS...');
    const authResponse = await fetch(`${nassBaseUrl}/auth/merchant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: nassUsername,
        password: nassPassword
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('NASS auth failed:', authResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to authenticate with payment gateway' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    console.log('NASS auth response:', JSON.stringify(authData));
    
    // Extract token - could be in different fields
    const accessToken = authData.access_token || authData.token || authData.accessToken || authData.data?.access_token || authData.data?.token;
    
    if (!accessToken) {
      console.error('No access token in response:', authData);
      return new Response(
        JSON.stringify({ success: false, error: 'No access token received from payment gateway' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('NASS authentication successful, token length:', accessToken.length);

    // Generate unique order ID
    const orderId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/nass-payment-callback`;

    // Step 2: Create transaction in NASS
    console.log('Creating NASS transaction...');
    console.log('Transaction URL:', `${nassBaseUrl}/transaction`);
    
    const transactionBody = {
      orderId: orderId,
      orderDesc: orderDesc,
      amount: amount,
      currency: '368', // IQD
      transactionType: '1',
      backRef: backRef,
      notifyUrl: callbackUrl
    };
    console.log('Transaction body:', JSON.stringify(transactionBody));
    
    const transactionResponse = await fetch(`${nassBaseUrl}/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(transactionBody)
    });

    const responseText = await transactionResponse.text();
    console.log('NASS transaction response status:', transactionResponse.status);
    console.log('NASS transaction response:', responseText);

    if (!transactionResponse.ok) {
      console.error('NASS transaction failed:', transactionResponse.status, responseText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create payment transaction', details: responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    let transactionData: NassTransactionResponse;
    try {
      transactionData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse transaction response:', responseText);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid response from payment gateway' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('NASS transaction created:', transactionData.success);

    if (!transactionData.success || !transactionData.data?.url) {
      console.error('NASS transaction response invalid:', transactionData);
      return new Response(
        JSON.stringify({ success: false, error: transactionData.message || 'Invalid payment gateway response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Save pending transaction in database
    const { error: insertError } = await supabase
      .from('rider_wallet_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'topup',
        status: 'pending',
        payment_method: 'nass',
        description: orderDesc,
        reference_id: orderId
      });

    if (insertError) {
      console.error('Error saving transaction:', insertError);
      // Continue anyway - the payment can still work
    }

    console.log(`Payment initiated successfully. Order ID: ${orderId}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          orderId: orderId,
          paymentUrl: transactionData.data.url,
          pSign: transactionData.data.pSign,
          transactionParams: transactionData.data.transactionParams
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('NASS Init Payment Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
