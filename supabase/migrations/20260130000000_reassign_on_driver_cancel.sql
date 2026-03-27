-- =====================================================
-- Migration: Reassign Ride on Driver Cancel
-- التاريخ: 2026-01-30
-- الوصف: إعادة تعيين الرحلة تلقائياً عند إلغاء السائق
-- =====================================================

-- ✅ إضافة عمود عداد محاولات إعادة التعيين
-- =====================================================
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS reassignment_count INTEGER DEFAULT 0;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN rides.reassignment_count IS 'عدد مرات إعادة تعيين الرحلة بعد إلغاء السائق (الحد الأقصى: 3)';

-- =====================================================
-- 🔄 دالة إعادة تعيين الرحلة عند إلغاء السائق
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_driver_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rider_user_id UUID;
  v_notification_title TEXT;
  v_notification_body TEXT;
BEGIN
  -- التحقق من أن التحديث هو إلغاء من السائق
  IF NEW.status = 'cancelled' 
     AND NEW.cancelled_by = 'driver' 
     AND OLD.status IN ('accepted', 'arrived') 
     AND NEW.reassignment_count < 3 THEN
    
    -- ✅ إعادة تعيين حالة الرحلة إلى pending
    NEW.status := 'pending';
    NEW.driver_id := NULL;
    NEW.reassignment_count := COALESCE(OLD.reassignment_count, 0) + 1;
    NEW.cancelled_by := NULL;
    NEW.cancellation_reason := NULL;
    NEW.updated_at := now();
    
    -- جلب user_id للراكب
    SELECT rider_id INTO v_rider_user_id FROM rides WHERE id = NEW.id;
    
    -- تحديد نص الإشعار
    IF NEW.reassignment_count = 1 THEN
      v_notification_title := 'البحث عن سائق بديل';
      v_notification_body := 'السائق ألغى الطلب، جاري البحث عن سائق بديل...';
    ELSIF NEW.reassignment_count = 2 THEN
      v_notification_title := 'لا تزال نبحث';
      v_notification_body := 'جاري البحث عن سائق آخر، يرجى الانتظار قليلاً...';
    ELSIF NEW.reassignment_count = 3 THEN
      v_notification_title := 'المحاولة الأخيرة';
      v_notification_body := 'آخر محاولة للعثور على سائق متاح...';
    END IF;
    
    -- ✅ إنشاء إشعار للراكب في جدول notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
      INSERT INTO notifications (
        user_id,
        title,
        body,
        type,
        data,
        is_read,
        created_at
      ) VALUES (
        v_rider_user_id,
        v_notification_title,
        v_notification_body,
        'ride_reassignment',
        jsonb_build_object(
          'ride_id', NEW.id,
          'reassignment_count', NEW.reassignment_count,
          'previous_status', OLD.status
        ),
        false,
        now()
      );
    END IF;
    
    -- تسجيل في السجل
    RAISE NOTICE 'Ride % reassigned (attempt %/3) after driver cancellation', NEW.id, NEW.reassignment_count;
    
  -- ✅ إذا وصلت المحاولات للحد الأقصى، إلغاء نهائي
  ELSIF NEW.status = 'cancelled' 
        AND NEW.cancelled_by = 'driver' 
        AND OLD.status IN ('accepted', 'arrived') 
        AND NEW.reassignment_count >= 3 THEN
    
    -- إرسال إشعار للراكب بالإلغاء النهائي
    SELECT rider_id INTO v_rider_user_id FROM rides WHERE id = NEW.id;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
      INSERT INTO notifications (
        user_id,
        title,
        body,
        type,
        data,
        is_read,
        created_at
      ) VALUES (
        v_rider_user_id,
        'عذراً، لم نتمكن من إيجاد سائق',
        'لم نتمكن من إيجاد سائق متاح. يرجى المحاولة مرة أخرى لاحقاً.',
        'ride_cancelled',
        jsonb_build_object(
          'ride_id', NEW.id,
          'reason', 'max_reassignment_reached'
        ),
        false,
        now()
      );
    END IF;
    
    RAISE NOTICE 'Ride % permanently cancelled after 3 reassignment attempts', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة تعليق توضيحي للدالة
COMMENT ON FUNCTION public.handle_driver_cancellation() IS 
'يقوم بإعادة تعيين الرحلة تلقائياً عند إلغاء السائق (حتى 3 محاولات)';

-- =====================================================
-- 🔔 إنشاء المحفز (Trigger)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_handle_driver_cancellation ON rides;

CREATE TRIGGER trigger_handle_driver_cancellation
  BEFORE UPDATE ON rides
  FOR EACH ROW
  WHEN (
    NEW.status = 'cancelled' 
    AND NEW.cancelled_by = 'driver'
    AND OLD.status IN ('accepted', 'arrived')
  )
  EXECUTE FUNCTION public.handle_driver_cancellation();

-- تعليق توضيحي للمحفز
COMMENT ON TRIGGER trigger_handle_driver_cancellation ON rides IS 
'يتم تشغيله عندما يلغي السائق رحلة مقبولة أو واصل لها';

-- =====================================================
-- 🔒 تحديث سياسات RLS (إن لزم الأمر)
-- =====================================================
-- السماح للنظام بتحديث الرحلات لإعادة التعيين
-- (معظم السياسات موجودة، لكن نضيف ضمان للتحديث التلقائي)

-- لا حاجة لتعديل RLS لأن TRIGGER يعمل بـ SECURITY DEFINER

-- =====================================================
-- 📊 إنشاء فهرس لتسريع الاستعلامات
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_rides_reassignment_count 
ON rides(reassignment_count) 
WHERE status = 'pending' AND reassignment_count > 0;

COMMENT ON INDEX idx_rides_reassignment_count IS 
'فهرس لتسريع البحث عن الرحلات المُعاد تعيينها';

-- =====================================================
-- ⬇️ ROLLBACK (Down Migration)
-- =====================================================
-- للتراجع عن هذا الترحيل، قم بتشغيل:
/*
DROP TRIGGER IF EXISTS trigger_handle_driver_cancellation ON rides;
DROP FUNCTION IF EXISTS public.handle_driver_cancellation();
DROP INDEX IF EXISTS idx_rides_reassignment_count;
ALTER TABLE rides DROP COLUMN IF EXISTS reassignment_count;
*/
