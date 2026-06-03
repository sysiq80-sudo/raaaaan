-- ═══════════════════════════════════════════════════════════════════
-- Migration: تصحيح حقل قبول الرحلة وصلاحية الـ service_role للاستدعاء الذري وتوجيه الإشعارات (إصدار 2)
-- التاريخ الفعلي الحالي: 2026-06-03 18:30:00
-- ═══════════════════════════════════════════════════════════════════

-- 1️⃣ تحديث دالة احتساب الغرامة لتستخدم matched_at بدلاً من accepted_at غير الموجود في جدول rides
CREATE OR REPLACE FUNCTION public.calculate_cancellation_penalty(
  p_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ride RECORD;
  v_driver RECORD;
  v_driver_lat FLOAT;
  v_driver_lng FLOAT;
  v_pickup_lat FLOAT;
  v_pickup_lng FLOAT;
  v_distance_km FLOAT := 0.0;
  v_time_since_accept INTERVAL;
  v_penalty_amount INTEGER;
  v_penalty_reason TEXT;
  v_should_penalize BOOLEAN := false;
  v_base_fee INTEGER := 2000;
  v_settings_fee JSONB;
BEGIN
  -- جلب بيانات الرحلة
  SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
  
  IF v_ride IS NULL THEN
    RETURN jsonb_build_object('should_penalize', false, 'reason', 'ride_not_found');
  END IF;

  -- محاولة قراءة الغرامة من الإعدادات
  SELECT value INTO v_settings_fee
  FROM app_settings
  WHERE key = 'cancellation_fee';
  
  -- 🛡️ القاعدة الذهبية: إذا لم يوجد الإعداد أو كان معطلاً، الغرامة = 0 والخصم ملغى
  IF v_settings_fee IS NULL OR COALESCE((v_settings_fee->>'enabled')::BOOLEAN, false) = false THEN
    RETURN jsonb_build_object(
      'should_penalize', false,
      'penalty_amount', 0,
      'reason', 'disabled_by_settings',
      'base_fee', 0,
      'ride_status', v_ride.status
    );
  END IF;

  v_base_fee := COALESCE((v_settings_fee->>'amount')::INTEGER, 2000);

  -- شروط استحقاق الغرامة للراكب (بعد قبول السائق)
  IF v_ride.status::text IN ('accepted', 'arrived') THEN
    v_should_penalize := true;
    v_penalty_reason := 'driver_accepted_ride';
  END IF;

  -- إذا وصل السائق بالفعل (حالة arrived)، يتم مضاعفة الغرامة
  IF v_ride.status::text = 'arrived' THEN
    v_should_penalize := true;
    v_penalty_reason := 'driver_already_arrived';
    v_penalty_amount := v_base_fee * 2;
  END IF;

  -- تحديد المبلغ النهائي
  IF v_should_penalize AND v_penalty_amount IS NULL THEN
    v_penalty_amount := v_base_fee;
  ELSIF NOT v_should_penalize THEN
    v_penalty_amount := 0;
  END IF;

  -- حساب الوقت والمسافة للتوثيق (استخدام matched_at بدلاً من accepted_at)
  IF v_ride.matched_at IS NOT NULL THEN
    v_time_since_accept := now() - v_ride.matched_at;
  END IF;

  v_pickup_lat := (v_ride.pickup_location->>'lat')::FLOAT;
  v_pickup_lng := (v_ride.pickup_location->>'lng')::FLOAT;

  IF v_ride.driver_id IS NOT NULL THEN
    SELECT * INTO v_driver FROM drivers WHERE id = v_ride.driver_id;
    
    IF v_driver IS NOT NULL AND v_driver.current_location IS NOT NULL THEN
      v_driver_lat := (v_driver.current_location->>'lat')::FLOAT;
      v_driver_lng := (v_driver.current_location->>'lng')::FLOAT;
      
      IF v_driver_lat IS NOT NULL AND v_driver_lng IS NOT NULL 
         AND v_pickup_lat IS NOT NULL AND v_pickup_lng IS NOT NULL THEN
        v_distance_km := public.calculate_distance(
          v_driver_lat, v_driver_lng,
          v_pickup_lat, v_pickup_lng
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'should_penalize', v_should_penalize,
    'penalty_amount', v_penalty_amount,
    'reason', COALESCE(v_penalty_reason, 'none'),
    'time_since_accept_seconds', COALESCE(EXTRACT(EPOCH FROM v_time_since_accept)::INTEGER, 0),
    'distance_to_pickup_km', COALESCE(ROUND(v_distance_km::NUMERIC, 3), 0),
    'base_fee', v_base_fee,
    'ride_status', v_ride.status
  );
END;
$$;

COMMENT ON FUNCTION public.calculate_cancellation_penalty IS 'احتساب غرامة إلغاء الرحلة للراكب فور قبول السائق أو وصوله مباشرة دون شروط زمنية أو مسافات (مصحح لاستخدام matched_at)';


-- 2️⃣ تحديث دالة التريجر handle_rider_cancellation_penalty وتوجيه الإشعارات إلى الجداول المخصصة
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
  v_distance_km    FLOAT;
  v_rider_balance  INTEGER;
BEGIN
  -- فحص الشروط الأساسية
  IF NEW.cancelled_by != 'rider'
     OR OLD.status::text NOT IN ('accepted', 'arrived')
     OR OLD.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_driver_id     := OLD.driver_id;
  v_rider_user_id := OLD.rider_id;

  -- حساب الغرامة بناء على الدالة المحدثة
  v_penalty := public.calculate_cancellation_penalty(NEW.id);

  -- 🛡️ إذا كانت الغرامة معطلة أو قيمتها صفر (مثال: enabled = false)، نخرج فورا دون خصم أو تعويض
  IF NOT (v_penalty->>'should_penalize')::BOOLEAN OR COALESCE((v_penalty->>'penalty_amount')::INTEGER, 0) = 0 THEN
    RAISE NOTICE 'Ride % cancelled by rider — no penalty applied (disabled in app_settings)', NEW.id;
    NEW.cancellation_fee := 0;
    NEW.cancellation_fee_paid := false;
    RETURN NEW;
  END IF;

  v_penalty_amount := (v_penalty->>'penalty_amount')::INTEGER;

  -- حساب المسافة وتسجيلها
  v_distance_km                  := (v_penalty->>'distance_to_pickup_km')::FLOAT;
  NEW.distance_to_pickup_at_cancel := v_distance_km;
  NEW.cancellation_fee           := v_penalty_amount;

  -- 🔐 القفل الحصري: قفل صف محفظة الراكب المتأثر لمنع معاملات السحب المتزامنة والتضارب
  SELECT COALESCE(wallet_balance, 0) INTO v_rider_balance
  FROM profiles 
  WHERE user_id = v_rider_user_id
  FOR UPDATE;

  -- خصم من محفظة الراكب فقط إذا لم يتم الخصم مسبقاً (عبر الـ RPC)
  IF NOT COALESCE(OLD.cancellation_fee_paid, false) AND NOT COALESCE(NEW.cancellation_fee_paid, false) THEN
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
    SET wallet_balance = v_rider_balance - v_penalty_amount,
        updated_at     = now()
    WHERE user_id = v_rider_user_id;

    NEW.cancellation_fee_paid := true;
  ELSE
    NEW.cancellation_fee_paid := true;
  END IF;

  -- 💰 إضافة تعويض لمحفظة السائق
  IF v_penalty_amount > 0 AND NEW.cancellation_fee_paid = true THEN
    -- 🔐 صمام الأمان المحدث: منع تكرار تعويض السائق لنفس الإلغاء بدقة باستخدام نوع العملية ونوع المكافأة و الـ metadata
    IF NOT EXISTS (
      SELECT 1 FROM wallet_transactions
      WHERE ride_id = NEW.id
        AND transaction_type = 'bonus'
        AND metadata->>'penalty_type' = 'rider_cancellation_compensation'
    ) THEN
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

      -- إرسال الإشعارات للسائق والراكب عند تنفيذ المعاملة المالية الفعلية فقط (استخدام جداول الإشعارات المتخصصة)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_notifications') THEN
        INSERT INTO driver_notifications (
          driver_id, title, body, type, data, is_read, created_at
        ) VALUES (
          v_driver_id,
          'تم تعويضك عن الإلغاء 💰',
          format('تم إضافة %s دينار لمحفظتك كتعويض عن إلغاء الراكب', v_penalty_amount),
          'wallet_credit',
          jsonb_build_object('ride_id', NEW.id, 'amount', v_penalty_amount, 'reason', 'rider_cancellation_compensation'),
          false,
          now()
        );
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rider_notifications') THEN
        INSERT INTO rider_notifications (
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
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- 3️⃣ تحديث دالة RPC cancel_ride_by_rider للسماح لـ service_role بتخطي تحقق الـ JWT ومطابقة الـ enum للـ status
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
  -- لا نثق بأي user_id يأتي من العميل بدون مطابقته مع JWT (إلا إذا كان الاستدعاء من الـ service_role)
  IF (auth.role() != 'service_role') AND (auth.uid() IS NULL OR auth.uid() != p_rider_user_id) THEN
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

  -- ═══ 3. التحقق من أن الحالة قابلة للإلغاء (تحويل enum النصي للمقارنة) ═══
  IF NOT (v_ride.status::text = ANY(v_cancellable_statuses)) THEN
    RETURN jsonb_build_object(
      'success',        false,
      'error',          'لا يمكن إلغاء رحلة بحالة: ' || v_ride.status::text,
      'code',           'INVALID_STATUS',
      'current_status', v_ride.status::text
    );
  END IF;

  -- ═══ 4. حساب الغرامة (إذا السائق قبل أو وصل) ═══
  IF v_ride.status::text IN ('accepted', 'arrived') THEN
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
    AND status::text = ANY(v_cancellable_statuses); -- حماية إضافية ضد race condition

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
    'cancelled_status', v_ride.status::text,
    'penalty_amount',  v_penalty_amount,
    'penalty_paid',    v_penalty_paid,
    'penalty_reason',  COALESCE(v_penalty->>'reason', 'none')
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_ride_by_rider IS
  'إلغاء رحلة من الراكب بشكل ذري مع حساب وخصم الغرامة وتسجيل balance_before/after (مصحح لـ service_role)';
