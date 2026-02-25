-- إصلاح دالة handle_driver_cancellation: تصحيح أسماء أعمدة جدول notifications
CREATE OR REPLACE FUNCTION public.handle_driver_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    
    -- إنشاء إشعار للراكب (تصحيح: message بدلاً من body، بدون data)
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

    INSERT INTO driver_wallet_transactions (
      driver_id, amount, type, description, ride_id
    ) VALUES (
      OLD.driver_id,
      -v_base_fee,
      'adjustment',
      format('غرامة إلغاء رحلة #%s — تجاوز الحد الأقصى لإعادة التعيين', LEFT(NEW.id::TEXT, 8)),
      NEW.id
    );

    UPDATE drivers
    SET wallet_balance = COALESCE(wallet_balance, 0) - v_base_fee,
        updated_at = now()
    WHERE id = OLD.driver_id;

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

    SELECT user_id INTO v_driver_user_id FROM drivers WHERE id = OLD.driver_id;

    -- إشعارات (تصحيح: message بدلاً من body، بدون data)
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
      RAISE NOTICE 'Failed to insert notification: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Ride % permanently cancelled — driver % penalized % IQD', 
      NEW.id, OLD.driver_id, v_base_fee;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إصلاح دالة handle_driver_cooldown: تصحيح أسماء أعمدة جدول notifications
CREATE OR REPLACE FUNCTION public.handle_driver_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_since_accept INTERVAL;
  v_accept_time TIMESTAMPTZ;
  v_driver_user_id UUID;
  v_driver_name TEXT;
  v_is_valid_reason BOOLEAN := FALSE;
  v_cooldown_minutes INTEGER := 15;
  v_settings JSONB;
BEGIN
  IF NEW.cancelled_by != 'driver' THEN RETURN NEW; END IF;
  IF OLD.driver_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status NOT IN ('accepted', 'arrived') THEN RETURN NEW; END IF;

  SELECT user_id, full_name INTO v_driver_user_id, v_driver_name
  FROM drivers WHERE id = OLD.driver_id;

  v_accept_time := COALESCE(OLD.matched_at, OLD.accepted_at);
  
  IF v_accept_time IS NULL THEN
    RETURN NEW;
  END IF;

  v_time_since_accept := now() - v_accept_time;

  IF v_time_since_accept <= INTERVAL '3 minutes' THEN
    RAISE NOTICE 'Ride % — driver cancelled within 3 min (%), no cooldown', NEW.id, v_time_since_accept;
    RETURN NEW;
  END IF;

  v_is_valid_reason := (
    LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%no show%'
    OR LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%no_show%'
    OR LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%rider_no_show%'
    OR LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%عدم حضور%'
    OR LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%لم يحضر%'
    OR LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%الراكب غير موجود%'
    OR (OLD.status = 'arrived' AND LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%انتظار%')
  );

  IF v_is_valid_reason THEN
    RAISE NOTICE 'Ride % — driver cancel with valid reason: %, no cooldown', NEW.id, NEW.cancellation_reason;
    RETURN NEW;
  END IF;

  SELECT value INTO v_settings
  FROM app_settings
  WHERE key = 'driver_cooldown_settings';
  
  IF v_settings IS NOT NULL THEN
    v_cooldown_minutes := COALESCE((v_settings->>'cooldown_minutes')::INTEGER, 15);
  END IF;

  RAISE NOTICE 'Ride % — driver % cooldown activated for % minutes (reason: %, time: %)',
    NEW.id, v_driver_name, v_cooldown_minutes, NEW.cancellation_reason, v_time_since_accept;

  UPDATE drivers
  SET cooldown_until = now() + (v_cooldown_minutes || ' minutes')::INTERVAL,
      is_online = false,
      is_available = false,
      updated_at = now()
  WHERE id = OLD.driver_id;

  -- إشعار السائق (تصحيح: message بدلاً من body، بدون data)
  IF v_driver_user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (
        user_id, title, message, type, is_read, created_at
      ) VALUES (
        v_driver_user_id,
        '⚠️ إيقاف مؤقت',
        format('تم إيقاف استقبال الطلبات مؤقتاً لمدة %s دقيقة بسبب إلغاء الرحلة بعد قبولها.', v_cooldown_minutes),
        'driver_cooldown',
        false,
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to insert cooldown notification: %', SQLERRM;
    END;
  END IF;

  NEW.high_priority := true;

  RETURN NEW;
END;
$$;