-- ══════════════════════════════════════════════════════════════════════════════
-- RAAN — Rider Wallet Ledger Hardening
-- Migration: إضافة balance_before و balance_after إلى rider_wallet_transactions
-- Date: 2026-05-30
-- ══════════════════════════════════════════════════════════════════════════════
--
-- الهدف:
--   كل حركة مالية على محفظة الراكب تُسجّل الرصيد قبلها وبعدها.
--   هذا يتيح:
--     • مراجعة محاسبية كاملة (ledger audit)
--     • اكتشاف Drift تلقائياً (balance_after يجب أن يساوي balance_before الحركة التالية)
--     • Observability alerts
--
-- الدوال المُعدَّلة:
--   1. deduct_wallet_safely        — دفع أجرة رحلة من المحفظة
--   2. redeem_voucher              — استرداد كارت شحن راكب
--   3. cancel_ride_by_rider        — غرامة إلغاء راكب
--   4. approve_topup_request       — موافقة الأدمن على شحن محفظة الراكب
--   5. handle_rider_cancellation_penalty — trigger غرامة إلغاء (مسار الـ trigger القديم)
--
-- الأعمدة الجديدة: nullable لحماية الصفوف القديمة من الكسر
-- Rollback:
--   ALTER TABLE rider_wallet_transactions
--     DROP COLUMN IF EXISTS balance_before,
--     DROP COLUMN IF EXISTS balance_after;
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. إضافة الأعمدة
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rider_wallet_transactions
  ADD COLUMN IF NOT EXISTS balance_before NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS balance_after  NUMERIC(12,2);

COMMENT ON COLUMN public.rider_wallet_transactions.balance_before IS
  'رصيد المحفظة قبل هذه الحركة (IQD). NULL للحركات قبل 2026-05-30.';

COMMENT ON COLUMN public.rider_wallet_transactions.balance_after IS
  'رصيد المحفظة بعد هذه الحركة (IQD). NULL للحركات قبل 2026-05-30.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. deduct_wallet_safely — دفع أجرة رحلة من محفظة الراكب
