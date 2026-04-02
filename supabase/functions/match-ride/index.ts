import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { haversineDistance, calculateETA, corsHeaders, getAuthUser, jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/utils.ts";

// ═══ Defaults (overridden by app_settings.matching_settings) ═══
const DEFAULT_MAX_RETRY_ROUNDS = 5;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const DEFAULT_RADIUS_EXPANSION_KM = 3;
const DEFAULT_MATCHING_MODE = "hybrid"; // "sequential" | "broadcast" | "hybrid"
const DEFAULT_MAX_DRIVERS_NOTIFY = 5;
const DEFAULT_SEQUENTIAL_DELAY_MS = 8000;
const DEFAULT_FAIRNESS_WEIGHT = 0.1; // وزن التوزيع العادل في المعادلة

// إعدادات المطابقة - تُقرأ من app_settings
interface MatchingConfig {
  matching_mode: "sequential" | "broadcast" | "hybrid";
  max_retry_rounds: number;
  retry_delay_ms: number;
  radius_expansion_km: number;
  max_drivers_notify: number;
  sequential_delay_ms: number;
  fairness_weight: number;
}

async function getMatchingConfig(supabase: any): Promise<MatchingConfig> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "matching_settings")
      .maybeSingle();
    const v = data?.value || {};
    return {
      matching_mode: v.matching_mode || DEFAULT_MATCHING_MODE,
      max_retry_rounds: v.max_retry_rounds ?? DEFAULT_MAX_RETRY_ROUNDS,
      retry_delay_ms: v.retry_delay_ms ?? DEFAULT_RETRY_DELAY_MS,
      radius_expansion_km: v.radius_expansion_km ?? DEFAULT_RADIUS_EXPANSION_KM,
      max_drivers_notify: v.max_drivers_notify ?? DEFAULT_MAX_DRIVERS_NOTIFY,
      sequential_delay_ms: v.sequential_delay_ms ?? DEFAULT_SEQUENTIAL_DELAY_MS,
      fairness_weight: v.fairness_weight ?? DEFAULT_FAIRNESS_WEIGHT,
    };
  } catch {
    return {
      matching_mode: DEFAULT_MATCHING_MODE,
      max_retry_rounds: DEFAULT_MAX_RETRY_ROUNDS,
      retry_delay_ms: DEFAULT_RETRY_DELAY_MS,
      radius_expansion_km: DEFAULT_RADIUS_EXPANSION_KM,
      max_drivers_notify: DEFAULT_MAX_DRIVERS_NOTIFY,
      sequential_delay_ms: DEFAULT_SEQUENTIAL_DELAY_MS,
      fairness_weight: DEFAULT_FAIRNESS_WEIGHT,
    };
  }
}

// Vehicle type compatibility - which drivers can serve which rides
function isVehicleTypeCompatible(
  driverType: string,
  rideType: string,
  preferWomenDriver: boolean,
): boolean {
  // إذا كان العميل يفضّل سائقة، لا نقبل إلا women_only
  if (preferWomenDriver) return driverType === "women_only";

  // Women only is exclusive
  if (rideType === "women_only") return driverType === "women_only";
  if (driverType === "women_only") return false;

  // Higher tier can serve lower tier
  const tiers: Record<string, number> = { economy: 1, comfort: 2, premium: 3 };
  return (tiers[driverType] || 1) >= (tiers[rideType] || 1);
}

