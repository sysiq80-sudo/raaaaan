import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing scheduled rides...');

    // Get scheduled rides that are due within the next 15 minutes
    const fifteenMinutesFromNow = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: scheduledRides, error: fetchError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', fifteenMinutesFromNow)
      .gte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled rides:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledRides?.length || 0} scheduled rides to process`);

    const results = [];

    for (const scheduledRide of scheduledRides || []) {
      try {
        // Mark as processing
        await supabase
          .from('scheduled_rides')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', scheduledRide.id);

        // Create the actual ride
        const { data: newRide, error: rideError } = await supabase
          .from('rides')
          .insert({
            rider_id: scheduledRide.rider_id,
            pickup_location: scheduledRide.pickup_location,
            pickup_address: scheduledRide.pickup_address,
            dropoff_location: scheduledRide.dropoff_location,
            dropoff_address: scheduledRide.dropoff_address,
            vehicle_type: scheduledRide.vehicle_type,
            payment_method: scheduledRide.payment_method,
            estimated_fare: scheduledRide.estimated_fare,
            status: 'pending'
          })
          .select()
          .single();

        if (rideError) {
          console.error(`Error creating ride for scheduled ride ${scheduledRide.id}:`, rideError);
          await supabase
            .from('scheduled_rides')
            .update({ status: 'scheduled', updated_at: new Date().toISOString() })
            .eq('id', scheduledRide.id);
          continue;
        }

        // Update scheduled ride with actual ride id
        await supabase
          .from('scheduled_rides')
          .update({ 
            status: 'created', 
            ride_id: newRide.id,
            updated_at: new Date().toISOString() 
          })
          .eq('id', scheduledRide.id);

        // Send reminder notification if not already sent
        if (!scheduledRide.reminder_sent) {
          // Get rider's push subscription
          const { data: pushTokens } = await supabase
            .from('push_tokens')
            .select('token')
            .eq('user_id', scheduledRide.rider_id)
            .eq('is_active', true);

          if (pushTokens && pushTokens.length > 0) {
            // Log notification
            await supabase
              .from('notifications_log')
              .insert({
                notification_type: 'scheduled_ride_reminder',
                title: 'تذكير: رحلتك المجدولة',
                body: `رحلتك المجدولة ستبدأ قريباً. من ${scheduledRide.pickup_address} إلى ${scheduledRide.dropoff_address}`,
                data: { scheduled_ride_id: scheduledRide.id, ride_id: newRide.id },
                status: 'sent'
              });
          }

          await supabase
            .from('scheduled_rides')
            .update({ reminder_sent: true })
            .eq('id', scheduledRide.id);
        }

        results.push({ 
          scheduled_ride_id: scheduledRide.id, 
          ride_id: newRide.id, 
          status: 'created' 
        });

        console.log(`Created ride ${newRide.id} for scheduled ride ${scheduledRide.id}`);

      } catch (processError) {
        console.error(`Error processing scheduled ride ${scheduledRide.id}:`, processError);
        results.push({ 
          scheduled_ride_id: scheduledRide.id, 
          status: 'error', 
          error: String(processError) 
        });
      }
    }

    // Mark expired scheduled rides
    const { data: expiredRides, error: expireError } = await supabase
      .from('scheduled_rides')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'scheduled')
      .lt('scheduled_at', now)
      .select();

    if (expiredRides && expiredRides.length > 0) {
      console.log(`Marked ${expiredRides.length} rides as expired`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        expired: expiredRides?.length || 0,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-scheduled-rides:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
