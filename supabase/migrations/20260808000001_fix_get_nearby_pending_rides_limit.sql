-- إصلاح دالة get_nearby_pending_rides: تغيير LIMIT 1 إلى LIMIT 5
-- السبب: الكود في RideRequestCard.tsx يأخذ data.slice(0, 5) لكن الدالة ترجع رحلة واحدة فقط

CREATE OR REPLACE FUNCTION public.get_nearby_pending_rides(
  driver_lat double precision,
  driver_lng double precision,
  max_radius_km double precision DEFAULT 10,
  driver_vehicle_type vehicle_type DEFAULT 'economy'::vehicle_type
)
RETURNS SETOF rides
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM rides r
  WHERE r.status = 'pending'
    AND r.driver_id IS NULL
    AND (
      (driver_vehicle_type = 'women_only' AND r.vehicle_type = 'women_only')
      OR
      (driver_vehicle_type = 'economy' AND r.vehicle_type = 'economy')
      OR
      (driver_vehicle_type = 'comfort' AND r.vehicle_type IN ('economy', 'comfort'))
      OR
      (driver_vehicle_type = 'premium' AND r.vehicle_type IN ('economy', 'comfort', 'premium'))
    )
    AND public.calculate_distance(
      driver_lat,
      driver_lng,
      (r.pickup_location->>'lat')::FLOAT,
      (r.pickup_location->>'lng')::FLOAT
    ) <= max_radius_km
  ORDER BY r.created_at ASC
  LIMIT 5;
END;
$function$;
