-- =============================================================
-- إصلاح شامل لقبول الرحلات — Fix Ride Acceptance
-- التاريخ: 2026-07-12
-- =============================================================
-- المشاكل المكتشفة:
-- 0. ⭐ notify_ride_status_change يشير لعمود vehicle_plate_number غير موجود
--    (العمود الصحيح: vehicle_plate) — السبب المباشر لفشل القبول
-- 1. captain_risk_radar_trigger يمكن أن يفشل ويلغي معاملة القبول بالكامل
-- 2. validate_ride_status_transition يمنع إعادة التعيين (accepted → pending)
-- 3. handle_driver_cancellation لا يعيد is_available للسائق القديم
-- =============================================================


-- ═══════════════════════════════════════════════════════════════════
-- 0️⃣ ⭐ إصلاح notify_ride_status_change — السبب المباشر للخطأ
--    vehicle_plate_number → vehicle_plate (العمود الصحيح في drivers)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_ride_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_record RECORD;
  v_rider_title TEXT;
  v_rider_body TEXT;
  v_driver_title TEXT;
  v_driver_body TEXT;
  v_notification_type TEXT;
  v_pickup TEXT;
  v_dropoff TEXT;
  v_fare TEXT;
BEGIN
  -- تجاهل إذا لم تتغير الحالة
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_pickup := COALESCE(NEW.pickup_address, 'موقع الانطلاق');
  v_dropoff := COALESCE(NEW.dropoff_address, 'الوجهة');
  v_fare := COALESCE(NEW.estimated_fare::TEXT, '0');

  -- ═══ حالة: تم قبول الرحلة ═══
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- جلب بيانات السائق
    SELECT full_name, phone, vehicle_type, vehicle_color, vehicle_plate
    INTO v_driver_record
    FROM drivers WHERE id = NEW.driver_id;

    v_rider_title := '✅ تم قبول رحلتك!';
    v_rider_body := 'السائق ' || COALESCE(v_driver_record.full_name, 'سائق') || ' في طريقه إليك';
    v_notification_type := 'ride_accepted';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object(
        'ride_id', NEW.id,
        'driver_name', v_driver_record.full_name,
        'driver_phone', v_driver_record.phone,
        'vehicle_type', v_driver_record.vehicle_type,
        'vehicle_color', v_driver_record.vehicle_color,
        'vehicle_plate', v_driver_record.vehicle_plate
      )
    );

  -- ═══ حالة: السائق وصل ═══
  ELSIF NEW.status = 'arrived' AND OLD.status = 'accepted' THEN
    v_rider_title := '📍 السائق وصل!';
    v_rider_body := 'السائق وصل إلى موقعك، يرجى التوجه إليه';
    v_notification_type := 'driver_arrived';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object('ride_id', NEW.id)
    );

  -- ═══ حالة: الرحلة بدأت ═══
  ELSIF NEW.status = 'in_progress' AND OLD.status = 'arrived' THEN
    v_rider_title := '🚗 الرحلة بدأت!';
    v_rider_body := 'في الطريق إلى ' || v_dropoff;
    v_notification_type := 'ride_started';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object('ride_id', NEW.id, 'dropoff_address', v_dropoff)
    );

  -- ═══ حالة: الرحلة اكتملت ═══
  ELSIF NEW.status = 'completed' THEN
    v_fare := COALESCE(NEW.final_fare::TEXT, NEW.estimated_fare::TEXT, '0');

    -- إشعار الراكب
    v_rider_title := '🏁 وصلت! الرحلة اكتملت';
    v_rider_body := 'المبلغ: ' || v_fare || ' د.ع — شكراً لاستخدامك ران!';
    v_notification_type := 'ride_completed';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object('ride_id', NEW.id, 'fare', v_fare)
    );

    -- إشعار السائق
    IF NEW.driver_id IS NOT NULL THEN
      v_driver_title := '🏁 رحلة مكتملة';
      v_driver_body := 'تم إكمال الرحلة — ' || v_fare || ' د.ع';

      INSERT INTO driver_notifications (driver_id, title, body, type, data)
      VALUES (
        NEW.driver_id,
        v_driver_title,
        v_driver_body,
        v_notification_type,
        jsonb_build_object('ride_id', NEW.id, 'fare', v_fare)
      );
    END IF;

  -- ═══ حالة: الرحلة ملغاة ═══
  ELSIF NEW.status = 'cancelled' THEN
    v_notification_type := 'ride_cancelled';

    -- إشعار الراكب (إذا ألغى السائق أو النظام)
    IF NEW.cancelled_by IS DISTINCT FROM 'rider' THEN
      v_rider_title := '❌ تم إلغاء الرحلة';
      IF NEW.cancelled_by = 'driver' THEN
        v_rider_body := 'السائق ألغى الرحلة — جاري البحث عن سائق بديل';
      ELSE
        v_rider_body := 'تم إلغاء الرحلة — يرجى المحاولة مرة أخرى';
      END IF;

      INSERT INTO rider_notifications (user_id, title, body, type, data)
      VALUES (
        NEW.rider_id,
        v_rider_title,
        v_rider_body,
        v_notification_type,
        jsonb_build_object(
          'ride_id', NEW.id,
          'cancelled_by', COALESCE(NEW.cancelled_by, 'system'),
          'reason', COALESCE(NEW.cancellation_reason, '')
        )
      );
    END IF;

    -- إشعار السائق (إذا ألغى الراكب)
    IF NEW.cancelled_by = 'rider' AND OLD.driver_id IS NOT NULL THEN
      v_driver_title := '❌ الراكب ألغى الرحلة';
      v_driver_body := 'تم إلغاء الرحلة من ' || v_pickup;

      INSERT INTO driver_notifications (driver_id, title, body, type, data)
      VALUES (
        OLD.driver_id,
        v_driver_title,
        v_driver_body,
        v_notification_type,
        jsonb_build_object(
          'ride_id', NEW.id,
          'reason', COALESCE(NEW.cancellation_reason, '')
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 1️⃣ إصلاح captain_risk_radar_trigger — جعله مقاوم للأخطاء
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.captain_risk_radar_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- فقط عند انتقال الحالة من pending إلى accepted مع وجود سائق
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.driver_id IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
        ),
        body := jsonb_build_object(
          'action', 'risk_radar',
          'ride_id', NEW.id,
          'driver_id', NEW.driver_id,
          'rider_id', NEW.rider_id
        )
      ) INTO request_id;

      RAISE LOG '[CaptainGuardian] Risk radar triggered for ride %: request_id=%', NEW.id, request_id;
    EXCEPTION WHEN OTHERS THEN
      -- ⚠️ لا نلغي المعاملة — الـ risk radar ميزة اختيارية
      RAISE LOG '[CaptainGuardian] Risk radar failed for ride % (non-fatal): %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.captain_risk_radar_trigger() IS
