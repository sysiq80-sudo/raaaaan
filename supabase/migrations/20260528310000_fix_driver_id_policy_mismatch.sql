-- ══════════════════════════════════════════════════════════════════════════════
-- ران — إصلاح سياسات driver_id = auth.uid() المعطّلة
-- تاريخ: 2027-05-28
--
-- المشكلة: في عدة جداول، العمود driver_id يشير إلى drivers.id (UUID مختلف)
--          وليس إلى auth.users.id الذي يُرجعه auth.uid().
--          هذا يعني أن سياسة driver_id = auth.uid() لا تُطابق أبداً
--          → السائق لا يرى بياناته! (الأدمن يراها عبر سياسة منفصلة)
--
-- الحل: استبدال كل driver_id = auth.uid() بـ:
--        driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
--
-- الجداول المتأثرة (8 سياسات):
--   1. rides — emergency update (2 سياسات)
--   2. company_earnings — driver_own_company_earnings
--   3. withdrawal_requests — driver_own_withdrawals + INSERT
--   4. driver_incentive_claims — driver_own_claims
--   5. driver_subscriptions — driver_own_subscriptions
--   6. delay_alerts — drivers_see_own_delay_alerts
--   7. ride_ratings — driver SELECT
--
-- تأثير الثغرة: السائق لا يرى بياناته → الواجهة تعرض "لا توجد بيانات"
--              لكنها ليست تسريباً (البيانات مخفية أكثر مما يجب).
--              مع ذلك، سياسات INSERT/UPDATE المعطّلة تعني أن العمليات
--              قد تفشل (مثل: إنهاء الرحلة في حالة طوارئ).
-- ══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #1: rides — emergency update policies
-- driver_id = auth.uid() → driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "drivers_can_emergency_end_rides" ON public.rides;

CREATE POLICY "drivers_can_emergency_end_rides" ON public.rides
  FOR UPDATE
  USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    AND status IN ('accepted', 'arrived', 'in_progress')
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    AND status = 'completed'
    AND emergency_completed = true
    AND emergency_end_reason = 'driver_ended'
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #2: company_earnings — السائق يرى أرباحه
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_earnings'
  ) THEN
    DROP POLICY IF EXISTS "driver_own_company_earnings" ON public.company_earnings;

    EXECUTE $p$
      CREATE POLICY "driver_own_company_earnings" ON public.company_earnings
        FOR SELECT
        USING (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #3: withdrawal_requests — السائق يرى ويُنشئ طلبات سحبه
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'withdrawal_requests'
  ) THEN
    -- SELECT policy
    DROP POLICY IF EXISTS "driver_own_withdrawals" ON public.withdrawal_requests;

    EXECUTE $p$
      CREATE POLICY "driver_own_withdrawals" ON public.withdrawal_requests
        FOR SELECT
        USING (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
          OR public.is_admin_or_moderator()
        )
    $p$;

    -- INSERT policy (phase1 audit already fixed this, but let's ensure)
    DROP POLICY IF EXISTS "driver_insert_own_withdrawal" ON public.withdrawal_requests;
    DROP POLICY IF EXISTS "withdrawal_driver_insert_own" ON public.withdrawal_requests;

    EXECUTE $p$
      CREATE POLICY "withdrawal_driver_insert_own" ON public.withdrawal_requests
        FOR INSERT TO authenticated
        WITH CHECK (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #4: driver_incentive_claims — السائق يرى مطالباته
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_incentive_claims'
  ) THEN
    DROP POLICY IF EXISTS "driver_own_claims" ON public.driver_incentive_claims;

    EXECUTE $p$
      CREATE POLICY "driver_own_claims" ON public.driver_incentive_claims
        FOR SELECT
        USING (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #5: driver_subscriptions — السائق يرى اشتراكاته
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_subscriptions'
  ) THEN
    DROP POLICY IF EXISTS "driver_own_subscriptions" ON public.driver_subscriptions;

    EXECUTE $p$
      CREATE POLICY "driver_own_subscriptions" ON public.driver_subscriptions
        FOR SELECT
        USING (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
          OR public.is_admin_or_moderator()
        )
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #6: delay_alerts — السائق يرى تنبيهاته
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'delay_alerts'
  ) THEN
    DROP POLICY IF EXISTS "drivers_see_own_delay_alerts" ON public.delay_alerts;

    EXECUTE $p$
      CREATE POLICY "drivers_see_own_delay_alerts" ON public.delay_alerts
        FOR SELECT
        USING (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #7: rides — سياسات 035_rls_comprehensive_policies
-- التحقق مما إذا كانت السياسات القديمة لا زالت موجودة وإصلاحها
-- ═══════════════════════════════════════════════════════════════════════════

-- سياسة VIEW للسائق
DROP POLICY IF EXISTS "drivers_view_assigned_rides" ON public.rides;

CREATE POLICY "drivers_view_assigned_rides" ON public.rides
  FOR SELECT
  USING (
    -- سائق معتمد
    auth.uid() IN (
      SELECT user_id FROM public.drivers WHERE status = 'approved'
    )
    AND (
      -- رحلاته المخصصة
      driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
      OR
      -- الرحلات المعلقة القريبة (ليست مخصصة لسائق)
      status = 'pending'
    )
  );

-- سياسة UPDATE للسائق (تحديث حالة الرحلة)
DROP POLICY IF EXISTS "drivers_can_update_assigned_rides" ON public.rides;

CREATE POLICY "drivers_can_update_assigned_rides" ON public.rides
  FOR UPDATE
  USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    AND status IN ('accepted', 'arrived', 'in_progress')
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX #8: ride_ratings — إصلاح سياسة السائق إن وجدت
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ride_ratings'
      AND policyname LIKE '%driver%'
      AND qual::text LIKE '%driver_id = auth.uid()%'
  ) THEN
    -- حذف السياسة القديمة
    DROP POLICY IF EXISTS "drivers_view_own_ratings" ON public.ride_ratings;

    EXECUTE $p$
      CREATE POLICY "drivers_view_own_ratings" ON public.ride_ratings
        FOR SELECT
        USING (
          driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- ملخص الإصلاحات:
--   1. rides emergency update: ✅ driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
--   2. company_earnings SELECT: ✅ نفس النمط
--   3. withdrawal_requests SELECT + INSERT: ✅ نفس النمط
--   4. driver_incentive_claims SELECT: ✅ نفس النمط
--   5. driver_subscriptions SELECT: ✅ نفس النمط
--   6. delay_alerts SELECT: ✅ نفس النمط
--   7. rides VIEW + UPDATE: ✅ نفس النمط
--   8. ride_ratings VIEW: ✅ نفس النمط (شرطي — فقط إذا السياسة القديمة موجودة)
--
-- التأثير: السائق الآن يرى بياناته فعلياً! كانت السياسات القديمة "ميتة"
--          لأنها تقارن drivers.id مع auth.users.id ولا تتطابق أبداً.
-- ═══════════════════════════════════════════════════════════════════════════
