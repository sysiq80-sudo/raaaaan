-- ============================================================
-- ران - تدقيق أمني: الشكاوى، كشف الاحتيال، إعدادات الطوارئ
-- Migration Batch #7
-- التاريخ: 2026-04-11
-- ============================================================

-- ============================================================
-- SECTION 1: CRITICAL — fraud_alerts RLS يستعلم user_roles مباشرة
-- → Infinite Recursion!
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fraud_alerts'
  ) THEN
    -- حذف السياسة القديمة المسببة للـ Recursion
    DROP POLICY IF EXISTS "admins_full_access_fraud_alerts" ON public.fraud_alerts;
    DROP POLICY IF EXISTS "admin_manage_fraud_alerts"        ON public.fraud_alerts;
    DROP POLICY IF EXISTS "service_insert_fraud_alerts"      ON public.fraud_alerts;

    -- الأدمن يدير كل التنبيهات
    EXECUTE $p$
      CREATE POLICY "admin_manage_fraud_alerts" ON public.fraud_alerts
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;

    -- service_role يُدرج التنبيهات (Edge Functions detect-fraud-patterns)
    EXECUTE $p$
      CREATE POLICY "service_insert_fraud_alerts" ON public.fraud_alerts
        FOR INSERT
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 2: CRITICAL — ride_complaints RLS يستخدم has_role()
-- (قد تسبب Recursion إذا كانت has_role تستعلم user_roles مباشرة)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ride_complaints'
  ) THEN
    -- حذف سياسة الأدمن القديمة
    DROP POLICY IF EXISTS "admins_manage_complaints" ON public.ride_complaints;
    DROP POLICY IF EXISTS "admin_manage_complaints"  ON public.ride_complaints;

    -- استبدال بـ is_admin_or_moderator() الآمنة
    EXECUTE $p$
      CREATE POLICY "admin_manage_complaints" ON public.ride_complaints
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 3: CRITICAL — complaint_responses: نفس المشكلة
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'complaint_responses'
  ) THEN
    DROP POLICY IF EXISTS "admins_manage_responses" ON public.complaint_responses;
    DROP POLICY IF EXISTS "admin_manage_responses"  ON public.complaint_responses;

    EXECUTE $p$
      CREATE POLICY "admin_manage_responses" ON public.complaint_responses
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 4: CRITICAL — financial_decisions_log: نفس المشكلة
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'financial_decisions_log'
  ) THEN
    DROP POLICY IF EXISTS "admins_manage_financial_decisions" ON public.financial_decisions_log;
    DROP POLICY IF EXISTS "admin_manage_financial_decisions"  ON public.financial_decisions_log;

    EXECUTE $p$
      CREATE POLICY "admin_manage_financial_decisions" ON public.financial_decisions_log
        FOR ALL
        USING  (public.is_admin_or_moderator())
        WITH CHECK (public.is_admin_or_moderator())
    $p$;
  END IF;
END $$;

-- ============================================================
-- SECTION 5: CRITICAL — execute_financial_decision() ثغرة خطيرة!
-- أي مستخدم authenticated يمكنه استدعاؤها!
-- الحل: إضافة فحص أدمن داخل الدالة
-- ============================================================

