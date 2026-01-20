import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the callback data from NASS
    let callbackData;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      callbackData = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      callbackData = Object.fromEntries(formData);
    } else {
      // Try to parse URL parameters for GET requests
      const url = new URL(req.url);
      callbackData = Object.fromEntries(url.searchParams);
    }

    console.log('NASS Payment Callback received:', JSON.stringify(callbackData));

    // Extract common payment fields (adjust based on NASS API documentation)
    const {
      transaction_id,
      order_id,
      status,
      amount,
      currency,
      payment_method,
      error_code,
      error_message,
      signature,
      // Add more fields as per NASS API spec
    } = callbackData;

    // TODO: Verify signature with NASS secret key
    // const isValid = verifySignature(callbackData, Deno.env.get('NASS_SECRET_KEY'));

    // Update the transaction status in database
    if (order_id) {
      const { error: updateError } = await supabase
        .from('rider_wallet_transactions')
        .update({
          status: status === 'success' || status === 'completed' ? 'completed' : 'failed',
          reference_id: transaction_id,
          description: status === 'success' 
            ? `NASS Payment - ${transaction_id}` 
            : `Payment Failed: ${error_message || 'Unknown error'}`,
        })
        .eq('id', order_id);

      if (updateError) {
        console.error('Error updating transaction:', updateError);
      }

      // If payment successful, update wallet balance
      if (status === 'success' || status === 'completed') {
        const { data: transaction } = await supabase
          .from('rider_wallet_transactions')
          .select('user_id, amount')
          .eq('id', order_id)
          .single();

        if (transaction) {
          const { error: walletError } = await supabase
            .from('profiles')
            .update({
              wallet_balance: supabase.rpc('increment_wallet', { 
                user_id: transaction.user_id, 
                amount: transaction.amount 
              })
            })
            .eq('user_id', transaction.user_id);

          if (walletError) {
            console.error('Error updating wallet:', walletError);
          }
        }
      }
    }

    // Log the callback for debugging
    await supabase.from('api_usage_logs').insert({
      api_type: 'nass_payment',
      endpoint: '/nass-payment-callback',
      metadata: callbackData,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Callback processed successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('NASS Callback Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
