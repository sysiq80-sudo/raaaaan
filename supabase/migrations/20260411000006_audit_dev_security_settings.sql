-- ============================================================
-- ران - تدقيق أمني للصفحات: التطوير والمهام، مدراء النظام،
--       سجل التدقيق، الأمان والحدود، ران المطور، الإعدادات
-- Migration Batch #6
-- التاريخ: 2026-04-11
-- ============================================================

-- ============================================================
-- SECTION 1: CRITICAL FIX — app_tasks RLS uses direct user_roles query
-- (يسبب Infinite Recursion تماماً كالثغرة السابقة!)
-- حل: استبدال بـ is_admin_or_moderator()
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_tasks'
  ) THEN
    -- حذف السياسات القديمة المسببة للـ Recursion
    DROP POLICY IF EXISTS "Admins can view tasks"   ON public.app_tasks;
    DROP POLICY IF EXISTS "Admins can insert tasks"  ON public.app_tasks;
    DROP POLICY IF EXISTS "Admins can update tasks"  ON public.app_tasks;
    DROP POLICY IF EXISTS "Admins can delete tasks"  ON public.app_tasks;
    DROP POLICY IF EXISTS "admin_manage_tasks"        ON public.app_tasks;

    -- سياسة واحدة آمنة تستخدم الدالة المساعدة
    EXECUTE $p$
      CREATE POLICY "admin_manage_tasks" ON public.app_tasks
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: system_configs — ترقية RLS لاستخدام is_admin_or_moderator()
-- (السياسات القديمة تستعلم user_roles مباشرة → خطر Recursion)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_configs'
  ) THEN
    -- حذف السياسات القديمة
    DROP POLICY IF EXISTS "Admins can view system_configs"   ON public.system_configs;
    DROP POLICY IF EXISTS "Admins can insert system_configs"  ON public.system_configs;
    DROP POLICY IF EXISTS "Admins can update system_configs"  ON public.system_configs;
    DROP POLICY IF EXISTS "Admins can delete system_configs"  ON public.system_configs;
    DROP POLICY IF EXISTS "Only admins can read system_configs" ON public.system_configs;
    DROP POLICY IF EXISTS "admin_manage_system_configs"        ON public.system_configs;

    -- سياسة واحدة موحّدة وآمنة
    EXECUTE $p$
      CREATE POLICY "admin_manage_system_configs" ON public.system_configs
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: payment_accounts — ترقية RLS
-- الأدمن يدير، الراكب يرى النشطة فقط
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_accounts'
  ) THEN
    -- حذف السياسات القديمة
    DROP POLICY IF EXISTS "Anyone can view payment_accounts"    ON public.payment_accounts;
    DROP POLICY IF EXISTS "Public can view payment_accounts"    ON public.payment_accounts;
    DROP POLICY IF EXISTS "Admins can manage payment_accounts"  ON public.payment_accounts;
    DROP POLICY IF EXISTS "admin_manage_payment_accounts"       ON public.payment_accounts;
    DROP POLICY IF EXISTS "public_read_active_payment_accounts" ON public.payment_accounts;

    -- الأدمن يدير كل شيء
    EXECUTE $p$
      CREATE POLICY "admin_manage_payment_accounts" ON public.payment_accounts
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- المستخدم العادي يرى الحسابات النشطة فقط (لشاشة الدفع)
    EXECUTE $p$
      CREATE POLICY "public_read_active_payment_accounts" ON public.payment_accounts
        FOR SELECT
        USING (is_active = true)
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 4: admin_audit_logs — ترقية RLS لاستخدام is_admin_or_moderator()
-- (السياسات موجودة لكن قد تستعلم user_roles مباشرة)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
  ) THEN
    -- حذف كل السياسات القديمة لتجنب التضارب
    DROP POLICY IF EXISTS "Admins can view audit logs"    ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "Admins can insert audit logs"  ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_view_audit_logs"          ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_insert_audit_logs"        ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_manage_audit_logs"        ON public.admin_audit_logs;

    -- سجلات التدقيق: قراءة للأدمن + إدراج للتسجيل
    EXECUTE $p$
      CREATE POLICY "admin_read_audit_logs" ON public.admin_audit_logs
        FOR SELECT
        USING (public.is_admin_or_moderator())
    $p$;

    -- السماح بإدراج السجلات (للنظام والـ triggers)
    EXECUTE $p$
      CREATE POLICY "admin_insert_audit_logs" ON public.admin_audit_logs
        FOR INSERT
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: GUARD — منع تعطيل وضع الصيانة بدون أدمن
-- (حماية إضافية لجدول app_settings)
-- ============================================================

-- لا حاجة لـ trigger إضافي — RLS الموجود كافٍ لأن:
-- 1. app_settings: كتابة أدمن فقط (✅ مضاف في Batch 2)
-- 2. system_configs: كتابة أدمن فقط (✅ مُرقّى أعلاه)

-- ============================================================
-- SECTION 6: إضافة index للبحث في سجل التدقيق
-- (AdminAuditLogs يبحث بـ ilike على action_type)
-- ============================================================

-- btree composite index لتسريع البحث في سجل التدقيق
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_composite
  ON public.admin_audit_logs (created_at DESC, action_type);

-- ============================================================
-- SECTION 7: إضافة indexes مفيدة
-- ============================================================

-- app_tasks: filter by status
CREATE INDEX IF NOT EXISTS idx_app_tasks_status
  ON public.app_tasks (status, created_at DESC);

-- system_configs: lookup by category + key
CREATE INDEX IF NOT EXISTS idx_system_configs_cat_key
  ON public.system_configs (category, key_name);

-- payment_accounts: ordered display
CREATE INDEX IF NOT EXISTS idx_payment_accounts_order
  ON public.payment_accounts (display_order, is_active);

-- ============================================================
-- END OF MIGRATION
-- الملاحظات:
-- 1. app_tasks: 🔴 CRITICAL — إصلاح RLS Infinite Recursion ✅
-- 2. system_configs: ترقية RLS لـ is_admin_or_moderator() ✅
-- 3. payment_accounts: ترقية RLS + فصل قراءة النشطة ✅
-- 4. admin_audit_logs: توحيد RLS ✅
-- 5. AdminDocumentation: عرض فقط (لا DB) — لا يحتاج إصلاح ✅
-- 6. AdminWorkflows: wrapper فقط — لا يحتاج إصلاح ✅
-- 7. AdminControllerUsers: يعتمد على RPCs آمنة — لا يحتاج إصلاح ✅
-- 8. AdminSecuritySettings: يعتمد على app_settings المحمي ✅
-- ============================================================
