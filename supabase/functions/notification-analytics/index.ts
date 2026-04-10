import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
interface AnalyticsSummary {
  date: string;
  notification_type: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_failed: number;
  delivery_rate: number;
  open_rate: number;
  avg_delivery_delay_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'summary';
    const days = parseInt(url.searchParams.get('days') || '30');
    const notification_type = url.searchParams.get('type');

    console.log(`Analytics request: action=${action}, days=${days}, type=${notification_type}`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (action === 'summary') {
      // Get aggregated summary
      let query = supabase
        .from('notification_analytics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (notification_type) {
        query = query.eq('notification_type', notification_type);
      }

      const { data: analytics, error } = await query;

      if (error) throw error;

      // Calculate totals
      const totals = {
        total_sent: 0,
        total_delivered: 0,
        total_opened: 0,
        total_failed: 0,
        avg_delivery_delay_ms: 0,
      };

      let delayCount = 0;

      (analytics || []).forEach((row: any) => {
        totals.total_sent += row.total_sent || 0;
        totals.total_delivered += row.total_delivered || 0;
        totals.total_opened += row.total_opened || 0;
        totals.total_failed += row.total_failed || 0;
        if (row.avg_delivery_delay_ms > 0) {
          totals.avg_delivery_delay_ms += row.avg_delivery_delay_ms;
          delayCount++;
        }
      });

      if (delayCount > 0) {
        totals.avg_delivery_delay_ms = Math.round(totals.avg_delivery_delay_ms / delayCount);
      }

      const delivery_rate = totals.total_sent > 0 
        ? Math.round((totals.total_delivered / totals.total_sent) * 100) 
        : 0;
      const open_rate = totals.total_delivered > 0 
        ? Math.round((totals.total_opened / totals.total_delivered) * 100) 
        : 0;

      return new Response(JSON.stringify({
        success: true,
        period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0], days },
        totals: {
          ...totals,
          delivery_rate,
          open_rate
        },
        daily: analytics || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'by_type') {
      // Get breakdown by notification type
      const { data: analytics, error } = await supabase
        .from('notification_analytics')
        .select('notification_type, total_sent, total_delivered, total_opened, total_failed, avg_delivery_delay_ms')
        .gte('date', startDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Aggregate by type
      const byType: Record<string, any> = {};

      (analytics || []).forEach((row: any) => {
        const type = row.notification_type;
        if (!byType[type]) {
          byType[type] = {
            notification_type: type,
            total_sent: 0,
            total_delivered: 0,
            total_opened: 0,
            total_failed: 0,
            avg_delivery_delay_ms: 0,
            count: 0
          };
        }
        byType[type].total_sent += row.total_sent || 0;
        byType[type].total_delivered += row.total_delivered || 0;
        byType[type].total_opened += row.total_opened || 0;
        byType[type].total_failed += row.total_failed || 0;
        if (row.avg_delivery_delay_ms > 0) {
          byType[type].avg_delivery_delay_ms += row.avg_delivery_delay_ms;
          byType[type].count++;
        }
      });

      // Calculate rates
      const result = Object.values(byType).map((type: any) => ({
        notification_type: type.notification_type,
        total_sent: type.total_sent,
        total_delivered: type.total_delivered,
        total_opened: type.total_opened,
        total_failed: type.total_failed,
        delivery_rate: type.total_sent > 0 ? Math.round((type.total_delivered / type.total_sent) * 100) : 0,
        open_rate: type.total_delivered > 0 ? Math.round((type.total_opened / type.total_delivered) * 100) : 0,
        avg_delivery_delay_ms: type.count > 0 ? Math.round(type.avg_delivery_delay_ms / type.count) : 0
      }));

      return new Response(JSON.stringify({
        success: true,
        period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0], days },
        by_type: result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'recent_failures') {
      // Get recent failed notifications for debugging
      const { data: failures, error } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group by error type
      const errorCounts: Record<string, number> = {};
      (failures || []).forEach((f: any) => {
        const err = f.error_message || 'unknown';
        errorCounts[err] = (errorCounts[err] || 0) + 1;
      });

      return new Response(JSON.stringify({
        success: true,
        recent_failures: failures || [],
        error_summary: errorCounts
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'subscription_stats') {
      // Get subscription statistics
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('driver_id, created_at, updated_at');

      if (error) throw error;

      const now = new Date();
      const stats = {
        total: subscriptions?.length || 0,
        active_last_24h: 0,
        active_last_7d: 0,
        active_last_30d: 0,
        stale: 0
      };

      (subscriptions || []).forEach((sub: any) => {
        const updatedAt = new Date(sub.updated_at);
        const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate <= 1) stats.active_last_24h++;
        if (daysSinceUpdate <= 7) stats.active_last_7d++;
        if (daysSinceUpdate <= 30) stats.active_last_30d++;
        if (daysSinceUpdate > 30) stats.stale++;
      });

      return new Response(JSON.stringify({
        success: true,
        subscription_stats: stats
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown action. Use: summary, by_type, recent_failures, subscription_stats' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in notification-analytics:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
