import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/utils.ts";

interface TrackingPoint {
  lat: number;
  lng: number;
  recorded_at?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ═══ Authorization: verify the caller is authenticated ═══
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_ANON_KEY is missing on the server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      ride_id,
      final_gps_distance = null,
      waiting_minutes = null,
      tracking_points = null,
    } = await req.json();

    // ═══ Validation ═══
    if (!ride_id) {
      return new Response(
        JSON.stringify({ error: "ride_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[complete-ride] Starting transactional completion:", {
      ride_id,
      final_gps_distance,
      waiting_minutes,
      tracking_points_count: tracking_points?.length || 0,
    });

    // ═══ 1. Save tracking points (batch insert, non-critical) ═══
    if (tracking_points && Array.isArray(tracking_points) && tracking_points.length > 0) {
      const pointsToInsert = tracking_points
        .filter((p: TrackingPoint) => p.lat && p.lng)
        .map((p: TrackingPoint) => ({
          ride_id,
          lat: p.lat,
          lng: p.lng,
          speed: p.speed || null,
          heading: p.heading || null,
          accuracy: p.accuracy || null,
          recorded_at: p.recorded_at || new Date().toISOString(),
        }));

      if (pointsToInsert.length > 0) {
        const { error: trackingError } = await supabase
          .from("ride_tracking_points")
          .insert(pointsToInsert);

        if (trackingError) {
          console.warn("[complete-ride] Failed to save tracking points:", trackingError.message);
        } else {
          console.log(`[complete-ride] Saved ${pointsToInsert.length} tracking points`);
        }
      }
    }

    // ═══ 2. Execute transactional ride completion ═══
    const { data: result, error: rpcError } = await supabase.rpc(
      "complete_ride_transactional",
      {
        p_ride_id: ride_id,
        p_caller_user_id: caller.id,
        p_final_gps_distance: final_gps_distance,
        p_waiting_minutes: waiting_minutes,
      }
    );

    if (rpcError) {
      console.error("[complete-ride] Transaction failed:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || "Failed to complete ride atomically" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[complete-ride] Completed ride atomically:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[complete-ride] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
