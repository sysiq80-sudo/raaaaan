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

interface TrackingQualityPayload {
  has_tracking_gap?: boolean;
  reason?: string;
  reasons?: string[];
  tracking_points_count?: number;
  valid_points_count?: number;
  final_gps_distance_km?: number | null;
}

const toFiniteNumber = (value: unknown): number | null => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const getValidTrackingPoints = (trackingPoints: unknown): TrackingPoint[] => {
  if (!Array.isArray(trackingPoints)) return [];

  return trackingPoints.filter((point): point is TrackingPoint => {
    if (!point || typeof point !== "object") return false;
    const candidate = point as TrackingPoint;
    return toFiniteNumber(candidate.lat) !== null && toFiniteNumber(candidate.lng) !== null;
  });
};

const getStartedDurationMinutes = (startedAt?: string | null): number => {
  if (!startedAt) return 0;
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startedMs) / 60000));
};

const buildTrackingQuality = ({
  clientQuality,
  finalGpsDistance,
  ride,
  validPoints,
}: {
  clientQuality: TrackingQualityPayload | null;
  finalGpsDistance: unknown;
  ride: { distance_km?: number | null; started_at?: string | null } | null;
  validPoints: TrackingPoint[];
}) => {
  const estimatedKm = toFiniteNumber(ride?.distance_km) ?? 0;
  const finalDistanceKm = toFiniteNumber(finalGpsDistance);
  const durationMinutes = getStartedDurationMinutes(ride?.started_at);
  const expectedMinPoints =
    durationMinutes >= 8 ? Math.min(8, Math.max(2, Math.floor(durationMinutes / 5))) : 2;
  const reasons = new Set<string>();

  if (clientQuality?.has_tracking_gap) {
    reasons.add(clientQuality.reason || "client_reported_tracking_gap");
    for (const reason of clientQuality.reasons || []) reasons.add(reason);
  }

  if (estimatedKm >= 1 && validPoints.length < 2) {
    reasons.add("missing_tracking_points");
  }

  if (durationMinutes >= 8 && validPoints.length < expectedMinPoints) {
    reasons.add("sparse_tracking_points");
  }

  if (estimatedKm >= 1 && (!finalDistanceKm || finalDistanceKm <= 0)) {
    reasons.add("missing_final_gps_distance");
  }

  if (
    estimatedKm >= 3 &&
    finalDistanceKm !== null &&
    finalDistanceKm > 0 &&
    finalDistanceKm < estimatedKm * 0.4 &&
    validPoints.length < expectedMinPoints
  ) {
    reasons.add("gps_distance_unreliable");
  }

  const hasTrackingGap = reasons.size > 0;

  return {
    status: hasTrackingGap ? "gps_network_gap" : "ok",
    has_tracking_gap: hasTrackingGap,
    reason: hasTrackingGap ? Array.from(reasons)[0] : null,
    reasons: Array.from(reasons),
    no_fare_adjustment_reason: hasTrackingGap ? "gps_or_network_unavailable" : null,
    distance_used_for_fare_audit: !hasTrackingGap && finalDistanceKm !== null && finalDistanceKm > 0,
    tracking_points_count: clientQuality?.tracking_points_count ?? validPoints.length,
    valid_points_count: validPoints.length,
    expected_min_points: expectedMinPoints,
    trip_duration_minutes: durationMinutes,
    estimated_distance_km: estimatedKm,
    final_gps_distance_km: finalDistanceKm,
    source: "complete-ride",
    recorded_at: new Date().toISOString(),
  };
};

const saveTrackingPoints = async (
  supabase: ReturnType<typeof createClient>,
  rideId: string,
  validPoints: TrackingPoint[],
) => {
  if (validPoints.length === 0) return;

  const pointsToInsert = validPoints.map((point) => ({
    ride_id: rideId,
    lat: point.lat,
    lng: point.lng,
    speed: point.speed || null,
    heading: point.heading || null,
    accuracy: point.accuracy || null,
    recorded_at: point.recorded_at || new Date().toISOString(),
  }));

  const { error } = await supabase.from("ride_tracking_points").insert(pointsToInsert);

  if (error) {
    console.warn("[complete-ride] Failed to save tracking points:", error.message);
  } else {
    console.log(`[complete-ride] Saved ${pointsToInsert.length} tracking points`);
  }
};

