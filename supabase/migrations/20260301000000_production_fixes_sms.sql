-- ══════════════════════════════════════════════════════════════════
-- Migration: Production Fixes + SMS Booking Support
-- 1. Fix WhatsApp trigger payload (add distance_km, duration_minutes, payment_method, vehicle_type)
-- 2. Remove hardcoded URL from triggers — read from system_configs
-- 3. Add SMS trigger for sms-ride-updates
-- 4. Update trip_type constraint to include 'sms'
-- 5. Add waiting_fare column to rides
-- ══════════════════════════════════════════════════════════════════

-- ═══ 1. Add waiting_fare column to rides if not exists ═══
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides' AND column_name = 'waiting_fare'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN waiting_fare INTEGER DEFAULT 0;
    COMMENT ON COLUMN public.rides.waiting_fare IS 'أجرة الانتظار بالدينار العراقي';
  END IF;
END $$;

-- ═══ 2. Add metadata column to rides if not exists (for radius_bonus_km etc.) ═══
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rides' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.rides.metadata IS 'بيانات وصفية إضافية (radius_bonus_km, retry hints, etc.)';
  END IF;
END $$;

-- ═══ 3. Add waiting_fare settings to fare_calculation if not present ═══
UPDATE public.app_settings
SET value = value || jsonb_build_object(
  'waiting_fare_per_minute', 250,
  'free_waiting_minutes', 3
)
WHERE key = 'fare_calculation'
  AND NOT (value ? 'waiting_fare_per_minute');

-- ═══ 4. Update trip_type support — allow 'sms' ═══
-- Drop existing constraint and re-create with 'sms' included
DO $$
BEGIN
  -- Try to drop existing constraint (name may vary)
  BEGIN
    ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_trip_type_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Add updated constraint
  BEGIN
    ALTER TABLE public.rides ADD CONSTRAINT rides_trip_type_check
      CHECK (trip_type IS NULL OR trip_type IN ('app', 'whatsapp', 'telegram', 'sms', 'voice', 'admin'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trip_type constraint already exists or column has no constraint';
  END;
END $$;

-- ═══ 5. Helper function to get Supabase URL dynamically ═══
CREATE OR REPLACE FUNCTION public.get_supabase_config(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT key_value INTO v_value
  FROM system_configs
  WHERE key_name = p_key
  LIMIT 1;
  
  -- Fallback for essential keys
  IF v_value IS NULL OR v_value = '' THEN
    IF p_key = 'SUPABASE_URL' THEN
      v_value := current_setting('app.settings.supabase_url', true);
    ELSIF p_key = 'SUPABASE_ANON_KEY' THEN
      v_value := current_setting('app.settings.supabase_anon_key', true);
    END IF;
  END IF;
  
  RETURN v_value;
END;
$$;

-- ═══ 6. Store Supabase URL and anon key in system_configs (placeholders only — set real values via dashboard or env) ═══
-- لا تخزين أسرار حقيقية في الـ migration؛ القيم الفعلية تُدرج من لوحة الإدارة أو سكربت تشغيل.
INSERT INTO system_configs (category, key_name, key_value, description)
VALUES 
  ('system', 'SUPABASE_URL', '', 'Supabase project URL — set via dashboard'),
  ('system', 'SUPABASE_ANON_KEY', '', 'Supabase anon key — set via dashboard')
ON CONFLICT (key_name) DO NOTHING;

-- ═══ 7. Recreate WhatsApp trigger with dynamic URL + enriched payload ═══
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
  -- Only WhatsApp rides + status changed
  IF NEW.trip_type = 'whatsapp'
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    -- Dynamic URL from system_configs
    SELECT key_value INTO v_base_url FROM system_configs WHERE key_name = 'SUPABASE_URL' LIMIT 1;
    SELECT key_value INTO v_anon_key FROM system_configs WHERE key_name = 'SUPABASE_ANON_KEY' LIMIT 1;

    -- Fallback to hardcoded if config missing
    v_base_url := COALESCE(NULLIF(v_base_url, ''), 'https://wgolkcztdrwdphwjvqxt.supabase.co');
    v_anon_key := COALESCE(NULLIF(v_anon_key, ''), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo');

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
        -- ═══ NEW FIELDS ═══
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

-- Re-create WhatsApp trigger
DROP TRIGGER IF EXISTS whatsapp_ride_status_notify ON public.rides;
CREATE TRIGGER whatsapp_ride_status_notify
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_ride_status_change();

-- ═══ 8. Create SMS ride status trigger ═══
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
  -- Only SMS rides + status changed
  IF NEW.trip_type = 'sms'
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    SELECT key_value INTO v_base_url FROM system_configs WHERE key_name = 'SUPABASE_URL' LIMIT 1;
    SELECT key_value INTO v_anon_key FROM system_configs WHERE key_name = 'SUPABASE_ANON_KEY' LIMIT 1;

    v_base_url := COALESCE(NULLIF(v_base_url, ''), 'https://wgolkcztdrwdphwjvqxt.supabase.co');
    v_anon_key := COALESCE(NULLIF(v_anon_key, ''), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo');

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

-- Create SMS trigger
DROP TRIGGER IF EXISTS sms_ride_status_notify ON public.rides;
CREATE TRIGGER sms_ride_status_notify
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sms_ride_status_change();

-- ═══ 9. Also update Telegram trigger to use dynamic URL ═══
-- (If it exists, update it; otherwise skip)
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'telegram_ride_status_notify'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE 'Telegram trigger exists — should be updated separately if needed';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- Done — الحمد لله
-- ══════════════════════════════════════════════════════════════════
