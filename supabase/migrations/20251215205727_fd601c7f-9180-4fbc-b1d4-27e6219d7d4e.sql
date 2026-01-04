-- إصلاح SECURITY DEFINER VIEW بإعادة إنشائه مع SECURITY INVOKER
DROP VIEW IF EXISTS public.safe_drivers_view;

CREATE VIEW public.safe_drivers_view
WITH (security_invoker = true)
AS
SELECT 
  id,
  vehicle_type,
  vehicle_model,
  vehicle_color,
  rating,
  is_online,
  is_available,
  current_location,
  working_region_id
FROM public.drivers
WHERE status = 'approved' AND is_online = true;