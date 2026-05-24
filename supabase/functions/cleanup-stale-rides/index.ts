import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get default timeout from app_settings
    const { data: defaultSettings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'default_wait_timeout')
      .single();

    const defaultTimeout = (defaultSettings?.value as { normal: number; weekend: number }) || { normal: 10, weekend: 15 };
    
    // Determine if today is weekend (Friday = 5, Saturday = 6)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    
    console.log(`Today is ${isWeekend ? 'weekend' : 'weekday'} (day: ${dayOfWeek})`);

    // Get all regions with their timeout settings
    const { data: regions } = await supabase
      .from('regions')
      .select('id, name_ar, wait_timeout_minutes, weekend_wait_timeout_minutes');

    const regionTimeouts = new Map<string, number>();
    for (const region of regions || []) {
      const timeout = isWeekend 
        ? (region.weekend_wait_timeout_minutes || defaultTimeout.weekend)
        : (region.wait_timeout_minutes || defaultTimeout.normal);
      regionTimeouts.set(region.id, timeout);
      console.log(`Region ${region.name_ar}: ${timeout} minutes timeout`);
    }

    // Find all pending rides without driver
    const { data: pendingRides, error: fetchError } = await supabase
      .from('rides')
      .select('id, rider_id, pickup_address, region_id, created_at')
      .eq('status', 'pending')
      .is('driver_id', null);

    if (fetchError) {
      console.error('Error fetching pending rides:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingRides?.length || 0} pending rides to check`);

    if (!pendingRides || pendingRides.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending rides to check', cancelled: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const cancelledRides: string[] = [];

    for (const ride of pendingRides) {
      // Get timeout for this ride's region, or use default
      let timeoutMinutes = isWeekend ? defaultTimeout.weekend : defaultTimeout.normal;
      
      if (ride.region_id && regionTimeouts.has(ride.region_id)) {
        timeoutMinutes = regionTimeouts.get(ride.region_id)!;
      }
      
      const rideCreatedAt = new Date(ride.created_at).getTime();
      const elapsedMinutes = (now - rideCreatedAt) / (1000 * 60);
      
      console.log(`Ride ${ride.id}: elapsed ${elapsedMinutes.toFixed(1)} min, timeout ${timeoutMinutes} min`);
      
      if (elapsedMinutes >= timeoutMinutes) {
        const { error: updateError } = await supabase
          .from('rides')
          .update({
            status: 'cancelled',
            cancellation_reason: 'لم يتم العثور على سائق متاح خلال الوقت المحدد',
            cancelled_by: 'system'
          })
          .eq('id', ride.id)
          .eq('status', 'pending');

        if (!updateError) {
          cancelledRides.push(ride.id);
          console.log(`Cancelled stale ride: ${ride.id} (exceeded ${timeoutMinutes} minutes)`);
        } else {
          console.error(`Error cancelling ride ${ride.id}:`, updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Cancelled ${cancelledRides.length} stale rides`,
        cancelled: cancelledRides.length,
        ride_ids: cancelledRides,
        is_weekend: isWeekend
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in cleanup-stale-rides:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
