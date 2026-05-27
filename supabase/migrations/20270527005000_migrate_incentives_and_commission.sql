-- ═══════════════════════════════════════════════════════════════════
-- Migration: ترحيل check_and_grant_incentives و deduct_driver_commission
--            من النظام القديم (driver_wallet_transactions) للنظام الجديد (wallet_transactions)
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- 1️⃣ check_and_grant_incentives — ترحيل كتابة المكافأة للنظام الجديد
--    الـ idempotency محفوظة عبر driver_incentive_claims ON CONFLICT
-- ═══════════════════════════════════════════════════════════════════

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
          -- ✅ النظام الجديد فقط (create_wallet_transaction يُنشئ driver_wallets تلقائياً)
          PERFORM public.create_wallet_transaction(
            p_driver_id,
            'bonus',
            v_incentive.bonus_amount::DECIMAL(12,2),
            NULL,
            'مكافأة: ' || v_incentive.name,
            jsonb_build_object(
              'incentive_id', v_incentive.id,
              'incentive_name', v_incentive.name,
              'period', v_incentive.period,
              'period_start', v_period_start,
              'rides_completed', v_rides_count
            )
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

COMMENT ON FUNCTION public.check_and_grant_incentives(UUID) IS
'منح حوافز الرحلات — idempotent عبر driver_incentive_claims — يكتب للنظام الجديد فقط';


-- ═══════════════════════════════════════════════════════════════════
-- 2️⃣ deduct_driver_commission — ترحيل للنظام الجديد
--    يبقى تحديث commission_balance (حقل محاسبي منفصل)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.deduct_driver_commission(
  p_driver_id UUID,
  p_amount INTEGER,
  p_ride_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  -- جلب المحفظة الحالية للتحقق من الرصيد
  SELECT id, balance INTO v_wallet
  FROM driver_wallets
  WHERE driver_id = p_driver_id;

  IF v_wallet.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا توجد محفظة للسائق',
      'driver_id', p_driver_id
    );
  END IF;

  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد غير كافي',
      'current_balance', v_wallet.balance,
      'required', p_amount
    );
  END IF;

  -- ✅ الخصم عبر النظام الجديد فقط
  PERFORM public.create_wallet_transaction(
    p_driver_id,
    'commission',
    (-p_amount)::DECIMAL(12,2),
    p_ride_id,
    'خصم عمولة رحلة',
    jsonb_build_object(
      'ride_id', p_ride_id
    )
  );

  -- تحديث commission_balance (حقل محاسبي تراكمي، منفصل عن رصيد المحفظة)
  UPDATE drivers
  SET commission_balance = COALESCE(commission_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = p_driver_id;

  RETURN jsonb_build_object(
    'success', true,
    'deducted', p_amount
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_driver_commission(UUID, INTEGER, UUID) IS
'خصم عمولة رحلة — يكتب للنظام الجديد فقط (wallet_transactions) + يحدث commission_balance';
