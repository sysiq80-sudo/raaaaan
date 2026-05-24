-- ران - سياسات الأمان الشاملة (Row Level Security)
-- تاريخ: 2026-01-15
-- هذا الملف يحتوي على جميع سياسات RLS لضمان أمان البيانات

-- ============================================================================
-- 1. جدول RIDES - سياسات الوصول
-- ============================================================================

-- تفعيل RLS على جدول rides
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- سياسة الراكب: يرى رحلاته الخاصة فقط
CREATE POLICY "riders_view_own_rides" ON public.rides
  FOR SELECT
  USING (
    (auth.uid() = rider_id) OR
    (EXISTS (
      SELECT 1 FROM public.admins
      WHERE user_id = auth.uid()
    ))
  );

-- سياسة السائق: يرى الرحلات المخصصة له والمتاحة
CREATE POLICY "drivers_view_assigned_rides" ON public.rides
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.drivers 
      WHERE status = 'approved'
    ) AND (
      driver_id = auth.uid() OR
      (status = 'pending' AND vehicle_type IN (
        SELECT vehicle_type FROM public.drivers 
        WHERE user_id = auth.uid()
      ))
    )
  );

-- سياسة الإدارة: الإداريون يرون كل الرحلات
CREATE POLICY "admins_view_all_rides" ON public.rides
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- سياسة تحديث الرحلة - الراكب يمكنه رفع الرحلة فقط
CREATE POLICY "riders_can_update_own_rides" ON public.rides
  FOR UPDATE
  USING (auth.uid() = rider_id)
  WITH CHECK (
    auth.uid() = rider_id AND
    CASE
      -- الراكب يمكنه الإلغاء فقط من حالات محددة
      WHEN (status = 'pending' AND "cancelledByRider") THEN true
      WHEN (status = 'accepted' AND "cancelledByRider" AND cancellation_reason IS NOT NULL) THEN true
      ELSE false
    END
  );

-- سياسة تحديث الرحلة - السائق يمكنه التحديث
CREATE POLICY "drivers_can_update_assigned_rides" ON public.rides
  FOR UPDATE
  USING (auth.uid() = driver_id AND status IN ('accepted', 'arrived', 'in_progress'))
  WITH CHECK (
    auth.uid() = driver_id AND
    CASE
      -- السائق يمكنه تحديث الحالة والموقع فقط
      WHEN (status = 'accepted' AND "arrivedAt" IS NOT NULL) THEN true
      WHEN (status = 'arrived' AND "startedAt" IS NOT NULL) THEN true
      WHEN (status = 'in_progress' AND "completedAt" IS NOT NULL) THEN true
      ELSE false
    END
  );

-- سياسة الإدارة: تحديث أي رحلة
CREATE POLICY "admins_can_update_rides" ON public.rides
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- سياسة الإدراج: الراكب فقط يمكنه إنشاء رحلة
CREATE POLICY "riders_can_create_rides" ON public.rides
  FOR INSERT
  WITH CHECK (auth.uid() = rider_id AND status = 'pending');

-- ============================================================================
-- 2. جدول DRIVERS - سياسات الوصول
-- ============================================================================

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- السائق يرى بياناته الخاصة فقط
CREATE POLICY "drivers_view_own_profile" ON public.drivers
  FOR SELECT
  USING (auth.uid() = user_id);

-- الإداريون يرون كل السائقين
CREATE POLICY "admins_view_all_drivers" ON public.drivers
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- السائق يحدث بيانات محدودة من ملفه
CREATE POLICY "drivers_update_own_profile" ON public.drivers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    -- لا يمكن تحديث: rating, total_rides, status (إلا من الإدارة)
    rating = (SELECT rating FROM public.drivers WHERE user_id = auth.uid()) AND
    total_rides = (SELECT total_rides FROM public.drivers WHERE user_id = auth.uid()) AND
    status = (SELECT status FROM public.drivers WHERE user_id = auth.uid())
  );

-- الإداريون يحدثون أي شيء
CREATE POLICY "admins_update_drivers" ON public.drivers
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 3. جدول PROFILES - سياسات الوصول
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- كل مستخدم يرى ملفه الخاص فقط
CREATE POLICY "users_view_own_profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- الإداريون يرون كل الملفات الشخصية
CREATE POLICY "admins_view_all_profiles" ON public.profiles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- كل مستخدم يحدث ملفه الخاص فقط
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- 4. جدول SAVED_PLACES - سياسات الوصول
-- ============================================================================

ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

-- كل مستخدم يرى أماكنه المحفوظة فقط
CREATE POLICY "users_view_own_saved_places" ON public.saved_places
  FOR SELECT
  USING (auth.uid() = rider_id);

-- كل مستخدم يدرج أماكنه الخاصة فقط
CREATE POLICY "users_insert_own_saved_places" ON public.saved_places
  FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

