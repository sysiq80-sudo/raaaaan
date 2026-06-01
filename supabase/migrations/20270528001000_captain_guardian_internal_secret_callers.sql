-- Route Captain Guardian DB/cron callers through INTERNAL_EDGE_SECRET.
-- The Edge Function now rejects anon/service-style calls without x-internal-secret.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_internal_edge_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, vault, public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'internal_edge_secret'
  LIMIT 1;

  RETURN NULLIF(v_secret, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.captain_risk_radar_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'private'
AS $$
DECLARE
  request_id bigint;
  v_secret text;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.driver_id IS NOT NULL THEN
    BEGIN
      v_secret := private.get_internal_edge_secret();

      IF v_secret IS NULL THEN
        RAISE LOG '[CaptainGuardian] internal_edge_secret not found; risk radar skipped for ride %', NEW.id;
        RETURN NEW;
      END IF;

      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', v_secret
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
      RAISE LOG '[CaptainGuardian] Risk radar failed for ride % (non-fatal): %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.captain_compensation_shield_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'private'
AS $$
DECLARE
  request_id bigint;
  v_secret text;
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IN ('accepted', 'arrived')
     AND NEW.cancelled_by = 'rider'
     AND OLD.driver_id IS NOT NULL THEN
    BEGIN
      v_secret := private.get_internal_edge_secret();

      IF v_secret IS NULL THEN
        RAISE LOG '[CaptainGuardian] internal_edge_secret not found; compensation shield skipped for ride %', NEW.id;
        RETURN NEW;
      END IF;

      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', v_secret
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

CREATE OR REPLACE FUNCTION private.trigger_captain_punctuality_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault, extensions
AS $$
DECLARE
  v_secret text;
BEGIN
  v_secret := private.get_internal_edge_secret();

  IF v_secret IS NULL THEN
    RAISE WARNING '[CaptainGuardian] internal_edge_secret not found; punctuality check skipped';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    ),
    body := jsonb_build_object('action', 'punctuality_check')
  );
END;
$$;

SELECT cron.unschedule('captain-punctuality-check')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'captain-punctuality-check'
);

SELECT cron.schedule(
  'captain-punctuality-check',
  '*/5 * * * *',
  $$SELECT private.trigger_captain_punctuality_check()$$
);

COMMENT ON FUNCTION public.captain_risk_radar_trigger() IS
'Captain Guardian risk radar trigger; calls Edge Function with x-internal-secret from Vault.';

COMMENT ON FUNCTION public.captain_compensation_shield_trigger() IS
'Captain Guardian compensation trigger; calls Edge Function with x-internal-secret from Vault.';
