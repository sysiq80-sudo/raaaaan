-- تحديث دالة get_nearby_pending_rides لتسمح للسائقين بخدمة رحلات من نفس نوعهم أو أقل
-- مثلاً: سائق comfort يمكنه خدمة economy, وسائق premium يمكنه خدمة economy و comfort

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
    -- منطق مطابقة نوع السيارة المحسّن:
    -- السائق يمكنه خدمة رحلات من نفس نوعه أو أقل (بمعنى سيارة أعلى تخدم طلبات أدنى)
    -- economy يخدم economy فقط
    -- comfort يخدم economy + comfort
    -- premium يخدم economy + comfort + premium
    -- women_only يخدم women_only فقط (حالة خاصة)
    AND (
      -- حالة خاصة: التكسي النسائي يخدم فقط طلبات نسائية
      (driver_vehicle_type = 'women_only' AND r.vehicle_type = 'women_only')
      OR
      -- السائق الاقتصادي يخدم طلبات اقتصادية فقط
      (driver_vehicle_type = 'economy' AND r.vehicle_type = 'economy')
      OR
      -- السائق المريح يخدم طلبات اقتصادية ومريحة
      (driver_vehicle_type = 'comfort' AND r.vehicle_type IN ('economy', 'comfort'))
      OR
      -- السائق الفاخر يخدم جميع الطلبات (عدا النسائي)
      (driver_vehicle_type = 'premium' AND r.vehicle_type IN ('economy', 'comfort', 'premium'))
    )
    AND public.calculate_distance(
      driver_lat, 
      driver_lng,
      (r.pickup_location->>'lat')::FLOAT,
      (r.pickup_location->>'lng')::FLOAT
    ) <= max_radius_km
  ORDER BY r.created_at ASC
  LIMIT 1;
END;
$function$;