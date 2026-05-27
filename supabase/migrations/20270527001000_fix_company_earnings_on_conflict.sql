-- ══════════════════════════════════════════════════════════════
-- إصلاح: إضافة ON CONFLICT (ride_id) DO NOTHING لمنع race condition
-- الدوال المعنية: add_ride_earning (trigger) و transfer_wallet_to_driver
-- ══════════════════════════════════════════════════════════════

-- ── 1. trigger: add_ride_earning ─────────────────────────────
CREATE OR REPLACE FUNCTION public.add_ride_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_fare INTEGER;
  v_commission_rate NUMERIC;
  v_commission_amount INTEGER;
  v_driver_share INTEGER;
  v_min_commission INTEGER;
  v_settings JSONB;
BEGIN
  -- When ride is completed
  IF NEW.status = 'completed'
     AND NEW.driver_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'completed' OR OLD IS NULL) THEN

    -- Get commission rate from vehicle_types table
    SELECT commission_rate INTO v_commission_rate
    FROM vehicle_types
    WHERE id = COALESCE(NEW.vehicle_type::TEXT, 'economy');

    -- If not found, fall back to app_settings
    IF v_commission_rate IS NULL THEN
      SELECT value INTO v_settings
      FROM app_settings
      WHERE key = 'commission';

      v_commission_rate := COALESCE((v_settings->>'rate')::NUMERIC, 15);
    END IF;

    -- Get min commission from settings
    SELECT value INTO v_settings
    FROM app_settings
    WHERE key = 'commission';

    v_min_commission := COALESCE((v_settings->>'min_amount')::INTEGER, 500);

    v_total_fare := COALESCE(NEW.final_fare, NEW.estimated_fare, 0);
    v_commission_amount := ROUND(v_total_fare * v_commission_rate / 100);

    -- Apply minimum commission if set
    IF v_commission_amount < v_min_commission THEN
      v_commission_amount := v_min_commission;
    END IF;

    v_driver_share := v_total_fare - v_commission_amount;

    -- Add driver's share to wallet
    INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
    VALUES (
      NEW.driver_id,
      v_driver_share,
      'ride_earning',
      'حصة السائق من رحلة مكتملة (بعد خصم العمولة ' || v_commission_rate || '%)',
      NEW.id
    );

    -- Record company earnings — ON CONFLICT يمنع التكرار عند race condition
    INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
    VALUES (
      NEW.id,
      NEW.driver_id,
      v_total_fare,
      v_commission_rate / 100,
      v_commission_amount,
      v_driver_share
    )
    ON CONFLICT (ride_id) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2. rpc: transfer_wallet_to_driver ────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_wallet_to_driver(
  p_rider_user_id UUID,
  p_driver_id UUID,
  p_amount INTEGER,
  p_ride_id UUID,
  p_commission_rate NUMERIC DEFAULT 0.15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rider_balance INTEGER;
  v_commission INTEGER;
  v_driver_share INTEGER;
BEGIN
  -- Get rider balance
  SELECT COALESCE(wallet_balance, 0) INTO v_rider_balance
  FROM profiles WHERE user_id = p_rider_user_id;

  -- Check if enough balance
  IF v_rider_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد الراكب غير كافي',
      'current_balance', v_rider_balance,
      'required', p_amount
    );
  END IF;

  -- Calculate commission and driver share
  v_commission := ROUND(p_amount * p_commission_rate);
  v_driver_share := p_amount - v_commission;

  -- Deduct from rider
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE user_id = p_rider_user_id;

  -- Record rider transaction
  INSERT INTO rider_wallet_transactions (user_id, amount, type, ride_id, description)
  VALUES (p_rider_user_id, -p_amount, 'ride_payment', p_ride_id, 'دفع أجرة رحلة');

  -- Add to driver wallet
  UPDATE drivers
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_driver_share,
      updated_at = now()
  WHERE id = p_driver_id;

  -- Record driver transaction
  INSERT INTO driver_wallet_transactions (driver_id, amount, type, description, ride_id)
  VALUES (p_driver_id, v_driver_share, 'ride_earning', 'أرباح رحلة (دفع إلكتروني)', p_ride_id);

  -- Record company earnings — ON CONFLICT يمنع التكرار عند race condition
  INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
  VALUES (p_ride_id, p_driver_id, p_amount, p_commission_rate, v_commission, v_driver_share)
  ON CONFLICT (ride_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'total_amount', p_amount,
    'commission', v_commission,
    'driver_share', v_driver_share
  );
END;
$function$;
