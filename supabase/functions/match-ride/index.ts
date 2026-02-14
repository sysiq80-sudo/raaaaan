import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// حساب المسافة بين نقطتين (Haversine formula) - Optimized
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = (lat2 - lat1) * 0.017453292519943295; // Math.PI / 180
  const dLng = (lng2 - lng1) * 0.017453292519943295;

  const a =
    Math.sin(dLat * 0.5) * Math.sin(dLat * 0.5) +
    Math.cos(lat1 * 0.017453292519943295) *
      Math.cos(lat2 * 0.017453292519943295) *
      Math.sin(dLng * 0.5) *
      Math.sin(dLng * 0.5);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// حساب وقت الوصول المتوقع (بالدقائق) مع مراعاة الوقت
function calculateETA(distanceKm: number): number {
  const hour = new Date().getHours();
  // Rush hours: 7-9 AM and 4-7 PM - slower speed
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  const avgSpeedKmh = isRushHour ? 25 : 40;
  return Math.round((distanceKm / avgSpeedKmh) * 60);
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { rideId } = await req.json();

    if (!rideId) {
      throw new Error("رقم الرحلة مطلوب");
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

    // 2. البحث عن السائقين المتاحين - Optimized query
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

    console.log(`👥 عدد السائقين المتصلين: ${drivers?.length || 0}`);

    if (!drivers || drivers.length === 0) {
      await supabase
        .from("rides")
        .update({
          matching_attempts: (ride.matching_attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      return new Response(
        JSON.stringify({
          success: false,
          message: "لا يوجد سائقين متاحين حالياً",
          drivers_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. حساب المسافة لكل سائق وترتيبهم - Optimized
    const pickupLoc = ride.pickup_location as { lat: number; lng: number };
    const alreadyNotified = new Set((ride.notified_drivers || []) as string[]);

    const driversWithDistance = drivers
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
        const distance = calculateDistance(
          pickupLoc.lat,
          pickupLoc.lng,
          driverLoc.lat,
          driverLoc.lng,
        );
        const eta = calculateETA(distance);
        const maxRadius =
          (driver.max_pickup_radius || 10) + (ride.high_priority ? 5 : 0);

        // Weighted dispatch: distance + rating (primary) with a small experience tie-breaker
        const normalizedDistance = Math.max(0, 1 - distance / maxRadius);
        const normalizedRating = Math.min(5, driver.rating || 5.0) / 5;
        const distanceWeight = 0.7;
        const ratingWeight = 0.3;
        const experienceBonus = Math.min(
          0.05,
          (driver.total_rides || 0) / 1000,
        );
        const weightedScore =
          normalizedDistance * distanceWeight +
          normalizedRating * ratingWeight +
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
      return new Response(
        JSON.stringify({
          success: false,
          message: "لا يوجد سائقين قريبين متوافقين",
          drivers_count: 0,
          already_notified: alreadyNotified.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. اختيار أفضل السائقين لإرسال الإشعارات
    const maxDrivers = ride.high_priority ? 10 : 5;
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

    // 7. إرسال الإشعارات للسائقين بالتوازي مع تأخير تدريجي
    const notificationPromises = topDrivers.map(async (driver, index) => {
      try {
        // تأخير تدريجي: السائق الأول فوراً، ثم بفواصل أسرع للطلبات العاجلة
        const baseDelay = ride.high_priority ? 4000 : 8000;
        const delay = index * baseDelay;

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

        // إرسال الإشعار مع نوع محدد للإشعارات الذكية
        const { error: notifError } = await supabase.functions.invoke(
          "send-push-notification",
          {
            body: {
              user_id: driver.user_id,
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

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    console.log(
      `📨 تم إرسال ${successCount}/${topDrivers.length} إشعار (${processingTime}ms)`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "تم مطابقة الرحلة بنجاح",
        ride_id: rideId,
        drivers_notified: successCount,
        total_drivers: topDrivers.length,
        already_notified: alreadyNotified.size,
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
