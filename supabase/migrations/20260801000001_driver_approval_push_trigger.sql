-- ═══════════════════════════════════════════════════════════════════
-- تريجر إشعارات تغيير حالة السائق (قبول / إيقاف)
-- يُطلق عند تغيير drivers.status → 'approved' أو 'suspended'
-- يقرأ القوالب من notification_auto_settings مثل بقية التريجرات
-- ═══════════════════════════════════════════════════════════════════

DROP TRIGGER  IF EXISTS on_driver_approval_push_notify ON public.drivers;
DROP FUNCTION IF EXISTS public.push_driver_on_approval_change();

CREATE OR REPLACE FUNCTION public.push_driver_on_approval_change()
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
  request_id  BIGINT;
BEGIN
  -- فقط عند تغيير فعلي للحالة
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- نحن نهتم فقط بـ approved و suspended
  CASE NEW.status
    WHEN 'approved'  THEN _setting_id := 'driver_approved';
    WHEN 'suspended' THEN _setting_id := 'driver_suspended';
    ELSE RETURN NEW;
  END CASE;

  -- جلب القالب من جدول الإعدادات
  SELECT * INTO _setting
  FROM public.notification_auto_settings
  WHERE id = _setting_id;

  -- تخطي إذا الإعداد معطل أو غير موجود
  IF _setting IS NULL OR NOT _setting.is_enabled THEN
    RAISE LOG 'Driver approval push skipped (disabled/missing): setting_id=% driver=%',
      _setting_id, NEW.id;
    RETURN NEW;
  END IF;

  _title := _setting.title_template;
  _body  := _setting.body_template;

  -- إرسال الإشعار للسائق عبر Edge Function
  BEGIN
    SELECT net.http_post(
      url     := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body    := jsonb_build_object(
        'action',    'notify_driver',
        'driver_id', NEW.id,
        'title',     _title,
        'body',      _body,
        'data',      jsonb_build_object(
          'type',       'driver_status_change',
          'new_status', NEW.status,
          'old_status', OLD.status,
          'driver_id',  NEW.id
        )
      )
    ) INTO request_id;

    RAISE LOG 'Driver approval push sent: driver=% status=% setting=% request=%',
      NEW.id, NEW.status, _setting_id, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Driver approval push failed (non-fatal): driver=% setting=% err=%',
      NEW.id, _setting_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- تريجر: يطلق بعد تحديث حالة السائق (approved أو suspended)
CREATE TRIGGER on_driver_approval_push_notify
  AFTER UPDATE OF status ON public.drivers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('approved', 'suspended'))
  EXECUTE FUNCTION public.push_driver_on_approval_change();
