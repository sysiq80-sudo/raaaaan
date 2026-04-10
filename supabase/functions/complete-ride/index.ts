import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";
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
    if (ride.driver_arrival_time && ride.started_at) {
      // الأولوية لحساب السيرفر: Waiting = time between driver arrival and ride start
      const arrivedAt = new Date(ride.driver_arrival_time).getTime();
      const startedAt = new Date(ride.started_at).getTime();
      const serverCalcMinutes = Math.max(0, Math.floor((startedAt - arrivedAt) / 60000));
      // استخدم القيمة الأكبر بين حساب السيرفر والقيمة المُرسلة من العميل
      finalWaitingMinutes = Math.max(serverCalcMinutes, finalWaitingMinutes || 0);
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

    // ═══ 6. Waiting fare — إضافة أجرة الانتظار ═══
    let waitingFare = 0;
    const actualWaitingMinutes = finalWaitingMinutes || ride.waiting_minutes || 0;
    if (actualWaitingMinutes > 0) {
      try {
        const { data: fareSettings } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "fare_calculation")
          .maybeSingle();

        const waitingFarePerMin = (fareSettings?.value as any)?.waiting_fare_per_minute ?? 250;
        const freeWaitingMinutes = (fareSettings?.value as any)?.free_waiting_minutes ?? 3;
        const chargeableMinutes = Math.max(0, actualWaitingMinutes - freeWaitingMinutes);
        waitingFare = chargeableMinutes * waitingFarePerMin;

        if (waitingFare > 0) {
          finalFare += waitingFare;
          // Update the ride with the new fare including waiting
          await supabase
            .from("rides")
            .update({ final_fare: finalFare, waiting_fare: waitingFare })
            .eq("id", ride_id);
          console.log(`[complete-ride] Waiting fare added: ${waitingFare} IQD (${chargeableMinutes} min × ${waitingFarePerMin})`);
        }
      } catch (e) {
        console.warn("[complete-ride] Failed to calculate waiting fare:", e);
      }
    }

    // ═══ 7. Commission deduction — خصم العمولة ومعالجة أرباح السائق ═══
    let commissionResult: any = null;
    try {
      // 7a. Fetch default commission rate
      const { data: walletSettings } = await supabase
        .from("wallet_settings")
        .select("default_commission_rate")
        .limit(1)
        .single();

      const baseRate = walletSettings?.default_commission_rate ?? 15;

      // 7b. Fetch driver's commission tier discount
      let tierDiscount = 0;
      let tierName = "";
      try {
        const { data: tierData } = await supabase.rpc("get_driver_commission_tier", {
          p_driver_id: ride.driver_id,
        });
        if (tierData && tierData.length > 0) {
          tierDiscount = tierData[0].commission_discount || 0;
          tierName = tierData[0].tier_name_ar || "";
        }
      } catch (e) {
        console.warn("[complete-ride] Tier lookup failed:", e);
      }

      // 7c. Fetch active subscription discount
      let subscriptionDiscount = 0;
      let subscriptionName = "";
      try {
        const { data: subData } = await supabase.rpc("get_active_driver_subscription", {
          p_driver_id: ride.driver_id,
        });
        if (subData && subData.length > 0) {
          subscriptionDiscount = subData[0].commission_discount || 0;
          subscriptionName = subData[0].plan_name_ar || "";
        }
      } catch (e) {
        console.warn("[complete-ride] Subscription lookup failed:", e);
      }

      // 7d. Calculate effective commission rate (minimum 0%)
      const effectiveRate = Math.max(0, baseRate - tierDiscount - subscriptionDiscount);

      console.log(`[complete-ride] Commission: base=${baseRate}% - tier=${tierDiscount}%(${tierName}) - sub=${subscriptionDiscount}%(${subscriptionName}) = ${effectiveRate}%`);

      // 7e. Process ride earnings via DB function (handles wallet + transactions)
      const { data: earnings, error: earningsError } = await supabase.rpc("process_ride_earnings", {
        p_ride_id: ride_id,
        p_driver_id: ride.driver_id,
        p_total_fare: finalFare,
        p_commission_rate: effectiveRate,
      });

      if (earningsError) {
        console.error("[complete-ride] process_ride_earnings failed:", earningsError.message);
      } else {
        commissionResult = earnings;
        console.log("[complete-ride] Earnings processed:", JSON.stringify(earnings));
      }

      // 7f. Record in company_earnings
      const commissionAmount = Math.round(finalFare * effectiveRate / 100);
      const driverShare = finalFare - commissionAmount;

      await supabase.from("company_earnings").insert({
        ride_id,
        driver_id: ride.driver_id,
        total_fare: finalFare,
        commission_rate: effectiveRate / 100, // stored as decimal 0.15
        commission_amount: commissionAmount,
        driver_share: driverShare,
      });

      console.log(`[complete-ride] Company earnings recorded: fare=${finalFare}, commission=${commissionAmount}, driver=${driverShare}`);
    } catch (e) {
      console.error("[complete-ride] Commission processing failed (non-critical):", e);
      // Ride is already completed — commission can be reconciled later
    }

    // ═══ 7.5. Wallet deduction for rider — خصم المبلغ من محفظة الراكب إذا كان الدفع عبر المحفظة ═══
    let walletDeducted = false;
    if (ride.payment_method === "wallet") {
      try {
        // خصم المبلغ بشكل آمن عبر الدالة الذرية (تمنع race condition)
        const { data: deductResult, error: deductError } = await supabase.rpc(
          'deduct_wallet_safely',
          {
            p_user_id: ride.rider_id,
            p_amount: finalFare,
            p_ride_id: ride_id,
          }
        );

        if (deductError) {
          console.error("[complete-ride] Wallet deduction RPC error:", deductError.message);
        } else if (deductResult?.success) {
          walletDeducted = true;
          console.log(`[complete-ride] ✅ Wallet deducted: ${finalFare} IQD from rider ${ride.rider_id}. New balance: ${deductResult.new_balance}`);
        } else {
          // رصيد غير كافٍ أو خطأ آخر — تحويل لنقدي
          console.warn(`[complete-ride] Wallet deduction failed: ${deductResult?.error}. Switching to cash.`);

          await supabase
            .from("rides")
            .update({ payment_method: "cash" })
            .eq("id", ride_id);
        }
      } catch (e) {
        console.error("[complete-ride] Wallet deduction failed (non-critical):", e);
        // الرحلة مكتملة — يمكن تسوية المحفظة لاحقاً
      }
    }

    // ═══ 8. Build response ═══
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
      waiting_minutes: actualWaitingMinutes,
      waiting_fare: waitingFare,
      completed_at: new Date().toISOString(),
      commission: commissionResult ? {
        rate: commissionResult.commission ? (commissionResult.commission / finalFare * 100).toFixed(1) + "%" : null,
        amount: commissionResult.commission || null,
        driver_earning: commissionResult.driver_earning || null,
      } : null,
      wallet_deducted: walletDeducted,
      payment_method: ride.payment_method,
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
