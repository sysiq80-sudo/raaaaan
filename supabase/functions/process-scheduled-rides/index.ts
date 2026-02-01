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

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const fifteenMinutesFromNow = new Date(nowDate.getTime() + 15 * 60 * 1000).toISOString();
    const thirtyMinutesFromNow = new Date(nowDate.getTime() + 30 * 60 * 1000).toISOString();
    const fortyFiveMinutesFromNow = new Date(nowDate.getTime() + 45 * 60 * 1000).toISOString();

    // Get scheduled rides that are within the next 45 minutes
    const { data: scheduledRides, error: fetchError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .in('status', ['scheduled', 'reserved', 'confirmed'])
      .lte('scheduled_at', fortyFiveMinutesFromNow)
      .gte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled rides:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledRides?.length || 0} scheduled rides to process`);

    const results = [];

    for (const scheduledRide of scheduledRides || []) {
      try {
        const scheduledAt = new Date(scheduledRide.scheduled_at);
        const minutesToRide = Math.round((scheduledAt.getTime() - nowDate.getTime()) / 60000);

        // 1) Reminder before 45 minutes (driver confirmation)
        if (
          scheduledRide.status === 'reserved' &&
          !scheduledRide.driver_confirmed_at &&
          !scheduledRide.reminder_sent_at &&
          minutesToRide <= 45 &&
          minutesToRide > 30
        ) {
          if (scheduledRide.driver_id) {
            await supabase
              .from('notifications_log')
              .insert({
                notification_type: 'scheduled_ride_driver_reminder',
                title: 'تذكير: رحلة مجدولة',
                body: 'يرجى تأكيد جاهزيتك قبل موعد الرحلة بـ 30 دقيقة',
                data: { scheduled_ride_id: scheduledRide.id },
                status: 'sent'
              });
          }

          await supabase
            .from('scheduled_rides')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', scheduledRide.id);
        }

        // 2) Fail-safe: 30 minutes before (high priority)
        if (minutesToRide <= 30 && !scheduledRide.ride_id) {
          if (scheduledRide.status === 'scheduled' || scheduledRide.status === 'reserved') {
            const shouldReleaseDriver = !scheduledRide.driver_confirmed_at;

            const { data: urgentRide, error: urgentRideError } = await supabase
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
                status: 'pending',
                scheduled_at: scheduledRide.scheduled_at,
                stops: scheduledRide.stops,
                prefer_women_driver: scheduledRide.prefer_women_driver,
                high_priority: true,
                trip_type: scheduledRide.trip_type
              })
              .select()
              .single();

            if (urgentRideError) {
              console.error(`Error creating urgent ride for scheduled ride ${scheduledRide.id}:`, urgentRideError);
              continue;
            }

            await supabase
              .from('scheduled_rides')
              .update({
                status: 'created',
                ride_id: urgentRide.id,
                high_priority: true,
                driver_id: shouldReleaseDriver ? null : scheduledRide.driver_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', scheduledRide.id);

            // Broadcast urgent matching
            await supabase.functions.invoke('match-ride', {
              body: { rideId: urgentRide.id }
            });

            results.push({
              scheduled_ride_id: scheduledRide.id,
              ride_id: urgentRide.id,
              status: 'urgent-created'
            });
          }

          continue;
        }

        // 3) Confirmed driver: create assigned ride at 15 minutes
        if (minutesToRide <= 15 && !scheduledRide.ride_id && scheduledRide.status === 'confirmed') {
          await supabase
            .from('scheduled_rides')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', scheduledRide.id);

          const { data: newRide, error: rideError } = await supabase
            .from('rides')
            .insert({
              rider_id: scheduledRide.rider_id,
              driver_id: scheduledRide.driver_id,
              pickup_location: scheduledRide.pickup_location,
              pickup_address: scheduledRide.pickup_address,
              dropoff_location: scheduledRide.dropoff_location,
              dropoff_address: scheduledRide.dropoff_address,
              vehicle_type: scheduledRide.vehicle_type,
              payment_method: scheduledRide.payment_method,
              estimated_fare: scheduledRide.estimated_fare,
              status: 'accepted',
              scheduled_at: scheduledRide.scheduled_at,
              stops: scheduledRide.stops,
              prefer_women_driver: scheduledRide.prefer_women_driver,
              trip_type: scheduledRide.trip_type
            })
            .select()
            .single();

          if (rideError) {
            console.error(`Error creating ride for scheduled ride ${scheduledRide.id}:`, rideError);
            await supabase
              .from('scheduled_rides')
              .update({ status: 'confirmed', updated_at: new Date().toISOString() })
              .eq('id', scheduledRide.id);
            continue;
          }

          if (scheduledRide.driver_id) {
            await supabase
              .from('drivers')
              .update({ is_available: false, updated_at: new Date().toISOString() })
              .eq('id', scheduledRide.driver_id);
          }

          await supabase
            .from('scheduled_rides')
            .update({
              status: 'created',
              ride_id: newRide.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', scheduledRide.id);

          results.push({
            scheduled_ride_id: scheduledRide.id,
            ride_id: newRide.id,
            status: 'created'
          });

          console.log(`Created assigned ride ${newRide.id} for scheduled ride ${scheduledRide.id}`);
        }
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
