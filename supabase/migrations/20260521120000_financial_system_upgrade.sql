-- ══════════════════════════════════════════════════════════════
-- 💰 تحسينات النظام المالي — Atomic Subscription + Idempotency
-- ══════════════════════════════════════════════════════════════
-- 1. subscribe_driver_to_plan — اشتراك ذري مع ledger كامل
-- 2. إضافة subscription نوع معاملة إلى wallet_transactions
-- 3. إضافة idempotency_key لمنع التكرار
-- ══════════════════════════════════════════════════════════════

-- ═══ 1. توسيع أنواع المعاملات لتشمل subscription ═══
-- نحتاج إضافة 'subscription' كنوع معاملة
-- لكن wallet_transactions يستخدم CHECK constraint
-- نضيف النوع الجديد
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
    'topup'
  ));

-- ═══ 2. إضافة idempotency_key لمنع التكرار ═══
-- يمنع: إكمال الرحلة مرتين، اشتراك مزدوج، خصم مكرر
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- فهرس فريد على idempotency_key (يمنع التكرار)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency
  ON wallet_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ═══ 3. إضافة settlement_type لتوضيح مسار cash vs online ═══
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS settlement_type TEXT
  DEFAULT 'standard'
  CHECK (settlement_type IN (
    'standard',          -- عادي
    'cash_collection',   -- كاش: العمولة دين على السائق
    'online_settlement', -- أونلاين: الشركة تحول الصافي
    'subscription',      -- اشتراك: خصم من المحفظة
    'penalty',           -- غرامة
    'manual'             -- تعديل يدوي
  ));

-- ═══ 4. دالة اشتراك ذرية — subscribe_driver_to_plan ═══
-- كل شيء في transaction واحدة: تحقق + خصم + سجل + اشتراك
CREATE OR REPLACE FUNCTION subscribe_driver_to_plan(
  p_driver_id UUID,
  p_plan_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_plan RECORD;
  v_wallet RECORD;
  v_new_balance DECIMAL(12,2);
  v_expires_at TIMESTAMPTZ;
  v_subscription_id UUID;
  v_transaction_id UUID;
  v_idem_key TEXT;
  v_existing_sub RECORD;
BEGIN
  -- ═══ التحقق من الخطة ═══
  SELECT * INTO v_plan
  FROM subscription_plans
  WHERE id = p_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_NOT_FOUND: الخطة غير موجودة أو غير مفعلة';
  END IF;

  -- ═══ التحقق من عدم وجود اشتراك فعّال ═══
  SELECT id INTO v_existing_sub
  FROM driver_subscriptions
  WHERE driver_id = p_driver_id
    AND status = 'active'
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'ALREADY_SUBSCRIBED: لديك اشتراك فعّال بالفعل';
  END IF;

  -- ═══ الحصول على المحفظة مع قفل (FOR UPDATE يمنع race condition) ═══
  SELECT id, balance INTO v_wallet
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- إنشاء محفظة جديدة إذا لم تكن موجودة
    INSERT INTO driver_wallets (driver_id, balance)
    VALUES (p_driver_id, 0)
    RETURNING id, balance INTO v_wallet;
  END IF;

  -- ═══ التحقق من الرصيد ═══
  IF v_wallet.balance < v_plan.price THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: رصيد غير كافٍ. الرصيد: % — المطلوب: %',
      v_wallet.balance, v_plan.price;
  END IF;

  -- ═══ حساب الرصيد الجديد وتاريخ الانتهاء ═══
  v_new_balance := v_wallet.balance - v_plan.price;
  v_expires_at := now() + (v_plan.duration_days || ' days')::INTERVAL;

  -- ═══ مفتاح Idempotency لمنع الاشتراك المزدوج ═══
  v_idem_key := 'sub_' || p_driver_id || '_' || p_plan_id || '_' || to_char(now(), 'YYYYMMDD');

  -- ═══ 1. خصم المبلغ من المحفظة (ذري) ═══
  UPDATE driver_wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- ═══ 2. تسجيل المعاملة في الدفتر/Ledger ═══
  INSERT INTO wallet_transactions (
    wallet_id,
    driver_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status,
    settlement_type,
    idempotency_key,
    processed_at
  ) VALUES (
    v_wallet.id,
    p_driver_id,
    'subscription',
    -v_plan.price,
    v_wallet.balance,
    v_new_balance,
    format('اشتراك خطة %s (%s يوم)', v_plan.name_ar, v_plan.duration_days),
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_name', v_plan.name_ar,
      'plan_price', v_plan.price,
      'duration_days', v_plan.duration_days,
      'commission_discount', v_plan.commission_discount,
      'expires_at', v_expires_at
    ),
    'completed',
    'subscription',
    v_idem_key,
    now()
  )
  RETURNING id INTO v_transaction_id;

  -- ═══ 3. إنشاء الاشتراك ═══
  INSERT INTO driver_subscriptions (
    driver_id,
    plan_id,
    starts_at,
    expires_at,
    status,
    payment_method,
    amount_paid
  ) VALUES (
    p_driver_id,
    p_plan_id,
    now(),
    v_expires_at,
    'active',
    'wallet',
    v_plan.price
  )
  RETURNING id INTO v_subscription_id;

  -- ═══ 4. إرجاع النتيجة ═══
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'transaction_id', v_transaction_id,
    'plan_name', v_plan.name_ar,
    'amount_paid', v_plan.price,
    'balance_before', v_wallet.balance,
    'balance_after', v_new_balance,
    'starts_at', now(),
    'expires_at', v_expires_at,
    'commission_discount', v_plan.commission_discount
  );

