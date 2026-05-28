-- Secure wallet top-up approval/rejection with an internal admin-only guard.

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
  SET status = 'approved',
      admin_notes = p_admin_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id;

  IF v_request.user_type = 'rider' THEN
    UPDATE profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_request.amount,
        updated_at = now()
    WHERE user_id = v_request.user_id;

    INSERT INTO rider_wallet_transactions (
      user_id,
      amount,
      type,
      payment_method,
      reference_id,
      description,
      status
    ) VALUES (
      v_request.user_id,
      v_request.amount,
      'topup',
      v_request.payment_method,
      v_request.reference_number,
      'إضافة رصيد',
      'completed'
    );
  ELSE
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

CREATE OR REPLACE FUNCTION public.reject_topup_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ADMIN' USING ERRCODE = '42501';
  END IF;

  UPDATE wallet_topup_requests
  SET status = 'rejected',
      admin_notes = p_admin_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود أو تمت معالجته');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_topup_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_topup_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_topup_request(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_topup_request(UUID, TEXT) TO authenticated, service_role;