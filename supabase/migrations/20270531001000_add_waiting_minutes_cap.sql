-- ============================================================================
-- Add 30-minute Cap to Waiting Minutes Calculation
-- Date: 2027-05-31
-- Description: Updates complete_ride_transactional RPC to cap waiting minutes at 30
--              to prevent astronomical overcharging in case of glitches.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_ride_transactional(
  p_ride_id UUID,
  p_caller_user_id UUID,
  p_final_gps_distance DOUBLE PRECISION DEFAULT NULL,
  p_waiting_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride RECORD;
  v_driver RECORD;
  v_estimated_fare INTEGER;
  v_final_fare INTEGER;
  v_waiting_mins INTEGER;
  v_waiting_fare INTEGER := 0;
  v_actual_distance_km DOUBLE PRECISION;
  
  -- audit variables
  v_audit JSONB;
  v_fare_adjusted BOOLEAN := false;
  v_adjustment_reason TEXT := NULL;
  
  -- monetization variables
  v_monetization_mode TEXT := 'commission';
  v_monetization_settings JSONB;
  v_commission_settings JSONB;
  v_wallet_settings RECORD;
  
  v_base_commission_rate DECIMAL(5,2);
  v_min_commission_floor DECIMAL(5,2) := 5.00;
  v_min_commission_amount INTEGER := 500;
  
  v_tier_discount DECIMAL(5,2) := 0.00;
  v_tier_name TEXT := '';
  v_sub_discount DECIMAL(5,2) := 0.00;
  v_sub_name TEXT := '';
  
  v_effective_rate DECIMAL(5,2);
  v_commission_amount INTEGER := 0;
  v_driver_share INTEGER := 0;
  
  -- wallet results
  v_wallet_deducted BOOLEAN := false;
  v_effective_payment_method TEXT;
  v_deduct_result JSONB;
  v_earnings_result JSONB;
  v_daily_result JSONB;
  
  v_receipt JSONB;
  v_response JSONB;
BEGIN
  -- 1. Fetch ride with row lock (FOR UPDATE)
  SELECT * INTO v_ride
  FROM rides
  WHERE id = p_ride_id
  FOR UPDATE;
  
  IF v_ride IS NULL THEN
    RAISE EXCEPTION 'RIDE_NOT_FOUND: الرحلة غير موجودة';
  END IF;
  
  -- Check status
  IF v_ride.status = 'completed' THEN
    -- Return success with already completed flag
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'ride_id', p_ride_id,
      'final_fare', v_ride.final_fare,
      'completed_at', v_ride.completed_at,
      'actual_distance_km', v_ride.actual_distance_km,
      'payment_method', v_ride.payment_method
    );
  END IF;
  
  IF v_ride.status != 'in_progress' THEN
    RAISE EXCEPTION 'INVALID_STATUS: لا يمكن إنهاء رحلة ليست قيد التنفيذ. الحالة الحالية: %', v_ride.status;
  END IF;
  
  -- 2. Verify driver matches caller
  SELECT * INTO v_driver
  FROM drivers
  WHERE user_id = p_caller_user_id;
  
  IF v_driver IS NULL OR v_driver.id != v_ride.driver_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED: غير مصرح لسائق آخر بإنهاء هذه الرحلة';
  END IF;
  
  -- 3. Calculate waiting minutes (Server-side timestamps are the source of truth)
  IF v_ride.driver_arrival_time IS NOT NULL AND v_ride.started_at IS NOT NULL THEN
    v_waiting_mins := EXTRACT(EPOCH FROM (v_ride.started_at - v_ride.driver_arrival_time))::INTEGER / 60;
  ELSE
    v_waiting_mins := COALESCE(p_waiting_minutes, 0);
  END IF;
  
  -- Safeguards: minimum 0, maximum 30 minutes
  v_waiting_mins := GREATEST(0, v_waiting_mins);
  v_waiting_mins := LEAST(v_waiting_mins, 30);
  
  -- Update waiting minutes on the ride row first (temporarily) so audit works with current state
  UPDATE rides
  SET waiting_minutes = v_waiting_mins
  WHERE id = p_ride_id;
  
  -- 4. Audit Fare
  v_estimated_fare := COALESCE(v_ride.estimated_fare, 0);
  v_final_fare := v_estimated_fare;
  v_actual_distance_km := p_final_gps_distance;
  
  IF p_final_gps_distance IS NOT NULL AND p_final_gps_distance > 0 THEN
    v_audit := public.audit_ride_fare(p_ride_id, p_final_gps_distance);
    IF COALESCE((v_audit->>'adjusted')::BOOLEAN, false) = true THEN
      v_fare_adjusted := true;
      v_final_fare := (v_audit->>'new_fare')::INTEGER;
      v_adjustment_reason := v_audit->>'reason';
    END IF;
  ELSE
    -- Try tracking-based audit
    v_audit := public.audit_ride_fare(p_ride_id);
    IF COALESCE((v_audit->>'adjusted')::BOOLEAN, false) = true THEN
      v_fare_adjusted := true;
      v_final_fare := (v_audit->>'new_fare')::INTEGER;
      v_adjustment_reason := v_audit->>'reason';
      v_actual_distance_km := (v_audit->>'actual_distance')::DOUBLE PRECISION;
    END IF;
  END IF;
  
  -- 5. Calculate waiting fare
  IF v_waiting_mins > 0 THEN
    DECLARE
      v_fare_settings JSONB;
      v_waiting_fare_per_min INTEGER := 250;
      v_free_waiting_minutes INTEGER := 3;
      v_chargeable_minutes INTEGER;
    BEGIN
      SELECT value INTO v_fare_settings FROM app_settings WHERE key = 'fare_calculation';
      IF v_fare_settings IS NOT NULL THEN
        v_waiting_fare_per_min := COALESCE((v_fare_settings->>'waiting_fare_per_minute')::INTEGER, 250);
        v_free_waiting_minutes := COALESCE((v_fare_settings->>'free_waiting_minutes')::INTEGER, 3);
      END IF;
      
      v_chargeable_minutes := GREATEST(0, v_waiting_mins - v_free_waiting_minutes);
      v_waiting_fare := v_chargeable_minutes * v_waiting_fare_per_min;
      
      IF v_waiting_fare > 0 THEN
        v_final_fare := v_final_fare + v_waiting_fare;
      END IF;
    END;
  END IF;
  
  -- 6. Payment/Wallet deduction
  v_effective_payment_method := v_ride.payment_method;
  
  IF v_ride.payment_method IN ('wallet', 'nas_wallet') THEN
    v_deduct_result := public.deduct_wallet_safely(v_ride.rider_id, v_final_fare::NUMERIC, p_ride_id);
    IF COALESCE((v_deduct_result->>'success')::BOOLEAN, false) = true THEN
      v_wallet_deducted := true;
    ELSE
      -- Switch to cash
      v_effective_payment_method := 'cash';
    END IF;
  END IF;
  
  -- 7. Monetization and Financial Settlement
  SELECT value INTO v_monetization_settings FROM app_settings WHERE key = 'monetization';
  IF v_monetization_settings IS NOT NULL THEN
    v_monetization_mode := COALESCE(v_monetization_settings->>'mode', 'commission');
  END IF;
  
  IF v_monetization_mode = 'daily_subscription' THEN
    v_daily_result := public.charge_daily_subscription(v_ride.driver_id, p_ride_id);
    v_driver_share := v_final_fare;
    v_commission_amount := CASE WHEN COALESCE((v_daily_result->>'charged')::BOOLEAN, false) = true THEN (v_daily_result->>'daily_fee')::INTEGER ELSE 0 END;
    
    INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
    VALUES (p_ride_id, v_ride.driver_id, v_final_fare, 0, v_commission_amount, v_driver_share);
    
    v_receipt := jsonb_build_object(
      'base_fare', v_estimated_fare,
      'final_fare', v_final_fare,
      'waiting_fare', v_waiting_fare,
      'fare_adjusted', v_fare_adjusted,
      'monetization_mode', 'daily_subscription',
      'commission_rate_percent', 0,
      'commission_amount', 0,
      'driver_earning', v_final_fare,
      'daily_fee_charged', COALESCE((v_daily_result->>'charged')::BOOLEAN, false),
      'daily_fee_amount', v_commission_amount,
      'daily_fee_reason', v_daily_result->>'reason',
      'payment_method', v_effective_payment_method,
      'completed_at', now()
    );
  ELSE
    -- Commission mode
    SELECT * INTO v_wallet_settings FROM wallet_settings LIMIT 1;
    v_base_commission_rate := COALESCE(v_wallet_settings.default_commission_rate, 15);
    
    SELECT value INTO v_commission_settings FROM app_settings WHERE key = 'commission';
    IF v_commission_settings IS NOT NULL THEN
      v_min_commission_floor := COALESCE((v_commission_settings->>'min_commission_floor')::NUMERIC, 5.00);
      v_min_commission_amount := COALESCE((v_commission_settings->>'min_amount')::INTEGER, 500);
    END IF;
    
    -- Tier lookup
    DECLARE
      v_t_id UUID;
      v_t_name TEXT;
      v_t_discount NUMERIC;
      v_t_icon TEXT;
      v_t_color TEXT;
    BEGIN
      SELECT * INTO v_t_id, v_t_name, v_t_discount, v_t_icon, v_t_color FROM public.get_driver_commission_tier(v_ride.driver_id) LIMIT 1;
      IF v_t_discount IS NOT NULL THEN
        v_tier_discount := v_t_discount;
        v_tier_name := v_t_name;
      END IF;
    END;
    
    -- Subscription lookup
    DECLARE
      v_s_id UUID;
      v_s_name TEXT;
      v_s_discount NUMERIC;
      v_s_priority BOOLEAN;
      v_s_expires TIMESTAMPTZ;
    BEGIN
      SELECT * INTO v_s_id, v_s_name, v_s_discount, v_s_priority, v_s_expires FROM public.get_active_driver_subscription(v_ride.driver_id) LIMIT 1;
      IF v_s_discount IS NOT NULL THEN
        v_sub_discount := v_s_discount;
        v_sub_name := v_s_name;
      END IF;
    END;
    
    v_effective_rate := GREATEST(v_min_commission_floor, v_base_commission_rate - v_tier_discount - v_sub_discount);
    
    -- Temporarily update payment method on rides table to let process_ride_earnings detect standard vs cash_collection correctly
    UPDATE rides
    SET payment_method = v_effective_payment_method
    WHERE id = p_ride_id;
    
    v_earnings_result := public.process_ride_earnings(
      p_ride_id,
      v_ride.driver_id,
      v_final_fare::NUMERIC,
      v_effective_rate
    );
    
    v_commission_amount := ROUND(v_final_fare * v_effective_rate / 100);
    v_commission_amount := GREATEST(v_commission_amount, v_min_commission_amount);
    v_commission_amount := LEAST(v_commission_amount, v_final_fare);
    v_driver_share := v_final_fare - v_commission_amount;
    
    INSERT INTO company_earnings (ride_id, driver_id, total_fare, commission_rate, commission_amount, driver_share)
    VALUES (p_ride_id, v_ride.driver_id, v_final_fare, v_effective_rate / 100, v_commission_amount, v_driver_share);
    
    v_receipt := jsonb_build_object(
      'base_fare', v_estimated_fare,
      'final_fare', v_final_fare,
      'waiting_fare', v_waiting_fare,
      'fare_adjusted', v_fare_adjusted,
      'monetization_mode', 'commission',
      'commission_rate_percent', v_effective_rate,
      'commission_amount', v_commission_amount,
      'driver_earning', v_driver_share,
      'tier_discount', v_tier_discount,
      'tier_name', v_tier_name,
      'subscription_discount', v_sub_discount,
      'subscription_name', v_sub_name,
      'payment_method', v_effective_payment_method,
      'completed_at', now()
    );
  END IF;
  
  -- Update ride row to completed with metadata receipt
  UPDATE rides
  SET
    status = 'completed',
    completed_at = now(),
    final_fare = v_final_fare,
    waiting_fare = v_waiting_fare,
    waiting_minutes = v_waiting_mins,
    actual_distance_km = v_actual_distance_km,
    payment_method = v_effective_payment_method,
    metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('receipt', v_receipt)
  WHERE id = p_ride_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'ride_id', p_ride_id,
    'final_fare', v_final_fare,
    'estimated_fare', v_estimated_fare,
    'fare_adjusted', v_fare_adjusted,
    'adjustment_message', v_adjustment_reason,
    'actual_distance_km', v_actual_distance_km,
    'estimated_distance_km', v_ride.distance_km,
    'waiting_minutes', v_waiting_mins,
    'waiting_fare', v_waiting_fare,
    'completed_at', now(),
    'wallet_deducted', v_wallet_deducted,
    'payment_method', v_effective_payment_method,
    'monetization_mode', v_monetization_mode,
    'commission', CASE WHEN v_monetization_mode = 'commission' THEN jsonb_build_object(
      'rate', v_effective_rate::TEXT || '%',
      'amount', v_commission_amount,
      'driver_earning', v_driver_share
    ) ELSE NULL END,
    'daily_subscription', CASE WHEN v_monetization_mode = 'daily_subscription' THEN jsonb_build_object(
      'charged', COALESCE((v_daily_result->>'charged')::BOOLEAN, false),
      'daily_fee', v_commission_amount,
      'reason', v_daily_result->>'reason',
      'driver_earning', v_final_fare
    ) ELSE NULL END
  );
END;
$$;

-- Restrict function execution to service_role only for security hardening (as done in 20260905200000)
REVOKE EXECUTE ON FUNCTION public.complete_ride_transactional(UUID, UUID, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride_transactional(UUID, UUID, DOUBLE PRECISION, INTEGER) TO service_role;

COMMENT ON FUNCTION public.complete_ride_transactional(UUID, UUID, DOUBLE PRECISION, INTEGER) IS
'Atomic ride completion with server-side wait time calculations, 30-minute cap, and financial updates.';
