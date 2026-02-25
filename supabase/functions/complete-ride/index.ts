import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * ═══════════════════════════════════════════════════════════
 * complete-ride — إكمال الرحلة مع تدقيق الأجرة الهجين
 * ═══════════════════════════════════════════════════════════
 *
 * Input:
 *   ride_id          — معرف الرحلة (مطلوب)
 *   final_gps_distance — المسافة الفعلية بالكم من GPS السائق (اختياري)
 *   waiting_minutes  — دقائق الانتظار (اختياري)
 *   tracking_points  — نقاط تتبع [{lat, lng, recorded_at, speed?, heading?, accuracy?}] (اختياري)
 *
 * Logic:
 *   1. يتحقق أن الرحلة موجودة وفي حالة in_progress
 *   2. يحفظ نقاط التتبع (إن وجدت)
 *   3. يكمل الرحلة في DB (status: completed, completed_at, final_fare = estimated_fare)
 *   4. يستدعي audit_ride_fare لمقارنة المسافة الفعلية بالمقدرة
 *   5. إذا الانحراف > 15% → يتم تعديل final_fare تلقائياً من audit_ride_fare
 *   6. يرجع النتيجة النهائية (الأجرة + هل تم التعديل)
 */

interface TrackingPoint {
  lat: number;
  lng: number;
  recorded_at?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ═══ Authorization: verify the caller is the assigned driver ═══
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey, {
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

    console.log("[complete-ride] Starting:", {
      ride_id,
      final_gps_distance,
      waiting_minutes,
      tracking_points_count: tracking_points?.length || 0,
    });

    // ═══ 1. Fetch ride ═══
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();

    if (rideError || !ride) {
      return new Response(
        JSON.stringify({ error: "Ride not found", details: rideError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (ride.status === "completed") {
      return new Response(
        JSON.stringify({
          error: "Ride already completed",
          final_fare: ride.final_fare,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["in_progress"].includes(ride.status)) {
      return new Response(
        JSON.stringify({
          error: `لا يمكن إنهاء رحلة بحالة: ${ride.status}. يجب أن تكون الرحلة "قيد التنفيذ"`,
          current_status: ride.status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ═══ Verify the caller is the ride's assigned driver ═══
    const { data: callerDriver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", caller.id)
      .single();

    if (!callerDriver || callerDriver.id !== ride.driver_id) {
      return new Response(
        JSON.stringify({ error: "غير مصرّح: يمكن فقط لسائق الرحلة إنهاؤها" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ═══ 2. Save tracking points (batch insert) ═══
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
          // Non-critical — continue with completion
        } else {
          console.log(`[complete-ride] Saved ${pointsToInsert.length} tracking points`);
        }
      }
    }

    // ═══ 3. Calculate waiting minutes ═══
    // وقت الانتظار = من وصول السائق (arrived_at) إلى بدء الرحلة (started_at)
    // وليس مدة الرحلة الكاملة
    let finalWaitingMinutes = waiting_minutes;
    if (finalWaitingMinutes === null && ride.driver_arrival_time && ride.started_at) {
      // Waiting = time between driver arrival and ride start
      const arrivedAt = new Date(ride.driver_arrival_time).getTime();
      const startedAt = new Date(ride.started_at).getTime();
      finalWaitingMinutes = Math.max(0, Math.floor((startedAt - arrivedAt) / 60000));
    } else if (finalWaitingMinutes === null) {
      finalWaitingMinutes = 0;
    }

    // ═══ 4. Complete the ride in DB ═══
    const estimatedFare = ride.estimated_fare || 0;

    const { error: updateError } = await supabase
      .from("rides")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        final_fare: estimatedFare, // Initially set to estimated — audit may override
        waiting_minutes: finalWaitingMinutes || ride.waiting_minutes || 0,
        actual_distance_km: final_gps_distance || null,
      })
      .eq("id", ride_id);

    if (updateError) {
      console.error("[complete-ride] Update failed:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to complete ride", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[complete-ride] Ride marked completed, initial fare:", estimatedFare);

    // ═══ 5. Fare Audit — Hybrid pricing check ═══
    let auditResult = null;
    let finalFare = estimatedFare;
    let fareAdjusted = false;
    let adjustmentMessage = null;

    // Only audit if we have actual distance data
    if (final_gps_distance && final_gps_distance > 0) {
      const { data: audit, error: auditError } = await supabase.rpc(
        "audit_ride_fare",
        {
          p_ride_id: ride_id,
          p_actual_distance_km: final_gps_distance,
        },
      );

      if (auditError) {
        console.warn("[complete-ride] Fare audit failed:", auditError.message);
        // Non-critical — ride is already completed with estimated fare
      } else if (audit) {
        auditResult = audit;
        fareAdjusted = audit.adjusted === true;
        
        if (fareAdjusted) {
          finalFare = audit.new_fare;
          const variancePercent = audit.variance_percent;
          
          if (audit.reason === "route_longer") {
            adjustmentMessage = `تم تعديل الأجرة بناءً على المسار الفعلي (+${variancePercent}%)`;
          } else if (audit.reason === "shortcut_taken") {
            adjustmentMessage = `تم تعديل الأجرة — مسار أقصر (${variancePercent}%)`;
          }
          
          console.log(`[complete-ride] Fare adjusted: ${estimatedFare} → ${finalFare} (${audit.reason}, ${variancePercent}%)`);
        } else {
          console.log(`[complete-ride] Fare unchanged — variance within tolerance (${audit.variance_percent}%)`);
        }
      }
    } else if (!final_gps_distance) {
      // Try tracking-based audit (if points exist)
      const { data: audit, error: auditError } = await supabase.rpc(
        "audit_ride_fare",
        { p_ride_id: ride_id },
      );

      if (!auditError && audit && audit.adjusted) {
        auditResult = audit;
        fareAdjusted = true;
        finalFare = audit.new_fare;
        adjustmentMessage = audit.reason === "route_longer"
          ? `تم تعديل الأجرة بناءً على المسار الفعلي (+${audit.variance_percent}%)`
          : `تم تعديل الأجرة — مسار أقصر (${audit.variance_percent}%)`;
        console.log(`[complete-ride] Fare adjusted from tracking: ${estimatedFare} → ${finalFare}`);
      }
    }

    // ═══ 6. Build response ═══
    const response = {
      success: true,
      ride_id,
      final_fare: finalFare,
      estimated_fare: estimatedFare,
      fare_adjusted: fareAdjusted,
      adjustment_message: adjustmentMessage,
      actual_distance_km: final_gps_distance || auditResult?.actual_distance || null,
      estimated_distance_km: ride.distance_km,
      variance_percent: auditResult?.variance_percent || null,
      waiting_minutes: finalWaitingMinutes || ride.waiting_minutes || 0,
      completed_at: new Date().toISOString(),
    };

    console.log("[complete-ride] Complete:", response);

    return new Response(JSON.stringify(response), {
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
