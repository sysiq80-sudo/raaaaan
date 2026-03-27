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

    const body = await req.json().catch(() => ({}));
    const stale_days = body.stale_days || 30;

    console.log(`Cleaning up subscriptions older than ${stale_days} days...`);

    // Delete subscriptions not updated in the specified number of days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - stale_days);
    
    const { data: deletedSubs, error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .lt('updated_at', cutoffDate.toISOString())
      .select('id, driver_id');

    if (deleteError) {
      console.error('Error deleting stale subscriptions:', deleteError);
      throw deleteError;
    }

    const deletedCount = deletedSubs?.length || 0;
    console.log(`Deleted ${deletedCount} stale subscriptions`);

    // Also clean up old notification logs (older than 90 days)
    const logCutoffDate = new Date();
    logCutoffDate.setDate(logCutoffDate.getDate() - 90);
    
    const { error: logDeleteError } = await supabase
      .from('notifications_log')
      .delete()
      .lt('created_at', logCutoffDate.toISOString());

    if (logDeleteError) {
      console.error('Error deleting old notification logs:', logDeleteError);
    }

    // Clean up old analytics (older than 365 days)
    const analyticsCutoffDate = new Date();
    analyticsCutoffDate.setDate(analyticsCutoffDate.getDate() - 365);
    
    const { error: analyticsDeleteError } = await supabase
      .from('notification_analytics')
      .delete()
      .lt('date', analyticsCutoffDate.toISOString().split('T')[0]);

    if (analyticsDeleteError) {
      console.error('Error deleting old analytics:', analyticsDeleteError);
    }

    // Get current subscription count
    const { count } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({ 
      success: true,
      deleted_subscriptions: deletedCount,
      remaining_subscriptions: count || 0,
      cutoff_date: cutoffDate.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in cleanup-stale-subscriptions:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
