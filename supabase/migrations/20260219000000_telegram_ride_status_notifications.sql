-- =============================================================
-- نظام إشعارات الرحلة عبر تيليغرام — Telegram Ride Status Notifications
-- Migration: Database Webhook Trigger
--
-- يُفجّر Edge Function "telegram-ride-updates" كل ما يتغير status
-- في جدول rides لرحلات التيليغرام (trip_type = 'telegram')
-- =============================================================

-- ── 1. Trigger Function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_telegram_ride_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- الشرط: فقط رحلات تيليغرام + تغيّر الحالة
  IF NEW.trip_type = 'telegram'
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/telegram-ride-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
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
        'cancellation_reason',  NEW.cancellation_reason
      )
    ) INTO request_id;

    RAISE LOG '[TelegramRideUpdates] Notification triggered for ride % (% → %): request_id=%',
      NEW.id, OLD.status, NEW.status, request_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Trigger ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS telegram_ride_status_notify ON public.rides;
CREATE TRIGGER telegram_ride_status_notify
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_telegram_ride_status_change();

-- ── 3. فهرسة trip_type للأداء ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rides_trip_type
  ON public.rides(trip_type)
  WHERE trip_type IS NOT NULL;
