-- =============================================================
-- نظام حارس الكابتن — Captain Guardian System
-- Migration: إعداد قاعدة البيانات
-- =============================================================

-- 1. إضافة telegram_chat_id لجدول السائقين
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- فهرسة للبحث السريع
CREATE INDEX IF NOT EXISTS idx_drivers_telegram_chat_id
  ON public.drivers(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- 2. جدول سجل التنبيهات
CREATE TABLE IF NOT EXISTS public.captain_alerts_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_captain_alerts_driver_id
  ON public.captain_alerts_log(driver_id);

CREATE INDEX IF NOT EXISTS idx_captain_alerts_ride_id
  ON public.captain_alerts_log(ride_id);

CREATE INDEX IF NOT EXISTS idx_captain_alerts_type_created
  ON public.captain_alerts_log(alert_type, created_at DESC);

-- RLS لجدول التنبيهات
ALTER TABLE public.captain_alerts_log ENABLE ROW LEVEL SECURITY;

-- السائق يرى تنبيهاته فقط
DROP POLICY IF EXISTS "drivers_own_alerts" ON public.captain_alerts_log;
CREATE POLICY "drivers_own_alerts" ON public.captain_alerts_log
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- الأدمن يرى كل التنبيهات
DROP POLICY IF EXISTS "admin_all_alerts" ON public.captain_alerts_log;
CREATE POLICY "admin_all_alerts" ON public.captain_alerts_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================
-- 3. تريغر: رادار المخاطر (Risk Radar)
-- عندما يقبل السائق رحلة → يفحص سجل إلغاءات الراكب
-- =============================================================

CREATE OR REPLACE FUNCTION public.captain_risk_radar_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- فقط عند انتقال الحالة من pending إلى accepted مع وجود سائق
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.driver_id IS NOT NULL THEN
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'risk_radar',
        'ride_id', NEW.id,
        'driver_id', NEW.driver_id,
        'rider_id', NEW.rider_id
      )
    ) INTO request_id;

    RAISE LOG '[CaptainGuardian] Risk radar triggered for ride %: request_id=%', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS captain_risk_radar ON public.rides;
CREATE TRIGGER captain_risk_radar
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.captain_risk_radar_trigger();

-- =============================================================
-- 4. تريغر: درع التعويض (Compensation Shield)
-- عندما يلغي الراكب بعد قبول السائق → تعويض تلقائي
-- =============================================================

CREATE OR REPLACE FUNCTION public.captain_compensation_shield_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- فقط عند إلغاء الراكب بعد القبول أو الوصول
  IF NEW.status = 'cancelled'
     AND OLD.status IN ('accepted', 'arrived')
     AND NEW.cancelled_by = 'rider'
     AND OLD.driver_id IS NOT NULL THEN

    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'compensation_shield',
        'ride_id', NEW.id,
        'driver_id', OLD.driver_id,
        'rider_id', NEW.rider_id,
        'cancellation_reason', NEW.cancellation_reason,
        'distance_to_pickup_at_cancel', NEW.distance_to_pickup_at_cancel
      )
    ) INTO request_id;

    RAISE LOG '[CaptainGuardian] Compensation shield triggered for ride %: request_id=%', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS captain_compensation_shield ON public.rides;
CREATE TRIGGER captain_compensation_shield
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.captain_compensation_shield_trigger();

-- =============================================================
-- 5. كرون: مدرب الالتزام (Punctuality Coach)
-- كل 5 دقائق — يفحص الرحلات المتأخرة
-- =============================================================

-- تأكد من تفعيل pg_cron
DO $outer$
BEGIN
  PERFORM cron.schedule(
    'captain-punctuality-check',
    '*/5 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/captain-guardian-alerts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo"}'::jsonb,
      body := '{"action": "punctuality_check"}'::jsonb
    );
    $cron$
  );
  RAISE LOG '[CaptainGuardian] Punctuality cron job scheduled successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG '[CaptainGuardian] pg_cron not available: %. Set up external cron instead.', SQLERRM;
END;
$outer$;
