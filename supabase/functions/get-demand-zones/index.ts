/**
 * ران — Edge Function: مناطق الطلب الساخنة
 * Get Demand Zones — Aggregate recent ride requests into heat zones
 *
 * يحلل طلبات الرحلات الأخيرة ويصنفها حسب المنطقة الجغرافية
 * لعرض خريطة حرارية للسائقين
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// تقريب الإحداثيات لإنشاء شبكة (~500 متر)
const GRID_PRECISION = 2.5; // ~400m

function roundToGrid(val: number): number {
  return Math.round(val * 1000 / GRID_PRECISION) * GRID_PRECISION / 1000;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // طلبات آخر ساعتين
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: rides, error } = await supabase
      .from("rides")
      .select("pickup_location")
      .gte("created_at", since)
      .not("pickup_location", "is", null)
      .limit(500);

    if (error) throw error;

    // تجميع حسب شبكة
    const grid: Record<string, { lat: number; lng: number; count: number }> = {};

    for (const ride of rides || []) {
      const loc = ride.pickup_location as { lat: number; lng: number };
      if (!loc?.lat || !loc?.lng) continue;

      const gLat = roundToGrid(loc.lat);
      const gLng = roundToGrid(loc.lng);
      const key = `${gLat},${gLng}`;

      if (!grid[key]) {
        grid[key] = { lat: gLat, lng: gLng, count: 0 };
      }
      grid[key].count++;
    }

    // ترتيب حسب الكثافة وإرجاع الأعلى
    const zones = Object.values(grid)
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    const maxCount = zones.length > 0 ? zones[0].count : 1;

    // تطبيع الكثافة (0-1)
    const normalizedZones = zones.map((z) => ({
      lat: z.lat,
      lng: z.lng,
      weight: z.count / maxCount,
      count: z.count,
    }));

    return new Response(
      JSON.stringify({ success: true, zones: normalizedZones, total_rides: rides?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[get-demand-zones] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