'رادار المخاطر — يرسل تنبيه عند قبول الرحلة (مع حماية من الأخطاء)';


-- ═══════════════════════════════════════════════════════════════════
-- 2️⃣ إصلاح captain_compensation_shield_trigger — نفس الحماية
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.captain_compensation_shield_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- فقط عند إلغاء الراكب بعد القبول أو الوصول
  IF NEW.status = 'cancelled'
     AND OLD.status IN ('accepted', 'arrived')
     AND NEW.cancelled_by = 'rider'
     AND OLD.driver_id IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
        ),
        body := jsonb_build_object(
          'action', 'compensation_shield',
          'ride_id', NEW.id,
          'driver_id', OLD.driver_id,
          'rider_id', NEW.rider_id,
          'old_status', OLD.status
        )
      ) INTO request_id;

      RAISE LOG '[CaptainGuardian] Compensation shield triggered for ride %: request_id=%', NEW.id, request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[CaptainGuardian] Compensation shield failed for ride % (non-fatal): %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 3️⃣ إصلاح validate_ride_status_transition — السماح بإعادة التعيين
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_ride_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- لا يمكن تغيير حالة رحلة مكتملة
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot change status of completed ride';
  END IF;

  -- لا يمكن تغيير حالة رحلة ملغاة
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of cancelled ride';
  END IF;

  -- التحولات المسموحة:
  -- pending -> accepted, cancelled
  -- accepted -> arrived, in_progress, cancelled, pending (إعادة تعيين)
  -- arrived -> in_progress, cancelled, pending (إعادة تعيين)
  -- in_progress -> completed, cancelled

  IF OLD.status = 'pending' AND NEW.status NOT IN ('accepted', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
  END IF;

  -- السماح بـ pending لإعادة التعيين عند إلغاء السائق
  IF OLD.status = 'accepted' AND NEW.status NOT IN ('arrived', 'in_progress', 'cancelled', 'pending') THEN
    RAISE EXCEPTION 'Invalid status transition from accepted to %', NEW.status;
  END IF;

  IF OLD.status = 'arrived' AND NEW.status NOT IN ('in_progress', 'cancelled', 'pending') THEN
    RAISE EXCEPTION 'Invalid status transition from arrived to %', NEW.status;
  END IF;

  IF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from in_progress to %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_ride_status_transition() IS
'التحقق من تحولات حالة الرحلة — مع دعم إعادة التعيين (accepted/arrived → pending)';


-- ═══════════════════════════════════════════════════════════════════
-- 4️⃣ إصلاح handle_driver_cancellation — إعادة تعيين is_available
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
  v_old_driver_id UUID;
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
  -- حفظ معرّف السائق القديم قبل التعديل
  v_old_driver_id := OLD.driver_id;

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

  BEGIN
    DECLARE
      v_driver_loc JSONB;
    BEGIN
      SELECT current_location INTO v_driver_loc
      FROM drivers WHERE id = v_old_driver_id;

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
    END;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

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
    NEW.distance_to_pickup_at_cancel := NULL;
    NEW.updated_at := now();

    -- ✅ إعادة تعيين is_available للسائق القديم
    UPDATE drivers
    SET is_available = true, updated_at = now()
    WHERE id = v_old_driver_id;

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
    BEGIN
      INSERT INTO notifications (
        user_id, title, message, type, is_read, created_at
      ) VALUES (
        v_rider_user_id,
        v_notification_title,
        v_notification_body,
        'ride_reassignment',
        false,
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to insert notification: %', SQLERRM;
    END;

    RAISE NOTICE 'Ride % reassigned (attempt %/3) after driver cancellation',
      NEW.id, NEW.reassignment_count;

  -- ═══════════════════════════════════════════════
  -- الحالة 2: إلغاء نهائي + غرامة على السائق
  -- ═══════════════════════════════════════════════
  ELSIF NEW.reassignment_count >= 3 THEN

    -- ✅ إعادة تعيين is_available للسائق القديم
    UPDATE drivers
    SET is_available = true, updated_at = now()
    WHERE id = v_old_driver_id;

    -- ═══ غرامة على السائق المتسبب بالإلغاء الأخير ═══
    BEGIN
      INSERT INTO driver_wallet_transactions (
        driver_id, amount, type, description, ride_id
      ) VALUES (
        v_old_driver_id,
        -v_base_fee,
        'adjustment',
        format('غرامة إلغاء رحلة #%s — تجاوز الحد الأقصى لإعادة التعيين', LEFT(NEW.id::TEXT, 8)),
        NEW.id
      );

      UPDATE drivers
      SET wallet_balance = COALESCE(wallet_balance, 0) - v_base_fee,
          updated_at = now()
      WHERE id = v_old_driver_id;

      SELECT EXISTS(
        SELECT 1 FROM driver_wallets WHERE driver_id = v_old_driver_id
      ) INTO v_driver_wallet_exists;

      IF v_driver_wallet_exists THEN
        PERFORM public.create_wallet_transaction(
          v_old_driver_id,
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
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to process driver penalty: %', SQLERRM;
    END;

    -- إشعارات
    SELECT user_id INTO v_driver_user_id FROM drivers WHERE id = v_old_driver_id;

    BEGIN
      INSERT INTO notifications (
        user_id, title, message, type, is_read, created_at
      ) VALUES (
        v_rider_user_id,
        'عذراً، لم نتمكن من إيجاد سائق',
        'لم نتمكن من إيجاد سائق متاح. يرجى المحاولة مرة أخرى لاحقاً.',
        'ride_cancelled',
        false,
        now()
      );

      IF v_driver_user_id IS NOT NULL THEN
        INSERT INTO notifications (
          user_id, title, message, type, is_read, created_at
        ) VALUES (
          v_driver_user_id,
          'تم خصم غرامة إلغاء ⚠️',
          format('تم خصم %s دينار من محفظتك بسبب إلغاء الرحلة بعد تجاوز الحد الأقصى للتعيين', v_base_fee),
          'wallet_debit',
          false,
          now()
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to insert cancellation notifications: %', SQLERRM;
    END;

    RAISE NOTICE 'Ride % permanently cancelled — driver % penalized % IQD',
      NEW.id, v_old_driver_id, v_base_fee;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_driver_cancellation() IS
'إعادة تعيين الرحلة عند إلغاء السائق (حتى 3 محاولات) + إعادة is_available + غرامة مالية';


-- ═══════════════════════════════════════════════════════════════════
-- 5️⃣ إصلاح السائقين العالقين — تنظيف is_available
-- ═══════════════════════════════════════════════════════════════════

-- إعادة تعيين is_available = true للسائقين المتصلين الذين ليس لديهم رحلة نشطة
UPDATE drivers
SET is_available = true, updated_at = now()
WHERE is_online = true
  AND is_available = false
  AND id NOT IN (
    SELECT driver_id FROM rides
    WHERE status IN ('accepted', 'arrived', 'in_progress')
      AND driver_id IS NOT NULL
  );


-- ═══════════════════════════════════════════════════════════════════
-- 6️⃣ تحسين on_ride_status_change — دعم إعادة التعيين
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_driver_stats_on_ride_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ride_earnings INTEGER;
  current_driver_id UUID;
BEGIN
  -- عند اكتمال الرحلة
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.driver_id IS NOT NULL THEN
    current_driver_id := NEW.driver_id;
    ride_earnings := COALESCE(NEW.final_fare, NEW.estimated_fare, 0);

    UPDATE drivers
    SET
      total_rides = COALESCE(total_rides, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + ride_earnings,
      is_available = true,
      updated_at = now()
    WHERE id = current_driver_id;

    RAISE LOG 'Updated driver % stats: +1 ride, +% earnings', current_driver_id, ride_earnings;
  END IF;

  -- عند قبول/وصول/بدء الرحلة → السائق غير متاح
  IF NEW.status IN ('accepted', 'arrived', 'in_progress') AND NEW.driver_id IS NOT NULL THEN
    UPDATE drivers
    SET is_available = false, updated_at = now()
    WHERE id = NEW.driver_id;
  END IF;

  -- عند إلغاء الرحلة → السائق متاح مرة أخرى
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND OLD.driver_id IS NOT NULL THEN
    UPDATE drivers
    SET is_available = true, updated_at = now()
    WHERE id = OLD.driver_id;
  END IF;

  -- ✅ جديد: عند إعادة التعيين (accepted/arrived → pending) → السائق القديم متاح
  IF NEW.status = 'pending' AND OLD.status IN ('accepted', 'arrived') AND OLD.driver_id IS NOT NULL THEN
    UPDATE drivers
    SET is_available = true, updated_at = now()
    WHERE id = OLD.driver_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_driver_stats_on_ride_complete() IS
'تحديث إحصائيات السائق عند تغيير حالة الرحلة — مع دعم إعادة التعيين';