--    المصدر الأحدث: 20260904000000_atomic_rider_cancellation_rpc.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deduct_wallet_safely(
  p_user_id UUID,
  p_amount  INTEGER,
  p_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
  v_role            TEXT := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;

  IF v_role <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() != p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرّح', 'code', 'UNAUTHORIZED');
  END IF;

  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  IF COALESCE(v_current_balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد المحفظة غير كافٍ',
      'current_balance', COALESCE(v_current_balance, 0),
      'required', p_amount
    );
  END IF;

  v_new_balance := COALESCE(v_current_balance, 0) - p_amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance,
      updated_at     = now()
  WHERE user_id = p_user_id;

  INSERT INTO rider_wallet_transactions (
    user_id, amount, type, status, payment_method, ride_id, description,
    balance_before, balance_after
  ) VALUES (
    p_user_id, -p_amount, 'ride_payment', 'completed', 'wallet', p_ride_id,
    'دفع أجرة رحلة من المحفظة',
    COALESCE(v_current_balance, 0), v_new_balance
  );

  RETURN jsonb_build_object(
    'success',        true,
    'new_balance',    v_new_balance,
    'amount_deducted', p_amount,
    'ride_id',        p_ride_id
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_safely IS
  'خصم رصيد الراكب بشكل آمن مع قفل الصف وتسجيل balance_before/after في rider_wallet_transactions';

REVOKE EXECUTE ON FUNCTION public.deduct_wallet_safely(UUID, INTEGER, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deduct_wallet_safely(UUID, INTEGER, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. redeem_voucher — استرداد كارت شحن راكب
--    المصدر الأحدث: 20260530000001_fix_voucher_null_auth_check.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_code    TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher         RECORD;
  v_current_balance DECIMAL(12,2);
  v_new_balance     DECIMAL(12,2);
BEGIN
  -- FIX: IS DISTINCT FROM بدل != لمعالجة NULL بأمان (يمنع anon)
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح — يمكنك شحن محفظتك فقط');
  END IF;

  p_code := UPPER(TRIM(p_code));

  SELECT * INTO v_voucher
  FROM voucher_codes WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الرمز غير صحيح أو غير موجود');
  END IF;

  IF v_voucher.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا الكارت مستخدم مسبقاً');
  END IF;

  IF v_voucher.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا الكارت غير فعّال');
  END IF;

  -- ═══ فصل النوع: يرفض كروت السائق ═══
  IF v_voucher.audience = 'driver' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا كارت سائق — لا يمكن استخدامه كراكب');
  END IF;

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE voucher_codes SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'انتهت صلاحية هذا الكارت');
  END IF;

  SELECT wallet_balance INTO v_current_balance
  FROM profiles WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  v_new_balance := COALESCE(v_current_balance, 0) + v_voucher.amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE voucher_codes
  SET status = 'redeemed', redeemed_by = p_user_id,
      redeemed_at = now(), updated_at = now()
  WHERE id = v_voucher.id;

  INSERT INTO rider_wallet_transactions (
    user_id, amount, type, status, payment_method, description, reference_id,
    balance_before, balance_after
  ) VALUES (
    p_user_id, v_voucher.amount, 'topup', 'completed', 'voucher',
    format('شحن كارت راكب — %s', p_code), v_voucher.id::TEXT,
    COALESCE(v_current_balance, 0), v_new_balance
  );

  RETURN jsonb_build_object(
    'success',     true,
    'amount',      v_voucher.amount,
    'new_balance', v_new_balance,
    'code',        p_code
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء معالجة الكارت');
END;
$$;

COMMENT ON FUNCTION public.redeem_voucher IS
  'استرداد كارت شحن راكب مع تسجيل balance_before/after';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. cancel_ride_by_rider — غرامة إلغاء الراكب (RPC مباشر)
--    المصدر الأحدث: 20260904000000_atomic_rider_cancellation_rpc.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_ride_by_rider(
  p_ride_id        UUID,
  p_rider_user_id  UUID,
  p_reason         TEXT DEFAULT 'لم يحدد سبب'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ride               RECORD;
  v_penalty            JSONB;
  v_penalty_amount     INTEGER := 0;
  v_current_balance    INTEGER := 0;
  v_new_balance        INTEGER := 0;
  v_penalty_paid       BOOLEAN := false;
  v_cancellable_statuses TEXT[] := ARRAY['pending', 'accepted', 'arrived'];
BEGIN
  -- لا نثق بأي user_id يأتي من العميل بدون مطابقته مع JWT
  IF auth.uid() IS NULL OR auth.uid() != p_rider_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'غير مصرّح',
      'code',    'UNAUTHORIZED'
    );
  END IF;

  -- ═══ 1. جلب الرحلة مع قفل الصف لمنع race condition ═══
  SELECT * INTO v_ride
  FROM rides
  WHERE id = p_ride_id
  FOR UPDATE;

  IF v_ride IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'الرحلة غير موجودة',
      'code',    'RIDE_NOT_FOUND'
    );
  END IF;

  -- ═══ 2. التحقق من أن الرحلة تابعة لهذا الراكب ═══
  IF v_ride.rider_id != p_rider_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'غير مصرّح: الرحلة ليست لهذا الراكب',
      'code',    'UNAUTHORIZED'
    );
  END IF;

  -- ═══ 3. التحقق من أن الحالة قابلة للإلغاء ═══
  IF NOT (v_ride.status = ANY(v_cancellable_statuses)) THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'لا يمكن إلغاء رحلة بحالة: ' || v_ride.status,
      'code',           'INVALID_STATUS',
      'current_status', v_ride.status
    );
  END IF;

  -- ═══ 4. حساب الغرامة (إذا السائق قبل أو وصل) ═══
  IF v_ride.status IN ('accepted', 'arrived') THEN
    v_penalty := public.calculate_cancellation_penalty(p_ride_id);
    IF v_penalty IS NOT NULL AND (v_penalty->>'should_penalize')::BOOLEAN = true THEN
      v_penalty_amount := COALESCE((v_penalty->>'penalty_amount')::INTEGER, 0);
    END IF;
  END IF;

  -- ═══ 5. خصم الغرامة من المحفظة (إن وُجدت) ═══
  IF v_penalty_amount > 0 THEN
    SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE user_id = p_rider_user_id
    FOR UPDATE;

    IF FOUND AND COALESCE(v_current_balance, 0) >= v_penalty_amount THEN
      v_new_balance := COALESCE(v_current_balance, 0) - v_penalty_amount;

      UPDATE profiles
      SET wallet_balance = v_new_balance,
          updated_at     = now()
      WHERE user_id = p_rider_user_id;

      INSERT INTO rider_wallet_transactions (
        user_id, amount, type, status, payment_method, ride_id, description,
        balance_before, balance_after
      ) VALUES (
        p_rider_user_id, -v_penalty_amount, 'ride_payment', 'completed', 'wallet', p_ride_id,
        format('غرامة إلغاء رحلة #%s', substring(p_ride_id::TEXT, 1, 8)),
        COALESCE(v_current_balance, 0), v_new_balance
      );

      v_penalty_paid := true;
    END IF;
  END IF;

  -- ═══ 6. تحديث الرحلة إلى ملغاة (ذري مع شرط الحالة) ═══
  UPDATE rides
  SET
    status              = 'cancelled',
    cancelled_by        = 'rider',
    cancellation_reason = p_reason,
    cancellation_fee    = v_penalty_amount,
    cancellation_fee_paid = v_penalty_paid,
    updated_at          = now()
  WHERE id = p_ride_id
    AND status = ANY(v_cancellable_statuses); -- حماية إضافية ضد race condition

  IF NOT FOUND THEN
    -- الرحلة تغيرت حالتها بين الجلب والتحديث (race condition)
    RETURN jsonb_build_object(
      'success', false,
      'error',   'تم تغيير حالة الرحلة من طرف آخر',
      'code',    'RACE_CONDITION'
    );
  END IF;

  -- ═══ 7. إرجاع النتيجة ═══
  RETURN jsonb_build_object(
    'success',         true,
    'ride_id',         p_ride_id,
    'cancelled_status', v_ride.status,
    'penalty_amount',  v_penalty_amount,
    'penalty_paid',    v_penalty_paid,
    'penalty_reason',  COALESCE(v_penalty->>'reason', 'none')
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_ride_by_rider IS
  'إلغاء رحلة من الراكب بشكل ذري مع حساب وخصم الغرامة وتسجيل balance_before/after';

REVOKE EXECUTE ON FUNCTION public.cancel_ride_by_rider(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_ride_by_rider(UUID, UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. approve_topup_request — موافقة الأدمن على شحن محفظة الراكب
--    المصدر الأحدث: 20261001001000_secure_topup_admin_only.sql
--    التغيير: إضافة SELECT لجلب balance قبل UPDATE + تمرير القيم للـ INSERT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_topup_request(
  p_request_id  UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request        RECORD;
  v_driver_id      UUID;
  v_wallet         RECORD;
  v_balance_before DECIMAL(12,2);
  v_balance_after  DECIMAL(12,2);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ADMIN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM wallet_topup_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود أو تمت معالجته');
  END IF;

  UPDATE wallet_topup_requests
  SET status      = 'approved',
      admin_notes = p_admin_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id;

  IF v_request.user_type = 'rider' THEN
    -- جلب الرصيد الحالي قبل التحديث (للـ ledger)
    SELECT COALESCE(wallet_balance, 0) INTO v_balance_before
    FROM profiles WHERE user_id = v_request.user_id;

    v_balance_after := v_balance_before + v_request.amount;

    UPDATE profiles
    SET wallet_balance = v_balance_after,
        updated_at     = now()
    WHERE user_id = v_request.user_id;

    INSERT INTO rider_wallet_transactions (
      user_id,
      amount,
      type,
      payment_method,
      reference_id,
      description,
      status,
      balance_before,
      balance_after
    ) VALUES (
      v_request.user_id,
      v_request.amount,
      'topup',
      v_request.payment_method,
      v_request.reference_number,
      'إضافة رصيد',
      'completed',
      v_balance_before,
      v_balance_after
    );
  ELSE
    -- Driver wallet — unchanged logic
    SELECT id INTO v_driver_id
    FROM drivers
    WHERE user_id = v_request.user_id;

    IF v_driver_id IS NULL THEN
      RAISE EXCEPTION 'DRIVER_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_wallet
    FROM driver_wallets
    WHERE driver_id = v_driver_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_balance_before := 0;
      v_balance_after  := v_request.amount;

      INSERT INTO driver_wallets (driver_id, balance)
      VALUES (v_driver_id, v_balance_after)
      RETURNING * INTO v_wallet;
    ELSE
      v_balance_before := COALESCE(v_wallet.balance, 0);
      v_balance_after  := v_balance_before + v_request.amount;

      UPDATE driver_wallets
      SET balance    = v_balance_after,
          updated_at = now()
      WHERE id = v_wallet.id;
    END IF;

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
      processed_at,
      processed_by
    ) VALUES (
      v_wallet.id,
      v_driver_id,
      'topup',
      v_request.amount,
      v_balance_before,
      v_balance_after,
      'شحن رصيد المحفظة من الإدارة',
      jsonb_build_object(
        'request_id',       p_request_id,
        'payment_method',   v_request.payment_method,
        'reference_number', v_request.reference_number
      ),
      'completed',
      'manual',
      'topup_' || p_request_id::TEXT,
      now(),
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', v_request.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_topup_request(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_topup_request(UUID, TEXT) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. handle_rider_cancellation_penalty — trigger غرامة إلغاء الراكب
--    المصدر الأحدث: 20270527004000_remove_dual_writes_fix_trigger_payload.sql
--    التغيير: إضافة SELECT لـ v_rider_balance قبل INSERT + تمرير balance columns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_rider_cancellation_penalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_penalty        JSONB;
  v_penalty_amount INTEGER;
  v_driver_id      UUID;
  v_rider_user_id  UUID;
  v_driver_lat     FLOAT;
  v_driver_lng     FLOAT;
  v_pickup_lat     FLOAT;
  v_pickup_lng     FLOAT;
  v_distance_km    FLOAT;
  v_rider_balance  INTEGER;
BEGIN
  -- ═══ فحص الشروط الأساسية ═══
  IF NEW.cancelled_by != 'rider'
     OR OLD.status NOT IN ('accepted', 'arrived')
     OR OLD.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_driver_id     := OLD.driver_id;
  v_rider_user_id := OLD.rider_id;

  -- ═══ حساب الغرامة ═══
  v_penalty := public.calculate_cancellation_penalty(NEW.id);

  IF NOT (v_penalty->>'should_penalize')::BOOLEAN THEN
    RAISE NOTICE 'Ride % cancelled by rider — no penalty (reason: %)', NEW.id, v_penalty->>'reason';
    RETURN NEW;
  END IF;

  v_penalty_amount := (v_penalty->>'penalty_amount')::INTEGER;

  -- ═══ حساب المسافة وتسجيلها ═══
  v_distance_km                  := (v_penalty->>'distance_to_pickup_km')::FLOAT;
  NEW.distance_to_pickup_at_cancel := v_distance_km;
  NEW.cancellation_fee           := v_penalty_amount;

  -- ═══ جلب الرصيد الحالي للراكب (للـ ledger) ═══
  SELECT COALESCE(wallet_balance, 0) INTO v_rider_balance
  FROM profiles WHERE user_id = v_rider_user_id;

  -- ═══ خصم من محفظة الراكب ═══
  INSERT INTO rider_wallet_transactions (
    user_id,
    amount,
    type,
    description,
    ride_id,
    status,
    balance_before,
    balance_after
  ) VALUES (
    v_rider_user_id,
    -v_penalty_amount,
    'ride_payment',
    format('غرامة إلغاء رحلة #%s — %s', LEFT(NEW.id::TEXT, 8), v_penalty->>'reason'),
    NEW.id,
    'completed',
    v_rider_balance,
    v_rider_balance - v_penalty_amount
  );

  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_penalty_amount,
      updated_at     = now()
  WHERE user_id = v_rider_user_id;

  -- ═══ إضافة تعويض لمحفظة السائق (النظام الجديد فقط) ═══
  PERFORM public.create_wallet_transaction(
    v_driver_id,
    'bonus',
    v_penalty_amount::DECIMAL(12,2),
    NEW.id,
    format('تعويض إلغاء الراكب — %s', v_penalty->>'reason'),
    jsonb_build_object(
      'penalty_type',                  'rider_cancellation_compensation',
      'time_since_accept_seconds',      v_penalty->>'time_since_accept_seconds',
      'distance_to_pickup_km',          v_penalty->>'distance_to_pickup_km'
    )
  );

  -- ═══ تعليم الغرامة كمدفوعة ═══
  NEW.cancellation_fee_paid := true;

  -- ═══ إشعار السائق بالتعويض ═══
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO notifications (
      user_id, title, body, type, data, is_read, created_at
    ) VALUES (
      (SELECT user_id FROM drivers WHERE id = v_driver_id),
      'تم تعويضك عن الإلغاء 💰',
      format('تم إضافة %s دينار لمحفظتك كتعويض عن إلغاء الراكب', v_penalty_amount),
      'wallet_credit',
      jsonb_build_object('ride_id', NEW.id, 'amount', v_penalty_amount, 'reason', 'rider_cancellation_compensation'),
      false,
      now()
    );

    INSERT INTO notifications (
      user_id, title, body, type, data, is_read, created_at
    ) VALUES (
      v_rider_user_id,
      'تم خصم غرامة إلغاء',
      format('تم خصم %s دينار من محفظتك — السائق كان في طريقه إليك', v_penalty_amount),
      'wallet_debit',
      jsonb_build_object('ride_id', NEW.id, 'amount', v_penalty_amount, 'reason', v_penalty->>'reason'),
      false,
      now()
    );
  END IF;

  RAISE NOTICE 'Ride % — rider cancellation penalty applied: % IQD (reason: %)',
    NEW.id, v_penalty_amount, v_penalty->>'reason';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_rider_cancellation_penalty IS
  'غرامة حقيقية على الراكب — تعويض السائق عبر النظام الجديد فقط (wallet_transactions) + balance_before/after مُسجَّل';
