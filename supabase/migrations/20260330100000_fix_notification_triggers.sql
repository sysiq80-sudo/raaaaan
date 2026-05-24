-- ═══════════════════════════════════════════════════════════════════
-- إصلاح شامل لنظام إشعارات الرحلات
-- 1. إصلاح push_rider_on_status_change: search_path + إزالة INSERT المكرر
-- 2. إضافة exception handling لمنع فشل تحديث الرحلات
-- 3. إصلاح push_driver_on_status_change لإشعار السائق عند تغير الحالة
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. إصلاح trigger إشعار الراكب عند تغير حالة الرحلة ──
-- ملاحظات:
--   • notify_ride_status_change() يتولى إدخال السجلات في rider_notifications
--   • هذه الدالة تتولى فقط إرسال push notification عبر Edge Function
--   • إضافة extensions للـ search_path لضمان عمل net.http_post
--   • إضافة exception handling لمنع فشل تحديث الرحلة إذا فشل الإشعار
CREATE OR REPLACE FUNCTION public.push_rider_on_status_change()
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
  -- فقط عند تغير الحالة
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- تحديد نوع الإعداد
  CASE NEW.status
    WHEN 'accepted' THEN _setting_id := 'ride_accepted'; _type := 'ride_accepted';
    WHEN 'arrived' THEN _setting_id := 'ride_arrived'; _type := 'ride_arrived';
    WHEN 'in_progress' THEN _setting_id := 'ride_started'; _type := 'ride_started';
    WHEN 'completed' THEN _setting_id := 'ride_completed'; _type := 'ride_completed';
    WHEN 'cancelled' THEN _setting_id := 'ride_cancelled'; _type := 'ride_cancelled';
    ELSE RETURN NEW;
  END CASE;

  -- جلب الإعداد من جدول notification_auto_settings
  SELECT * INTO _setting FROM notification_auto_settings WHERE id = _setting_id;

  -- تخطي إذا معطل أو غير موجود
  IF _setting IS NULL OR NOT _setting.is_enabled THEN
    RETURN NEW;
  END IF;

  _title := _setting.title_template;
  _body := _setting.body_template;

  -- ملاحظة: لا نُدخل في rider_notifications هنا
  -- لأن notify_ride_status_change() يتولى ذلك بالفعل (تجنب التكرار)

  -- إرسال push notification عبر Edge Function (مع حماية من الفشل)
  BEGIN
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
          'driver_id', NEW.driver_id,
          'action_url', '/track/' || NEW.id
        )
      )
    ) INTO request_id;

    RAISE LOG 'Rider push notification sent for ride % status %: request %', NEW.id, NEW.status, request_id;
  EXCEPTION WHEN OTHERS THEN
    -- لا نفشل تحديث الرحلة إذا فشل إرسال الإشعار
    RAISE LOG 'Push notification failed for ride % (non-fatal): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- إعادة إنشاء التريجر
DROP TRIGGER IF EXISTS on_ride_status_push_rider ON public.rides;
CREATE TRIGGER on_ride_status_push_rider
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_rider_on_status_change();


-- ── 2. إصلاح trigger إشعار السائقين القريبين عند رحلة جديدة ──
-- إضافة exception handling لمنع فشل إنشاء الرحلة
CREATE OR REPLACE FUNCTION public.notify_drivers_new_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  pickup_lat FLOAT;
  pickup_lng FLOAT;
  request_id BIGINT;
BEGIN
  -- Only trigger for pending rides
  IF NEW.status = 'pending' THEN
    -- Extract pickup coordinates
    pickup_lat := (NEW.pickup_location->>'lat')::FLOAT;
    pickup_lng := (NEW.pickup_location->>'lng')::FLOAT;

    -- Call Edge Function using pg_net (مع حماية من الفشل)
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
          'estimated_fare', NEW.estimated_fare
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


-- ── 3. إضافة trigger لإشعار السائق عبر push عند تغير حالة الرحلة ──
-- (حالياً السائق يُشعَر فقط عبر rider_notifications/Realtime)
CREATE OR REPLACE FUNCTION public.push_driver_on_status_change()
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
  -- فقط عند تغير الحالة ووجود سائق
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NULL AND OLD.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- إشعار السائق فقط عند الإلغاء من الراكب أو اكتمال الرحلة
  CASE NEW.status
    WHEN 'cancelled' THEN
      IF NEW.cancelled_by IS DISTINCT FROM 'driver' AND OLD.driver_id IS NOT NULL THEN
        _title := '❌ تم إلغاء الرحلة';
        _body := 'الراكب ألغى الرحلة';
        _type := 'ride_cancelled';
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'completed' THEN
      _title := '🏁 رحلة مكتملة';
      _body := 'تم إكمال الرحلة بنجاح — ' || COALESCE(NEW.final_fare::TEXT, NEW.estimated_fare::TEXT, '0') || ' د.ع';
      _type := 'ride_completed';
    ELSE
      RETURN NEW;
  END CASE;

  -- إرسال push للسائق
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

DROP TRIGGER IF EXISTS on_ride_status_push_driver ON public.rides;
CREATE TRIGGER on_ride_status_push_driver
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.push_driver_on_status_change();


-- ── 4. تفعيل Realtime على جداول الإشعارات والاشتراكات ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'push_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE push_subscriptions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add push_subscriptions to realtime: %', SQLERRM;
END $$;

-- ── 5. إضافة index على user_id في push_subscriptions لتسريع البحث ──
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token ON push_subscriptions(fcm_token) WHERE fcm_token IS NOT NULL;
