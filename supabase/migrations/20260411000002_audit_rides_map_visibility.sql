-- ============================================================
-- ران - تصليح شامل لصفحات: المستخدمون، الرحلات، الخريطة، ظهور السائقين
-- تاريخ: 2026-04-11 (الدفعة الثانية)
-- الملفات: AdminUsers, AdminRides, AdminPendingRides,
--          AdminStoppedRides, AdminMap, AdminDriverVisibility
-- ============================================================

-- ============================================================
-- SECTION 1: RLS على rides — إصلاح تعارض السياسات الموجودة
-- AdminRides.tsx يستخدم pagination ✅ (لا مشاكل أداء)
-- ============================================================

-- تأكد أن سياسات rides لا تستخدم user_roles بشكل مباشر (recursion fix)
-- السياسات الموجودة في 035_rls_comprehensive_policies تستخدم admins table
-- لكن نضيف سياسة للأدمن عبر user_roles كذلك (للتوافق)

DO $$
BEGIN
  -- إضافة سياسة admin عبر is_admin_or_moderator() إذا لم تكن موجودة
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rides'
    AND policyname = 'admin_full_rides_access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_full_rides_access" ON public.rides
        FOR ALL
        USING (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: RLS على dual_stop_alerts (AdminStoppedRides)
-- الصفحة تستعلم عن هذا الجدول بدون أي حماية
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dual_stop_alerts'
  ) THEN
    ALTER TABLE public.dual_stop_alerts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_access_dual_stop_alerts" ON public.dual_stop_alerts;
    EXECUTE $policy$
      CREATE POLICY "admin_access_dual_stop_alerts" ON public.dual_stop_alerts
        FOR ALL
        USING (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: RLS على app_settings (AdminDriverVisibility)
-- الإعدادات العامة: قراءة للجميع، تعديل للأدمن
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_settings'
  ) THEN
    ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_app_settings"  ON public.app_settings;
    DROP POLICY IF EXISTS "admin_write_app_settings"  ON public.app_settings;

    EXECUTE $policy$
      CREATE POLICY "public_read_app_settings" ON public.app_settings
        FOR SELECT USING (true)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "admin_write_app_settings" ON public.app_settings
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 4: RLS على fake_drivers (AdminDriverVisibility)
-- قراءة للجميع (الراكب يحتاجها)، تعديل للأدمن فقط
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fake_drivers'
  ) THEN
    ALTER TABLE public.fake_drivers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_fake_drivers" ON public.fake_drivers;
    DROP POLICY IF EXISTS "admin_manage_fake_drivers" ON public.fake_drivers;

    -- الراكب يقرأ السائقين الوهميين النشطين فقط
    EXECUTE $policy$
      CREATE POLICY "public_read_active_fake_drivers" ON public.fake_drivers
        FOR SELECT
        USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير (insert/update/delete)
    EXECUTE $policy$
      CREATE POLICY "admin_manage_fake_drivers" ON public.fake_drivers
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: RLS على regions (AdminMap)
-- الصفحة تستعلم عن regions بدون حماية
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regions'
  ) THEN
    ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_regions" ON public.regions;
    DROP POLICY IF EXISTS "admin_manage_regions" ON public.regions;

    -- المناطق النشطة مرئية للجميع
    EXECUTE $policy$
      CREATE POLICY "public_read_regions" ON public.regions
        FOR SELECT USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير المناطق
    EXECUTE $policy$
      CREATE POLICY "admin_manage_regions" ON public.regions
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 6: delete_ride_cascade RPC (AdminRides - حذف الرحلات)
-- إنشاء الدالة إن لم تكن موجودة (AdminRides يستدعيها)
-- ============================================================

-- Drop first to allow return type change
DROP FUNCTION IF EXISTS public.delete_ride_cascade(UUID);