EXCEPTION
  WHEN unique_violation THEN
    -- idempotency_key مكرر — الاشتراك تمّ بالفعل
    RAISE EXCEPTION 'ALREADY_SUBSCRIBED: اشتراك فعّال بالفعل لهذا اليوم';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION subscribe_driver_to_plan IS
  'اشتراك ذري: تحقق رصيد + خصم + ledger + اشتراك — كل شيء في transaction واحدة';


-- ═══ 5. تحديث process_ride_earnings لدعم settlement_type + idempotency ═══
CREATE OR REPLACE FUNCTION process_ride_earnings(
  p_ride_id UUID,
  p_driver_id UUID,
  p_total_fare DECIMAL(10,2),
  p_commission_rate DECIMAL(5,2) DEFAULT 15.00
)
RETURNS JSONB AS $$
DECLARE
  v_commission DECIMAL(10,2);
  v_driver_earning DECIMAL(10,2);
  v_wallet_id UUID;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_earnings_tx_id UUID;
  v_commission_tx_id UUID;
  v_idem_key_earn TEXT;
  v_idem_key_comm TEXT;
  v_ride RECORD;
  v_settlement TEXT;
BEGIN
  -- ═══ مفتاح Idempotency — يمنع معالجة نفس الرحلة مرتين ═══
  v_idem_key_earn := 'ride_earn_' || p_ride_id;
  v_idem_key_comm := 'ride_comm_' || p_ride_id;

  -- التحقق من عدم وجود معاملة سابقة لهذه الرحلة
  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE idempotency_key = v_idem_key_earn
  ) THEN
    -- الرحلة تمت معالجتها بالفعل — إرجاع بيانات سابقة
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'total_fare', p_total_fare
    );
  END IF;

  -- جلب بيانات الرحلة لمعرفة طريقة الدفع
  SELECT payment_method INTO v_ride
  FROM rides WHERE id = p_ride_id;

  -- تحديد نوع التسوية حسب طريقة الدفع
  -- cash → العمولة دين على السائق (السائق استلم كاش كامل)
  -- online → الشركة تحول الصافي
  IF v_ride.payment_method IN ('cash', 'zain_cash', 'asia_hawala') THEN
    v_settlement := 'cash_collection';
  ELSE
    v_settlement := 'online_settlement';
  END IF;

  -- حساب العمولة والأرباح
  v_commission := ROUND(p_total_fare * p_commission_rate / 100, 2);
  v_driver_earning := p_total_fare - v_commission;

  -- الحصول على المحفظة مع قفل
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO driver_wallets (driver_id)
    VALUES (p_driver_id)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  -- ═══ للكاش: السائق استلم المبلغ كاملاً → نخصم العمولة فقط ═══
  -- ═══ للأونلاين: نضيف صافي الربح ═══
  IF v_settlement = 'cash_collection' THEN
    -- الكاش: العمولة تُسجّل كدين (خصم من المحفظة)
    v_new_balance := v_current_balance - v_commission;

    -- تسجيل معاملة خصم العمولة
    INSERT INTO wallet_transactions (
      wallet_id, driver_id, transaction_type, amount,
      balance_before, balance_after, ride_id,
      description, metadata, status, settlement_type, idempotency_key, processed_at
    ) VALUES (
      v_wallet_id, p_driver_id, 'commission', -v_commission,
      v_current_balance, v_new_balance, p_ride_id,
      format('عمولة رحلة نقدية (%s%%)', p_commission_rate),
      jsonb_build_object('total_fare', p_total_fare, 'commission_rate', p_commission_rate, 'payment', 'cash'),
      'completed', 'cash_collection', v_idem_key_comm, now()
    )
    RETURNING id INTO v_commission_tx_id;
    v_earnings_tx_id := v_commission_tx_id;

  ELSE
    -- أونلاين: نضيف صافي الربح فقط
    v_new_balance := v_current_balance + v_driver_earning;

    -- تسجيل معاملة الأرباح
    INSERT INTO wallet_transactions (
      wallet_id, driver_id, transaction_type, amount,
      balance_before, balance_after, ride_id,
      description, metadata, status, settlement_type, idempotency_key, processed_at
    ) VALUES (
      v_wallet_id, p_driver_id, 'ride_earning', v_driver_earning,
      v_current_balance, v_new_balance, p_ride_id,
      format('أرباح رحلة إلكترونية (صافي بعد عمولة %s%%)', p_commission_rate),
      jsonb_build_object('total_fare', p_total_fare, 'commission_rate', p_commission_rate, 'commission', v_commission, 'payment', 'online'),
      'completed', 'online_settlement', v_idem_key_earn, now()
    )
    RETURNING id INTO v_earnings_tx_id;
    v_commission_tx_id := v_earnings_tx_id;
  END IF;

  -- تحديث رصيد المحفظة
  UPDATE driver_wallets
  SET
    balance = v_new_balance,
    lifetime_earnings = lifetime_earnings + v_driver_earning,
    total_rides_completed = total_rides_completed + 1,
    commission_paid = commission_paid + v_commission,
    updated_at = now()
  WHERE id = v_wallet_id;

  -- إرجاع النتائج
  RETURN jsonb_build_object(
    'success', true,
    'total_fare', p_total_fare,
    'commission', v_commission,
    'driver_earning', v_driver_earning,
    'settlement_type', v_settlement,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance,
    'earnings_transaction_id', v_earnings_tx_id,
    'commission_transaction_id', v_commission_tx_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_ride_earnings IS
  'معالجة أرباح الرحلة مع ledger كامل + idempotency + تمييز cash vs online';


-- ═══ 6. فهارس إضافية للأداء والتدقيق ═══
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_settlement
  ON wallet_transactions(settlement_type)
  WHERE settlement_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_driver_subscriptions_active
  ON driver_subscriptions(driver_id, status, expires_at)
  WHERE status = 'active';
