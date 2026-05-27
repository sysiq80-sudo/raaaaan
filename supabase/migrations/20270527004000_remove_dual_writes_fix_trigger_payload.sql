-- ═══════════════════════════════════════════════════════════════════
-- Migration: إزالة الكتابة المزدوجة (dual-writes) + إصلاح trigger payload
-- ═══════════════════════════════════════════════════════════════════
-- التغييرات:
--   1. captain_compensation_shield_trigger: إعادة distance_to_pickup_at_cancel للـ payload
--   2. handle_driver_cancellation: إزالة old system (driver_wallet_transactions + drivers.wallet_balance)
--   3. handle_rider_cancellation_penalty: إزالة old system driver writes، إبقاء rider writes
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- 1️⃣ إصلاح captain_compensation_shield_trigger
--    إعادة حقل distance_to_pickup_at_cancel للـ payload (تراجع عن 20260712)
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
          'old_status', OLD.status,
          'distance_to_pickup_at_cancel', NEW.distance_to_pickup_at_cancel
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

COMMENT ON FUNCTION public.captain_compensation_shield_trigger() IS
'إطلاق Edge Function لفحص تعويض الكابتن — يتضمن distance_to_pickup_at_cancel في الـ payload';


-- ═══════════════════════════════════════════════════════════════════
-- 2️⃣ handle_driver_cancellation — إزالة dual-writes للنظام القديم
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
      -- ✅ النظام الجديد فقط (create_wallet_transaction يُنشئ driver_wallets تلقائياً)
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
'إعادة تعيين الرحلة عند إلغاء السائق (حتى 3 محاولات) + إعادة is_available + غرامة عبر النظام الجديد فقط';


-- ═══════════════════════════════════════════════════════════════════
-- 3️⃣ handle_rider_cancellation_penalty — إزالة dual-writes للسائق
--    إبقاء كتابات الراكب كما هي (لا يوجد نظام محافظ جديد للراكب بعد)
-- ═══════════════════════════════════════════════════════════════════

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
BEGIN
  -- ═══ فحص الشروط الأساسية ═══
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
    RAISE NOTICE 'Ride % cancelled by rider — no penalty (reason: %)', NEW.id, v_penalty->>'reason';
    RETURN NEW;
  END IF;

  v_penalty_amount := (v_penalty->>'penalty_amount')::INTEGER;

  -- ═══ حساب المسافة وتسجيلها ═══
  v_distance_km := (v_penalty->>'distance_to_pickup_km')::FLOAT;
  NEW.distance_to_pickup_at_cancel := v_distance_km;
  NEW.cancellation_fee := v_penalty_amount;

  -- ═══ خصم من محفظة الراكب (النظام البسيط — لا يوجد نظام محافظ للراكب بعد) ═══
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
    'ride_payment',
    format('غرامة إلغاء رحلة #%s — %s', LEFT(NEW.id::TEXT, 8), v_penalty->>'reason'),
    NEW.id,
    'completed'
  );

  UPDATE profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) - v_penalty_amount,
      updated_at = now()
  WHERE user_id = v_rider_user_id;

  -- ═══ إضافة تعويض لمحفظة السائق ═══
  -- ✅ النظام الجديد فقط (create_wallet_transaction يُنشئ driver_wallets تلقائياً)
  PERFORM public.create_wallet_transaction(
    v_driver_id,
    'bonus',
    v_penalty_amount::DECIMAL(12,2),
    NEW.id,
    format('تعويض إلغاء الراكب — %s', v_penalty->>'reason'),
    jsonb_build_object(
      'penalty_type', 'rider_cancellation_compensation',
      'time_since_accept_seconds', v_penalty->>'time_since_accept_seconds',
      'distance_to_pickup_km', v_penalty->>'distance_to_pickup_km'
    )
  );

  -- ═══ تعليم الغرامة كمدفوعة ═══
  NEW.cancellation_fee_paid := true;

  -- ═══ إشعار السائق بالتعويض ═══
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
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
'غرامة حقيقية على الراكب — تعويض السائق عبر النظام الجديد فقط (wallet_transactions)';
