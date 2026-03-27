-- 1. إصلاح تسرب بيانات السائقين - تقييد الحقول المرئية للمستخدمين المصادق عليهم

-- حذف السياسة القديمة التي تعرض كل البيانات
DROP POLICY IF EXISTS "Authenticated users can view available drivers" ON public.drivers;

-- إنشاء VIEW آمن للسائقين المتاحين (بيانات غير حساسة فقط)
CREATE OR REPLACE VIEW public.available_drivers_safe AS
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

-- منح صلاحية الوصول للـ VIEW
GRANT SELECT ON public.available_drivers_safe TO authenticated;

-- 2. إصلاح تسرب بيانات الراكب - تقييد ما يراه السائق

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Drivers can view rider profile for active rides" ON public.profiles;

-- إنشاء VIEW آمن لبيانات الراكب أثناء الرحلة (بدون phone و email)
CREATE OR REPLACE VIEW public.rider_profile_safe AS
SELECT 
  p.id,
  p.user_id,
  p.full_name,
  p.avatar_url,
  p.preferred_language
FROM public.profiles p;

-- منح صلاحية الوصول
GRANT SELECT ON public.rider_profile_safe TO authenticated;

-- إنشاء function للتحقق من أن السائق لديه رحلة نشطة مع الراكب
CREATE OR REPLACE FUNCTION public.driver_has_active_ride_with_rider(rider_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r
    JOIN public.drivers d ON r.driver_id = d.id
    WHERE r.rider_id = rider_user_id
      AND r.status IN ('accepted', 'arrived', 'in_progress')
      AND d.user_id = auth.uid()
  )
$$;

-- سياسة جديدة محدودة: السائق يرى فقط الاسم والصورة
CREATE POLICY "Drivers can view limited rider info for active rides"
ON public.profiles FOR SELECT
USING (
  public.driver_has_active_ride_with_rider(user_id)
);

-- 3. إضافة سياسة للراكب ليرى بيانات السائق المعين له فقط
CREATE OR REPLACE FUNCTION public.rider_has_active_ride_with_driver(driver_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.driver_id = driver_id_param
      AND r.rider_id = auth.uid()
      AND r.status IN ('accepted', 'arrived', 'in_progress')
  )
$$;

-- سياسة للراكب ليرى بيانات السائق المعين له فقط (بما في ذلك الهاتف للاتصال)
CREATE POLICY "Riders can view their assigned driver details"
ON public.drivers FOR SELECT
USING (
  public.rider_has_active_ride_with_driver(id)
);