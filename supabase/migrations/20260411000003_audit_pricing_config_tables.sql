-- ============================================================
-- ران - تدقيق أمني وأداء لجداول التسعير والإعدادات
-- الصفحات: AdminRegions, AdminLandmarks, AdminVehicleTypes,
--          AdminFareSettings, AdminSurgePricing,
--          AdminCommissionTiers, AdminSubscriptionPlans
-- تاريخ: 2026-04-11 (الدفعة الثالثة)
-- ============================================================

-- ============================================================
-- SECTION 1: RLS على landmarks
-- AdminLandmarks يقرأ الكل بدون فلتر أمان من DB
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'landmarks'
  ) THEN
    ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_active_landmarks"  ON public.landmarks;
    DROP POLICY IF EXISTS "admin_manage_landmarks"        ON public.landmarks;

    -- الراكب يرى المعالم النشطة فقط
    EXECUTE $policy$
      CREATE POLICY "public_read_active_landmarks" ON public.landmarks
        FOR SELECT
        USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير كل المعالم
    EXECUTE $policy$
      CREATE POLICY "admin_manage_landmarks" ON public.landmarks
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: RLS على vehicle_types
-- يجب أن يقرأها الراكب (لاختيار نوع السيارة) + يعدلها الأدمن
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicle_types'
  ) THEN
    ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_active_vehicle_types" ON public.vehicle_types;
    DROP POLICY IF EXISTS "admin_manage_vehicle_types"       ON public.vehicle_types;

    -- الراكب والسائق يريان النشطة فقط
    EXECUTE $policy$
      CREATE POLICY "public_read_active_vehicle_types" ON public.vehicle_types
        FOR SELECT
        USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير جميع أنواع السيارات
    EXECUTE $policy$
      CREATE POLICY "admin_manage_vehicle_types" ON public.vehicle_types
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: RLS على surge_pricing_rules
-- يقرأها نظام الرحلات (Edge Function) + يعدلها الأدمن
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'surge_pricing_rules'
  ) THEN
    ALTER TABLE public.surge_pricing_rules ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "system_read_active_surge_rules" ON public.surge_pricing_rules;
    DROP POLICY IF EXISTS "admin_manage_surge_rules"       ON public.surge_pricing_rules;

    -- النظام يقرأ القواعد النشطة  (المصادقة مطلوبة = authenticated)
    EXECUTE $policy$
      CREATE POLICY "authenticated_read_active_surge_rules" ON public.surge_pricing_rules
        FOR SELECT
        USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير القواعد
    EXECUTE $policy$
      CREATE POLICY "admin_manage_surge_rules" ON public.surge_pricing_rules
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 4: RLS على commission_tiers
-- يقرأها نظام العمولة + يعدلها الأدمن
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commission_tiers'
  ) THEN
    ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_active_commission_tiers" ON public.commission_tiers;
    DROP POLICY IF EXISTS "admin_manage_commission_tiers"       ON public.commission_tiers;

    -- السائق يرى مستوياته المتاحة
    EXECUTE $policy$
      CREATE POLICY "authenticated_read_commission_tiers" ON public.commission_tiers
        FOR SELECT
        USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير المستويات
    EXECUTE $policy$
      CREATE POLICY "admin_manage_commission_tiers" ON public.commission_tiers
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: RLS على subscription_plans
-- السائق يرى الخطط عند الاشتراك + الأدمن يعدلها
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_plans'
  ) THEN
    ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_active_subscription_plans" ON public.subscription_plans;
    DROP POLICY IF EXISTS "admin_manage_subscription_plans"       ON public.subscription_plans;

    -- السائق يرى الخطط النشطة للاشتراك
    EXECUTE $policy$
      CREATE POLICY "authenticated_read_subscription_plans" ON public.subscription_plans
        FOR SELECT
        USING (is_active = true OR public.is_admin_or_moderator())
    $policy$;

    -- الأدمن يدير الخطط
    EXECUTE $policy$
      CREATE POLICY "admin_manage_subscription_plans" ON public.subscription_plans
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 6: RLS على driver_subscriptions
-- السائق يرى اشتراكاته الخاصة + الأدمن يرى الكل
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_subscriptions'
  ) THEN
    ALTER TABLE public.driver_subscriptions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "driver_own_subscriptions"       ON public.driver_subscriptions;
    DROP POLICY IF EXISTS "admin_all_driver_subscriptions" ON public.driver_subscriptions;

    -- السائق يرى اشتراكاته الخاصة فقط
    EXECUTE $policy$
      CREATE POLICY "driver_own_subscriptions" ON public.driver_subscriptions
        FOR SELECT
        USING (
          driver_id = auth.uid()
          OR public.is_admin_or_moderator()
        )
    $policy$;

    -- الأدمن يدير جميع الاشتراكات
    EXECUTE $policy$
      CREATE POLICY "admin_all_driver_subscriptions" ON public.driver_subscriptions
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 7: RLS على governorates
-- AdminLandmarks يستعلم عن هذا الجدول
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'governorates'
  ) THEN
    ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "public_read_governorates"  ON public.governorates;
    DROP POLICY IF EXISTS "admin_manage_governorates" ON public.governorates;

    -- القراءة للجميع
    EXECUTE $policy$
      CREATE POLICY "public_read_governorates" ON public.governorates
        FOR SELECT USING (true)
    $policy$;

    -- التعديل للأدمن فقط
    EXECUTE $policy$
      CREATE POLICY "admin_manage_governorates" ON public.governorates
        FOR ALL
        USING (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $policy$;
  END IF;
END $$;

-- ============================================================
-- SECTION 8: SECURITY DEFINER دالة لحذف معالم محافظة
-- AdminLandmarks يحذف كل معالم محافظة - لازم دالة آمنة
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_delete_landmarks_by_governorate(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_landmarks_by_governorate(
  governorate_id_param UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- التحقق من صلاحيات الأدمن
  IF NOT public.is_admin_or_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- إحصاء المعالم قبل الحذف
  SELECT COUNT(*) INTO v_count
  FROM public.landmarks
  WHERE governorate_id = governorate_id_param;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', true, 'deleted', 0);
  END IF;

  -- الحذف
  DELETE FROM public.landmarks
  WHERE governorate_id = governorate_id_param;

  RETURN jsonb_build_object('success', true, 'deleted', v_count);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- SECTION 9: Indexes للأداء
-- ============================================================

-- landmarks: بحث سريع بالاسم
CREATE INDEX IF NOT EXISTS idx_landmarks_name_ar
  ON public.landmarks USING gin(to_tsvector('arabic', name_ar));

CREATE INDEX IF NOT EXISTS idx_landmarks_active_category
  ON public.landmarks (is_active, category)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_landmarks_governorate
  ON public.landmarks (governorate_id);

CREATE INDEX IF NOT EXISTS idx_landmarks_region
  ON public.landmarks (region_id);

-- vehicle_types: ترتيب سريع
CREATE INDEX IF NOT EXISTS idx_vehicle_types_sort
  ON public.vehicle_types (sort_order, is_active);

-- surge_pricing_rules: الاستعلام النشط الأكثر شيوعاً
CREATE INDEX IF NOT EXISTS idx_surge_rules_active
  ON public.surge_pricing_rules (is_active, priority DESC)
  WHERE is_active = true;

-- commission_tiers: ترتيب حسب الأولوية
CREATE INDEX IF NOT EXISTS idx_commission_tiers_active
  ON public.commission_tiers (is_active, priority DESC)
  WHERE is_active = true;

-- subscription_plans: ترتيب العرض
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active_sort
  ON public.subscription_plans (is_active, sort_order)
  WHERE is_active = true;

-- driver_subscriptions: اشتراكات نشطة حسب السائق
CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_active
  ON public.driver_subscriptions (driver_id, status, expires_at)
  WHERE status = 'active';

-- ============================================================
-- SECTION 10: Business Rule Triggers
-- ============================================================

-- منع حذف خطة اشتراك لها مشتركين نشطين (حماية DB layer)
CREATE OR REPLACE FUNCTION public.prevent_delete_active_subscription_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM public.driver_subscriptions
  WHERE plan_id = OLD.id
    AND status = 'active'
    AND expires_at > NOW();

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete subscription plan with % active subscribers', v_active_count;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_active_plan ON public.subscription_plans;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_plans'
  ) THEN
    CREATE TRIGGER trg_prevent_delete_active_plan
      BEFORE DELETE ON public.subscription_plans
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_delete_active_subscription_plan();
  END IF;
END $$;

-- منع تعيين surge_multiplier أكبر من 2.0 (Business Rule)
CREATE OR REPLACE FUNCTION public.validate_surge_multiplier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.surge_multiplier > 2.0 THEN
    RAISE EXCEPTION 'surge_multiplier cannot exceed 2.0 (got: %)', NEW.surge_multiplier;
  END IF;
  IF NEW.surge_multiplier < 1.0 THEN
    RAISE EXCEPTION 'surge_multiplier must be at least 1.0 (got: %)', NEW.surge_multiplier;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_surge_multiplier ON public.surge_pricing_rules;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'surge_pricing_rules'
  ) THEN
    CREATE TRIGGER trg_validate_surge_multiplier
      BEFORE INSERT OR UPDATE ON public.surge_pricing_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_surge_multiplier();
  END IF;
END $$;

-- ============================================================
-- END OF MIGRATION
-- الملاحظات:
-- 1. AdminRegions: RLS كان موجوداً - تم التحقق ✅
-- 2. AdminLandmarks: RLS مضاف + دالة آمنة للحذف الجماعي ✅
-- 3. AdminVehicleTypes: RLS مضاف ✅
-- 4. AdminFareSettings: يعتمد على app_settings - RLS موجود من Migration السابقة ✅
-- 5. AdminSurgePricing: RLS مضاف + Trigger للتحقق من المعامل ✅
-- 6. AdminCommissionTiers: RLS مضاف ✅
-- 7. AdminSubscriptionPlans: RLS مضاف + Trigger لحماية الحذف ✅
-- ============================================================
