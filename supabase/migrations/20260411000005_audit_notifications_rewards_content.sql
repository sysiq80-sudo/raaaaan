-- ============================================================
-- ران - تدقيق أمني للصفحات: الإشعارات، المكافآت، الإحالات،
--       الأسماء المحظورة، الترويجية، صفحات الراكب، دليل عائلة ران
-- Migration Batch #5
-- التاريخ: 2026-04-11
-- ============================================================

-- ============================================================
-- SECTION 1: notification_campaigns — أدمن فقط
-- (إشعارات مجدولة + سجلاتها حساسة جداً)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_campaigns'
  ) THEN
    ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_campaigns"  ON public.notification_campaigns;
    DROP POLICY IF EXISTS "service_insert_campaigns" ON public.notification_campaigns;

    EXECUTE $p$
      CREATE POLICY "admin_manage_campaigns" ON public.notification_campaigns
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- notification_auto_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_auto_settings'
  ) THEN
    ALTER TABLE public.notification_auto_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_auto_settings" ON public.notification_auto_settings;

    EXECUTE $p$
      CREATE POLICY "admin_manage_auto_settings" ON public.notification_auto_settings
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- notification_groups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_groups'
  ) THEN
    ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_notif_groups" ON public.notification_groups;

    EXECUTE $p$
      CREATE POLICY "admin_manage_notif_groups" ON public.notification_groups
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: driver_incentives + driver_incentive_claims
-- الإدمن يدير الحوافز — السائق يرى مطالباته فقط
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_incentives'
  ) THEN
    ALTER TABLE public.driver_incentives ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_incentives"    ON public.driver_incentives;
    DROP POLICY IF EXISTS "driver_read_active_incentives" ON public.driver_incentives;

    -- الأدمن يدير الحوافز
    EXECUTE $p$
      CREATE POLICY "admin_manage_incentives" ON public.driver_incentives
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- السائق يرى الحوافز النشطة فقط
    EXECUTE $p$
      CREATE POLICY "driver_read_active_incentives" ON public.driver_incentives
        FOR SELECT
        USING (is_active = true)
    $p$;
  END IF;
END $$;

-- driver_incentive_claims: السائق يرى مطالباته، الأدمن يرى الكل
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_incentive_claims'
  ) THEN
    ALTER TABLE public.driver_incentive_claims ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_read_claims"      ON public.driver_incentive_claims;
    DROP POLICY IF EXISTS "driver_own_claims"       ON public.driver_incentive_claims;
    DROP POLICY IF EXISTS "service_insert_claims"   ON public.driver_incentive_claims;

    -- الأدمن يرى كل المطالبات
    EXECUTE $p$
      CREATE POLICY "admin_read_claims" ON public.driver_incentive_claims
        FOR SELECT
        USING (public.is_admin_or_moderator())
    $p$;

    -- السائق يرى مطالباته الخاصة
    EXECUTE $p$
      CREATE POLICY "driver_own_claims" ON public.driver_incentive_claims
        FOR SELECT
        USING (driver_id = auth.uid())
    $p$;

    -- النظام يضيف المطالبات (edge function)
    EXECUTE $p$
      CREATE POLICY "service_insert_claims" ON public.driver_incentive_claims
        FOR INSERT
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: CRITICAL FIX — stats في AdminIncentives
-- كان يجلب كل سجلات driver_incentive_claims (بلا حد)
-- لحساب الإجمالي!
-- ============================================================

-- دالة آمنة لحساب إحصائيات الحوافز بكفاءة
DROP FUNCTION IF EXISTS public.get_incentives_stats();

CREATE OR REPLACE FUNCTION public.get_incentives_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_bonus_paid',  COALESCE(SUM(bonus_earned), 0),
    'total_claims',      COUNT(*),
    'unique_drivers',    COUNT(DISTINCT driver_id)
  )
  FROM public.driver_incentive_claims;
$$;

