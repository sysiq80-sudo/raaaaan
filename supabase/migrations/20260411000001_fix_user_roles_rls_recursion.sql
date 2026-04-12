-- ============================================================
-- ران - إصلاح عاجل: حل مشكلة Infinite Recursion في user_roles RLS
-- خطأ: 42P17 - infinite recursion detected in policy for relation "user_roles"
-- السبب: السياسة تستعلم عن user_roles لتحقق من الأدمن → يُطلق نفس السياسة → تكرار لا نهائي
-- الحل: دالة SECURITY DEFINER تتجاوز RLS عند فحص الصلاحيات
-- تاريخ: 2026-04-11
-- ============================================================

-- ============================================================
-- STEP 1: إزالة السياسات الإشكالية فوراً
-- ============================================================

DROP POLICY IF EXISTS "user_roles_select"      ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;

-- ============================================================
-- STEP 2: دالة مساعدة SECURITY DEFINER — تتجاوز RLS لفحص الأدوار
-- هذا هو الحل الصحيح لمنع infinite recursion
-- عند استدعاء هذه الدالة داخل سياسة RLS، تعمل بصلاحيات postgres
-- وليس بصلاحيات المستخدم الحالي → لا يوجد تكرار
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- دالة منفصلة للتحقق من صلاحية الأدمن (للاستخدام في سياسات الجداول الأخرى)
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  );
$$;

-- ============================================================
-- STEP 3: إعادة كتابة سياسات user_roles بشكل صحيح
-- المفتاح: لا نستعلم عن user_roles داخل سياسة user_roles!
-- ============================================================

-- قراءة: كل مستخدم يرى صفوفه الخاصة فقط (بدون subquery على user_roles)
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- كتابة: نستخدم الدالة SECURITY DEFINER التي تتجاوز RLS
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL
  USING (public.is_admin_or_moderator())
  WITH CHECK (public.is_admin_or_moderator());

-- ============================================================
-- STEP 4: تحديث سياسة bot_customers لاستخدام الدالة المساعدة
-- (كانت تُسبب نفس المشكلة لأنها تستعلم عن user_roles)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bot_customers'
  ) THEN
    DROP POLICY IF EXISTS "admin_access_bot_customers" ON public.bot_customers;
    
    -- إنشاء السياسة باستخدام الدالة SECURITY DEFINER بدلاً من subquery
    EXECUTE $policy$
      CREATE POLICY "admin_access_bot_customers" ON public.bot_customers
        FOR ALL
        USING (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- STEP 5: تحديث سياسات الجداول الأخرى التي قد تعاني نفس المشكلة
-- ============================================================

-- driver_registration_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_registration_settings'
  ) THEN
    DROP POLICY IF EXISTS "public_read_reg_settings" ON public.driver_registration_settings;
    DROP POLICY IF EXISTS "admin_write_reg_settings"  ON public.driver_registration_settings;
    
    EXECUTE $policy$
      CREATE POLICY "public_read_reg_settings" ON public.driver_registration_settings
        FOR SELECT USING (true)
    $policy$;
    
    EXECUTE $policy$
      CREATE POLICY "admin_write_reg_settings" ON public.driver_registration_settings
        FOR UPDATE USING (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- rider_wait_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rider_wait_settings'
  ) THEN
    DROP POLICY IF EXISTS "public_read_wait_settings" ON public.rider_wait_settings;
    DROP POLICY IF EXISTS "admin_write_wait_settings"  ON public.rider_wait_settings;
    
    EXECUTE $policy$
      CREATE POLICY "public_read_wait_settings" ON public.rider_wait_settings
        FOR SELECT USING (true)
    $policy$;
    
    EXECUTE $policy$
      CREATE POLICY "admin_write_wait_settings" ON public.rider_wait_settings
        FOR UPDATE USING (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- admin_audit_logs: الكتابة والقراءة للأدمن فقط
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view audit logs"   ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
    
    EXECUTE $policy$
      CREATE POLICY "admin_view_audit_logs" ON public.admin_audit_logs
        FOR SELECT USING (public.is_admin_or_moderator())
    $policy$;
    
    EXECUTE $policy$
      CREATE POLICY "admin_insert_audit_logs" ON public.admin_audit_logs
        FOR INSERT WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- STEP 6: التحقق — اختبر أن الدوال والسياسات موجودة
-- ============================================================
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('get_my_role', 'is_admin_or_moderator');
--
-- SELECT policyname, tablename FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'user_roles';
-- ============================================================
