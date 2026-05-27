-- ═══════════════════════════════════════════════════════════════════
-- Migration: إصلاح منطق الرصيد السالب في create_wallet_transaction
-- ═══════════════════════════════════════════════════════════════════
-- المشكلة: create_wallet_transaction ترفع استثناء عند أي رصيد سالب،
--           بينما النظام يسمح بدين حتى سقف debt_limit (افتراضياً -15000 IQD)
--           محدد في app_settings.monetization.debt_limit
--
-- السلوك الصحيح:
--   - السحب (withdrawal): يجب أن يبقى الرصيد >= 0
--   - باقي الخصومات (penalty, commission, adjustment, …): يُسمح بالدين حتى debt_limit
--   - إيداع / مكافأة (amount > 0): لا يوجد قيد
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- 1️⃣ create_wallet_transaction — استبدال قيد الرصيد الصفري بسقف الدين
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_wallet_transaction(
  p_driver_id UUID,
  p_transaction_type TEXT,
  p_amount DECIMAL(12,2),
  p_ride_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_transaction_id UUID;
  v_debt_limit DECIMAL(12,2);
BEGIN
  -- الحصول على المحفظة مع قفل لمنع race condition
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO driver_wallets (driver_id)
    VALUES (p_driver_id)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  -- حساب الرصيد الجديد
  v_new_balance := v_current_balance + p_amount;

  -- ══ التحقق من صحة الرصيد حسب نوع المعاملة ══
  IF p_amount < 0 THEN
    IF p_transaction_type = 'withdrawal' THEN
      -- السحب: لا يُسمح بالرصيد السالب إطلاقاً
      IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'insufficient_balance: الرصيد غير كافٍ للسحب (رصيدك: %, المطلوب: %)',
          v_current_balance, ABS(p_amount);
      END IF;
    ELSE
      -- خصومات إلزامية (penalty, commission, adjustment, …): يُسمح بالدين حتى السقف
      SELECT COALESCE((value->>'debt_limit')::DECIMAL(12,2), -15000)
      INTO v_debt_limit
      FROM app_settings
      WHERE key = 'monetization';

      v_debt_limit := COALESCE(v_debt_limit, -15000);

      IF v_new_balance < v_debt_limit THEN
        RAISE EXCEPTION 'debt_limit_reached: تجاوز سقف الدين (سقف: %, رصيد جديد: %)',
          v_debt_limit, v_new_balance;
      END IF;
    END IF;
  END IF;

  -- إنشاء المعاملة
  INSERT INTO wallet_transactions (
    wallet_id,
    driver_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    ride_id,
    description,
    metadata,
    status,
    processed_at
  ) VALUES (
    v_wallet_id,
    p_driver_id,
    p_transaction_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_ride_id,
    p_description,
    p_metadata,
    'completed',
    now()
  )
  RETURNING id INTO v_transaction_id;

  -- تحديث رصيد المحفظة
  UPDATE driver_wallets
  SET
    balance = v_new_balance,
    lifetime_earnings = lifetime_earnings + GREATEST(p_amount, 0),
    updated_at = now()
  WHERE id = v_wallet_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_wallet_transaction(UUID, TEXT, DECIMAL, UUID, TEXT, JSONB) IS
'معاملة محفظة ذرية مع قفل. السحب: رصيد >= 0. الخصومات الإلزامية: يُسمح بدين حتى app_settings.monetization.debt_limit';


-- ═══════════════════════════════════════════════════════════════════
-- 2️⃣ deduct_driver_commission — استخدام debt_limit في الفحص المسبق
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
  v_debt_limit DECIMAL(12,2);
BEGIN
  -- جلب سقف الدين من الإعدادات
  SELECT COALESCE((value->>'debt_limit')::DECIMAL(12,2), -15000)
  INTO v_debt_limit
  FROM app_settings
  WHERE key = 'monetization';

  v_debt_limit := COALESCE(v_debt_limit, -15000);

  -- جلب المحفظة الحالية
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

  -- التحقق من سقف الدين (ليس الرصيد الصفري)
  IF (v_wallet.balance - p_amount) < v_debt_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'تجاوز سقف الدين',
      'current_balance', v_wallet.balance,
      'debt_limit', v_debt_limit,
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
    jsonb_build_object('ride_id', p_ride_id)
  );

  -- تحديث commission_balance (حقل محاسبي تراكمي، منفصل عن رصيد المحفظة)
  UPDATE drivers
  SET commission_balance = COALESCE(commission_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = p_driver_id;

  RETURN jsonb_build_object(
    'success', true,
    'deducted', p_amount,
    'new_balance', v_wallet.balance - p_amount
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_driver_commission(UUID, INTEGER, UUID) IS
'خصم عمولة رحلة — يسمح بالدين حتى debt_limit من app_settings.monetization';
