import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NassCallbackData {
  terminal?: string;
  actionCode?: string;
  responseCode?: string;
  statusMsg?: string;
  card?: string;
  amount?: string;
  currency?: string;
  tranDate?: string;
  rrn?: string;
  intRef?: string;
  nonce?: string;
  signature?: string;
  orderId?: string;
  timestamp?: string;
}

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
    let callbackData: NassCallbackData;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      callbackData = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      callbackData = Object.fromEntries(formData) as unknown as NassCallbackData;
    } else {
      // Try to parse URL parameters for GET requests
      const url = new URL(req.url);
      callbackData = Object.fromEntries(url.searchParams) as unknown as NassCallbackData;
    }

    console.log('NASS Payment Callback received:', JSON.stringify(callbackData));

    // Extract fields based on NASS API v1.7 documentation
    const {
      orderId,
      actionCode,
      responseCode,
      statusMsg,
      amount,
      rrn,
      intRef,
      card,
      signature
    } = callbackData;

    // Determine if payment was successful
    // According to NASS docs: responseCode "00" and actionCode "0" means success
    const isSuccess = responseCode === '00' && actionCode === '0';
    const paymentStatus = isSuccess ? 'completed' : 'failed';

    console.log(`Payment ${orderId}: ${isSuccess ? 'SUCCESS' : 'FAILED'} - ${statusMsg}`);

    // Find and update the transaction by reference_id (orderId)
    if (orderId) {
      const { data: transaction, error: fetchError } = await supabase
        .from('rider_wallet_transactions')
        .select('id, user_id, amount, status')
        .eq('reference_id', orderId)
        .single();

      if (fetchError) {
        console.error('Error fetching transaction:', fetchError);
      }

      if (transaction) {
        // Only update if transaction is still pending
        if (transaction.status === 'pending') {
          const { error: updateError } = await supabase
            .from('rider_wallet_transactions')
            .update({
              status: paymentStatus,
              description: isSuccess 
                ? `شحن ناجح - RRN: ${rrn || 'N/A'} - البطاقة: ${card || 'N/A'}` 
                : `فشل الدفع: ${statusMsg || 'Unknown error'}`
            })
            .eq('id', transaction.id);

          if (updateError) {
            console.error('Error updating transaction:', updateError);
          }

          // If payment successful, update wallet balance
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
                console.error('Error updating wallet:', walletError);
              } else {
                console.log(`Wallet updated for user ${transaction.user_id}: ${newBalance} IQD`);
              }
            }
          }
        } else {
          console.log(`Transaction ${orderId} already processed with status: ${transaction.status}`);
        }
      } else {
        console.warn(`Transaction not found for order: ${orderId}`);
      }
    }

    // Log the callback for debugging and auditing
    await supabase.from('api_usage_logs').insert({
      api_type: 'nass_payment',
      endpoint: '/nass-payment-callback',
      metadata: {
        orderId,
        responseCode,
        actionCode,
        statusMsg,
        amount,
        rrn,
        intRef,
        card: card ? `****${card.slice(-4)}` : null,
        success: isSuccess
      }
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
