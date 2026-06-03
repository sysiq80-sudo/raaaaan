-- ═══════════════════════════════════════════════════════════════════
-- Migration: تصحيح حقل قبول الرحلة في دالة handle_driver_cooldown
-- التاريخ الفعلي الحالي: 2026-06-03 18:35:00
-- ═══════════════════════════════════════════════════════════════════

-- 1️⃣ تحديث دالة handle_driver_cooldown لتستخدم matched_at بدلاً من accepted_at غير الموجود في جدول rides
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
  IF OLD.status::text NOT IN ('accepted', 'arrived') THEN RETURN NEW; END IF;

  SELECT user_id, full_name INTO v_driver_user_id, v_driver_name
  FROM drivers WHERE id = OLD.driver_id;

  -- تصحيح: استخدام matched_at فقط بدلاً من accepted_at غير الموجود
  v_accept_time := OLD.matched_at;
  
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
    OR (OLD.status::text = 'arrived' AND LOWER(COALESCE(NEW.cancellation_reason, '')) LIKE '%انتظار%')
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

  -- إشعار السائق
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

COMMENT ON FUNCTION public.handle_driver_cooldown IS 'إيقاف السائق مؤقتاً عند إلغاء الرحلة بعد قبولها (مصحح لاستخدام matched_at)';
