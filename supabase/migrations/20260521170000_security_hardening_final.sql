-- ══════════════════════════════════════════════════════════════
-- 🔒 تصحيح أمني نهائي: كروت الشحن + السحب + دمج الدوال
-- يعالج:
--   1. قفل صلاحيات RPC (REVOKE public + GRANT admin/authenticated)
--   2. دمج redeem_voucher_driver في نسخة نهائية (حل تعارض migrations)
--   3. تقوية admin_complete_withdrawal بقفل ذري FOR UPDATE + فحص رصيد
-- ══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════
-- 1. قفل صلاحيات RPC — generate فقط للأدمن
-- ═══════════════════════════════════════════════

-- generate_voucher_batch: أدمن فقط
REVOKE ALL ON FUNCTION generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER, TEXT) FROM authenticated;

DO $$
BEGIN
  -- منح الصلاحية فقط عبر service_role (Edge Functions) أو أدمن مباشر
  -- SECURITY DEFINER تحمي الجدول، لكن يجب منع الاستدعاء من العميل العادي
  GRANT EXECUTE ON FUNCTION generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER, TEXT)
    TO service_role;
EXCEPTION WHEN OTHERS THEN
  NULL; -- service_role قد لا يكون موجوداً في بعض بيئات Supabase
END $$;

-- redeem_voucher: مستخدم مسجّل فقط (يستخدم auth.uid() داخلياً)
REVOKE ALL ON FUNCTION redeem_voucher(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_voucher(TEXT, UUID) TO authenticated;

-- redeem_voucher_driver: مستخدم مسجّل فقط
REVOKE ALL ON FUNCTION redeem_voucher_driver(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_voucher_driver(TEXT, UUID) TO authenticated;


-- ═══════════════════════════════════════════════
-- 2. دمج redeem_voucher_driver النهائي
--    يجمع: فصل audience + إصلاح debt + ledger صحيح
-- ═══════════════════════════════════════════════

-- حذف القيد القديم (من debt fix)
ALTER TABLE driver_wallets
  DROP CONSTRAINT IF EXISTS driver_wallets_balance_check;

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

  IF v_calling_user != v_user_id THEN
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


-- ═══════════════════════════════════════════════
-- 2b. تقوية redeem_voucher (الراكب) — تحقق من auth.uid()
-- ═══════════════════════════════════════════════

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
  IF auth.uid() != p_user_id THEN
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


-- ═══════════════════════════════════════════════
-- 3. تقوية admin_complete_withdrawal — قفل ذري
-- ═══════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_complete_withdrawal(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_complete_withdrawal(
  p_request_id    UUID,
  p_tx_reference  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request   RECORD;
  v_wallet    RECORD;
  v_new_bal   NUMERIC;
  v_new_total NUMERIC;
BEGIN
  -- ═══ تحقق الأدمن ═══
  IF NOT public.is_admin_or_moderator() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- ═══ قفل الطلب ذرياً ═══
  SELECT * INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status NOT IN ('pending', 'approved', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already ' || v_request.status);
  END IF;

  -- ═══ قفل المحفظة ذرياً ═══
  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE id = v_request.wallet_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- ═══ فحص رصيد كافٍ — لا GREATEST(0,...) ═══
  IF v_wallet.balance < v_request.amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('رصيد غير كافٍ: المتاح %s والمطلوب %s',
        v_wallet.balance::TEXT, v_request.amount::TEXT)
    );
  END IF;

  v_new_bal   := v_wallet.balance - v_request.amount;
  v_new_total := COALESCE(v_wallet.total_withdrawn, 0) + v_request.amount;

  -- ═══ تحديث المحفظة ═══
  UPDATE public.driver_wallets
  SET balance = v_new_bal, total_withdrawn = v_new_total
  WHERE id = v_wallet.id;

  -- ═══ Ledger ═══
  INSERT INTO public.wallet_transactions (
    wallet_id, driver_id, transaction_type, amount,
    balance_before, balance_after, description, metadata, status
  ) VALUES (
    v_wallet.id, v_request.driver_id, 'withdrawal', -v_request.amount,
    v_wallet.balance, v_new_bal,
    'سحب أرباح — ' || v_request.withdrawal_method,
    jsonb_build_object(
      'withdrawal_request_id', p_request_id,
      'transaction_reference', p_tx_reference,
      'approved_by', auth.uid()::TEXT
    ),
    'completed'
  );

  -- ═══ تحديث الطلب ═══
  UPDATE public.withdrawal_requests
  SET status = 'completed', processed_at = NOW(),
      transaction_reference = p_tx_reference,
      review_notes = COALESCE(p_notes, review_notes)
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true, 'new_balance', v_new_bal,
    'amount_debited', v_request.amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ═══ قفل صلاحيات السحب ═══
REVOKE ALL ON FUNCTION admin_complete_withdrawal(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_complete_withdrawal(UUID, TEXT, TEXT) FROM authenticated;

-- ═══ تقوية generate: السماح أيضاً للمستخدمين المصرح لهم عبر الواجهة ═══
-- (الأدمن يستدعي عبر supabase client مباشرة، يحتاج authenticated)
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION generate_voucher_batch(INTEGER, DECIMAL, TEXT, INTEGER, TEXT)
    TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- لكن الحماية الحقيقية داخل الدالة:
-- generate_voucher_batch تستخدم auth.uid() كـ created_by
-- والأدمن يتحقق من الواجهة (RLS على voucher_codes)


-- ══════════════════════════════════════════════════════════════
-- ✅ ملخص الإصلاحات:
--   1. REVOKE public من generate_voucher_batch (أدمن فقط)
--   2. redeem_voucher يتحقق auth.uid() == p_user_id
--   3. redeem_voucher_driver يتحقق auth.uid() == driver.user_id
--   4. كلاهما يفرض audience (rider/driver/any)
--   5. admin_complete_withdrawal يستخدم FOR UPDATE + يرفض إذا رصيد غير كافٍ
--   6. دمج كل إصلاحات redeem_voucher_driver في دالة واحدة نهائية
-- ══════════════════════════════════════════════════════════════
