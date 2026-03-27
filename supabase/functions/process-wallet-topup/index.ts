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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, request_id, admin_notes } = await req.json();

    console.log(`Processing wallet topup action: ${action} for request: ${request_id}`);

    if (action === 'approve') {
      // Get request details
      const { data: request, error: fetchError } = await supabase
        .from('wallet_topup_requests')
        .select('*')
        .eq('id', request_id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !request) {
        console.error('Request not found or already processed:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'الطلب غير موجود أو تمت معالجته' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('wallet_topup_requests')
        .update({
          status: 'approved',
          admin_notes: admin_notes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request_id);

      if (updateError) {
        console.error('Error updating request:', updateError);
        throw updateError;
      }

      // Add balance based on user type
      if (request.user_type === 'rider') {
        // Update rider profile balance
        const { error: balanceError } = await supabase
          .from('profiles')
          .update({
            wallet_balance: supabase.rpc('get_rider_wallet_balance', { p_user_id: request.user_id }) + request.amount
          })
          .eq('user_id', request.user_id);

        if (balanceError) {
          console.error('Error updating rider balance:', balanceError);
        }

        // Record transaction
        await supabase
          .from('rider_wallet_transactions')
          .insert({
            user_id: request.user_id,
            amount: request.amount,
            type: 'topup',
            payment_method: request.payment_method,
            reference_id: request.reference_number,
            description: 'إضافة رصيد'
          });

      } else {
        // Get driver id
        const { data: driver } = await supabase
          .from('drivers')
          .select('id, wallet_balance')
          .eq('user_id', request.user_id)
          .single();

        if (driver) {
          // Update driver balance
          const { error: balanceError } = await supabase
            .from('drivers')
            .update({
              wallet_balance: (driver.wallet_balance || 0) + request.amount
            })
            .eq('id', driver.id);

          if (balanceError) {
            console.error('Error updating driver balance:', balanceError);
          }

          // Record transaction
          await supabase
            .from('driver_wallet_transactions')
            .insert({
              driver_id: driver.id,
              amount: request.amount,
              type: 'topup',
              description: 'إضافة رصيد للعمولة'
            });
        }
      }

      console.log(`Successfully approved topup request ${request_id} for ${request.amount} IQD`);

      return new Response(
        JSON.stringify({ success: true, amount: request.amount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('wallet_topup_requests')
        .update({
          status: 'rejected',
          admin_notes: admin_notes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request_id)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Error rejecting request:', updateError);
        throw updateError;
      }

      console.log(`Successfully rejected topup request ${request_id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing wallet topup:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});