-- =====================================================================
-- Migration: "Justice" Cancellation Logic — عدالة الإلغاء
-- التاريخ: 2026-02-15
-- الوصف: تعويض مالي حقيقي عند إلغاء الرحلات بناءً على جهد السائق
-- =====================================================================
-- 
-- 📌 السيناريوهات:
--   A) الراكب يلغي → غرامة على الراكب + تعويض للسائق  
--      (إذا مرّ أكثر من دقيقتين بعد القبول أو السائق ضمن 500م من نقطة الانطلاق)
--   B) السائق يلغي → بعد 3 محاولات إعادة تعيين → غرامة على السائق
--
-- 📌 يستخدم كلا نظامي المحفظة الموجودين:
--   - النظام البسيط: driver_wallet_transactions + rider_wallet_transactions + profiles.wallet_balance + drivers.wallet_balance
--   - النظام المتقدم: driver_wallets + wallet_transactions (via create_wallet_transaction)
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════
-- 1️⃣ إضافة أعمدة جديدة لجدول rides
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS driver_arrival_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS distance_to_pickup_at_cancel FLOAT;

COMMENT ON COLUMN rides.driver_arrival_time IS 'وقت وصول السائق الفعلي إلى نقطة الانطلاق';
COMMENT ON COLUMN rides.distance_to_pickup_at_cancel IS 'المسافة بين السائق ونقطة الانطلاق لحظة الإلغاء (بالكيلومتر)';


-- ═══════════════════════════════════════════════════════════════════
-- 2️⃣ دالة حساب غرامة الإلغاء
-- ═══════════════════════════════════════════════════════════════════

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
  v_distance_km FLOAT;
  v_time_since_accept INTERVAL;
  v_penalty_amount INTEGER;
  v_penalty_reason TEXT;
  v_should_penalize BOOLEAN := false;
  v_base_fee INTEGER := 2000; -- غرامة أساسية افتراضية (دينار عراقي)
  v_settings_fee JSONB;
BEGIN
  -- ═══ جلب بيانات الرحلة ═══
  SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
  
  IF v_ride IS NULL THEN
    RETURN jsonb_build_object('should_penalize', false, 'reason', 'ride_not_found');
  END IF;

  -- ═══ محاولة قراءة الغرامة من الإعدادات ═══
  SELECT value INTO v_settings_fee
  FROM app_settings
  WHERE key = 'cancellation_fee';
  
  IF v_settings_fee IS NOT NULL AND (v_settings_fee->>'enabled')::BOOLEAN = true THEN
    v_base_fee := COALESCE((v_settings_fee->>'amount')::INTEGER, 2000);
  END IF;

  -- ═══ حساب الوقت منذ القبول ═══
  IF v_ride.accepted_at IS NOT NULL THEN
    v_time_since_accept := now() - v_ride.accepted_at;
  END IF;

  -- ═══ حساب مسافة السائق من نقطة الانطلاق ═══
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

  -- ═══ شروط استحقاق الغرامة (سيناريو الراكب) ═══
  -- الشرط 1: أكثر من دقيقتين بعد القبول
  IF v_ride.status IN ('accepted', 'arrived') 
     AND v_time_since_accept IS NOT NULL 
     AND v_time_since_accept > INTERVAL '2 minutes' THEN
    v_should_penalize := true;
    v_penalty_reason := 'time_exceeded_2min';
  END IF;

  -- الشرط 2: السائق ضمن 500 متر (0.5 كم) من نقطة الانطلاق
  IF v_ride.status IN ('accepted', 'arrived') 
     AND v_distance_km IS NOT NULL 
     AND v_distance_km <= 0.5 THEN
    v_should_penalize := true;
    v_penalty_reason := COALESCE(v_penalty_reason || '+', '') || 'driver_within_500m';
  END IF;

  -- الشرط 3: السائق وصل بالفعل (حالة arrived)
  IF v_ride.status = 'arrived' THEN
    v_should_penalize := true;
    v_penalty_reason := 'driver_already_arrived';
    -- غرامة أعلى عندما يكون السائق قد وصل فعلاً
    v_penalty_amount := v_base_fee * 2;
  END IF;

  -- ═══ تحديد المبلغ النهائي ═══
  IF v_penalty_amount IS NULL THEN
    v_penalty_amount := v_base_fee;
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

COMMENT ON FUNCTION public.calculate_cancellation_penalty IS 
'حساب غرامة الإلغاء بناءً على الوقت والمسافة — تُستدعى قبل تنفيذ الغرامة';


