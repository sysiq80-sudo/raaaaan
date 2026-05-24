-- ══════════════════════════════════════════════════════════════════════════════
-- 🔧 إصلاح زر الإلغاء - Fix Cancel Button
-- ══════════════════════════════════════════════════════════════════════════════
-- 
-- تطبيق هذا الـ SQL في Supabase Dashboard:
-- 1. افتح https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt
-- 2. اذهب لـ SQL Editor
-- 3. انسخ والصق هذا الكود كاملاً
-- 4. اضغط RUN
-- 
-- ══════════════════════════════════════════════════════════════════════════════

-- Fix rider wallet deduction used by complete-ride
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
  v_role TEXT := COALESCE(auth.jwt() ->> 'role', '');
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
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO rider_wallet_transactions (
    user_id, amount, type, status, payment_method, ride_id, description
  )
  VALUES (
    p_user_id, -p_amount, 'ride_payment', 'completed', 'wallet', p_ride_id,
    'دفع أجرة رحلة من المحفظة'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount,
    'ride_id', p_ride_id
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_safely IS 'خصم رصيد الراكب بشكل آمن مع قفل الصف وتسجيله في rider_wallet_transactions';

REVOKE EXECUTE ON FUNCTION public.deduct_wallet_safely(UUID, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_safely(UUID, INTEGER, UUID) TO authenticated, service_role;

-- Atomic rider cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_ride_by_rider(
  p_ride_id UUID,
  p_rider_user_id UUID,
  p_reason TEXT DEFAULT 'لم يحدد سبب'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ride RECORD;
  v_penalty JSONB;
  v_penalty_amount INTEGER := 0;
  v_current_balance INTEGER := 0;
  v_new_balance INTEGER := 0;
  v_penalty_paid BOOLEAN := false;
  v_cancellable_statuses TEXT[] := ARRAY['pending', 'accepted', 'arrived'];
BEGIN
  -- لا نثق بأي user_id يأتي من العميل بدون مطابقته مع JWT
  IF auth.uid() IS NULL OR auth.uid() != p_rider_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرّح',
      'code', 'UNAUTHORIZED'
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
      'error', 'الرحلة غير موجودة',
      'code', 'RIDE_NOT_FOUND'
    );
  END IF;

  -- ═══ 2. التحقق من أن الرحلة تابعة لهذا الراكب ═══
  IF v_ride.rider_id != p_rider_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرّح: الرحلة ليست لهذا الراكب',
      'code', 'UNAUTHORIZED'
    );
  END IF;

  -- ═══ 3. التحقق من أن الحالة قابلة للإلغاء ═══
  IF NOT (v_ride.status = ANY(v_cancellable_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا يمكن إلغاء رحلة بحالة: ' || v_ride.status,
      'code', 'INVALID_STATUS',
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
          updated_at = now()
      WHERE user_id = p_rider_user_id;

      INSERT INTO rider_wallet_transactions (
        user_id, amount, type, status, payment_method, ride_id, description
      )
      VALUES (
        p_rider_user_id, -v_penalty_amount, 'ride_payment', 'completed', 'wallet', p_ride_id,
        format('غرامة إلغاء رحلة #%s', substring(p_ride_id::TEXT, 1, 8))
      );

      v_penalty_paid := true;
    END IF;
  END IF;

  -- ═══ 6. تحديث الرحلة إلى ملغاة (ذري مع شرط الحالة) ═══
  UPDATE rides
  SET
    status = 'cancelled',
    cancelled_by = 'rider',
    cancellation_reason = p_reason,
    cancellation_fee = v_penalty_amount,
    cancellation_fee_paid = v_penalty_paid,
    updated_at = now()
  WHERE id = p_ride_id
    AND status = ANY(v_cancellable_statuses); -- حماية إضافية ضد race condition

  IF NOT FOUND THEN
    -- الرحلة تغيرت حالتها بين الجلب والتحديث (race condition)
    RETURN jsonb_build_object(
      'success', false,
      'error', 'تم تغيير حالة الرحلة من طرف آخر',
      'code', 'RACE_CONDITION'
    );
  END IF;

  -- ═══ 7. إرجاع النتيجة ═══
  RETURN jsonb_build_object(
    'success', true,
    'ride_id', p_ride_id,
    'cancelled_status', v_ride.status, -- الحالة قبل الإلغاء
    'penalty_amount', v_penalty_amount,
    'penalty_paid', v_penalty_paid,
    'penalty_reason', COALESCE(v_penalty->>'reason', 'none')
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_ride_by_rider IS 'إلغاء رحلة من الراكب بشكل ذري مع حساب وخصم الغرامة تلقائياً';

-- منح الصلاحيات
REVOKE EXECUTE ON FUNCTION public.cancel_ride_by_rider(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_ride_by_rider(UUID, UUID, TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- ✅ تم! الآن زر الإلغاء يجب أن يعمل بشكل صحيح
-- ══════════════════════════════════════════════════════════════════════════════
