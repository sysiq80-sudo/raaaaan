-- Fix Security Definer Views by converting them to SECURITY INVOKER
-- This ensures views respect RLS policies of the querying user

-- 1. Drop and recreate available_drivers_safe view with SECURITY INVOKER
DROP VIEW IF EXISTS public.available_drivers_safe;
CREATE VIEW public.available_drivers_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  vehicle_type,
  rating,
  vehicle_model,
  vehicle_color,
  current_location,
  working_region_id,
  is_available,
  is_online
FROM public.drivers
WHERE status = 'approved' 
  AND is_online = true;

-- Add comment explaining the view
COMMENT ON VIEW public.available_drivers_safe IS 'Safe view of available drivers - excludes sensitive PII like phone, license, email';

-- 2. Drop and recreate drivers_with_email view with SECURITY INVOKER
DROP VIEW IF EXISTS public.drivers_with_email;
CREATE VIEW public.drivers_with_email
WITH (security_invoker = true)
AS
SELECT 
  d.id,
  d.user_id,
  d.full_name,
  d.phone,
  d.vehicle_type,
  d.vehicle_model,
  d.vehicle_color,
  d.vehicle_plate,
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
  d.updated_at,
  u.email as user_email
FROM public.drivers d
LEFT JOIN auth.users u ON d.user_id = u.id;

COMMENT ON VIEW public.drivers_with_email IS 'Admin-only view of drivers with email - protected by RLS on drivers table';

-- 3. Drop and recreate referral_stats view with SECURITY INVOKER
DROP VIEW IF EXISTS public.referral_stats;
CREATE VIEW public.referral_stats
WITH (security_invoker = true)
AS
SELECT 
  rc.user_id,
  rc.code,
  COALESCE(rc.usage_count, 0) as total_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'pending') as pending_referrals,
  COUNT(r.id) FILTER (WHERE r.status = 'completed') as completed_referrals,
  COALESCE(SUM(r.referrer_reward) FILTER (WHERE r.status = 'completed'), 0) as total_earned
FROM public.referral_codes rc
LEFT JOIN public.referrals r ON r.referral_code = rc.code
GROUP BY rc.user_id, rc.code, rc.usage_count;

COMMENT ON VIEW public.referral_stats IS 'Referral statistics per user - protected by RLS on referral_codes table';

-- 4. Drop and recreate api_usage_daily_stats view with SECURITY INVOKER
DROP VIEW IF EXISTS public.api_usage_daily_stats;
CREATE VIEW public.api_usage_daily_stats
WITH (security_invoker = true)
AS
SELECT 
  date,
  api_type,
  SUM(request_count) as total_requests,
  SUM(estimated_cost) as total_cost
FROM public.api_usage_logs
GROUP BY date, api_type;

COMMENT ON VIEW public.api_usage_daily_stats IS 'Daily API usage statistics - protected by RLS on api_usage_logs table';

-- 5. Drop and recreate company_earnings_daily_stats view with SECURITY INVOKER
DROP VIEW IF EXISTS public.company_earnings_daily_stats;
CREATE VIEW public.company_earnings_daily_stats
WITH (security_invoker = true)
AS
SELECT 
  date,
  COUNT(*) as total_rides,
  SUM(total_fare) as total_fares,
  SUM(commission_amount) as total_commission,
  SUM(driver_share) as total_driver_share,
  AVG(commission_rate) as avg_commission_rate
FROM public.company_earnings
GROUP BY date;

COMMENT ON VIEW public.company_earnings_daily_stats IS 'Daily company earnings statistics - protected by RLS on company_earnings table';

-- 6. Check if ride_matching_stats exists and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.ride_matching_stats;
CREATE VIEW public.ride_matching_stats
WITH (security_invoker = true)
AS
SELECT 
  r.id as ride_id,
  r.status,
  r.created_at,
  r.matched_at,
  EXTRACT(EPOCH FROM (r.matched_at - r.created_at)) as matching_duration_seconds,
  COUNT(rml.id) as drivers_notified,
  COUNT(rml.id) FILTER (WHERE rml.response = 'accepted') as drivers_accepted,
  COUNT(rml.id) FILTER (WHERE rml.response = 'rejected') as drivers_rejected
FROM public.rides r
LEFT JOIN public.ride_matching_log rml ON r.id = rml.ride_id
GROUP BY r.id, r.status, r.created_at, r.matched_at;

COMMENT ON VIEW public.ride_matching_stats IS 'Ride matching statistics - protected by RLS on rides table';