-- ═══════════════════════════════════════════════════════════════════
-- 3️⃣ سيناريو A: دالة غرامة إلغاء الراكب (مع تعويض مالي حقيقي)
-- ═══════════════════════════════════════════════════════════════════
-- تحل محل add_cancellation_compensation التجميلية السابقة

CREATE OR REPLACE FUNCTION public.handle_rider_cancellation_penalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_penalty JSONB;
  v_penalty_amount INTEGER;
  v_driver_id UUID;
  v_rider_user_id UUID;
  v_driver_lat FLOAT;
  v_driver_lng FLOAT;
  v_pickup_lat FLOAT;
  v_pickup_lng FLOAT;
  v_distance_km FLOAT;
  v_rider_balance INTEGER;
  v_driver_wallet_exists BOOLEAN;
BEGIN
  -- ═══ فحص الشروط الأساسية ═══
  -- يجب أن يكون:  
  --   - الإلغاء من الراكب
  --   - الحالة السابقة: accepted أو arrived  
  --   - يوجد سائق مخصص
  IF NEW.cancelled_by != 'rider' 
     OR OLD.status NOT IN ('accepted', 'arrived')
     OR OLD.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_driver_id := OLD.driver_id;
  v_rider_user_id := OLD.rider_id;

  -- ═══ حساب الغرامة ═══
  v_penalty := public.calculate_cancellation_penalty(NEW.id);
  
  IF NOT (v_penalty->>'should_penalize')::BOOLEAN THEN
    -- لم تتحقق شروط الغرامة — إلغاء مجاني
    RAISE NOTICE 'Ride % cancelled by rider — no penalty (reason: %)', NEW.id, v_penalty->>'reason';
    RETURN NEW;
  END IF;

  v_penalty_amount := (v_penalty->>'penalty_amount')::INTEGER;

  -- ═══ حساب المسافة وتسجيلها ═══
  v_distance_km := (v_penalty->>'distance_to_pickup_km')::FLOAT;
  NEW.distance_to_pickup_at_cancel := v_distance_km;
  NEW.cancellation_fee := v_penalty_amount;

  -- ═══ خصم من محفظة الراكب ═══
  -- (1) rider_wallet_transactions — النظام البسيط
  INSERT INTO rider_wallet_transactions (
    user_id,
    amount,
    type,
    description,
    ride_id,
    status
  ) VALUES (
    v_rider_user_id,
    -v_penalty_amount,
    'ride_payment',  -- نستخدم نوع موجود في CHECK constraint
    format('غرامة إلغاء رحلة #%s — %s', LEFT(NEW.id::TEXT, 8), v_penalty->>'reason'),
    NEW.id,
    'completed'
  );

  -- (2) تحديث رصيد الراكب في profiles
  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_penalty_amount,
      updated_at = now()
  WHERE user_id = v_rider_user_id;

  -- ═══ إضافة تعويض لمحفظة السائق ═══
  -- (1) driver_wallet_transactions — النظام البسيط
  INSERT INTO driver_wallet_transactions (
    driver_id,
    amount,
    type,
    description,
    ride_id
  ) VALUES (
    v_driver_id,
    v_penalty_amount,
    'cancellation_compensation',
    format('تعويض إلغاء الراكب — الرحلة #%s', LEFT(NEW.id::TEXT, 8)),
    NEW.id
  );

  -- (2) تحديث رصيد السائق في drivers
  UPDATE drivers
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_penalty_amount,
      updated_at = now()
  WHERE id = v_driver_id;

  -- (3) النظام المتقدم driver_wallets — إذا كانت المحفظة موجودة
  SELECT EXISTS(
    SELECT 1 FROM driver_wallets WHERE driver_id = v_driver_id
  ) INTO v_driver_wallet_exists;

  IF v_driver_wallet_exists THEN
    PERFORM public.create_wallet_transaction(
      v_driver_id,
      'bonus',  -- تعويض الإلغاء كمكافأة
      v_penalty_amount::DECIMAL(12,2),
      NEW.id,
      format('تعويض إلغاء الراكب — %s', v_penalty->>'reason'),
      jsonb_build_object(
        'penalty_type', 'rider_cancellation_compensation',
        'time_since_accept_seconds', v_penalty->>'time_since_accept_seconds',
        'distance_to_pickup_km', v_penalty->>'distance_to_pickup_km'
      )
    );
  END IF;

  -- ═══ تعليم الغرامة كمدفوعة ═══
  NEW.cancellation_fee_paid := true;

  -- ═══ إشعار السائق بالتعويض ═══
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- إشعار السائق
    INSERT INTO notifications (
      user_id,
      title,
      body,
      type,
      data,
      is_read,
      created_at
    ) VALUES (
      (SELECT user_id FROM drivers WHERE id = v_driver_id),
      'تم تعويضك عن الإلغاء 💰',
      format('تم إضافة %s دينار لمحفظتك كتعويض عن إلغاء الراكب', v_penalty_amount),
      'wallet_credit',
      jsonb_build_object(
        'ride_id', NEW.id,
        'amount', v_penalty_amount,
        'reason', 'rider_cancellation_compensation'
      ),
      false,
      now()
    );

    -- إشعار الراكب بالخصم
    INSERT INTO notifications (
      user_id,
      title,
      body,
      type,
      data,
      is_read,
      created_at
    ) VALUES (
      v_rider_user_id,
      'تم خصم غرامة إلغاء',
      format('تم خصم %s دينار من محفظتك — السائق كان في طريقه إليك', v_penalty_amount),
      'wallet_debit',
      jsonb_build_object(
        'ride_id', NEW.id,
        'amount', v_penalty_amount,
        'reason', v_penalty->>'reason'
      ),
      false,
      now()
    );
  END IF;

  RAISE NOTICE 'Ride % — rider cancellation penalty applied: % IQD (reason: %)', 
    NEW.id, v_penalty_amount, v_penalty->>'reason';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_rider_cancellation_penalty IS
