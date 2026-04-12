-- ============================================================
-- ران - تصليح أمني شامل للوحة التحكم الإدارية
-- Admin Dashboard Security & Logic Hardening
-- تاريخ: 2026-04-11
-- المرجع: نتائج تدقيق لوحة التحكم (BUG-2, BUG-3, FLEET-2, RIDER-3, USERS-1)
-- ============================================================

-- ============================================================
-- SECTION 1: DRIVER STATUS SECURITY (BUG-2 + BUG-3)
-- إيقاف السائق فوراً عند التعليق/الرفض من طبقة DB
-- ============================================================

-- دالة: إيقاف السائق تلقائياً عند تغيير حالته لـ suspended/rejected
CREATE OR REPLACE FUNCTION public.enforce_driver_status_offline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند التعليق أو الرفض: أوقف السائق فوراً
  IF NEW.status IN ('suspended', 'rejected')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.is_online    := false;
    NEW.is_available := false;
    -- سجّل أن هذا التغيير صادر من الأدمن
    NEW.admin_controlled := true;
  END IF;

  -- عند رفع الإيقاف (approved): أُعد التحكم للسائق
  IF NEW.status = 'approved'
     AND OLD.status IN ('suspended', 'rejected') THEN
    NEW.admin_controlled := false;
  END IF;

  RETURN NEW;
END;
$$;

-- تطبيق الـ Trigger
DROP TRIGGER IF EXISTS trg_driver_status_enforce_offline ON public.drivers;
CREATE TRIGGER trg_driver_status_enforce_offline
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.enforce_driver_status_offline();

-- ============================================================
-- SECTION 2: RPC لتفعيل/تعطيل السائق من الأدمن (BUG-3)
-- كانت الدالة غائبة — الكود يستدعيها لكنها لم تكن موجودة
-- ============================================================

