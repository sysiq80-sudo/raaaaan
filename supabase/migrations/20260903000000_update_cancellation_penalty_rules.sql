-- ══════════════════════════════════════════════════════════════════════════════
-- ران — تحديث قواعد احتساب غرامة الإلغاء للراكب بعد قبول السائق
-- RAAN Update Cancellation Penalty Rules
-- Date: 2026-05-22
-- ══════════════════════════════════════════════════════════════════════════════

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

  -- ═══ شروط استحقاق الغرامة (سيناريو الراكب) ═══
  -- بمجرد قبول السائق للرحلة، يتم فرض غرامة إلغاء في أي وقت
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

  -- ═══ تحديد المبلغ النهائي ═══
  IF v_should_penalize AND v_penalty_amount IS NULL THEN
    v_penalty_amount := v_base_fee;
  ELSIF NOT v_should_penalize THEN
    v_penalty_amount := 0;
  END IF;

  -- حساب الوقت والمسافة كبيانات إضافية فقط للتوثيق
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

COMMENT ON FUNCTION public.calculate_cancellation_penalty IS 'احتساب غرامة إلغاء الرحلة للراكب فور قبول السائق أو وصوله مباشرة دون شروط زمنية أو مسافات';
