-- ══════════════════════════════════════════════════════════════
-- 🎯 فصل كروت الشحن: راكب / سائق / عام
-- ══════════════════════════════════════════════════════════════

-- ═══ 1. إضافة حقل audience ═══
ALTER TABLE voucher_codes
ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'any'
CHECK (audience IN ('rider', 'driver', 'any'));

CREATE INDEX IF NOT EXISTS idx_voucher_audience ON voucher_codes(audience);

-- ═══ 2. تحديث redeem_voucher (الراكب) — يقبل rider أو any فقط ═══
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
  p_code := UPPER(TRIM(p_code));

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

  -- ═══ التحقق من النوع ═══
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
  SET status = 'redeemed', redeemed_by = p_user_id, redeemed_at = now(), updated_at = now()
  WHERE id = v_voucher.id;

  INSERT INTO rider_wallet_transactions (user_id, amount, type, status, payment_method, description, reference_id)
  VALUES (p_user_id, v_voucher.amount, 'topup', 'completed', 'voucher', format('شحن كارت راكب — %s', p_code), v_voucher.id::TEXT);

  RETURN jsonb_build_object('success', true, 'amount', v_voucher.amount, 'new_balance', v_new_balance, 'code', p_code);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء معالجة الكارت');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ 3. تحديث redeem_voucher_driver (السائق) — يقبل driver أو any فقط ═══
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

  -- ═══ التحقق من النوع ═══
  IF v_voucher.audience = 'rider' THEN
    RETURN jsonb_build_object('success', false, 'error', 'هذا كارت راكب — لا يمكن استخدامه كسائق');
  END IF;

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE voucher_codes SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'انتهت صلاحية هذا الكارت');
  END IF;

  SELECT user_id INTO v_user_id FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير موجود');
  END IF;

  SELECT * INTO v_wallet FROM driver_wallets WHERE driver_id = p_driver_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO driver_wallets (driver_id, balance) VALUES (p_driver_id, v_voucher.amount) RETURNING * INTO v_wallet;
    v_new_balance := v_voucher.amount;
  ELSE
    v_new_balance := COALESCE(v_wallet.balance, 0) + v_voucher.amount;
    UPDATE driver_wallets SET balance = v_new_balance, updated_at = now() WHERE id = v_wallet.id;
  END IF;

  UPDATE voucher_codes
  SET status = 'redeemed', redeemed_by = v_user_id, redeemed_at = now(), updated_at = now()
  WHERE id = v_voucher.id;

  INSERT INTO wallet_transactions (wallet_id, driver_id, transaction_type, amount, balance_before, balance_after, description, idempotency_key)
  VALUES (v_wallet.id, p_driver_id, 'topup', v_voucher.amount, COALESCE(v_wallet.balance, 0), v_new_balance, format('شحن كارت سائق — %s', p_code), 'voucher_' || v_voucher.id::TEXT);

  RETURN jsonb_build_object('success', true, 'amount', v_voucher.amount, 'new_balance', v_new_balance, 'code', p_code);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء معالجة الكارت');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ 4. تحديث generate_voucher_batch — إضافة audience ═══
CREATE OR REPLACE FUNCTION generate_voucher_batch(
  p_count INTEGER,
  p_amount DECIMAL,
  p_batch_name TEXT DEFAULT NULL,
  p_expires_days INTEGER DEFAULT NULL,
  p_audience TEXT DEFAULT 'any'
)
RETURNS TABLE (code TEXT, amount DECIMAL) AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i INTEGER;
  v_generated INTEGER := 0;
  v_part1 TEXT;
  v_part2 TEXT;
  v_expires TIMESTAMPTZ;
  v_prefix TEXT;
BEGIN
  IF p_count > 500 THEN RAISE EXCEPTION 'الحد الأقصى 500 كارت'; END IF;
  IF p_amount < 250 THEN RAISE EXCEPTION 'الحد الأدنى 250 دينار'; END IF;
  IF p_audience NOT IN ('rider', 'driver', 'any') THEN RAISE EXCEPTION 'النوع غير صالح'; END IF;

  -- بادئة الكود حسب النوع
  v_prefix := CASE p_audience
    WHEN 'driver' THEN 'RD-'
    WHEN 'rider'  THEN 'RR-'
    ELSE 'RAAN-'
  END;

  IF p_expires_days IS NOT NULL THEN
    v_expires := now() + (p_expires_days || ' days')::interval;
  END IF;

  WHILE v_generated < p_count LOOP
    v_part1 := '';
    v_part2 := '';
    FOR v_i IN 1..4 LOOP
      v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    v_code := v_prefix || v_part1 || '-' || v_part2;

    IF NOT EXISTS (SELECT 1 FROM voucher_codes vc WHERE vc.code = v_code) THEN
      INSERT INTO voucher_codes (code, amount, batch_name, expires_at, created_by, audience)
      VALUES (v_code, p_amount, COALESCE(p_batch_name, 'batch_' || to_char(now(), 'YYYYMMDD_HH24MI')), v_expires, auth.uid(), p_audience);

      code := v_code;
      amount := p_amount;
      RETURN NEXT;
      v_generated := v_generated + 1;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
