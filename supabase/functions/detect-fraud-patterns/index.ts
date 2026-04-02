/**
 * ران — Edge Function: كشف الأنماط المشبوهة
 * Detect suspicious ride patterns for fraud prevention
 *
 * يحلل الرحلات الأخيرة ويبحث عن أنماط احتيال محتملة:
 * 1. إلغاء متكرر (>5 إلغاءات في 24 ساعة)
 * 2. رحلات بنفس النقطة انطلاق/وصول
 * 3. مبالغ غير طبيعية (>3x المتوسط لنفس المسافة)
 * 4. تكرار سائق-راكب مشبوه (>3 رحلات/يوم لنفس الثنائي)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// عتبات الكشف
const CANCEL_THRESHOLD = 5;          // إلغاءات/24 ساعة
const SAME_PAIR_THRESHOLD = 3;       // رحلات لنفس الثنائي/يوم
const FARE_MULTIPLIER_THRESHOLD = 3; // 3x المتوسط
const SAME_ROUTE_THRESHOLD = 4;      // نفس المسار/يوم
const LOOKBACK_HOURS = 24;

interface FraudAlert {
  type: string;
  severity: "low" | "medium" | "high";
  user_id: string;
  user_type: "rider" | "driver";
  description: string;
  details: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const alerts: FraudAlert[] = [];

    // 1. كشف الإلغاء المتكرر — الراكبون
    const { data: riderCancels } = await supabase
      .from("rides")
      .select("rider_id")
      .eq("status", "cancelled")
      .gte("created_at", since);

    if (riderCancels) {
      const counts: Record<string, number> = {};
      for (const r of riderCancels) {
        counts[r.rider_id] = (counts[r.rider_id] || 0) + 1;
      }
      for (const [userId, count] of Object.entries(counts)) {
        if (count >= CANCEL_THRESHOLD) {
          alerts.push({
            type: "excessive_cancellations",
            severity: count >= CANCEL_THRESHOLD * 2 ? "high" : "medium",
            user_id: userId,
            user_type: "rider",
            description: `إلغاء متكرر: ${count} رحلة ملغية خلال ${LOOKBACK_HOURS} ساعة`,
            details: { cancellation_count: count },
          });
        }
      }
    }

    // 2. كشف الإلغاء المتكرر — السائقون
    const { data: driverCancels } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("status", "cancelled")
      .eq("cancelled_by", "driver")
      .gte("created_at", since)
      .not("driver_id", "is", null);

    if (driverCancels) {
      const counts: Record<string, number> = {};
      for (const r of driverCancels) {
        if (r.driver_id) counts[r.driver_id] = (counts[r.driver_id] || 0) + 1;
      }
      for (const [driverId, count] of Object.entries(counts)) {
        if (count >= CANCEL_THRESHOLD) {
          alerts.push({
            type: "driver_excessive_cancellations",
            severity: count >= CANCEL_THRESHOLD * 2 ? "high" : "medium",
            user_id: driverId,
            user_type: "driver",
            description: `سائق يلغي بكثرة: ${count} إلغاء خلال ${LOOKBACK_HOURS} ساعة`,
            details: { cancellation_count: count },
          });
        }
      }
    }

    // 3. تكرار سائق-راكب مشبوه
    const { data: completedRides } = await supabase
      .from("rides")
      .select("rider_id, driver_id, final_fare, distance_km, pickup_location, dropoff_location")
      .eq("status", "completed")
      .gte("created_at", since)
      .not("driver_id", "is", null);

    if (completedRides) {
      // تكرار الأزواج
      const pairCounts: Record<string, number> = {};
      for (const r of completedRides) {
        const key = `${r.rider_id}__${r.driver_id}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
      for (const [pair, count] of Object.entries(pairCounts)) {
        if (count >= SAME_PAIR_THRESHOLD) {
          const [riderId, driverId] = pair.split("__");
          alerts.push({
            type: "suspicious_pair",
            severity: count >= SAME_PAIR_THRESHOLD * 2 ? "high" : "medium",
            user_id: riderId,
            user_type: "rider",
            description: `تكرار مشبوه: ${count} رحلات لنفس الراكب والسائق خلال ${LOOKBACK_HOURS} ساعة`,
            details: { pair_count: count, driver_id: driverId },
          });
        }
      }

      // 4. مبالغ غير طبيعية
      const ridesWithFare = completedRides.filter(
        (r) => r.final_fare && r.distance_km && r.distance_km > 0
      );
      if (ridesWithFare.length > 10) {
        const farePerKm = ridesWithFare.map((r) => r.final_fare / r.distance_km);
        const avgFarePerKm = farePerKm.reduce((a, b) => a + b, 0) / farePerKm.length;

        for (const r of ridesWithFare) {
          const ratePerKm = r.final_fare / r.distance_km;
          if (ratePerKm > avgFarePerKm * FARE_MULTIPLIER_THRESHOLD) {
            alerts.push({
              type: "abnormal_fare",
              severity: "medium",
              user_id: r.driver_id!,
              user_type: "driver",
              description: `أجرة غير طبيعية: ${r.final_fare.toLocaleString()} د.ع لـ ${r.distance_km.toFixed(1)} كم (${Math.round(ratePerKm)} د.ع/كم vs متوسط ${Math.round(avgFarePerKm)} د.ع/كم)`,
              details: {
                fare: r.final_fare,
                distance: r.distance_km,
                rate: ratePerKm,
                avg_rate: avgFarePerKm,
                rider_id: r.rider_id,
              },
            });
          }
        }
      }

      // 5. كشف نفس المسار المتكرر (pickup/dropoff قريبين جداً)
      const routeCounts: Record<string, { count: number; userId: string }> = {};
      for (const r of completedRides) {
        if (!r.pickup_location || !r.dropoff_location) continue;
        const pickup = r.pickup_location as { lat: number; lng: number };
        const dropoff = r.dropoff_location as { lat: number; lng: number };
        // تقريب الإحداثيات لـ 3 منازل عشرية (~111 متر)
        const key = `${r.rider_id}__${pickup.lat.toFixed(3)},${pickup.lng.toFixed(3)}__${dropoff.lat.toFixed(3)},${dropoff.lng.toFixed(3)}`;
        if (!routeCounts[key]) routeCounts[key] = { count: 0, userId: r.rider_id };
        routeCounts[key].count++;
      }
      for (const [, data] of Object.entries(routeCounts)) {
        if (data.count >= SAME_ROUTE_THRESHOLD) {
          alerts.push({
            type: "repeated_route",
            severity: "low",
            user_id: data.userId,
            user_type: "rider",
            description: `مسار متكرر: ${data.count} رحلات بنفس النقاط خلال ${LOOKBACK_HOURS} ساعة`,
            details: { route_count: data.count },
          });
        }
      }
    }

    // حفظ التنبيهات في قاعدة البيانات
    if (alerts.length > 0) {
      const rows = alerts.map((a) => ({
        alert_type: a.type,
        severity: a.severity,
        user_id: a.user_id,
        user_type: a.user_type,
        description: a.description,
        details: a.details,
        status: "pending",
      }));

      await supabase.from("fraud_alerts").insert(rows);
    }

    console.log(`[detect-fraud] Found ${alerts.length} alerts`);

    return new Response(
      JSON.stringify({ success: true, alerts_count: alerts.length, alerts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[detect-fraud] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