-- كل مستخدم يحدث أماكنه الخاصة فقط
CREATE POLICY "users_update_own_saved_places" ON public.saved_places
  FOR UPDATE
  USING (auth.uid() = rider_id);

-- كل مستخدم يحذف أماكنه الخاصة فقط
CREATE POLICY "users_delete_own_saved_places" ON public.saved_places
  FOR DELETE
  USING (auth.uid() = rider_id);

-- الإداريون يرون الكل (للدعم)
CREATE POLICY "admins_view_all_saved_places" ON public.saved_places
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 5. جدول RIDE_RATINGS - سياسات الوصول
-- ============================================================================

ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- كل مستخدم يرى تقييماتهم فقط
CREATE POLICY "users_view_own_ratings" ON public.ride_ratings
  FOR SELECT
  USING (auth.uid() = rater_id);

-- الإداريون يرون التقييمات لكل الرحلات
CREATE POLICY "admins_view_all_ratings" ON public.ride_ratings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- كل مستخدم يدرج تقييم واحد فقط لكل رحلة
CREATE POLICY "users_insert_own_rated" ON public.ride_ratings
  FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id AND
    NOT EXISTS (
      SELECT 1 FROM public.ride_ratings
      WHERE ride_id = NEW.ride_id AND rater_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. جدول ADMINS - سياسات الوصول (حماية عالية)
-- ============================================================================

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- فقط الإداريون يرون قائمة الإداريين
CREATE POLICY "admins_view_all_admins" ON public.admins
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- لا يمكن لأحد إدراج إداري إلا عبر Deno functions
CREATE POLICY "no_direct_admin_insert" ON public.admins
  FOR INSERT
  WITH CHECK (false);

-- الإداريون الموجودون يمكنهم تحديث بعضهم البعض (بحذر)
CREATE POLICY "admins_update_admins" ON public.admins
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ))
  WITH CHECK (
    -- لا يمكن تغيير role إلا من super_admin
    role = (SELECT role FROM public.admins WHERE user_id = auth.uid() LIMIT 1)
  );

-- ============================================================================
-- 7. جدول SURGE_PRICING - سياسات الوصول
-- ============================================================================

ALTER TABLE public.surge_pricing ENABLE ROW LEVEL SECURITY;

-- الجميع يقرأون أسعار surge
CREATE POLICY "everyone_view_surge_pricing" ON public.surge_pricing
  FOR SELECT
  USING (true);

-- الإداريون فقط يعدلون surge_pricing
CREATE POLICY "admins_manage_surge_pricing" ON public.surge_pricing
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'pricing_manager')
  ));

-- ============================================================================
-- 8. جدول SUPPORT_TICKETS - سياسات الوصول
-- ============================================================================

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى تذاكره الخاصة
CREATE POLICY "users_view_own_tickets" ON public.support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

-- الإداريون يرون كل التذاكر
CREATE POLICY "admins_view_all_tickets" ON public.support_tickets
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- المستخدمون يدرجون تذاكرهم الخاصة
CREATE POLICY "users_create_tickets" ON public.support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- الإداريون يحدثون التذاكر
CREATE POLICY "admins_update_tickets" ON public.support_tickets
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 9. جدول RIDE_ROUTES_HISTORY - سياسات الوصول
-- ============================================================================

ALTER TABLE public.ride_routes_history ENABLE ROW LEVEL SECURITY;

-- الراكب يرى مساراته
CREATE POLICY "riders_view_own_routes" ON public.ride_routes_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_routes_history.ride_id
      AND rides.rider_id = auth.uid()
    )
  );

-- السائق يرى مساراته
CREATE POLICY "drivers_view_own_routes" ON public.ride_routes_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_routes_history.ride_id
      AND rides.driver_id = auth.uid()
    )
  );

-- الإداريون يرون الكل
CREATE POLICY "admins_view_all_routes" ON public.ride_routes_history
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- 10. حماية إضافية: منع حذف البيانات المهمة
-- ============================================================================

-- حظر حذف الرحلات مباشرة (استخدم soft delete فقط)
CREATE POLICY "no_delete_rides" ON public.rides
  FOR DELETE
  WITH CHECK (false);

-- حظر حذف السائقين مباشرة
CREATE POLICY "no_delete_drivers" ON public.drivers
  FOR DELETE
  WITH CHECK (false);

-- حماية الملفات الشخصية من الحذف
CREATE POLICY "no_delete_profiles" ON public.profiles
  FOR DELETE
  WITH CHECK (false);

-- ============================================================================
-- 11. إنشاء indices لتحسين الأداء مع RLS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON public.rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at);

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON public.drivers(is_online);

CREATE INDEX IF NOT EXISTS idx_saved_places_rider_id ON public.saved_places(rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_rater_id ON public.ride_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);

-- ============================================================================
-- IMPORTANT: اختبر جميع السياسات بعد التطبيق!
-- Run test_rls_policies.sql
-- ============================================================================
