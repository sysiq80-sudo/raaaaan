-- ═══════════════════════════════════════════════════════════════════
-- إشعارات تغيير حالة الرحلة
-- يُنشئ إشعارات في rider_notifications و driver_notifications
-- عند تغيير حالة الرحلة
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_ride_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_record RECORD;
  v_rider_title TEXT;
  v_rider_body TEXT;
  v_driver_title TEXT;
  v_driver_body TEXT;
  v_notification_type TEXT;
  v_pickup TEXT;
  v_dropoff TEXT;
  v_fare TEXT;
BEGIN
  -- تجاهل إذا لم تتغير الحالة
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_pickup := COALESCE(NEW.pickup_address, 'موقع الانطلاق');
  v_dropoff := COALESCE(NEW.dropoff_address, 'الوجهة');
  v_fare := COALESCE(NEW.estimated_fare::TEXT, '0');

  -- ═══ حالة: تم قبول الرحلة ═══
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- جلب بيانات السائق
    SELECT full_name, phone, vehicle_type, vehicle_color, vehicle_plate
    INTO v_driver_record
    FROM drivers WHERE id = NEW.driver_id;

    v_rider_title := '✅ تم قبول رحلتك!';
    v_rider_body := 'السائق ' || COALESCE(v_driver_record.full_name, 'سائق') || ' في طريقه إليك';
    v_notification_type := 'ride_accepted';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object(
        'ride_id', NEW.id,
        'driver_name', v_driver_record.full_name,
        'driver_phone', v_driver_record.phone,
        'vehicle_type', v_driver_record.vehicle_type,
        'vehicle_color', v_driver_record.vehicle_color,
        'vehicle_plate', v_driver_record.vehicle_plate
      )
    );

  -- ═══ حالة: السائق وصل ═══
  ELSIF NEW.status = 'arrived' AND OLD.status = 'accepted' THEN
    v_rider_title := '📍 السائق وصل!';
    v_rider_body := 'السائق وصل إلى موقعك، يرجى التوجه إليه';
    v_notification_type := 'driver_arrived';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object('ride_id', NEW.id)
    );

  -- ═══ حالة: الرحلة بدأت ═══
  ELSIF NEW.status = 'in_progress' AND OLD.status = 'arrived' THEN
    v_rider_title := '🚗 الرحلة بدأت!';
    v_rider_body := 'في الطريق إلى ' || v_dropoff;
    v_notification_type := 'ride_started';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object('ride_id', NEW.id, 'dropoff_address', v_dropoff)
    );

  -- ═══ حالة: الرحلة اكتملت ═══
  ELSIF NEW.status = 'completed' THEN
    v_fare := COALESCE(NEW.final_fare::TEXT, NEW.estimated_fare::TEXT, '0');

    -- إشعار الراكب
    v_rider_title := '🏁 وصلت! الرحلة اكتملت';
    v_rider_body := 'المبلغ: ' || v_fare || ' د.ع — شكراً لاستخدامك ران!';
    v_notification_type := 'ride_completed';

    INSERT INTO rider_notifications (user_id, title, body, type, data)
    VALUES (
      NEW.rider_id,
      v_rider_title,
      v_rider_body,
      v_notification_type,
      jsonb_build_object('ride_id', NEW.id, 'fare', v_fare)
    );

    -- إشعار السائق
    IF NEW.driver_id IS NOT NULL THEN
      v_driver_title := '🏁 رحلة مكتملة';
      v_driver_body := 'تم إكمال الرحلة — ' || v_fare || ' د.ع';

      INSERT INTO driver_notifications (driver_id, title, body, type, data)
      VALUES (
        NEW.driver_id,
        v_driver_title,
        v_driver_body,
        v_notification_type,
        jsonb_build_object('ride_id', NEW.id, 'fare', v_fare)
      );
    END IF;

  -- ═══ حالة: الرحلة ملغاة ═══
  ELSIF NEW.status = 'cancelled' THEN
    v_notification_type := 'ride_cancelled';

    -- إشعار الراكب (إذا ألغى السائق أو النظام)
    IF NEW.cancelled_by IS DISTINCT FROM 'rider' THEN
      v_rider_title := '❌ تم إلغاء الرحلة';
      IF NEW.cancelled_by = 'driver' THEN
        v_rider_body := 'السائق ألغى الرحلة — جاري البحث عن سائق بديل';
      ELSE
        v_rider_body := 'تم إلغاء الرحلة — يرجى المحاولة مرة أخرى';
      END IF;

      INSERT INTO rider_notifications (user_id, title, body, type, data)
      VALUES (
        NEW.rider_id,
        v_rider_title,
        v_rider_body,
        v_notification_type,
        jsonb_build_object(
          'ride_id', NEW.id,
          'cancelled_by', COALESCE(NEW.cancelled_by, 'system'),
          'reason', COALESCE(NEW.cancellation_reason, '')
        )
      );
    END IF;

    -- إشعار السائق (إذا ألغى الراكب)
    IF NEW.cancelled_by = 'rider' AND OLD.driver_id IS NOT NULL THEN
      v_driver_title := '❌ الراكب ألغى الرحلة';
      v_driver_body := 'تم إلغاء الرحلة من ' || v_pickup;

      INSERT INTO driver_notifications (driver_id, title, body, type, data)
      VALUES (
        OLD.driver_id,
        v_driver_title,
        v_driver_body,
        v_notification_type,
        jsonb_build_object(
          'ride_id', NEW.id,
          'reason', COALESCE(NEW.cancellation_reason, '')
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- إنشاء التريجر
DROP TRIGGER IF EXISTS trigger_ride_status_notifications ON rides;

CREATE TRIGGER trigger_ride_status_notifications
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_ride_status_change();

COMMENT ON TRIGGER trigger_ride_status_notifications ON rides IS
'يُنشئ إشعارات في rider_notifications و driver_notifications عند تغيير حالة الرحلة';


-- ═══════════════════════════════════════════════════════════════════
-- تريجر إضافي: إشعار السائق عند إنشاء رحلة جديدة (pending)
-- هذا يكمل نظام Realtime — يضمن وجود سجل في الجدول
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_new_ride_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- إشعار الراكب بتأكيد الطلب
  INSERT INTO rider_notifications (user_id, title, body, type, data)
  VALUES (
    NEW.rider_id,
    '🔍 جاري البحث عن سائق',
    'تم إرسال طلبك — جاري البحث عن سائق قريب منك',
    'ride_requested',
    jsonb_build_object(
      'ride_id', NEW.id,
      'pickup_address', COALESCE(NEW.pickup_address, ''),
      'dropoff_address', COALESCE(NEW.dropoff_address, '')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_new_ride_notification ON rides;

CREATE TRIGGER trigger_new_ride_notification
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_ride_created();

COMMENT ON TRIGGER trigger_new_ride_notification ON rides IS
'يُرسل إشعار للراكب عند إنشاء طلب رحلة جديد';


-- ═══════════════════════════════════════════════════════════════════
-- تفعيل Realtime على جداول الإشعارات (إذا لم تكن مفعّلة مسبقاً)
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rider_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE driver_notifications;
  END IF;
END $$;
