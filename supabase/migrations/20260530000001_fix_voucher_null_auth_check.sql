-- ════════════════════════════════════════════════════════════════════════════
-- إصلاح أمني: استخدام IS DISTINCT FROM بدل != للتحقق من auth.uid()
-- ════════════════════════════════════════════════════════════════════════════
--
-- المشكلة: في PL/pgSQL، المقارنة NULL != uuid تُعيد NULL (ليست TRUE).
-- هذا يعني أن مستخدم anon (auth.uid() = NULL) كان يتجاوز حارس الملكية
-- في redeem_voucher و redeem_voucher_driver.
--
-- الإصلاح: تغيير != إلى IS DISTINCT FROM — الذي يتعامل مع NULL بأمان:
--   NULL IS DISTINCT FROM uuid = TRUE  → يُوقف anon صحيح
--   uuid IS DISTINCT FROM uuid (نفسه) = FALSE → يسمح للمالك صحيح
--
-- يؤثر على: redeem_voucher, redeem_voucher_driver
-- ════════════════════════════════════════════════════════════════════════════

-- ═══ 1. إصلاح redeem_voucher (الراكب) ═══

CREATE OR REPLACE FUNCTION redeem_voucher(
  p_code TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_voucher RECORD;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
BEGIN
  -- ═══ التحقق: المستدعي يشحن نفسه فقط ═══
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

  UPDATE profiles SET wallet_balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;

  UPDATE voucher_codes
  SET status = 'redeemed', redeemed_by = p_user_id,
      redeemed_at = now(), updated_at = now()
  WHERE id = v_voucher.id;

  INSERT INTO rider_wallet_transactions (user_id, amount, type, status, payment_method, description, reference_id)
  VALUES (p_user_id, v_voucher.amount, 'topup', 'completed', 'voucher',
    format('شحن كارت راكب — %s', p_code), v_voucher.id::TEXT);

  RETURN jsonb_build_object(
    'success', true, 'amount', v_voucher.amount,
    'new_balance', v_new_balance, 'code', p_code
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء معالجة الكارت');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ 2. إصلاح redeem_voucher_driver (السائق) ═══

CREATE OR REPLACE FUNCTION redeem_voucher_driver(
  p_code TEXT,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_voucher RECORD;
  v_wallet RECORD;
  v_balance_before DECIMAL(12,2) := 0;
  v_new_balance DECIMAL(12,2);
  v_user_id UUID;
  v_calling_user UUID;
BEGIN
  p_code := UPPER(TRIM(p_code));

  -- ═══ التحقق من أن المستدعي هو السائق نفسه ═══
  v_calling_user := auth.uid();
  SELECT user_id INTO v_user_id FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير موجود');
  END IF;

  -- FIX: IS DISTINCT FROM بدل != لمعالجة NULL بأمان (يمنع anon)
  IF v_calling_user IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح — يمكنك شحن محفظتك فقط');
  END IF;

  -- ═══ البحث عن الكارت مع قفل ═══
  SELECT * INTO v_voucher
  FROM voucher_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الرمز غير صحيح أو غير موجود');
  END IF;

  IF v_voucher.status = 'redeemed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا الكارت مستخدم مسبقاً');
  END IF;

  IF v_voucher.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا الكارت غير فعّال');
  END IF;

  -- ═══ فصل النوع: يرفض كروت الراكب ═══
  IF v_voucher.audience = 'rider' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا كارت راكب — لا يمكن استخدامه كسائق');
  END IF;

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE voucher_codes SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'انتهت صلاحية هذا الكارت');
  END IF;

  -- ═══ شحن محفظة السائق مع FOR UPDATE ═══
  SELECT * INTO v_wallet
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_balance_before := 0;
    v_new_balance := v_voucher.amount;
    INSERT INTO driver_wallets (driver_id, balance)
    VALUES (p_driver_id, v_new_balance)
    RETURNING * INTO v_wallet;
  ELSE
    v_balance_before := COALESCE(v_wallet.balance, 0);
    v_new_balance := v_balance_before + v_voucher.amount;
    UPDATE driver_wallets
    SET balance = v_new_balance, updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  -- ═══ تحديث الكارت ═══
  UPDATE voucher_codes
  SET status = 'redeemed', redeemed_by = v_user_id,
      redeemed_at = now(), updated_at = now()
  WHERE id = v_voucher.id;

  -- ═══ تسجيل في Ledger ═══
  INSERT INTO wallet_transactions (
    wallet_id, driver_id, transaction_type, amount,
    balance_before, balance_after, description,
    metadata, status, settlement_type,
    idempotency_key, processed_at
  ) VALUES (
    v_wallet.id, p_driver_id, 'topup', v_voucher.amount,
    v_balance_before, v_new_balance,
    format('شحن كارت سائق — %s', p_code),
    jsonb_build_object('voucher_id', v_voucher.id, 'code', p_code, 'audience', v_voucher.audience),
    'completed', 'manual',
    'voucher_' || v_voucher.id::TEXT, now()
  );

  RETURN jsonb_build_object(
    'success', true, 'amount', v_voucher.amount,
    'new_balance', v_new_balance, 'code', p_code
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا الكارت مستخدم مسبقاً');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء معالجة الكارت');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