-- Drop first to allow changing return type if needed
DROP FUNCTION IF EXISTS public.admin_toggle_driver_activation(UUID, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.admin_toggle_driver_activation(
  p_driver_id     UUID,
  p_is_active     BOOLEAN,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- التحقق من أن المستدعي أدمن أو مشرف
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id
      AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admins can toggle driver activation';
  END IF;

  -- تحديث حالة التفعيل
  UPDATE public.drivers
  SET
    admin_activated = p_is_active,
    -- إذا تم التعطيل: أوقف السائق فوراً
    is_online       = CASE WHEN NOT p_is_active THEN false ELSE is_online END,
    is_available    = CASE WHEN NOT p_is_active THEN false ELSE is_available END,
    admin_controlled = NOT p_is_active,
    updated_at      = now()
  WHERE id = p_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found: %', p_driver_id;
  END IF;
END;
$$;

-- ============================================================
-- SECTION 3: FLEET DEACTIVATION CASCADE (FLEET-2)
-- عند تعطيل أسطول: أوقف جميع سائقيه فوراً
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_fleet_driver_offline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند تعطيل الأسطول: أوقف كل سائقيه المتصلين
  IF NEW.is_active = false AND OLD.is_active = true THEN
    UPDATE public.drivers
    SET
      is_online    = false,
      is_available = false,
      updated_at   = now()
    WHERE fleet_id = NEW.id
      AND (is_online = true OR is_available = true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fleet_deactivate_cascade ON public.fleets;
CREATE TRIGGER trg_fleet_deactivate_cascade
  AFTER UPDATE ON public.fleets
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION public.enforce_fleet_driver_offline();

-- دالة مساعدة: التحقق من حد السائقين في الأسطول (FLEET-3)
CREATE OR REPLACE FUNCTION public.fleet_has_capacity(p_fleet_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max     INTEGER;
  v_current INTEGER;
BEGIN
  -- جلب الحد الأقصى
  SELECT max_drivers INTO v_max
  FROM public.fleets
  WHERE id = p_fleet_id;

  -- إذا لم يكن هناك حد: مسموح
  IF v_max IS NULL THEN
    RETURN true;
  END IF;

  -- عد السائقين الحاليين
  SELECT COUNT(*) INTO v_current
  FROM public.drivers
  WHERE fleet_id = p_fleet_id
    AND status = 'approved';

  RETURN v_current < v_max;
END;
$$;

-- ============================================================
-- SECTION 4: RIDER SUSPENSION PROTECTION (RIDER-3)
-- منع الراكب المعلق من طلب رحلات جديدة
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_suspended_rider_rides()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- تحقق من حالة الراكب في profiles
  SELECT status INTO v_status
  FROM public.profiles
  WHERE user_id = NEW.rider_id;

  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Suspended rider (%) cannot request new rides', NEW.rider_id;
  END IF;

  RETURN NEW;
END;
$$;

-- تطبيق الـ Trigger على جدول rides
DROP TRIGGER IF EXISTS trg_check_rider_suspension ON public.rides;
CREATE TRIGGER trg_check_rider_suspension
  BEFORE INSERT ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_suspended_rider_rides();

-- ============================================================
-- SECTION 5: RIDER STATS VIEW (RIDER-1 / أداء)
-- حل مشكلة جلب كل الرحلات في JavaScript
-- ============================================================

CREATE OR REPLACE VIEW public.rider_stats AS
SELECT
  r.rider_id,
  COUNT(*)                                                    AS total_rides,
  COUNT(*) FILTER (WHERE r.status = 'completed')             AS completed_rides,
  COUNT(*) FILTER (WHERE r.status = 'cancelled')             AS cancelled_rides,
  COALESCE(
    SUM(r.final_fare) FILTER (WHERE r.status = 'completed'), 0
  )                                                           AS total_spent,
  AVG(r.driver_rating) FILTER (
    WHERE r.status = 'completed' AND r.driver_rating IS NOT NULL
  )                                                           AS avg_rating,
  MAX(r.created_at)                                           AS last_ride_date
FROM public.rides r
WHERE r.rider_id IS NOT NULL
GROUP BY r.rider_id;

-- Index لتسريع الـ View
CREATE INDEX IF NOT EXISTS idx_rides_rider_id_status
  ON public.rides (rider_id, status);

-- ============================================================
-- SECTION 6: RLS على user_roles (USERS-1 — أهم ثغرة أمنية)
-- منع أي مستخدم من رفع صلاحياته بشكل غير مشروع
-- ============================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- إزالة السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "admin_write_roles"     ON public.user_roles;
DROP POLICY IF EXISTS "read_own_roles"        ON public.user_roles;
DROP POLICY IF EXISTS "users_read_own_roles"  ON public.user_roles;

-- السياسة 1: قراءة — الأدمن يقرأ الكل، المستخدم يقرأ أدواره فقط
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT
  USING (
    -- المستخدم يرى دوره الخاص
    user_id = auth.uid()
    OR
    -- الأدمن يرى الكل
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator')
    )
  );

-- السياسة 2: كتابة (INSERT/UPDATE/DELETE) — الأدمن فقط
-- هذا هو القفل الرئيسي لمنع رفع الصلاحيات
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- ============================================================
-- SECTION 7: RLS على جداول إضافية
-- ============================================================

-- bot_customers: أدمن فقط
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bot_customers'
  ) THEN
    ALTER TABLE public.bot_customers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_access_bot_customers" ON public.bot_customers;
    CREATE POLICY "admin_access_bot_customers" ON public.bot_customers
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
      );
  END IF;
END $$;

-- driver_registration_settings: قراءة للجميع، تعديل للأدمن
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_registration_settings'
  ) THEN
    ALTER TABLE public.driver_registration_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_reg_settings"  ON public.driver_registration_settings;
    DROP POLICY IF EXISTS "admin_write_reg_settings"  ON public.driver_registration_settings;

    CREATE POLICY "public_read_reg_settings" ON public.driver_registration_settings
      FOR SELECT USING (true);

    CREATE POLICY "admin_write_reg_settings" ON public.driver_registration_settings
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
      );
  END IF;