const annotateRideTrackingQuality = async (
  supabase: ReturnType<typeof createClient>,
  rideId: string,
  trackingQuality: ReturnType<typeof buildTrackingQuality>,
) => {
  const { data: rideRow, error: readError } = await supabase
    .from("rides")
    .select("metadata, fare_adjustment_reason")
    .eq("id", rideId)
    .maybeSingle();

  if (readError) {
    console.warn("[complete-ride] Failed to read ride metadata:", readError.message);
    return;
  }

  const currentMetadata =
    rideRow?.metadata && typeof rideRow.metadata === "object" && !Array.isArray(rideRow.metadata)
      ? rideRow.metadata
      : {};

  const updatePayload: Record<string, unknown> = {
    metadata: {
      ...currentMetadata,
      tracking_quality: trackingQuality,
      ...(trackingQuality.has_tracking_gap ? { tracking_gap: trackingQuality } : {}),
    },
  };

  if (trackingQuality.has_tracking_gap && !rideRow?.fare_adjustment_reason) {
    updatePayload.fare_adjustment_reason = "tracking_gap_gps_network_unavailable";
  }

  const { error: updateError } = await supabase
    .from("rides")
    .update(updatePayload)
    .eq("id", rideId);

  if (updateError) {
    console.warn("[complete-ride] Failed to annotate tracking quality:", updateError.message);
  }
};

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

    const requestBody = await req.json();
    const {
      ride_id,
      final_gps_distance = null,
      waiting_minutes = null,
      tracking_points = null,
      tracking_quality = null,
    } = requestBody;

    // ═══ Validation ═══
    if (!ride_id) {
      return new Response(
        JSON.stringify({ error: "ride_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const validTrackingPoints = getValidTrackingPoints(tracking_points);
    const { data: rideForTracking, error: rideReadError } = await supabase
      .from("rides")
      .select("distance_km, started_at")
      .eq("id", ride_id)
      .maybeSingle();

    if (rideReadError) {
      console.warn("[complete-ride] Failed to read ride for tracking quality:", rideReadError.message);
    }

    const trackingQuality = buildTrackingQuality({
      clientQuality: tracking_quality,
      finalGpsDistance: final_gps_distance,
      ride: rideForTracking,
      validPoints: validTrackingPoints,
    });
    const distanceForFareAudit = trackingQuality.has_tracking_gap ? null : final_gps_distance;

    console.log("[complete-ride] Starting transactional completion:", {
      ride_id,
      final_gps_distance: distanceForFareAudit,
      waiting_minutes,
      tracking_points_count: validTrackingPoints.length,
      tracking_quality: trackingQuality.status,
    });

    // ═══ 1. Save reliable tracking points before fare audit.
    // If GPS/network was unreliable, save them only after completion as evidence,
    // so incomplete points cannot incorrectly lower or raise the fare.
    if (!trackingQuality.has_tracking_gap) {
      await saveTrackingPoints(supabase, ride_id, validTrackingPoints);
    }

    // ═══ 2. Execute transactional ride completion ═══
    const { data: result, error: rpcError } = await supabase.rpc(
      "complete_ride_transactional",
      {
        p_ride_id: ride_id,
        p_caller_user_id: caller.id,
        p_final_gps_distance: distanceForFareAudit,
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

    if (trackingQuality.has_tracking_gap) {
      await saveTrackingPoints(supabase, ride_id, validTrackingPoints);
    }
    await annotateRideTrackingQuality(supabase, ride_id, trackingQuality);

    return new Response(JSON.stringify({ ...result, tracking_quality: trackingQuality }), {
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