serve(async (req) => {
  const startTime = performance.now();

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // التحقق من المستخدم — مطلوب بعد تفعيل JWT
    const caller = await getAuthUser(req);
    if (!caller) {
      return errorResponse("غير مصرّح: يجب تسجيل الدخول", 401);
    }

    const body = await req.json();
    const rideId = body.rideId;
    const isReMatch = body.re_match === true;

    if (!rideId) {
      throw new Error("رقم الرحلة مطلوب");
    }

    // ═══════════════════════════════════
    // 🛡️ حد الرحلات النشطة — من إعدادات الأمان
    // ═══════════════════════════════════
    try {
      const { data: secConf } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "security_settings")
        .maybeSingle();

      const maxActive = (secConf?.value as any)?.max_active_rides_per_user ?? 3;

      const { count } = await supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("rider_id", caller.id)
        .in("status", ["pending", "accepted", "in_progress"]);

      if (count !== null && count >= maxActive) {
        return errorResponse(
          `لديك ${count} رحلات نشطة بالفعل — الحد الأقصى ${maxActive}`,
          429
        );
      }
    } catch (e) {
      console.warn("[match-ride] ⚠️ Failed to check ride limit, continuing:", e);
    }

    console.log("🔍 بدء مطابقة الرحلة:", rideId);

    // 1. جلب تفاصيل الرحلة
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideError || !ride) {
      throw new Error("الرحلة غير موجودة");
    }

    // التحقق من أن المتصل هو صاحب الرحلة
    if (ride.rider_id !== caller.id) {
      // التحقق من أنه مدير (admin)
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!adminRole) {
        return errorResponse("غير مصرّح: لا يمكنك مطابقة رحلة ليست لك", 403);
      }
    }

    // التحقق من حالة الرحلة
    if (ride.status !== "pending") {
      console.log("⚠️ الرحلة ليست في حالة انتظار:", ride.status);
      return new Response(
        JSON.stringify({
          success: false,
          message: "الرحلة ليست في حالة انتظار",
          status: ride.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // منع الحجز الذاتي - سنستبعد السائق/الراكب من نتائج المطابقة لاحقاً
    // بدلاً من منع الراكب الذي هو سائق أيضاً من الحجز بالكامل
    const { data: riderAsDriver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", ride.rider_id)
      .maybeSingle();

    // 2. تحميل إعدادات المطابقة
    const matchConfig = await getMatchingConfig(supabase);
    console.log(`⚙️ Matching mode: ${matchConfig.matching_mode}, max notify: ${matchConfig.max_drivers_notify}`);

    // 3. البحث عن السائقين المتاحين - Optimized query
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select(
        "id, user_id, full_name, vehicle_type, current_location, rating, total_rides, max_pickup_radius",
      )
      .eq("is_online", true)
      .eq("is_available", true)
      .eq("status", "approved")
      .not("current_location", "is", null);

    if (driversError) {
      console.error("❌ خطأ في جلب السائقين:", driversError);
      throw new Error("فشل في جلب السائقين");
    }

    // استبعاد السائق الذي هو نفسه الراكب (منع الحجز الذاتي)
    let availableDrivers = drivers || [];
    if (riderAsDriver) {
      availableDrivers = availableDrivers.filter(
        (d: any) => d.id !== riderAsDriver.id
      );
      console.log(`🚫 استبعاد السائق/الراكب ${riderAsDriver.id} من المطابقة`);
    }

    console.log(`👥 عدد السائقين المتصلين: ${availableDrivers.length}`);

    if (!availableDrivers || availableDrivers.length === 0) {
      const noDriverAttempt = (ride.matching_attempts || 0) + 1;
      await supabase
        .from("rides")
        .update({
          matching_attempts: noDriverAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      // ═══ جدولة إعادة محاولة حتى مع عدم وجود سائقين ═══
      // ربما يتصل سائقون جدد قريباً
      if (noDriverAttempt < matchConfig.max_retry_rounds) {
        const retryEmpty = async () => {
          await new Promise((resolve) => setTimeout(resolve, matchConfig.retry_delay_ms));
          const { data: currentRide } = await supabase
            .from("rides")
            .select("status")
            .eq("id", rideId)
            .single();
          if (currentRide?.status !== "pending") return;

          console.log(`[match-ride] 🔄 Retry (no online drivers) round ${noDriverAttempt + 1}/${matchConfig.max_retry_rounds}`);
          try {
            await supabase.functions.invoke("match-ride", {
              body: { rideId },
              headers: { Authorization: req.headers.get("Authorization") || "" },
            });
          } catch (e) {
            console.error("[match-ride] Retry invocation failed:", e);
          }
        };
        retryEmpty().catch((e) => console.error("[match-ride] Retry error:", e));
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: "لا يوجد سائقين متاحين حالياً — سيتم إعادة المحاولة",
          drivers_count: 0,
          retry_scheduled: noDriverAttempt < matchConfig.max_retry_rounds,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. حساب المسافة لكل سائق وترتيبهم - Optimized
    const pickupLoc = ride.pickup_location as { lat: number; lng: number };
    let alreadyNotified = new Set((ride.notified_drivers || []) as string[]);
    const radiusBonus = (ride.metadata as any)?.radius_bonus_km || 0;

    // ═══ إعادة المطابقة: تنظيف السائقين الرافضين من القائمة ═══
    // عند إعادة المطابقة، نحذف السائقين الذين رفضوا/انتهت مهلتهم من notified_drivers
    // هذا يسمح بإعادة إرسال إشعارات لهم (ربما تغيرت ظروفهم)
    if (isReMatch && alreadyNotified.size > 0) {
      try {
        const { data: rejectedLogs } = await supabase
          .from("ride_matching_log")
          .select("driver_id")
          .eq("ride_id", rideId)
          .in("response", ["rejected", "timeout"]);

        if (rejectedLogs && rejectedLogs.length > 0) {
          const rejectedIds = new Set(rejectedLogs.map((l: any) => l.driver_id));
          // حذف الرافضين من القائمة لإعادة إشعارهم
          const filteredNotified = Array.from(alreadyNotified).filter(id => !rejectedIds.has(id));
          alreadyNotified = new Set(filteredNotified);

          console.log(`[match-ride] 🔄 Re-match: cleared ${rejectedIds.size} rejected/timed-out drivers from notified list`);

          // تحديث قاعدة البيانات
          await supabase
            .from("rides")
            .update({ notified_drivers: filteredNotified })
            .eq("id", rideId);
        }
      } catch (e) {
        console.warn("[match-ride] ⚠️ Failed to clear rejected drivers:", e);
      }
    }

    // ═══ التوزيع العادل: جلب عدد رحلات اليوم لكل سائق ═══
    const todayRideCounts: Record<string, number> = {};
    if (matchConfig.fairness_weight > 0) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const eligibleIds = availableDrivers
          .filter((d) => !alreadyNotified.has(d.id))
          .map((d) => d.id);
        if (eligibleIds.length > 0) {
          const { data: rideCounts } = await supabase
            .from("rides")
            .select("driver_id")
            .in("driver_id", eligibleIds)
            .eq("status", "completed")
            .gte("created_at", todayStart.toISOString());
          if (rideCounts) {
            for (const r of rideCounts) {
              todayRideCounts[r.driver_id] = (todayRideCounts[r.driver_id] || 0) + 1;
            }
          }
        }
      } catch (e) {
        console.warn("[match-ride] ⚠️ Failed to fetch fairness data:", e);
      }
    }

    const driversWithDistance = availableDrivers
      .filter((driver) => {
        // Filter by vehicle type compatibility + تفضيل السائقة
        if (
          !isVehicleTypeCompatible(
            driver.vehicle_type,
            ride.vehicle_type,
            !!ride.prefer_women_driver,
          )
        )
          return false;
        // Skip already notified drivers
        if (alreadyNotified.has(driver.id)) return false;
        return true;
      })
      .map((driver) => {
        const driverLoc = driver.current_location as {
          lat: number;
          lng: number;
        };
        const distance = haversineDistance(
          pickupLoc.lat,
          pickupLoc.lng,
          driverLoc.lat,
          driverLoc.lng,
        );
        const eta = calculateETA(distance);
        const maxRadius =
          (driver.max_pickup_radius || 10) + (ride.high_priority ? 5 : 0) + radiusBonus;

        // Weighted dispatch: distance + rating + fairness + experience tie-breaker
        const normalizedDistance = Math.max(0, 1 - distance / maxRadius);
        const normalizedRating = Math.min(5, driver.rating || 5.0) / 5;
        const fw = matchConfig.fairness_weight;
        const distanceWeight = 0.7 * (1 - fw);
        const ratingWeight = 0.3 * (1 - fw);
        const experienceBonus = Math.min(
          0.05,
          (driver.total_rides || 0) / 1000,
        );
        // التوزيع العادل: تقليل أولوية السائقين الذين أكملوا رحلات كثيرة اليوم
        const driverTodayRides = todayRideCounts[driver.id] || 0;
        const fairnessScore = Math.max(0, 1 - driverTodayRides / 20); // 20 رحلة = صفر عدالة
        const weightedScore =
          normalizedDistance * distanceWeight +
          normalizedRating * ratingWeight +
          fairnessScore * fw +
          experienceBonus;
        const priorityScore = Math.round(weightedScore * 100);

        return {
          ...driver,
          distance_km: Math.round(distance * 100) / 100,
          eta_minutes: eta,
          priority_score: Math.round(priorityScore),
          max_radius: maxRadius,
        };
      })
      .filter((driver) => driver.distance_km <= driver.max_radius)
      .sort((a, b) => b.priority_score - a.priority_score);

    console.log(`🎯 السائقين المؤهلين: ${driversWithDistance.length}`);

    if (driversWithDistance.length === 0) {
      const currentAttemptZero = (ride.matching_attempts || 0) + 1;

      // تحديث عداد المحاولات
      await supabase
        .from("rides")
        .update({
          matching_attempts: currentAttemptZero,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      // ═══ جدولة إعادة محاولة حتى مع 0 سائقين جدد ═══
      // الرحلة تبقى pending — ربما يتصل سائقون جدد قريباً
      if (currentAttemptZero < matchConfig.max_retry_rounds) {
        const retryNoDrivers = async () => {
          await new Promise((resolve) => setTimeout(resolve, matchConfig.retry_delay_ms));
          const { data: currentRide } = await supabase
            .from("rides")
            .select("status")
            .eq("id", rideId)
            .single();
          if (currentRide?.status !== "pending") return;

          console.log(`[match-ride] 🔄 Retry (no compatible drivers) round ${currentAttemptZero + 1}/${matchConfig.max_retry_rounds}`);
          await supabase
            .from("rides")
            .update({
              metadata: {
                ...(ride.metadata || {}),
                radius_bonus_km: matchConfig.radius_expansion_km * currentAttemptZero,
              },
            })
            .eq("id", rideId);

          try {
            await supabase.functions.invoke("match-ride", {
              body: { rideId },
              headers: { Authorization: req.headers.get("Authorization") || "" },
            });
          } catch (e) {
            console.error("[match-ride] Retry invocation failed:", e);
          }
        };
        retryNoDrivers().catch((e) => console.error("[match-ride] Retry error:", e));
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: "لا يوجد سائقين قريبين متوافقين — سيتم إعادة المحاولة",
          drivers_count: 0,
          already_notified: alreadyNotified.size,
          retry_scheduled: currentAttemptZero < matchConfig.max_retry_rounds,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. اختيار أفضل السائقين لإرسال الإشعارات
    const maxDrivers = ride.high_priority
      ? Math.max(matchConfig.max_drivers_notify, 10)
      : matchConfig.max_drivers_notify;
    const topDrivers = driversWithDistance.slice(0, maxDrivers);

    console.log(
      "🏆 أفضل السائقين:",
      topDrivers.map((d) => ({
        name: d.full_name,
        distance: d.distance_km,
        eta: d.eta_minutes,
        score: d.priority_score,
        vehicle: d.vehicle_type,
      })),
    );

    // 5. تسجيل محاولات المطابقة - Batch insert
    const matchingLogs = topDrivers.map((driver) => ({
      ride_id: rideId,
      driver_id: driver.id,
      distance_km: driver.distance_km,
      priority_score: driver.priority_score,
      notified_at: new Date().toISOString(),
      response: null,
      responded_at: null,
    }));

    await supabase.from("ride_matching_log").insert(matchingLogs);

    // 6. تحديث الرحلة بالسائقين المُشعرين
    const allNotifiedDrivers = [
      ...Array.from(alreadyNotified),
      ...topDrivers.map((d) => d.id),
    ];
    await supabase
      .from("rides")
      .update({
        notified_drivers: allNotifiedDrivers,
        matching_attempts: (ride.matching_attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rideId);

    // 7. إرسال الإشعارات للسائقين حسب وضع المطابقة
    const notificationPromises = topDrivers.map(async (driver, index) => {
      try {
        // حساب التأخير حسب وضع المطابقة
        let delay = 0;
        if (matchConfig.matching_mode === "sequential") {
          // تتابعي: كل سائق بعد فترة
          const baseDelay = ride.high_priority
            ? Math.round(matchConfig.sequential_delay_ms / 2)
            : matchConfig.sequential_delay_ms;
          delay = index * baseDelay;
        } else if (matchConfig.matching_mode === "hybrid") {
          // هجين: أول 3 فوراً، الباقي تتابعي
          const instantBatch = Math.min(3, topDrivers.length);
          if (index >= instantBatch) {
            const baseDelay = ride.high_priority
              ? Math.round(matchConfig.sequential_delay_ms / 2)
              : matchConfig.sequential_delay_ms;
            delay = (index - instantBatch) * baseDelay;
          }
        }
        // broadcast: delay = 0 (الكل فوراً)

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // التحقق من أن الرحلة لا تزال متاحة
        const { data: currentRide } = await supabase
          .from("rides")
          .select("status")
          .eq("id", rideId)
          .single();

        if (currentRide?.status !== "pending") {
          console.log(`⏭️ تخطي السائق ${driver.full_name} - الرحلة تم قبولها`);
          return { success: false, reason: "ride_accepted" };
        }

        // إرسال الإشعار — notify_driver + service role / internal secret
        const edgeSecret = Deno.env.get("INTERNAL_EDGE_SECRET");
        const { error: notifError } = await supabase.functions.invoke(
          "send-push-notification",
          {
            headers: edgeSecret
              ? { "x-internal-secret": edgeSecret }
              : undefined,
            body: {
              action: "notify_driver",
              driver_id: driver.id,
              title: "🚗 طلب رحلة جديد!",
              body: `على بعد ${driver.distance_km} كم • ${
                ride.estimated_fare?.toLocaleString() || 0
              } د.ع`,
              data: {
                type: "NEW_RIDE_REQUEST",
                ride_id: rideId,
                distance: driver.distance_km,
                eta_minutes: driver.eta_minutes,
                estimated_fare: ride.estimated_fare,
                pickup_address: ride.pickup_address,
                dropoff_address: ride.dropoff_address,
                vehicle_type: ride.vehicle_type,
                priority: index + 1,
              },
            },
          },
        );

        if (notifError) {
          console.error(
            `❌ فشل إرسال الإشعار للسائق ${driver.full_name}:`,
            notifError,
          );
          return { success: false, error: notifError };
        }

        console.log(
          `✅ إشعار للسائق ${driver.full_name} (${index + 1}/${
            topDrivers.length
          })`,
        );
        return { success: true, driver_id: driver.id };
      } catch (error) {
        console.error(`❌ خطأ في إرسال الإشعار:`, error);
        return { success: false, error };
      }
    });

    const notificationResults = await Promise.all(notificationPromises);
    const successCount = notificationResults.filter((r) => r.success).length;

    // ═══ 8. Schedule progressive re-matching retry ═══
    // If we haven't exhausted all retry rounds and there might be more drivers
    const currentAttempt = (ride.matching_attempts || 0) + 1;
    let retryScheduled = false;

    if (currentAttempt < matchConfig.max_retry_rounds) {
      // Schedule a delayed retry invocation to expand search
      const retryFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, matchConfig.retry_delay_ms));

        // Re-check ride is still pending
        const { data: currentRide } = await supabase
          .from("rides")
          .select("status")
          .eq("id", rideId)
          .single();

        if (currentRide?.status !== "pending") {
          console.log(`[match-ride] ⏭️ Retry skipped — ride ${rideId} is now ${currentRide?.status}`);
          return;
        }

        // Invoke self for next round (with expanded radius bonus)
        console.log(`[match-ride] 🔄 Retry round ${currentAttempt + 1}/${matchConfig.max_retry_rounds} for ride ${rideId} (+${matchConfig.radius_expansion_km * currentAttempt}km radius)`);

        // Update ride with radius expansion hint
        await supabase
          .from("rides")
          .update({
            metadata: {
              ...(ride.metadata || {}),
              radius_bonus_km: matchConfig.radius_expansion_km * currentAttempt,
            },
          })
          .eq("id", rideId);

        try {
          await supabase.functions.invoke("match-ride", {
            body: { rideId },
            headers: { Authorization: req.headers.get("Authorization") || "" },
          });
        } catch (e) {
          console.error(`[match-ride] Retry invocation failed:`, e);
        }
      };

      // Fire and forget — don't block the response
      retryFn().catch((e) => console.error("[match-ride] Retry error:", e));
      retryScheduled = true;
    }

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    console.log(
      `📨 تم إرسال ${successCount}/${topDrivers.length} إشعار (${processingTime}ms) | retry=${retryScheduled}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "تم مطابقة الرحلة بنجاح",
        ride_id: rideId,
        drivers_notified: successCount,
        total_drivers: topDrivers.length,
        already_notified: alreadyNotified.size,
        matching_attempt: currentAttempt,
        retry_scheduled: retryScheduled,
        radius_bonus_km: radiusBonus,
        processing_time_ms: processingTime,
        top_drivers: topDrivers.map((d) => ({
          id: d.id,
          name: d.full_name,
          distance_km: d.distance_km,
          eta_minutes: d.eta_minutes,
          rating: d.rating,
          vehicle_type: d.vehicle_type,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ خطأ في مطابقة الرحلة:", error);
    const errorMessage =
      error instanceof Error ? error.message : "خطأ غير معروف";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