CREATE OR REPLACE FUNCTION public.delete_ride_cascade(ride_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_status TEXT;
BEGIN
  -- التحقق من أن الرحلة غير نشطة (لا يمكن حذف رحلة جارية)
  SELECT status INTO v_ride_status
  FROM public.rides WHERE id = ride_id_param;

  IF v_ride_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ride not found');
  END IF;

  IF v_ride_status IN ('accepted', 'arrived', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete an active ride');
  END IF;

  -- التحقق من صلاحيات الأدمن
  IF NOT public.is_admin_or_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- حذف البيانات المرتبطة أولاً
  DELETE FROM public.ride_ratings   WHERE ride_id = ride_id_param;
  DELETE FROM public.dual_stop_alerts WHERE ride_id = ride_id_param;

  -- حذف الرحلة نفسها
  DELETE FROM public.rides WHERE id = ride_id_param;

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- SECTION 7: Indexes لتحسين الأداء في صفحات الرحلات
-- ============================================================

-- تسريع فلتر الرحلات النشطة (AdminPendingRides + AdminMap)
CREATE INDEX IF NOT EXISTS idx_rides_status_created
  ON public.rides (status, created_at DESC)
  WHERE status IN ('pending', 'accepted', 'arrived', 'in_progress');

-- تسريع dual_stop_alerts
CREATE INDEX IF NOT EXISTS idx_dual_stop_alerts_unresolved
  ON public.dual_stop_alerts (created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dual_stop_alerts_ride_id
  ON public.dual_stop_alerts (ride_id);

-- تسريع app_settings
CREATE INDEX IF NOT EXISTS idx_app_settings_key
  ON public.app_settings (key);

-- تسريع fake_drivers
CREATE INDEX IF NOT EXISTS idx_fake_drivers_active
  ON public.fake_drivers (is_active)
  WHERE is_active = true;

-- تسريع regions
CREATE INDEX IF NOT EXISTS idx_regions_active
  ON public.regions (is_active)
  WHERE is_active = true;

-- ============================================================
-- SECTION 8: View للرحلات المعلقة مع بيانات الراكب والسائق
-- لاستخدامه في AdminPendingRides بدلاً من 3 استعلامات
-- ============================================================

CREATE OR REPLACE VIEW public.pending_rides_with_users AS
SELECT
  r.id,
  r.status,
  r.pickup_address,
  r.dropoff_address,
  r.estimated_fare,
  r.created_at,
  r.updated_at,
  r.rider_id,
  r.driver_id,
  r.vehicle_type,
  -- بيانات الراكب
  rp.full_name  AS rider_name,
  rp.phone      AS rider_phone,
  -- بيانات السائق
  d.full_name   AS driver_name,
  d.phone       AS driver_phone
FROM public.rides r
LEFT JOIN public.profiles rp ON rp.user_id = r.rider_id
LEFT JOIN public.drivers  d  ON d.id = r.driver_id
WHERE r.status IN ('pending', 'accepted', 'arrived', 'in_progress');

-- ============================================================
-- SECTION 9: Real-time على dual_stop_alerts و rides
-- (AdminStoppedRides يستخدم Real-time بالفعل - تأكيد الإعداد)
-- ============================================================

-- تأكيد REPLICA IDENTITY لدعم Real-time
DO $$
BEGIN
  -- rides
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rides') THEN
    ALTER TABLE public.rides REPLICA IDENTITY FULL;
  END IF;

  -- dual_stop_alerts
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dual_stop_alerts') THEN
    ALTER TABLE public.dual_stop_alerts REPLICA IDENTITY FULL;
  END IF;
END $$;

-- ============================================================
-- END OF MIGRATION
-- الملاحظات:
-- 1. AdminRides: pagination ✅ - لا تغييرات كود مطلوبة
-- 2. AdminPendingRides: يستخدم batch fetch ✅ - view لتبسيط مستقبلاً
-- 3. AdminStoppedRides: Real-time ✅ - RLS مضاف
-- 4. AdminMap: Real-time ✅ - RLS على regions مضاف
-- 5. AdminDriverVisibility: useQuery ✅ - RLS على fake_drivers و app_settings مضاف
-- 6. delete_ride_cascade: RPC آمنة مع فحص الصلاحيات
-- ============================================================
