-- إضافة عمود البريد الإلكتروني لجدول السائقين
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS email text;

-- إنشاء index للبريد الإلكتروني
CREATE INDEX IF NOT EXISTS idx_drivers_email ON public.drivers(email);

-- تحديث العرض drivers_with_email ليستخدم العمود الجديد بدلاً من auth.users
DROP VIEW IF EXISTS public.drivers_with_email;

CREATE VIEW public.drivers_with_email AS
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

-- إضافة سياسة RLS للعرض (العروض ترث سياسات الجداول الأساسية)
-- لكن نضيف سياسة للأدمن للوصول الكامل للسائقين

-- حذف السياسة القديمة إن وجدت
DROP POLICY IF EXISTS "Admins can view all drivers via view" ON public.drivers;

-- السياسة موجودة بالفعل "Admins can view all drivers" لكن نتأكد منها
-- لا حاجة لإضافة سياسة جديدة لأن السياسة الحالية تغطي ذلك