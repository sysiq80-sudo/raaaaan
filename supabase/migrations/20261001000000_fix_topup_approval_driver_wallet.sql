-- ══════════════════════════════════════════════════════════════════════════════
-- ران — تصحيح شحن المحفظة للسائقين
-- RAAN Fix Topup Approval for Driver Wallet
-- Date: 2026-05-27
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.approve_topup_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_driver_id UUID;
  v_wallet RECORD;
  v_balance_before DECIMAL(12,2);
  v_balance_after DECIMAL(12,2);
BEGIN
  -- 1. جلب تفاصيل الطلب مع القفل للتحقق
  SELECT * INTO v_request
  FROM wallet_topup_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود أو تمت معالجته');
  END IF;
  
  -- 2. تحديث حالة طلب الشحن
  UPDATE wallet_topup_requests
  SET status = 'approved',
      admin_notes = p_admin_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id;
  
  -- 3. إضافة الرصيد للمحفظة بحسب نوع المستخدم
  IF v_request.user_type = 'rider' THEN
    -- شحن رصيد الراكب (profiles.wallet_balance)
    UPDATE profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;
    
    INSERT INTO rider_wallet_transactions (user_id, amount, type, payment_method, reference_id, description, status)
    VALUES (v_request.user_id, v_request.amount, 'topup', v_request.payment_method, v_request.reference_number, 'إضافة رصيد', 'completed');
  
  ELSE
    -- شحن رصيد السائق (driver_wallets.balance)
    -- جلب معرّف السائق
    SELECT id INTO v_driver_id
    FROM drivers
    WHERE user_id = v_request.user_id;

    IF v_driver_id IS NULL THEN
      RAISE EXCEPTION 'DRIVER_NOT_FOUND: السائق صاحب الطلب غير موجود في جدول drivers';
    END IF;

    -- جلب محفظة السائق مع القفل
    SELECT * INTO v_wallet
    FROM driver_wallets
    WHERE driver_id = v_driver_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- إنشاء المحفظة لو لم تكن موجودة
      v_balance_before := 0;
      v_balance_after := v_request.amount;
      
      INSERT INTO driver_wallets (driver_id, balance)
      VALUES (v_driver_id, v_balance_after)
      RETURNING * INTO v_wallet;
    ELSE
      v_balance_before := COALESCE(v_wallet.balance, 0);
      v_balance_after := v_balance_before + v_request.amount;
      
      UPDATE driver_wallets
      SET balance = v_balance_after,
          updated_at = now()
      WHERE id = v_wallet.id;
    END IF;

    -- تسجيل المعاملة في الدفتر المحاسبي الجديد wallet_transactions
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
        'request_id', p_request_id,
        'payment_method', v_request.payment_method,
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