-- ============================================================
-- SECTION 4: referral_codes + referrals
-- كل مستخدم يرى كوده فقط + الأدمن يرى الكل
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referral_codes'
  ) THEN
    ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_own_referral_code"  ON public.referral_codes;
    DROP POLICY IF EXISTS "admin_all_referral_codes" ON public.referral_codes;

    -- المستخدم يرى ويدير كوده الخاص
    EXECUTE $p$
      CREATE POLICY "user_own_referral_code" ON public.referral_codes
        FOR SELECT
        USING (user_id = auth.uid() OR public.is_admin_or_moderator())
    $p$;

    -- الأدمن يدير كل الأكواد
    EXECUTE $p$
      CREATE POLICY "admin_manage_referral_codes" ON public.referral_codes
        FOR UPDATE
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- النظام يضيف الأكواد
    EXECUTE $p$
      CREATE POLICY "service_insert_referral_codes" ON public.referral_codes
        FOR INSERT
        WITH CHECK (user_id = auth.uid() OR public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referrals'
  ) THEN
    ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_own_referrals"    ON public.referrals;
    DROP POLICY IF EXISTS "admin_all_referrals"   ON public.referrals;

    -- المستخدم يرى إحالاته (محيل أو مُحال)
    EXECUTE $p$
      CREATE POLICY "user_own_referrals" ON public.referrals
        FOR SELECT
        USING (
          referrer_id = auth.uid()
          OR referred_id = auth.uid()
          OR public.is_admin_or_moderator()
        )
    $p$;

    -- النظام يسجل الإحالات
    EXECUTE $p$
      CREATE POLICY "service_insert_referrals" ON public.referrals
        FOR INSERT
        WITH CHECK (true)
    $p$;

    -- الأدمن يعدّل الإحالات
    EXECUTE $p$
      CREATE POLICY "admin_manage_referrals" ON public.referrals
        FOR UPDATE
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: banned_names — أدمن يدير، عام يقرأ (للتحقق)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'banned_names'
  ) THEN
    ALTER TABLE public.banned_names ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_banned_names" ON public.banned_names;
    DROP POLICY IF EXISTS "service_read_banned_names" ON public.banned_names;

    -- الأدمن يدير القائمة
    EXECUTE $p$
      CREATE POLICY "admin_manage_banned_names" ON public.banned_names
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- النظام يقرأ القائمة للتحقق من التسجيل (Edge Functions)
    EXECUTE $p$
      CREATE POLICY "service_read_active_banned_names" ON public.banned_names
        FOR SELECT
        USING (is_active = true)
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 6: promo_banners — أدمن يدير، عام يقرأ النشطة
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promo_banners'
  ) THEN
    ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_promo_banners"  ON public.promo_banners;
    DROP POLICY IF EXISTS "public_read_active_banners"  ON public.promo_banners;

    -- الأدمن يدير البانرات
    EXECUTE $p$
      CREATE POLICY "admin_manage_promo_banners" ON public.promo_banners
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- الراكب يرى البانرات النشطة فقط
    EXECUTE $p$
      CREATE POLICY "public_read_active_banners" ON public.promo_banners
        FOR SELECT
        USING (is_active = true)
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 7: rider_page_layouts — أدمن يدير، عام يقرأ النشطة
-- (دليل عائلة ران + صفحات الراكب)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rider_page_layouts'
  ) THEN
    ALTER TABLE public.rider_page_layouts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_manage_rider_pages"   ON public.rider_page_layouts;
    DROP POLICY IF EXISTS "public_read_active_pages"   ON public.rider_page_layouts;

    -- الأدمن يدير التخطيطات
    EXECUTE $p$
      CREATE POLICY "admin_manage_rider_pages" ON public.rider_page_layouts
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- الراكب يرى الصفحات المفعّلة فقط
    EXECUTE $p$
      CREATE POLICY "public_read_active_pages" ON public.rider_page_layouts
        FOR SELECT
        USING (is_active = true)
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 8: GUARD — منع حذف الصفحة الافتراضية لصفحات الراكب
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_prevent_delete_default_page()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'لا يمكن حذف الصفحة الافتراضية للراكب';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_default_page ON public.rider_page_layouts;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rider_page_layouts'
  ) THEN
    CREATE TRIGGER trg_prevent_delete_default_page
      BEFORE DELETE ON public.rider_page_layouts
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_fn_prevent_delete_default_page();
  END IF;
END $$;

-- ============================================================
-- SECTION 9: GUARD — منع حذف حافز نشط له مطالبات
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_prevent_delete_active_incentive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims_count INT;
BEGIN
  IF OLD.is_active THEN
    SELECT COUNT(*) INTO claims_count
    FROM public.driver_incentive_claims
    WHERE incentive_id = OLD.id;

    IF claims_count > 0 THEN
      RAISE EXCEPTION 'لا يمكن حذف حافز نشط له % مطالبة. عطّله أولاً.', claims_count;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_active_incentive ON public.driver_incentives;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_incentives'
  ) THEN
    CREATE TRIGGER trg_prevent_delete_active_incentive
      BEFORE DELETE ON public.driver_incentives
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_fn_prevent_delete_active_incentive();
  END IF;
END $$;

-- ============================================================
-- SECTION 10: Indexes للأداء
-- ============================================================

-- notification_campaigns: filter by status
CREATE INDEX IF NOT EXISTS idx_notif_campaigns_status
  ON public.notification_campaigns (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_campaigns_scheduled
  ON public.notification_campaigns (scheduled_at)
  WHERE status = 'scheduled';

-- driver_incentives
CREATE INDEX IF NOT EXISTS idx_driver_incentives_active
  ON public.driver_incentives (is_active, period);

-- driver_incentive_claims
CREATE INDEX IF NOT EXISTS idx_incentive_claims_driver
  ON public.driver_incentive_claims (driver_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_incentive_claims_incentive
  ON public.driver_incentive_claims (incentive_id, claimed_at DESC);

-- referral_codes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user
  ON public.referral_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code
  ON public.referral_codes (code);

-- referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.referrals (referrer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_referred
  ON public.referrals (referred_id);

CREATE INDEX IF NOT EXISTS idx_referrals_status
  ON public.referrals (status, created_at DESC);

-- banned_names: text search index
CREATE INDEX IF NOT EXISTS idx_banned_names_name
  ON public.banned_names (name);

-- promo_banners: ordered by display
CREATE INDEX IF NOT EXISTS idx_promo_banners_order
  ON public.promo_banners (display_order, is_active);

-- rider_page_layouts
CREATE INDEX IF NOT EXISTS idx_rider_page_layouts_default
  ON public.rider_page_layouts (is_default, is_active);

-- ============================================================
-- END OF MIGRATION
-- الملاحظات:
-- 1. notification_campaigns/groups/auto_settings: RLS أدمن فقط ✅
-- 2. driver_incentives: RLS مضاف + Guard لمنع حذف الحوافز النشطة ✅
-- 3. driver_incentive_claims: RLS مضاف ✅
-- 4. get_incentives_stats(): دالة بدلاً من SELECT * لحساب الإجمالي ✅ (CRITICAL)
-- 5. referral_codes + referrals: RLS مضاف ✅
-- 6. banned_names: RLS مضاف + public read للتحقق ✅
-- 7. promo_banners: RLS مضاف + public read للنشطة ✅
-- 8. rider_page_layouts: RLS مضاف + Guard للصفحة الافتراضية ✅
-- ============================================================