'غرامة حقيقية على الراكب عند الإلغاء بعد جهد السائق (وقت > 2 دقيقة أو مسافة < 500م أو وصول)';


-- ═══════════════════════════════════════════════════════════════════
-- 4️⃣ إعادة بناء trigger الراكب
-- ═══════════════════════════════════════════════════════════════════

-- حذف التريجر التجميلي القديم
DROP TRIGGER IF EXISTS add_cancellation_compensation_trigger ON rides;

-- إنشاء التريجر الجديد (BEFORE UPDATE لأنه يعدّل NEW)
DROP TRIGGER IF EXISTS trigger_rider_cancellation_penalty ON rides;

CREATE TRIGGER trigger_rider_cancellation_penalty
  BEFORE UPDATE ON rides
  FOR EACH ROW
  WHEN (
    NEW.status = 'cancelled'
    AND NEW.cancelled_by = 'rider'
    AND OLD.status IN ('accepted', 'arrived')
    AND OLD.driver_id IS NOT NULL
  )
  EXECUTE FUNCTION public.handle_rider_cancellation_penalty();

COMMENT ON TRIGGER trigger_rider_cancellation_penalty ON rides IS
'يُشغَّل عند إلغاء الراكب لرحلة مقبولة/واصل — يطبق غرامة مالية حقيقية';


-- ═══════════════════════════════════════════════════════════════════
-- 5️⃣ سيناريو B: تحسين دالة إلغاء السائق (غرامة بعد 3 محاولات)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_driver_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rider_user_id UUID;
  v_driver_user_id UUID;
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_base_fee INTEGER := 2000;
  v_settings_fee JSONB;
  v_driver_wallet_exists BOOLEAN;
  v_pickup_lat FLOAT;
  v_pickup_lng FLOAT;
  v_driver_lat FLOAT;
  v_driver_lng FLOAT;
  v_distance_km FLOAT;