CREATE OR REPLACE FUNCTION public.execute_financial_decision(
  p_complaint_id UUID,
  p_decision_type TEXT,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_id UUID;
  v_rider_id UUID;
  v_driver_id UUID;
  v_final_fare INTEGER;
  v_amount INTEGER;
  v_result JSON;
BEGIN
  -----------------------------------------------------------
  -- 🔒 تحقق أن المستدعي أدمن (CRITICAL SECURITY CHECK)
  -----------------------------------------------------------
  IF NOT public.is_admin_or_moderator() THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح — أدمن فقط');
  END IF;

  -----------------------------------------------------------
  -- التحقق من صحة نوع القرار
  -----------------------------------------------------------
  IF p_decision_type NOT IN ('refund_to_rider', 'refund_to_driver', 'split_50_50', 'no_refund') THEN
    RETURN json_build_object('success', false, 'error', 'نوع قرار غير صالح');
  END IF;

  -----------------------------------------------------------
  -- جلب معلومات الرحلة
  -----------------------------------------------------------
  SELECT r.id, r.rider_id, r.driver_id, r.final_fare
  INTO v_ride_id, v_rider_id, v_driver_id, v_final_fare
  FROM ride_complaints c
  JOIN rides r ON r.id = c.ride_id
  WHERE c.id = p_complaint_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الشكوى غير موجودة');
  END IF;

  -- التحقق أن الشكوى لم تُحل مسبقاً
  IF EXISTS (
    SELECT 1 FROM ride_complaints
    WHERE id = p_complaint_id AND financial_decision_executed = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'تم تنفيذ القرار المالي لهذه الشكوى مسبقاً');
  END IF;

  -----------------------------------------------------------
  -- تنفيذ القرار المالي
  -----------------------------------------------------------
  CASE p_decision_type
    WHEN 'refund_to_rider' THEN
      v_amount := COALESCE(v_final_fare, 0);
      UPDATE profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
      WHERE user_id = v_rider_id;

      UPDATE driver_wallets
      SET balance = balance - v_amount
      WHERE driver_id = v_driver_id;

    WHEN 'refund_to_driver' THEN
      v_amount := COALESCE(v_final_fare, 0);
      UPDATE driver_wallets
      SET balance = balance + v_amount
      WHERE driver_id = v_driver_id;

    WHEN 'split_50_50' THEN
      v_amount := COALESCE(v_final_fare, 0) / 2;
      UPDATE profiles
      SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount
      WHERE user_id = v_rider_id;

      UPDATE driver_wallets
      SET balance = balance + v_amount
      WHERE driver_id = v_driver_id;

    WHEN 'no_refund' THEN
      v_amount := 0;
  END CASE;

  -----------------------------------------------------------
  -- تسجيل القرار في سجل التدقيق
  -----------------------------------------------------------
  INSERT INTO financial_decisions_log (
    complaint_id, ride_id, decision_type, amount,
    reason, decided_by, executed, executed_at,
    execution_details
  ) VALUES (
    p_complaint_id, v_ride_id, p_decision_type, v_amount,
    p_reason, auth.uid(), true, now(),
    json_build_object(
      'rider_id', v_rider_id,
      'driver_id', v_driver_id,
      'original_fare', v_final_fare,
      'refund_amount', v_amount
    )
  );

  -----------------------------------------------------------
  -- تحديث حالة الشكوى
  -----------------------------------------------------------
  UPDATE ride_complaints
  SET
    financial_decision = p_decision_type,
    financial_decision_notes = p_reason,
    financial_decision_executed = true,
    financial_decision_executed_at = now(),
    status = 'resolved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_complaint_id;

  RETURN json_build_object(
    'success', true,
    'decision', p_decision_type,
    'amount', v_amount,
    'ride_id', v_ride_id
  );
END;
$$;

-- ============================================================
-- SECTION 6: إعدادات الطوارئ
-- تعتمد على app_settings (مؤمّن من Batch 2) ✅
-- إضافة فحص: التأكد أن الـ update يعمل صح عبر upsert
-- ============================================================

-- لا إصلاح DB مطلوب — app_settings محمي بالفعل ✅

-- ============================================================
-- SECTION 7: Indexes إضافية للأداء
-- ============================================================

-- fraud_alerts: composite index مفيد
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status_severity
  ON public.fraud_alerts (status, severity, created_at DESC);

-- fraud_alerts: تنبيهات اليوم
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_today
  ON public.fraud_alerts (created_at DESC)
  WHERE status = 'pending';

-- ride_complaints: شكاوى بدون Pagination → إضافة حماية
-- (AdminComplaints لا يستخدم pagination — لكن يفلتر بـ status)
-- الـ index الموجود idx_complaints_status كافٍ ✅

-- ============================================================
-- END OF MIGRATION
-- الملاحظات:
-- 1. fraud_alerts: 🔴 CRITICAL — RLS Infinite Recursion مُصلح ✅
-- 2. ride_complaints: ترقية RLS لـ is_admin_or_moderator() ✅
-- 3. complaint_responses: ترقية RLS ✅
-- 4. financial_decisions_log: ترقية RLS ✅
-- 5. execute_financial_decision(): 🔴 CRITICAL — إضافة فحص أدمن
--    + منع التنفيذ المزدوج + التحقق من نوع القرار ✅
-- 6. AdminEmergencySettings: يعتمد على app_settings المحمي ✅
-- ============================================================
