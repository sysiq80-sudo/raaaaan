-- ═══════════════════════════════════════════════════════
-- إرسال إشعار FCM للراكب عند تغيير حالة الرحلة
-- Sends push notification to rider when ride status changes
-- Uses same pattern as notify_drivers_new_ride()
-- ═══════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_ride_status_push_rider ON public.rides;
DROP FUNCTION IF EXISTS public.push_rider_on_status_change();

CREATE OR REPLACE FUNCTION public.push_rider_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _title TEXT;
  _body TEXT;
  _type TEXT;
  request_id BIGINT;
BEGIN
  -- Only fire when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Build notification based on new status
  CASE NEW.status
    WHEN 'accepted' THEN
      _title := 'تم قبول رحلتك! ✅';
      _body  := 'سائق في الطريق إليك';
      _type  := 'ride_accepted';
    WHEN 'arrived' THEN
      _title := 'السائق وصل! 🚗';
      _body  := 'السائق بانتظارك في نقطة الانطلاق';
      _type  := 'driver_arrived';
    WHEN 'in_progress' THEN
      _title := 'بدأت الرحلة! 🛣️';
      _body  := 'في الطريق إلى وجهتك';
      _type  := 'ride_started';
    WHEN 'completed' THEN
      _title := 'وصلت! 🎉';
      _body  := 'شكراً لاستخدامك ران';
      _type  := 'ride_completed';
    WHEN 'cancelled' THEN
      _title := 'تم إلغاء الرحلة ❌';
      _body  := 'تم إلغاء رحلتك';
      _type  := 'ride_cancelled';
    ELSE
      -- Unknown status — skip
      RETURN NEW;
  END CASE;

  -- Call Edge Function via pg_net to push notification to rider
  SELECT net.http_post(
    url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
    ),
    body := jsonb_build_object(
      'action', 'notify_rider',
      'rider_id', NEW.rider_id,
      'title', _title,
      'body', _body,
      'data', jsonb_build_object(
        'type', _type,
        'ride_id', NEW.id,
        'status', NEW.status,
        'driver_id', NEW.driver_id
      )
    )
  ) INTO request_id;

  RAISE LOG 'Rider push notification sent for ride % status %: request %', NEW.id, NEW.status, request_id;

  RETURN NEW;
END;
$$;

-- Trigger: fires AFTER UPDATE on rides when status changes
CREATE TRIGGER on_ride_status_push_rider
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_rider_on_status_change();
