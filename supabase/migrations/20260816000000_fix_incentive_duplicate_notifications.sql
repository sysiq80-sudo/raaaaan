-- ═══════════════════════════════════════════════════════════════════════════
-- إصلاح التكرار في إشعارات المكافآت
-- المشكلة: race condition في check_and_grant_incentives() تسمح بإدراج صفين 
-- متطابقين في driver_incentive_claims مما يطلق التريغر مرتين → إشعارَيْ FCM
-- الحل: قيد UNIQUE + ON CONFLICT DO NOTHING لجعل الدالة idempotent
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. التأكد من وجود قيد UNIQUE على (driver_id, incentive_id, period_start)
--    ⚠️ القيد موجود مسبقاً من migration 20251220150348 (باسم مُولَّد تلقائياً)
--    نتحقق بناءً على الأعمدة الفعلية وليس الاسم فقط
DO $$
BEGIN
  -- فحص: هل يوجد أي UNIQUE constraint على هذه الأعمدة الثلاثة؟
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'driver_incentive_claims'
      AND c.contype = 'u'
      AND c.conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'driver_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'incentive_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'period_start')
      ]
  ) THEN
    ALTER TABLE public.driver_incentive_claims
      ADD CONSTRAINT uq_incentive_claim_per_period
      UNIQUE (driver_id, incentive_id, period_start);
    RAISE NOTICE '✅ تم إضافة UNIQUE constraint على driver_incentive_claims';
  ELSE
    RAISE NOTICE '⏭  UNIQUE constraint على (driver_id, incentive_id, period_start) موجود مسبقاً — تم تخطيه';
  END IF;
END
$$;

-- 2. إضافة قيد UNIQUE على (driver_id, fcm_token) في push_subscriptions
--    يمنع تراكم رموز FCM المكررة لنفس السائق عند إعادة التسجيل
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_driver_fcm_token'
  ) THEN
    -- إزالة أي سجلات مكررة أولاً (احتفظ بالأحدث)
    DELETE FROM public.push_subscriptions ps1
    USING public.push_subscriptions ps2
    WHERE ps1.driver_id = ps2.driver_id
      AND ps1.fcm_token = ps2.fcm_token
      AND ps1.fcm_token IS NOT NULL
      AND ps1.created_at < ps2.created_at;

    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT uq_driver_fcm_token
      UNIQUE (driver_id, fcm_token);
    RAISE NOTICE '✅ تم إضافة UNIQUE constraint على push_subscriptions(driver_id, fcm_token)';
  ELSE
    RAISE NOTICE '⏭  UNIQUE constraint موجود مسبقاً — تم تخطيه';
  END IF;
END
$$;

-- 3. تحديث دالة check_and_grant_incentives لتكون idempotent
--    الإضافة: ON CONFLICT DO NOTHING تمنع الخطأ عند تزامن استدعاءين
CREATE OR REPLACE FUNCTION public.check_and_grant_incentives(p_driver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incentive RECORD;
  v_rides_count INTEGER;
  v_period_start DATE;
  v_period_end DATE;
  v_already_claimed BOOLEAN;
  v_rows_inserted INTEGER;
BEGIN
  -- المرور على جميع الحوافز النشطة
  FOR v_incentive IN 
    SELECT * FROM driver_incentives WHERE is_active = true
  LOOP
    -- تحديد فترة الحافز
    CASE v_incentive.period
      WHEN 'daily' THEN
        v_period_start := CURRENT_DATE;
        v_period_end := CURRENT_DATE;
      WHEN 'weekly' THEN
        v_period_start := date_trunc('week', CURRENT_DATE)::DATE;
        v_period_end := (date_trunc('week', CURRENT_DATE) + interval '6 days')::DATE;
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
        v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;
    END CASE;
    
    -- التحقق من عدم وجود مطالبة سابقة لهذه الفترة
    SELECT EXISTS (
      SELECT 1 FROM driver_incentive_claims 
      WHERE driver_id = p_driver_id 
        AND incentive_id = v_incentive.id 
        AND period_start = v_period_start
    ) INTO v_already_claimed;
    
    IF NOT v_already_claimed THEN
      -- حساب عدد الرحلات المكتملة في هذه الفترة
      SELECT COUNT(*) INTO v_rides_count
      FROM rides
      WHERE driver_id = p_driver_id
        AND status = 'completed'
        AND completed_at::DATE >= v_period_start
        AND completed_at::DATE <= v_period_end;
      
      -- إذا وصل للعدد المطلوب، منح المكافأة
      IF v_rides_count >= v_incentive.rides_required THEN
        -- إضافة سجل المطالبة مع ON CONFLICT لمنع التكرار عند التزامن
        INSERT INTO driver_incentive_claims (
          driver_id, incentive_id, period_start, period_end, 
          rides_completed, bonus_earned
        ) VALUES (
          p_driver_id, v_incentive.id, v_period_start, v_period_end,
          v_rides_count, v_incentive.bonus_amount
        )
        ON CONFLICT (driver_id, incentive_id, period_start) DO NOTHING;

        -- تحقق هل تم الإدراج فعلاً (وليس تجاهله بسبب التزامن)
        GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

        IF v_rows_inserted > 0 THEN
          -- إضافة المكافأة للمحفظة فقط إذا تم إدراج سجل جديد
          INSERT INTO driver_wallet_transactions (
            driver_id, amount, type, description
          ) VALUES (
            p_driver_id, v_incentive.bonus_amount, 'bonus',
            'مكافأة: ' || v_incentive.name
          );

          RAISE LOG 'Granted incentive % to driver %: % IQD', 
            v_incentive.name, p_driver_id, v_incentive.bonus_amount;
        ELSE
          RAISE LOG 'Skipped duplicate incentive % for driver % (race condition ignored)', 
            v_incentive.name, p_driver_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;
