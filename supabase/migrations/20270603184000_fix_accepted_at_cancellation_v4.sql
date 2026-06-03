-- ═══════════════════════════════════════════════════════════════════
-- Migration: تصحيح حقول القبول والإشعارات في دالتي تعويض السائق
-- التاريخ الفعلي الحالي: 2026-06-03 18:40:00
-- ═══════════════════════════════════════════════════════════════════

-- 1️⃣ تحديث دالة check_cancellation_compensation لتستخدم matched_at بدلاً من accepted_at
CREATE OR REPLACE FUNCTION public.check_cancellation_compensation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_secret text;
  request_id bigint;
BEGIN
  -- الشرط: الراكب ألغى + الرحلة كانت مقبولة + مر أكثر من 3 دقائق (180 ثانية)
  -- تصحيح: استخدام matched_at بدلاً من accepted_at غير الموجود
  IF NEW.status::text = 'cancelled' AND NEW.cancelled_by = 'rider' AND OLD.status::text = 'accepted' THEN
    IF OLD.matched_at IS NOT NULL AND (EXTRACT(EPOCH FROM (NOW() - OLD.matched_at)) > 180) THEN 
      
      v_secret := private.get_internal_edge_secret();
      IF v_secret IS NULL THEN
        RAISE WARNING '[check_cancellation_compensation] internal_edge_secret not found; driver compensation skipped';
        RETURN NEW;
      END IF;

      -- استدعاء بوت الكابتن لتعويض السائق
      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-support-bot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', v_secret
        ),
        body := jsonb_build_object(
          'action', 'COMPENSATE_DRIVER',
          'payload', jsonb_build_object(
            'driver_id', OLD.driver_id,
            'amount', 1000,
            'reason', 'إلغاء متأخر من الراكب'
          )
        )
      ) INTO request_id;
      
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_cancellation_compensation IS 'التحقق من استحقاق تعويض إلغاء الرحلة الكلي للكابتن (مصحح لـ matched_at)';


-- 2️⃣ تحديث دالة handle_driver_compensation_90s لتستخدم matched_at وتوجيه الإشعارات إلى driver_notifications
CREATE OR REPLACE FUNCTION public.handle_driver_compensation_90s()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_since_accept INTERVAL;
  v_compensation_amount INTEGER := 1000;  -- دينار عراقي (قابل للتعديل)
  v_driver_id UUID;
  v_driver_user_id UUID;
  v_driver_wallet_exists BOOLEAN;
  v_settings JSONB;
  v_accept_time TIMESTAMPTZ;
BEGIN
  -- ═══ الشروط الأساسية ═══
  -- يعمل فقط عند: إلغاء من الراكب + وجود سائق مُعيَّن
  IF NEW.cancelled_by != 'rider' THEN RETURN NEW; END IF;
  IF OLD.driver_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status::text NOT IN ('accepted', 'arrived', 'in_progress') THEN RETURN NEW; END IF;

  v_driver_id := OLD.driver_id;

  -- ═══ تحديد وقت القبول ═══
  -- تصحيح: نستخدم matched_at فقط بدلاً من accepted_at غير الموجود
  v_accept_time := OLD.matched_at;
  
  IF v_accept_time IS NULL THEN
    RAISE NOTICE 'Ride % — no acceptance timestamp found, skipping 90s compensation', NEW.id;
    RETURN NEW;
  END IF;

  v_time_since_accept := now() - v_accept_time;

  -- ═══ شرط الـ 90 ثانية ═══
  IF v_time_since_accept <= INTERVAL '90 seconds' THEN
    RAISE NOTICE 'Ride % — cancelled within 90s (%), no compensation', NEW.id, v_time_since_accept;
    RETURN NEW;
  END IF;

  -- ═══ قراءة مبلغ التعويض من الإعدادات (إن وُجد) ═══
  SELECT value INTO v_settings
  FROM app_settings
  WHERE key = 'driver_cancellation_compensation';
  
  IF v_settings IS NOT NULL THEN
    v_compensation_amount := COALESCE((v_settings->>'amount')::INTEGER, 1000);
  END IF;

  -- ═══ جلب user_id للسائق ═══
  SELECT user_id INTO v_driver_user_id FROM drivers WHERE id = v_driver_id;

  RAISE NOTICE 'Ride % — 90s rule triggered (%), compensating driver % with % IQD',
    NEW.id, v_time_since_accept, v_driver_id, v_compensation_amount;

  -- ═══ إضافة رصيد للسائق (النظام البسيط) ═══
  INSERT INTO driver_wallet_transactions (
    driver_id, amount, type, description, ride_id
  ) VALUES (
    v_driver_id,
    v_compensation_amount,
    'cancellation_compensation',
    'تعويض إلغاء رحلة - من الشركة',
    NEW.id
  );

  UPDATE drivers
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_compensation_amount,
      updated_at = now()
  WHERE id = v_driver_id;

  -- ═══ إضافة رصيد للسائق (النظام المتقدم إن وُجد) ═══
  SELECT EXISTS(
    SELECT 1 FROM driver_wallets WHERE driver_id = v_driver_id
  ) INTO v_driver_wallet_exists;

  IF v_driver_wallet_exists THEN
    PERFORM public.create_wallet_transaction(
      v_driver_id,
      'bonus',
      v_compensation_amount::DECIMAL(12,2),
      NEW.id,
      'تعويض إلغاء رحلة - من الشركة',
      jsonb_build_object(
        'compensation_type', 'rider_cancel_90s_rule',
        'time_since_accept_seconds', EXTRACT(EPOCH FROM v_time_since_accept)::INTEGER,
        'compensation_amount', v_compensation_amount
      )
    );
  END IF;

  -- ═══ إشعار السائق (توجيه الإشعارات إلى جدول driver_notifications المتوافق مع الأعمدة body و data) ═══
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_notifications') THEN
    INSERT INTO driver_notifications (
      driver_id, title, body, type, data, is_read, created_at
    ) VALUES (
      v_driver_id,
      'تم تعويضك من الشركة 💰',
      format('تم إضافة %s دينار لمحفظتك كتعويض عن إلغاء الراكب بعد قبولك الرحلة', v_compensation_amount),
      'wallet_credit',
      jsonb_build_object(
        'ride_id', NEW.id,
        'amount', v_compensation_amount,
        'reason', 'company_compensation_90s_rule',
        'label', 'تعويض إلغاء رحلة - من الشركة'
      ),
      false, now()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_driver_compensation_90s IS 'تعويض الكابتن عند إلغاء الراكب بعد 90 ثانية من القبول (مصحح لـ matched_at وإشعارات السائق)';
