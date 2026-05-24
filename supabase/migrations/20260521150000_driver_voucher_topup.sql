-- ══════════════════════════════════════════════════════════════
-- 🚗 دالة استبدال كارت شحن للسائق
-- يشحن driver_wallets.balance بدل profiles.wallet_balance
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION redeem_voucher_driver(
  p_code TEXT,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_voucher RECORD;
  v_wallet RECORD;
  v_new_balance DECIMAL(12,2);
  v_user_id UUID;
BEGIN
  p_code := UPPER(TRIM(p_code));

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

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE voucher_codes SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'انتهت صلاحية هذا الكارت');
  END IF;

  -- ═══ جلب user_id للسائق ═══
  SELECT user_id INTO v_user_id FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير موجود');
  END IF;

  -- ═══ شحن محفظة السائق ═══
  SELECT * INTO v_wallet
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- إنشاء محفظة إذا غير موجودة
    INSERT INTO driver_wallets (driver_id, balance)
    VALUES (p_driver_id, v_voucher.amount)
    RETURNING * INTO v_wallet;
    v_new_balance := v_voucher.amount;
  ELSE
    v_new_balance := COALESCE(v_wallet.balance, 0) + v_voucher.amount;
    UPDATE driver_wallets
    SET balance = v_new_balance,
        updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  -- ═══ تحديث الكارت ═══
  UPDATE voucher_codes
  SET status = 'redeemed',
      redeemed_by = v_user_id,
      redeemed_at = now(),
      updated_at = now()
  WHERE id = v_voucher.id;

  -- ═══ تسجيل في wallet_transactions (ledger السائق) ═══
  INSERT INTO wallet_transactions (
    wallet_id,
    driver_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    idempotency_key
  ) VALUES (
    v_wallet.id,
    p_driver_id,
    'topup',
    v_voucher.amount,
    COALESCE(v_wallet.balance, 0),
    v_new_balance,
    format('شحن كارت — %s', p_code),
    'voucher_' || v_voucher.id::TEXT
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_voucher.amount,
    'new_balance', v_new_balance,
    'code', p_code
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ أثناء معالجة الكارت'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
