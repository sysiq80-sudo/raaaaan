-- إصلاح VIEWs بإضافة security_invoker

DROP VIEW IF EXISTS public.available_drivers_safe;
CREATE VIEW public.available_drivers_safe
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
WHERE status = 'approved' 
  AND is_online = true 
  AND is_available = true;

GRANT SELECT ON public.available_drivers_safe TO authenticated;

DROP VIEW IF EXISTS public.rider_profile_safe;
CREATE VIEW public.rider_profile_safe
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.preferred_language
FROM public.profiles p;

GRANT SELECT ON public.rider_profile_safe TO authenticated;

-- حذف safe_drivers_view القديم إن وجد (تم إنشاؤه سابقاً)
DROP VIEW IF EXISTS public.safe_drivers_view;