-- ══════════════════════════════════════════════════════════════
-- 💰 نظام الاشتراك اليومي النشط — Daily Active Subscription
-- ══════════════════════════════════════════════════════════════
-- monetization_mode = 'daily_subscription'
-- يُخصم عند أول رحلة مكتملة يومياً (Asia/Baghdad)
-- مع سقف دين ومنع الخصم المكرر (idempotency)
-- ══════════════════════════════════════════════════════════════

-- ═══ 1. إعداد النموذج المالي في app_settings ═══
INSERT INTO app_settings (key, value)
VALUES (
  'monetization',
  jsonb_build_object(
    'mode', 'daily_subscription',        -- 'commission' أو 'daily_subscription'
    'daily_fee', 3000,                    -- رسم يومي بالدينار
    'daily_fee_baghdad', 3000,            -- بغداد
    'daily_fee_provinces', 2000,          -- المحافظات
    'daily_fee_new_driver_days', 7,       -- أيام مجانية للسائق الجديد
    'daily_fee_new_driver_amount', 0,     -- رسم خلال الأيام المجانية
    'debt_limit', -15000,                 -- سقف الدين (5 أيام تقريباً)
    'charge_only_on_activity', true,      -- خصم فقط عند إكمال رحلة
    'commission_enabled', false,          -- العمولة معطلة حالياً
    'timezone', 'Asia/Baghdad'
  )
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- ═══ 2. إضافة نوع معاملة 'daily_fee' ═══
ALTER TABLE wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_transaction_type_check;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ride_earning',
    'commission',
    'tip',
    'withdrawal',
    'refund',
    'bonus',
    'penalty',
    'adjustment',
    'subscription',
    'topup',
    'daily_fee'
  ));

-- ═══ 3. دالة الاشتراك اليومي الذرية ═══
-- تُستدعى من complete-ride عند أول رحلة مكتملة في اليوم
CREATE OR REPLACE FUNCTION charge_daily_subscription(
  p_driver_id UUID,
  p_ride_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
  v_daily_fee DECIMAL(10,2);
  v_debt_limit DECIMAL(12,2);
  v_tz TEXT;
  v_today TEXT;
  v_idem_key TEXT;
  v_wallet RECORD;
  v_new_balance DECIMAL(12,2);
  v_driver RECORD;
  v_driver_age_days INT;
  v_free_days INT;
  v_free_amount DECIMAL(10,2);
BEGIN
  -- ═══ جلب إعدادات النموذج المالي ═══
  SELECT value INTO v_config
  FROM app_settings
  WHERE key = 'monetization';

  IF v_config IS NULL OR (v_config->>'mode') != 'daily_subscription' THEN
    -- النموذج ليس اشتراك يومي — لا تفعل شيئاً
    RETURN jsonb_build_object('charged', false, 'reason', 'mode_not_daily');
  END IF;

  v_daily_fee := COALESCE((v_config->>'daily_fee')::DECIMAL, 3000);
  v_debt_limit := COALESCE((v_config->>'debt_limit')::DECIMAL, -15000);
  v_tz := COALESCE(v_config->>'timezone', 'Asia/Baghdad');
  v_free_days := COALESCE((v_config->>'daily_fee_new_driver_days')::INT, 7);
  v_free_amount := COALESCE((v_config->>'daily_fee_new_driver_amount')::DECIMAL, 0);

  -- ═══ حساب تاريخ اليوم حسب توقيت بغداد ═══
  v_today := to_char(now() AT TIME ZONE v_tz, 'YYYY-MM-DD');

  -- ═══ مفتاح Idempotency — يمنع الخصم المكرر ═══
  v_idem_key := 'daily_sub_' || p_driver_id || '_' || v_today;

  -- التحقق من عدم الخصم سابقاً
  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE idempotency_key = v_idem_key
  ) THEN
    RETURN jsonb_build_object(
      'charged', false,
      'reason', 'already_charged_today',
      'date', v_today
    );
  END IF;

  -- ═══ التحقق من عمر السائق (أيام مجانية) ═══
  SELECT created_at INTO v_driver
  FROM drivers
  WHERE id = p_driver_id;

  IF v_driver.created_at IS NOT NULL THEN
    v_driver_age_days := EXTRACT(DAY FROM (now() - v_driver.created_at))::INT;
    IF v_driver_age_days < v_free_days THEN
      v_daily_fee := v_free_amount; -- مجاني أو مخفض
    END IF;
  END IF;

  -- إذا الرسم = 0 (فترة مجانية)، سجّل بدون خصم
  IF v_daily_fee <= 0 THEN
    RETURN jsonb_build_object(
      'charged', false,
      'reason', 'free_period',
      'days_remaining', GREATEST(0, v_free_days - COALESCE(v_driver_age_days, 0)),
      'date', v_today
    );
  END IF;

  -- ═══ جلب المحفظة مع قفل ═══
  SELECT id, balance INTO v_wallet
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO driver_wallets (driver_id, balance)
    VALUES (p_driver_id, 0)
    RETURNING id, balance INTO v_wallet;
  END IF;

  -- ═══ التحقق من سقف الدين ═══
  v_new_balance := v_wallet.balance - v_daily_fee;

  IF v_new_balance < v_debt_limit THEN
    RETURN jsonb_build_object(
      'charged', false,
      'reason', 'debt_limit_reached',
      'balance', v_wallet.balance,
      'debt_limit', v_debt_limit,
      'daily_fee', v_daily_fee,
      'date', v_today
    );
  END IF;

  -- ═══ خصم الرسم اليومي ═══
  UPDATE driver_wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- ═══ تسجيل في الدفتر/Ledger ═══
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
    settlement_type,
    idempotency_key,
    processed_at
  ) VALUES (
    v_wallet.id,
    p_driver_id,
    'daily_fee',
    -v_daily_fee,
    v_wallet.balance,
    v_new_balance,
    p_ride_id,
    format('اشتراك يومي — %s', v_today),
    jsonb_build_object(
      'date', v_today,
      'timezone', v_tz,
      'daily_fee', v_daily_fee,
      'trigger_ride_id', p_ride_id,
      'driver_age_days', v_driver_age_days
    ),
    'completed',
    'subscription',
    v_idem_key,
    now()
  );

  -- ═══ النتيجة ═══
  RETURN jsonb_build_object(
    'charged', true,
    'daily_fee', v_daily_fee,
    'balance_before', v_wallet.balance,
    'balance_after', v_new_balance,
    'date', v_today,
    'idempotency_key', v_idem_key
  );

EXCEPTION
  WHEN unique_violation THEN
    -- idempotency_key مكرر — تم الخصم بالفعل
    RETURN jsonb_build_object(
      'charged', false,
      'reason', 'already_charged_today',
      'date', v_today
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION charge_daily_subscription IS
  'خصم اشتراك يومي ذري عند أول رحلة مكتملة — مع idempotency وسقف دين';

-- ═══ 4. فهرس لتسريع البحث عن اشتراكات اليوم ═══
CREATE INDEX IF NOT EXISTS idx_wallet_tx_daily_fee_type
  ON wallet_transactions(driver_id, transaction_type, created_at DESC)
  WHERE transaction_type = 'daily_fee';
