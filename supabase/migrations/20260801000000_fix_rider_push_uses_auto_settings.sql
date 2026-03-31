-- ═══════════════════════════════════════════════════════════════════
-- إصلاح إشعارات الراكب: القراءة من notification_auto_settings
-- يحل مشكلة: الإرسال hardcoded لا يتأثر بإعدادات الأدمن
-- يطابق نمط: push_driver_on_status_change() في 20260401000000
-- ═══════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_ride_status_push_rider ON public.rides;
DROP FUNCTION IF EXISTS public.push_rider_on_status_change();

CREATE OR REPLACE FUNCTION public.push_rider_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _setting    RECORD;
  _setting_id TEXT;
  _title      TEXT;
  _body       TEXT;
  _type       TEXT;
  request_id  BIGINT;
BEGIN
  -- فقط عند تغيير فعلي للحالة
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- ربط حالة الرحلة بمعرّف الإعداد في notification_auto_settings
  CASE NEW.status
    WHEN 'accepted'    THEN _setting_id := 'ride_accepted';    _type := 'ride_accepted';
    WHEN 'arrived'     THEN _setting_id := 'ride_arrived';     _type := 'ride_arrived';
    WHEN 'in_progress' THEN _setting_id := 'ride_started';     _type := 'ride_started';
    WHEN 'completed'   THEN _setting_id := 'ride_completed';   _type := 'ride_completed';
    WHEN 'cancelled'   THEN _setting_id := 'ride_cancelled';   _type := 'ride_cancelled';
    ELSE RETURN NEW;  -- حالة غير معروفة — تجاهل
  END CASE;

  -- جلب القالب من جدول الإعدادات
  SELECT * INTO _setting
  FROM public.notification_auto_settings
  WHERE id = _setting_id;

  -- تخطي إذا الإعداد معطل أو غير موجود
  IF _setting IS NULL OR NOT _setting.is_enabled THEN
    RAISE LOG 'Rider push skipped (disabled/missing): setting_id=% ride=%', _setting_id, NEW.id;
    RETURN NEW;
  END IF;

  _title := _setting.title_template;
  _body  := _setting.body_template;

  -- إرسال الإشعار للراكب عبر Edge Function
  BEGIN
    SELECT net.http_post(
      url     := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body    := jsonb_build_object(
        'action',   'notify_rider',
        'rider_id', NEW.rider_id,
        'title',    _title,
        'body',     _body,
        'data',     jsonb_build_object(
          'type',      _type,
          'ride_id',   NEW.id,
          'status',    NEW.status,
          'driver_id', NEW.driver_id
        )
      )
    ) INTO request_id;

    RAISE LOG 'Rider push sent: ride=% status=% setting=% request=%',
      NEW.id, NEW.status, _setting_id, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Rider push failed (non-fatal): ride=% setting=% err=%',
      NEW.id, _setting_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- تريجر: يطلق بعد تحديث حالة الرحلة
CREATE TRIGGER on_ride_status_push_rider
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_rider_on_status_change();