BEGIN
  -- ═══ قراءة الغرامة الأساسية من الإعدادات ═══
  SELECT value INTO v_settings_fee
  FROM app_settings
  WHERE key = 'cancellation_fee';
  
  IF v_settings_fee IS NOT NULL AND (v_settings_fee->>'enabled')::BOOLEAN = true THEN
    v_base_fee := COALESCE((v_settings_fee->>'amount')::INTEGER, 2000);
  END IF;

  -- ═══ حساب المسافة من نقطة الانطلاق وتسجيلها ═══
  v_pickup_lat := (OLD.pickup_location->>'lat')::FLOAT;
  v_pickup_lng := (OLD.pickup_location->>'lng')::FLOAT;

  DECLARE
    v_driver_loc JSONB;
  BEGIN
    SELECT current_location INTO v_driver_loc
    FROM drivers WHERE id = OLD.driver_id;

    IF v_driver_loc IS NOT NULL THEN
      v_driver_lat := (v_driver_loc->>'lat')::FLOAT;
      v_driver_lng := (v_driver_loc->>'lng')::FLOAT;
      IF v_driver_lat IS NOT NULL AND v_driver_lng IS NOT NULL
         AND v_pickup_lat IS NOT NULL AND v_pickup_lng IS NOT NULL THEN
        v_distance_km := public.calculate_distance(
          v_driver_lat, v_driver_lng, v_pickup_lat, v_pickup_lng
        );
        NEW.distance_to_pickup_at_cancel := v_distance_km;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- driver not found or no location
  END;

  -- جلب user_id للراكب
  v_rider_user_id := OLD.rider_id;

  -- ═══════════════════════════════════════════════
  -- الحالة 1: إعادة تعيين (أقل من 3 محاولات)
  -- ═══════════════════════════════════════════════
  IF NEW.reassignment_count < 3 THEN
    
    NEW.status := 'pending';
    NEW.driver_id := NULL;
    NEW.reassignment_count := COALESCE(OLD.reassignment_count, 0) + 1;
    NEW.cancelled_by := NULL;
    NEW.cancellation_reason := NULL;
    NEW.distance_to_pickup_at_cancel := NULL; -- إعادة تعيين المسافة
    NEW.updated_at := now();
    
    -- تحديد نص الإشعار
    IF NEW.reassignment_count = 1 THEN
      v_notification_title := 'البحث عن سائق بديل';
      v_notification_body := 'السائق ألغى الطلب، جاري البحث عن سائق بديل...';
    ELSIF NEW.reassignment_count = 2 THEN
      v_notification_title := 'لا تزال نبحث';
      v_notification_body := 'جاري البحث عن سائق آخر، يرجى الانتظار قليلاً...';
    ELSIF NEW.reassignment_count = 3 THEN
      v_notification_title := 'المحاولة الأخيرة';
      v_notification_body := 'آخر محاولة للعثور على سائق متاح...';
    END IF;
    
    -- إنشاء إشعار للراكب
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
      INSERT INTO notifications (
        user_id, title, body, type, data, is_read, created_at
      ) VALUES (
        v_rider_user_id,
        v_notification_title,
        v_notification_body,
        'ride_reassignment',
        jsonb_build_object(
          'ride_id', NEW.id,
          'reassignment_count', NEW.reassignment_count,
          'previous_status', OLD.status
        ),
        false,
        now()
      );
    END IF;
    
    RAISE NOTICE 'Ride % reassigned (attempt %/3) after driver cancellation', 
      NEW.id, NEW.reassignment_count;

  -- ═══════════════════════════════════════════════
  -- الحالة 2: إلغاء نهائي + غرامة على السائق
  -- ═══════════════════════════════════════════════
  ELSIF NEW.reassignment_count >= 3 THEN

    -- ═══ غرامة على السائق المتسبب بالإلغاء الأخير ═══
    -- خصم من driver_wallet_transactions (النظام البسيط)
    INSERT INTO driver_wallet_transactions (
      driver_id,
      amount,
      type,
      description,
      ride_id
    ) VALUES (
      OLD.driver_id,
      -v_base_fee,  -- مبلغ سالب = خصم
      'adjustment',  -- نوع 'adjustment' موجود في CHECK constraint
      format('غرامة إلغاء رحلة #%s — تجاوز الحد الأقصى لإعادة التعيين', LEFT(NEW.id::TEXT, 8)),
      NEW.id
    );

    -- تحديث رصيد السائق في drivers  
    UPDATE drivers
    SET wallet_balance = COALESCE(wallet_balance, 0) - v_base_fee,
        updated_at = now()
    WHERE id = OLD.driver_id;

    -- النظام المتقدم driver_wallets
    SELECT EXISTS(
      SELECT 1 FROM driver_wallets WHERE driver_id = OLD.driver_id
    ) INTO v_driver_wallet_exists;

    IF v_driver_wallet_exists THEN
      PERFORM public.create_wallet_transaction(
        OLD.driver_id,
        'penalty',
        (-v_base_fee)::DECIMAL(12,2),
        NEW.id,
        'غرامة إلغاء — تجاوز حد إعادة التعيين (3 محاولات)',
        jsonb_build_object(
          'penalty_type', 'driver_max_reassignment_penalty',
          'reassignment_count', NEW.reassignment_count
        )
      );
    END IF;

    -- إشعار السائق بالغرامة
    SELECT user_id INTO v_driver_user_id FROM drivers WHERE id = OLD.driver_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
      -- إشعار الراكب بالإلغاء النهائي
      INSERT INTO notifications (
        user_id, title, body, type, data, is_read, created_at
      ) VALUES (
        v_rider_user_id,
        'عذراً، لم نتمكن من إيجاد سائق',
        'لم نتمكن من إيجاد سائق متاح. يرجى المحاولة مرة أخرى لاحقاً.',
        'ride_cancelled',
        jsonb_build_object(
          'ride_id', NEW.id,
          'reason', 'max_reassignment_reached'
        ),
        false,
        now()
      );

      -- إشعار السائق بالغرامة
      IF v_driver_user_id IS NOT NULL THEN
        INSERT INTO notifications (
          user_id, title, body, type, data, is_read, created_at
        ) VALUES (
          v_driver_user_id,
          'تم خصم غرامة إلغاء ⚠️',
          format('تم خصم %s دينار من محفظتك بسبب إلغاء الرحلة بعد تجاوز الحد الأقصى للتعيين', v_base_fee),
          'wallet_debit',
          jsonb_build_object(
            'ride_id', NEW.id,
            'amount', v_base_fee,
            'reason', 'max_reassignment_penalty'
          ),
          false,
          now()
        );
      END IF;
    END IF;
    
    RAISE NOTICE 'Ride % permanently cancelled — driver % penalized % IQD', 
      NEW.id, OLD.driver_id, v_base_fee;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_driver_cancellation() IS 
