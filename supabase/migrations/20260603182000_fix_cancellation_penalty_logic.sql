-- ═══════════════════════════════════════════════════════════════════
-- Migration: إصلاح غرامات إلغاء الراكب وضمان السلامة المالية ومنع التكرار المتزامن
-- التاريخ الفعلي الحالي: 2026-06-03 18:20:00
-- ═══════════════════════════════════════════════════════════════════

-- [تعطيل محاسبي وإداري]: تم نقل عملية أرشفة وحذف التكرارات وإضافة القيد الفريد بالكامل إلى Migration لاحق (20270603185000)
-- لضمان أرشفة كافة البيانات مع أعمدة الـ ledger المضافة لاحقاً وتجنب الحذف المبكر الناقص للبيانات التاريخية.

/*
-- 1️⃣ إنشاء جدول الأرشفة والنسخ الاحتياطي للمعاملات المكررة قبل حذفها
CREATE TABLE IF NOT EXISTS public.deleted_rider_wallet_transactions_backup (
  id UUID,
  user_id UUID,
  amount INTEGER,
  type TEXT,
  payment_method TEXT,
  reference_id TEXT,
  ride_id UUID,
  status TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2️⃣ نسخ المعاملات المكررة التاريخية (إن وُجدت) إلى جدول الأرشفة للتدقيق اللاحق
WITH duplicates AS (
  SELECT t1.id
  FROM public.rider_wallet_transactions t1
  JOIN public.rider_wallet_transactions t2 
    ON t1.ride_id = t2.ride_id 
    AND t1.type = t2.type
  WHERE t1.id > t2.id 
    AND t1.ride_id IS NOT NULL
)
INSERT INTO public.deleted_rider_wallet_transactions_backup (
  id, user_id, amount, type, payment_method, reference_id, ride_id, status, description, created_at
)
SELECT id, user_id, amount, type, payment_method, reference_id, ride_id, status, description, created_at
FROM public.rider_wallet_transactions
WHERE id IN (SELECT id FROM duplicates)
ON CONFLICT DO NOTHING;

-- 3️⃣ حذف التكرارات التاريخية الفعلية التي تم نسخها احتياطياً
DELETE FROM public.rider_wallet_transactions
WHERE id IN (SELECT id FROM public.deleted_rider_wallet_transactions_backup);

-- 4️⃣ قيد الـ Idempotency الفريد على مستوى جدول معاملات محفظة الراكب لمنع التكرار
ALTER TABLE public.rider_wallet_transactions
  ADD CONSTRAINT uq_rider_wallet_ride_payment UNIQUE (ride_id, type);
*/



-- 5️⃣ تحديث دالة احتساب الغرامة مع الافتراض الاحترازي (التعطيل التلقائي في حال غياب الإعداد أو تلفه)
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
  IF v_ride.status IN ('accepted', 'arrived') THEN
    v_should_penalize := true;
    v_penalty_reason := 'driver_accepted_ride';
  END IF;

  -- إذا وصل السائق بالفعل (حالة arrived)، يتم مضاعفة الغرامة
  IF v_ride.status = 'arrived' THEN
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

  -- حساب الوقت والمسافة للتوثيق
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


-- 6️⃣ تحديث دالة تريجر الغرامة لمنع التكرار المتزامن وقفل صف المحفظة
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
     OR OLD.status NOT IN ('accepted', 'arrived')
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
  -- 🛡️ لا يتم تعويض السائق إلا إذا كانت الغرامة مفعّلة، وتم تسجيل غرامة الراكب بنجاح، أو كانت مسجلة مسبقاً بشكل موثّق، ولم يتم تعويض السائق سابقاً.
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

      -- إرسال الإشعارات للسائق والراكب عند تنفيذ المعاملة المالية الفعلية فقط
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
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
