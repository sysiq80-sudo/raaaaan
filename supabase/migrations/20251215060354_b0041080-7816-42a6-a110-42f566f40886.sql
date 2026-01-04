-- إصلاح Security Definer View بتحويلها إلى Security Invoker
DROP VIEW IF EXISTS public.drivers_with_email;

CREATE VIEW public.drivers_with_email 
WITH (security_invoker = true) AS
SELECT 
  d.id,
  d.user_id,
  d.full_name,
  d.phone,
  d.email as user_email,
  d.vehicle_type,
  d.vehicle_model,
  d.vehicle_plate,
  d.vehicle_color,
  d.license_number,
  d.license_image_url,
  d.id_image_url,
  d.status,
  d.is_online,
  d.is_available,
  d.current_location,
  d.rating,
  d.total_rides,
  d.total_earnings,
  d.working_region_id,
  d.max_pickup_radius,
  d.admin_controlled,
  d.admin_activated,
  d.created_at,
  d.updated_at
FROM public.drivers d;

-- إصلاح ride_matching_stats view أيضاً
DROP VIEW IF EXISTS public.ride_matching_stats;

CREATE VIEW public.ride_matching_stats
WITH (security_invoker = true) AS
SELECT 
  r.id as ride_id,
  r.status,
  r.vehicle_type,
  r.created_at,
  r.matched_at,
  r.matching_attempts,
  COUNT(rml.id) as drivers_notified,
  COUNT(CASE WHEN rml.response = 'accepted' THEN 1 END) as drivers_accepted,
  COUNT(CASE WHEN rml.response = 'rejected' THEN 1 END) as drivers_rejected,
  COUNT(CASE WHEN rml.response IS NULL AND rml.responded_at IS NULL THEN 1 END) as drivers_timeout,
  ROUND(AVG(rml.distance_km)::numeric, 2) as avg_driver_distance,
  ROUND(MIN(rml.distance_km)::numeric, 2) as nearest_driver_distance
FROM public.rides r
LEFT JOIN public.ride_matching_log rml ON r.id = rml.ride_id
GROUP BY r.id, r.status, r.vehicle_type, r.created_at, r.matched_at, r.matching_attempts;