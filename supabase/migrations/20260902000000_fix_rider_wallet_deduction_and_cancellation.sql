-- ══════════════════════════════════════════════════════════════════════════════
-- ران — إصلاح دالة خصم رصيد المحفظة للراكب بشكل آمن
-- RAAN Fix Rider Wallet Deduction Safe Function
-- Date: 2026-05-22
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.deduct_wallet_safely(
  p_user_id UUID,
  p_amount INTEGER,
  p_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- التحقق من أن المبلغ موجب
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;

  -- قفل صف المستخدم لمنع خصم متزامن
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المستخدم غير موجود');
  END IF;

  -- التحقق من كفاية الرصيد
  IF COALESCE(v_current_balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد المحفظة غير كافٍ',
      'current_balance', COALESCE(v_current_balance, 0),
      'required', p_amount
    );
  END IF;

  -- خصم الرصيد
  v_new_balance := v_current_balance - p_amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE user_id = p_user_id;

  -- تسجيل المعاملة في جدول معاملات محفظة الراكب (rider_wallet_transactions)
  INSERT INTO public.rider_wallet_transactions (
    user_id,
    amount,
    type,
    description,
    ride_id,
    status
  ) VALUES (
    p_user_id,
    -p_amount,
    'ride_payment',
    'دفع أجرة رحلة من المحفظة',
    p_ride_id,
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount,
    'ride_id', p_ride_id
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_safely IS 'خصم رصيد من محفظة الراكب بشكل آمن مع قفل لمنع التكرار وتسجيل المعاملة';

-- إعادة منح الصلاحيات للتأكد من وصول المستخدمين المصادقين للوظيفة
GRANT EXECUTE ON FUNCTION public.deduct_wallet_safely TO authenticated;
