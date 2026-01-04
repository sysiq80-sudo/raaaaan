-- ======================================
-- إنشاء View لعرض السائقين مع البريد الإلكتروني
-- ======================================
-- إنشاء view يجمع بيانات السائقين مع البريد الإلكتروني من auth.users
CREATE OR REPLACE VIEW public.drivers_with_email WITH (security_invoker = false) AS
SELECT d.id,
    d.user_id,
    d.full_name,
    d.phone,
    d.vehicle_type,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_plate,
    d.license_number,
    d.status,
    d.rating,
    d.total_rides,
    d.total_earnings,
    d.is_online,
    d.is_available,
    d.current_location,
    d.working_region_id,
    d.max_pickup_radius,
    d.id_image_url,
    d.license_image_url,
    d.admin_controlled,
    d.admin_activated,
    d.created_at,
    d.updated_at,
    u.email as user_email
FROM public.drivers d
    LEFT JOIN auth.users u ON d.user_id = u.id;
-- منح صلاحيات القراءة
GRANT SELECT ON public.drivers_with_email TO authenticated;
-- تعليق
COMMENT ON VIEW public.drivers_with_email IS 'عرض السائقين مع البريد الإلكتروني للمستخدم';