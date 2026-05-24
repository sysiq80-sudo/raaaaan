-- ══════════════════════════════════════════════════════════════════
-- إعادة تعريف دوال إشعار واتساب/SMS بدون أي مفاتيح مضمّنة في الكود.
-- للبيئات التي طبّقت migration 20260301000000 قبل تعديل المستودع.
-- يجب ضبط SUPABASE_URL و SUPABASE_ANON_KEY في system_configs (غير فارغين).
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_whatsapp_ride_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
  v_base_url TEXT;
  v_anon_key TEXT;
BEGIN
  IF NEW.trip_type = 'whatsapp'
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    SELECT key_value INTO v_base_url FROM system_configs WHERE key_name = 'SUPABASE_URL' LIMIT 1;
    SELECT key_value INTO v_anon_key FROM system_configs WHERE key_name = 'SUPABASE_ANON_KEY' LIMIT 1;
    v_base_url := NULLIF(TRIM(COALESCE(v_base_url, '')), '');
    v_anon_key := NULLIF(TRIM(COALESCE(v_anon_key, '')), '');

    IF v_base_url IS NULL OR v_anon_key IS NULL THEN
      RAISE LOG '[WhatsAppRideUpdates] Skipped: set non-empty SUPABASE_URL and SUPABASE_ANON_KEY in system_configs';
      RETURN NEW;
    END IF;

    SELECT net.http_post(
      url := v_base_url || '/functions/v1/whatsapp-ride-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'ride_id',              NEW.id,
        'new_status',           NEW.status,
        'old_status',           OLD.status,
        'trip_type',            NEW.trip_type,
        'rider_id',             NEW.rider_id,
        'driver_id',            NEW.driver_id,
        'final_fare',           NEW.final_fare,
        'estimated_fare',       NEW.estimated_fare,
        'pickup_address',       NEW.pickup_address,
        'dropoff_address',      NEW.dropoff_address,
        'cancelled_by',         NEW.cancelled_by,
        'cancellation_reason',  NEW.cancellation_reason,
        'distance_km',          NEW.distance_km,
        'duration_minutes',     NEW.duration_minutes,
        'payment_method',       NEW.payment_method,
        'vehicle_type',         NEW.vehicle_type,
        'waiting_fare',         NEW.waiting_fare,
        'waiting_minutes',      NEW.waiting_minutes
      )
    ) INTO request_id;

    RAISE LOG '[WhatsAppRideUpdates] Notification triggered for ride % (% → %): request_id=%',
      NEW.id, OLD.status, NEW.status, request_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_sms_ride_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
  v_base_url TEXT;
  v_anon_key TEXT;
BEGIN
  IF NEW.trip_type = 'sms'
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    SELECT key_value INTO v_base_url FROM system_configs WHERE key_name = 'SUPABASE_URL' LIMIT 1;
    SELECT key_value INTO v_anon_key FROM system_configs WHERE key_name = 'SUPABASE_ANON_KEY' LIMIT 1;
    v_base_url := NULLIF(TRIM(COALESCE(v_base_url, '')), '');
    v_anon_key := NULLIF(TRIM(COALESCE(v_anon_key, '')), '');

    IF v_base_url IS NULL OR v_anon_key IS NULL THEN
      RAISE LOG '[SMSRideUpdates] Skipped: set non-empty SUPABASE_URL and SUPABASE_ANON_KEY in system_configs';
      RETURN NEW;
    END IF;

    SELECT net.http_post(
      url := v_base_url || '/functions/v1/sms-ride-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'ride_id',              NEW.id,
        'new_status',           NEW.status,
        'old_status',           OLD.status,
        'trip_type',            NEW.trip_type,
        'rider_id',             NEW.rider_id,
        'driver_id',            NEW.driver_id,
        'final_fare',           NEW.final_fare,
        'estimated_fare',       NEW.estimated_fare,
        'pickup_address',       NEW.pickup_address,
        'dropoff_address',      NEW.dropoff_address,
        'cancelled_by',         NEW.cancelled_by,
        'cancellation_reason',  NEW.cancellation_reason,
        'distance_km',          NEW.distance_km,
        'duration_minutes',     NEW.duration_minutes,
        'payment_method',       NEW.payment_method,
        'vehicle_type',         NEW.vehicle_type,
        'waiting_fare',         NEW.waiting_fare,
        'waiting_minutes',      NEW.waiting_minutes
      )
    ) INTO request_id;

    RAISE LOG '[SMSRideUpdates] Notification triggered for ride % (% → %): request_id=%',
      NEW.id, OLD.status, NEW.status, request_id;
  END IF;

  RETURN NEW;
END;
$$;