'إعادة تعيين الرحلة عند إلغاء السائق (حتى 3 محاولات) ثم غرامة مالية حقيقية';


-- ═══════════════════════════════════════════════════════════════════
-- 6️⃣ إعادة إنشاء trigger إلغاء السائق (بنفس الاسم الأصلي)
-- ═══════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_handle_driver_cancellation ON rides;

CREATE TRIGGER trigger_handle_driver_cancellation
  BEFORE UPDATE ON rides
  FOR EACH ROW
  WHEN (
    NEW.status = 'cancelled' 
    AND NEW.cancelled_by = 'driver'
    AND OLD.status IN ('accepted', 'arrived')
  )
  EXECUTE FUNCTION public.handle_driver_cancellation();

COMMENT ON TRIGGER trigger_handle_driver_cancellation ON rides IS 
'يُشغَّل عند إلغاء السائق — إعادة تعيين (حتى 3 مرات) ثم غرامة مالية';


-- ═══════════════════════════════════════════════════════════════════
-- 7️⃣ فهارس لتحسين الأداء
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_rides_cancellation_fee_paid
ON rides(cancellation_fee_paid)
WHERE cancellation_fee > 0;

CREATE INDEX IF NOT EXISTS idx_rides_cancelled_with_driver
ON rides(driver_id, cancelled_by)
WHERE status = 'cancelled' AND driver_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 8️⃣ دالة مساعدة: استعلام تقرير الغرامات (للوحة Admin)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_cancellation_penalties_report(
  p_from_date TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days',
  p_to_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  ride_id UUID,
  cancelled_by TEXT,
  cancellation_fee INTEGER,
  cancellation_fee_paid BOOLEAN,
  distance_to_pickup FLOAT,
  cancelled_at TIMESTAMPTZ,
  rider_id UUID,
  driver_id UUID,
  reassignment_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    r.id,
    r.cancelled_by,
    r.cancellation_fee,
    r.cancellation_fee_paid,
    r.distance_to_pickup_at_cancel,
    r.updated_at,
    r.rider_id,
    r.driver_id,
    r.reassignment_count
  FROM rides r
  WHERE r.status = 'cancelled'
    AND r.cancellation_fee > 0
    AND r.updated_at BETWEEN p_from_date AND p_to_date
  ORDER BY r.updated_at DESC;
$$;

COMMENT ON FUNCTION public.get_cancellation_penalties_report IS
'تقرير الغرامات للوحة الإدارة — يعرض كل الإلغاءات مع غرامات حقيقية';


-- ═══════════════════════════════════════════════════════════════════
-- ⬇️ ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
/*
-- لإلغاء هذا الترحيل:
DROP TRIGGER IF EXISTS trigger_rider_cancellation_penalty ON rides;
DROP TRIGGER IF EXISTS trigger_handle_driver_cancellation ON rides;
DROP FUNCTION IF EXISTS public.handle_rider_cancellation_penalty();
DROP FUNCTION IF EXISTS public.calculate_cancellation_penalty(UUID);
DROP FUNCTION IF EXISTS public.get_cancellation_penalties_report(TIMESTAMPTZ, TIMESTAMPTZ);
DROP INDEX IF EXISTS idx_rides_cancellation_fee_paid;
DROP INDEX IF EXISTS idx_rides_cancelled_with_driver;
ALTER TABLE rides DROP COLUMN IF EXISTS driver_arrival_time;
ALTER TABLE rides DROP COLUMN IF EXISTS distance_to_pickup_at_cancel;

-- إعادة الدالة الأصلية (التجميلية):
-- أعد تشغيل ملف 20260130000000_reassign_on_driver_cancel.sql
-- + أعد تشغيل ملف 20251219225610 (add_cancellation_compensation)
*/
