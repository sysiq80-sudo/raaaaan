-- ═══════════════════════════════════════════════════════════════════
-- جعل جميع إشعارات السائق قابلة للتخصيص من لوحة الإدارة
-- 1. إضافة إعدادات تلقائية لإشعارات السائق (إلغاء + اكتمال)
-- 2. تحديث push_driver_on_status_change() للقراءة من notification_auto_settings
-- 3. تحديث notify_drivers_new_ride() للقراءة من notification_auto_settings
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. إضافة إعدادات إشعارات السائق عند إلغاء أو اكتمال الرحلة ──
INSERT INTO notification_auto_settings (id, title_template, body_template, priority, target_role, is_enabled)
VALUES
  ('ride_cancelled_driver', '❌ تم إلغاء الرحلة', 'الراكب ألغى الرحلة', 'high', 'driver', true),
  ('ride_completed_driver', '🏁 رحلة مكتملة', 'تم إكمال الرحلة بنجاح', 'normal', 'driver', true)
ON CONFLICT (id) DO NOTHING;


-- ── 2. تحديث push_driver_on_status_change() للقراءة من notification_auto_settings ──
CREATE OR REPLACE FUNCTION public.push_driver_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _setting RECORD;
  _setting_id TEXT;
  _title TEXT;
  _body TEXT;
  _type TEXT;
  request_id BIGINT;
BEGIN
  -- فقط عند تغير الحالة ووجود سائق
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NULL AND OLD.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- تحديد نوع الإعداد حسب الحالة الجديدة
  CASE NEW.status
    WHEN 'cancelled' THEN
      -- إشعار السائق فقط عندما يلغي الراكب (ليس السائق)
      IF NEW.cancelled_by IS DISTINCT FROM 'driver' AND OLD.driver_id IS NOT NULL THEN
        _setting_id := 'ride_cancelled_driver';
        _type := 'ride_cancelled';
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'completed' THEN
      _setting_id := 'ride_completed_driver';
      _type := 'ride_completed';
    ELSE
      RETURN NEW;
  END CASE;

  -- جلب الإعداد من جدول notification_auto_settings
  SELECT * INTO _setting FROM notification_auto_settings WHERE id = _setting_id;

  -- تخطي إذا معطل أو غير موجود
  IF _setting IS NULL OR NOT _setting.is_enabled THEN
    RETURN NEW;
  END IF;

  _title := _setting.title_template;
  _body := _setting.body_template;

  -- إضافة الأجرة في نص الإشعار عند اكتمال الرحلة
  IF NEW.status = 'completed' THEN
    _body := _body || ' — ' || COALESCE(NEW.final_fare::TEXT, NEW.estimated_fare::TEXT, '0') || ' د.ع';
  END IF;

  -- إرسال push للسائق عبر Edge Function
  BEGIN
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'notify_driver',
        'driver_id', COALESCE(NEW.driver_id, OLD.driver_id),
        'title', _title,
        'body', _body,
        'data', jsonb_build_object(
          'type', _type,
          'ride_id', NEW.id,
          'status', NEW.status
        )
      )
    ) INTO request_id;

    RAISE LOG 'Driver push sent for ride % status %: request %', NEW.id, NEW.status, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Driver push failed for ride % (non-fatal): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- إعادة إنشاء التريجر
DROP TRIGGER IF EXISTS on_ride_status_push_driver ON public.rides;
CREATE TRIGGER on_ride_status_push_driver
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_driver_on_status_change();


-- ── 3. تحديث notify_drivers_new_ride() للقراءة من notification_auto_settings ──
CREATE OR REPLACE FUNCTION public.notify_drivers_new_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _setting RECORD;
  pickup_lat FLOAT;
  pickup_lng FLOAT;
  request_id BIGINT;
BEGIN
  -- فقط للرحلات الجديدة بحالة pending
  IF NEW.status = 'pending' THEN

    -- جلب إعداد بث الرحلة الجديدة
    SELECT * INTO _setting FROM notification_auto_settings WHERE id = 'new_ride_broadcast';

    -- تخطي إذا معطل
    IF _setting IS NOT NULL AND NOT _setting.is_enabled THEN
      RETURN NEW;
    END IF;

    -- استخراج إحداثيات نقطة الانطلاق
    pickup_lat := (NEW.pickup_location->>'lat')::FLOAT;
    pickup_lng := (NEW.pickup_location->>'lng')::FLOAT;

    -- إرسال عبر Edge Function مع عنوان ونص مخصص من الإعدادات
    BEGIN
      SELECT net.http_post(
        url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
        ),
        body := jsonb_build_object(
          'action', 'notify_new_ride',
          'ride_id', NEW.id,
          'pickup_lat', pickup_lat,
          'pickup_lng', pickup_lng,
          'pickup_address', NEW.pickup_address,
          'dropoff_address', NEW.dropoff_address,
          'vehicle_type', NEW.vehicle_type,
          'estimated_fare', NEW.estimated_fare,
          'custom_title', COALESCE(_setting.title_template, 'طلب رحلة جديد! 🚖'),
          'custom_body', COALESCE(_setting.body_template, 'رحلة جديدة بالقرب منك')
        )
      ) INTO request_id;

      RAISE LOG 'Driver push notification request sent for ride %: %', NEW.id, request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Driver push notification failed for ride % (non-fatal): %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- إعادة إنشاء التريجر
DROP TRIGGER IF EXISTS on_new_ride_notify_drivers ON public.rides;
CREATE TRIGGER on_new_ride_notify_drivers
  AFTER INSERT ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_drivers_new_ride();
