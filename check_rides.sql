-- فحص الطلبات المعلقة
SELECT 
  id,
  status,
  vehicle_type,
  pickup_location,
  pickup_address,
  driver_id,
  created_at,
  -- حساب المسافة من موقع السائق (36.2181, 44.1478)
  public.calculate_distance(
    36.2181, 
    44.1478,
    (pickup_location->>'lat')::FLOAT,
    (pickup_location->>'lng')::FLOAT
  ) as distance_km
FROM rides
WHERE status = 'pending'
  AND driver_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- اختبار دالة get_nearby_pending_rides مباشرة
SELECT * FROM public.get_nearby_pending_rides(
  36.2181,  -- driver_lat
  44.1478,  -- driver_lng
  30,       -- max_radius_km
  'economy' -- driver_vehicle_type
);

-- فحص بيانات السائق
SELECT 
  id,
  full_name,
  phone,
  status,
  is_online,
  is_available,
  vehicle_type,
  max_pickup_radius,
  current_location,
  admin_activated
FROM drivers
WHERE phone = '07734166402'
LIMIT 1;
