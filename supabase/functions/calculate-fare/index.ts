import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Point-in-Polygon algorithm (Ray casting)
function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[],
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng,
      yi = polygon[i].lat;
    const xj = polygon[j].lng,
      yj = polygon[j].lat;

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// Haversine formula — المسافة الخطية بين نقطتين بالكيلومتر
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * 0.017453292519943295;
  const dLng = (lng2 - lng1) * 0.017453292519943295;
  const a =
    Math.sin(dLat * 0.5) * Math.sin(dLat * 0.5) +
    Math.cos(lat1 * 0.017453292519943295) *
      Math.cos(lat2 * 0.017453292519943295) *
      Math.sin(dLng * 0.5) * Math.sin(dLng * 0.5);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      distance_km,
      vehicle_type = "economy",
      waiting_minutes = 0,
      driver_id = null, // Optional: for calculating with driver discounts
    } = await req.json();

    // ═══ Input Validation ═══
    // التحقق من أن الإحداثيات ضمن حدود العراق (lat ~29-37, lng ~38-49)
    const IRAQ_BOUNDS = { minLat: 29.0, maxLat: 37.5, minLng: 38.0, maxLng: 49.0 };

    if (
      typeof pickup_lat !== "number" || typeof pickup_lng !== "number" ||
      typeof dropoff_lat !== "number" || typeof dropoff_lng !== "number" ||
      isNaN(pickup_lat) || isNaN(pickup_lng) || isNaN(dropoff_lat) || isNaN(dropoff_lng)
    ) {
      return new Response(
        JSON.stringify({ error: "إحداثيات غير صالحة — يجب أن تكون أرقاماً" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (
      pickup_lat < IRAQ_BOUNDS.minLat || pickup_lat > IRAQ_BOUNDS.maxLat ||
      pickup_lng < IRAQ_BOUNDS.minLng || pickup_lng > IRAQ_BOUNDS.maxLng
    ) {
      return new Response(
        JSON.stringify({ error: "نقطة الانطلاق خارج نطاق الخدمة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (
      dropoff_lat < IRAQ_BOUNDS.minLat || dropoff_lat > IRAQ_BOUNDS.maxLat ||
      dropoff_lng < IRAQ_BOUNDS.minLng || dropoff_lng > IRAQ_BOUNDS.maxLng
    ) {
      return new Response(
        JSON.stringify({ error: "نقطة الوصول خارج نطاق الخدمة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // التحقق من المسافة — الحد الأقصى 500 كم (عبر العراق كاملاً)، الحد الأدنى 0.1 كم
    if (typeof distance_km !== "number" || isNaN(distance_km) || distance_km < 0.1 || distance_km > 500) {
      return new Response(
        JSON.stringify({ error: "المسافة غير صالحة — يجب أن تكون بين 0.1 و 500 كم" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Server-side distance sanity check: مقارنة المسافة المُدخلة بالمسافة الخطية
    const straightLineKm = haversineDistance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng);
    if (distance_km < straightLineKm * 0.8) {
      // المسافة المرسلة أقل من المسافة الخطية — مُحتمل تلاعب
      console.warn(`[calculate-fare] Suspicious distance: client=${distance_km}km, straight=${straightLineKm.toFixed(2)}km`);
      return new Response(
        JSON.stringify({ error: "المسافة غير منطقية — أقل من المسافة الخطية بين النقطتين" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (distance_km > straightLineKm * 5) {
      // المسافة أكثر من 5x المسافة الخطية — مبالغ فيها
      console.warn(`[calculate-fare] Exaggerated distance: client=${distance_km}km, straight=${straightLineKm.toFixed(2)}km`);
      return new Response(
        JSON.stringify({ error: "المسافة المُدخلة مبالغ فيها" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Calculating fare for:", {
      pickup: [pickup_lat, pickup_lng],
      dropoff: [dropoff_lat, dropoff_lng],
      distance_km,
      vehicle_type,
      waiting_minutes,
      driver_id,
    });

    // Fetch fare calculation settings
    const { data: fareSettingsData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "fare_calculation")
      .single();

    const fareSettings = fareSettingsData?.value || {
      service_fee_percentage: 5,
      min_service_fee: 500,
      surge_pricing_enabled: true,
      max_surge_multiplier: 3.0,
      subscription_discounts_enabled: true,
      tier_discounts_enabled: true,
    };

    // Get vehicle type multiplier from database
    const { data: vehicleTypeData } = await supabase
      .from("vehicle_types")
      .select("multiplier, commission_rate, min_fare")
      .eq("id", vehicle_type)
      .eq("is_active", true)
      .single();

    const vehicleMultiplier = vehicleTypeData?.multiplier || 1.0;
    const vehicleMinFare = vehicleTypeData?.min_fare || 2000;

    // Find the region based on pickup location — sort by name for deterministic fallback
    const { data: regions, error: regionsError } = await supabase
      .from("regions")
      .select("*")
      .eq("is_active", true)
      .order("name_ar", { ascending: true });

    if (regionsError) {
      console.error("Error fetching regions:", regionsError);
      throw new Error("Failed to fetch regions");
    }

    console.log("Found regions:", regions?.length || 0);

    // Default pricing if no region found
    let baseFare = 2000;
    let perKmFare = 500;
    let waitingFarePerMin = 100;
    let regionName = "بغداد";
    let regionId = null;

    // Find matching region based on pickup coordinates using Point-in-Polygon
    if (regions && regions.length > 0) {
      let matchedRegion = null;

      for (const region of regions) {
        if (
          region.coordinates &&
          Array.isArray(region.coordinates) &&
          region.coordinates.length >= 3
        ) {
          if (isPointInPolygon(pickup_lat, pickup_lng, region.coordinates)) {
            matchedRegion = region;
            console.log("Pickup is inside region:", region.name_ar);
            break;
          }
        }
      }

      if (!matchedRegion) {
        matchedRegion = regions[0];
        console.log("Using default region:", matchedRegion.name_ar);
      }

      baseFare = matchedRegion.base_fare;
      perKmFare = matchedRegion.per_km_fare;
      waitingFarePerMin = matchedRegion.waiting_fare_per_min;
      regionName = matchedRegion.name_ar;
      regionId = matchedRegion.id;

      console.log("Using region:", regionName, {
        baseFare,
        perKmFare,
        waitingFarePerMin,
      });
    }

    // Check for dynamic surge pricing (NEW)
    let surgeMultiplier = 1.0;
    let surgeName = null;
    let demandLevel = "normal";
    let commissionBonus = 0;

    if (fareSettings.surge_pricing_enabled && regionId) {
      // Call the new calculate_surge_multiplier function
      const { data: surgeData, error: surgeError } = await supabase.rpc(
        "calculate_surge_multiplier",
        {
          p_governorate_id: regionId,
          p_pickup_lat: pickup_lat,
          p_pickup_lng: pickup_lng,
        },
      );

      if (!surgeError && surgeData) {
        surgeMultiplier = Math.min(
          parseFloat(surgeData.multiplier) || 1.0,
          fareSettings.max_surge_multiplier || 2.5,
        );
        surgeName = surgeData.reason;
        demandLevel = surgeData.demand_level;
        console.log(`[Surge] Applied surge pricing:`, {
          multiplier: surgeMultiplier,
          demandLevel,
          activeRides: surgeData.active_rides,
          availableDrivers: surgeData.available_drivers,
        });
      } else {
        console.warn(
          "[Surge] Failed to calculate surge multiplier:",
          surgeError,
        );
      }

      // Also check for legacy surge pricing rules for backward compatibility
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
      const currentDay = currentTime.getDay();

      const { data: surgeRules } = await supabase
        .from("surge_pricing_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (surgeRules && surgeRules.length > 0) {
        for (const rule of surgeRules) {
          // Check if current day is in day_of_week array
          if (rule.day_of_week && rule.day_of_week.includes(currentDay)) {
            // Check if current time is within range
            if (
              currentTimeStr >= rule.start_time &&
              currentTimeStr <= rule.end_time
            ) {
              // Check region if specified
              if (!rule.region_id || rule.region_id === regionId) {
                const legacySurge = Math.min(
                  rule.surge_multiplier,
                  fareSettings.max_surge_multiplier,
                );
                // Use the higher surge multiplier
                if (legacySurge > surgeMultiplier) {
                  surgeMultiplier = legacySurge;
                  surgeName = rule.name_ar;
                  commissionBonus = rule.commission_bonus || 0;
                }
                console.log(
                  "[LegacySurge] Applied surge pricing:",
                  surgeName,
                  "x",
                  surgeMultiplier,
                );
                break;
              }
            }
          }
        }
      }
    }

    // Calculate fare components
    const distanceFare = Math.round(distance_km * perKmFare);
    const waitingFare = Math.round(waiting_minutes * waitingFarePerMin);
    const subtotal = baseFare + distanceFare + waitingFare;

    // Apply vehicle multiplier
    let vehicleAdjustedFare = Math.round(subtotal * vehicleMultiplier);

    // Apply surge multiplier
    const surgeAdjustedFare = Math.round(vehicleAdjustedFare * surgeMultiplier);

    // Ensure minimum fare
    const fareAfterMin = Math.max(surgeAdjustedFare, vehicleMinFare);

    // Calculate service fee
    const serviceFeePercent = fareSettings.service_fee_percentage || 5;
    const minServiceFee = fareSettings.min_service_fee || 500;
    const serviceFee = Math.max(
      minServiceFee,
      Math.round((fareAfterMin * serviceFeePercent) / 100),
    );

    const totalFare = fareAfterMin + serviceFee;

    // Build fare breakdown
    const fareBreakdown: Record<string, unknown> = {
      base_fare: baseFare,
      distance_km: Math.round(distance_km * 100) / 100,
      distance_fare: distanceFare,
      per_km_rate: perKmFare,
      waiting_minutes: waiting_minutes,
      waiting_fare: waitingFare,
      waiting_rate_per_min: waitingFarePerMin,
      vehicle_type: vehicle_type,
      vehicle_multiplier: vehicleMultiplier,
      subtotal: subtotal,
      vehicle_adjusted_fare: vehicleAdjustedFare,
      surge_multiplier: surgeMultiplier,
      surge_name: surgeName,
      demand_level: demandLevel,
      surge_adjusted_fare: surgeAdjustedFare,
      commission_bonus: commissionBonus,
      min_fare_applied: surgeAdjustedFare < vehicleMinFare,
      vehicle_min_fare: vehicleMinFare,
      fare_after_min: fareAfterMin,
      service_fee_percentage: serviceFeePercent,
      service_fee: serviceFee,
      total_fare: totalFare,
      region_id: regionId,
      region_name: regionName,
      currency: "IQD",
      formatted_fare: `${totalFare.toLocaleString("ar-IQ")} د.ع`,
      is_surge: surgeMultiplier > 1,
    };

    // If driver_id provided, calculate driver-specific info (subscription & tier discounts)
    if (driver_id) {
      let subscriptionDiscount = 0;
      let tierDiscount = 0;
      let subscriptionName = null;
      let tierName = null;
      let tierBadge = null;

      // Check for active subscription
      if (fareSettings.subscription_discounts_enabled) {
        const { data: subscriptions } = await supabase
          .from("driver_subscriptions")
          .select("id, expires_at, plan_id")
          .eq("driver_id", driver_id)
          .eq("status", "active")
          .gte("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1);

        if (subscriptions && subscriptions.length > 0) {
          const sub = subscriptions[0];
          // Fetch plan details separately
          const { data: plan } = await supabase
            .from("subscription_plans")
            .select("name_ar, commission_discount")
            .eq("id", sub.plan_id)
            .single();

          if (plan) {
            subscriptionDiscount = plan.commission_discount;
            subscriptionName = plan.name_ar;
            console.log(
              "Subscription discount applied:",
              subscriptionName,
              subscriptionDiscount + "%",
            );
          }
        }
      }

      // Check for tier discount
      if (fareSettings.tier_discounts_enabled) {
        // Get monthly rides count
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: monthlyRides } = await supabase
          .from("rides")
          .select("*", { count: "exact", head: true })
          .eq("driver_id", driver_id)
          .eq("status", "completed")
          .gte("completed_at", startOfMonth.toISOString());

        // Get driver rating
        const { data: driver } = await supabase
          .from("drivers")
          .select("rating")
          .eq("id", driver_id)
          .single();

        const driverRating = driver?.rating || 5.0;

        // Find matching tier
        const { data: tiers } = await supabase
          .from("commission_tiers")
          .select("*")
          .eq("is_active", true)
          .lte("min_rides_monthly", monthlyRides || 0)
          .lte("min_rating", driverRating)
          .order("priority", { ascending: false })
          .limit(1);

        if (tiers && tiers.length > 0) {
          const tier = tiers[0];
          tierDiscount = tier.commission_discount;
          tierName = tier.name_ar;
          tierBadge = tier.badge_icon;
          console.log("Tier discount applied:", tierName, tierDiscount + "%");
        }
      }

      fareBreakdown.driver_id = driver_id;
      fareBreakdown.subscription_discount = subscriptionDiscount;
      fareBreakdown.subscription_name = subscriptionName;
      fareBreakdown.tier_discount = tierDiscount;
      fareBreakdown.tier_name = tierName;
      fareBreakdown.tier_badge = tierBadge;
      fareBreakdown.total_commission_discount =
        subscriptionDiscount + tierDiscount;
    }

    console.log("Fare calculated:", fareBreakdown);

    return new Response(JSON.stringify(fareBreakdown), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error calculating fare:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