END $$;

-- rider_wait_settings: قراءة للجميع، تعديل للأدمن
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rider_wait_settings'
  ) THEN
    ALTER TABLE public.rider_wait_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_wait_settings" ON public.rider_wait_settings;
    DROP POLICY IF EXISTS "admin_write_wait_settings" ON public.rider_wait_settings;

    CREATE POLICY "public_read_wait_settings" ON public.rider_wait_settings
      FOR SELECT USING (true);

    CREATE POLICY "admin_write_wait_settings" ON public.rider_wait_settings
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
      );
  END IF;
END $$;

-- ============================================================
-- SECTION 8: Indexes لتحسين الأداء
-- ============================================================

-- bot_customers: بحث سريع بالهاتف والمنصة
CREATE INDEX IF NOT EXISTS idx_bot_customers_phone
  ON public.bot_customers (phone_number)
  WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_customers_platform
  ON public.bot_customers (platform);

CREATE INDEX IF NOT EXISTS idx_bot_customers_last_active
  ON public.bot_customers (last_active DESC);

-- drivers: تسريع استعلامات الأدمن
CREATE INDEX IF NOT EXISTS idx_drivers_status_online
  ON public.drivers (status, is_online)
  WHERE status IN ('approved', 'suspended', 'rejected');

CREATE INDEX IF NOT EXISTS idx_drivers_fleet_id
  ON public.drivers (fleet_id)
  WHERE fleet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_admin_activated
  ON public.drivers (admin_activated)
  WHERE admin_activated IS NOT NULL;

-- user_roles: تسريع فحص الأدوار
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles (user_id, role);

-- ============================================================
-- SECTION 9: BOT CUSTOMERS VIEW مع ربط بـ profiles (BOT-1)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bot_customers'
  ) THEN
    -- View يربط عملاء البوت بالملفات الشخصية
    EXECUTE '
      CREATE OR REPLACE VIEW public.bot_customers_enriched AS
      SELECT
        bc.*,
        p.user_id  AS profile_user_id,
        p.id       AS profile_id,
        p.full_name AS profile_full_name,
        CASE WHEN p.id IS NOT NULL THEN true ELSE false END AS is_app_user
      FROM public.bot_customers bc
      LEFT JOIN public.profiles p ON p.phone = bc.phone_number
    ';
  END IF;
END $$;

-- ============================================================
-- SECTION 10: تسجيل الترحيل في سجل التدقيق
-- ============================================================

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
  ) THEN
    -- استخدم system user ID (أو NULL إذا لم يكن هناك جلسة)
    v_admin_id := COALESCE(
      auth.uid(),
      (SELECT id FROM public.profiles LIMIT 1)
    );

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.admin_audit_logs (
        admin_id,
        action_type,
        entity_id,
        old_data,
        new_data
      ) VALUES (
        v_admin_id,
        'migration_applied',
        '20260411000000_admin_audit_security_hardening',
        NULL,
        jsonb_build_object(
          'fixes', ARRAY[
            'BUG-2: driver status change now forces is_online=false',
            'BUG-3: admin_toggle_driver_activation RPC created',
            'FLEET-2: fleet deactivation cascade to drivers',
            'FLEET-3: fleet_has_capacity helper function',
            'RIDER-3: suspended rider ride prevention trigger',
            'RIDER-1: rider_stats view for performance',
            'USERS-1: user_roles RLS enabled (critical security)',
            'BOT-1: bot_customers_enriched view created'
          ],
          'applied_at', now()
        )
      );
    END IF;
  END IF;
END $$;


-- ============================================================
-- END OF MIGRATION
-- التحقق: شغّل هذا الاستعلام للتأكد من نجاح الترحيل
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN (
--   'enforce_driver_status_offline',
--   'admin_toggle_driver_activation',
--   'enforce_fleet_driver_offline',
--   'fleet_has_capacity',
--   'prevent_suspended_rider_rides'
-- );
-- ============================================================
