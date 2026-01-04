-- 1. إنشاء VIEW آمن للسائقين (يخفي البيانات الحساسة)
CREATE OR REPLACE VIEW public.safe_drivers_view AS
SELECT 
  id,
  vehicle_type,
  vehicle_model,
  vehicle_color,
  rating,
  is_online,
  is_available,
  current_location,
  working_region_id
FROM public.drivers
WHERE status = 'approved' AND is_online = true;

-- 2. إضافة RLS لـ ride_matching_stats (جدول VIEW لا يحتاج RLS مباشرة)
-- لكن نضيف سياسة للتأكد من أن الـ VIEW الأصلي محمي

-- 3. إنشاء Trigger للتحقق من تحولات حالة الرحلة
CREATE OR REPLACE FUNCTION public.validate_ride_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- التحقق من التحولات المسموحة فقط
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot change status of completed ride';
  END IF;
  
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of cancelled ride';
  END IF;
  
  -- التحولات المسموحة:
  -- pending -> accepted, cancelled
  -- accepted -> arrived, in_progress, cancelled
  -- arrived -> in_progress, cancelled
  -- in_progress -> completed, cancelled
  
  IF OLD.status = 'pending' AND NEW.status NOT IN ('accepted', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
  END IF;
  
  IF OLD.status = 'accepted' AND NEW.status NOT IN ('arrived', 'in_progress', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from accepted to %', NEW.status;
  END IF;
  
  IF OLD.status = 'arrived' AND NEW.status NOT IN ('in_progress', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from arrived to %', NEW.status;
  END IF;
  
  IF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition from in_progress to %', NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ Trigger
DROP TRIGGER IF EXISTS validate_ride_status ON public.rides;
CREATE TRIGGER validate_ride_status
  BEFORE UPDATE OF status ON public.rides
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validate_ride_status_transition();

-- 4. إضافة فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON public.rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON public.drivers(is_online);
CREATE INDEX IF NOT EXISTS idx_drivers_is_available ON public.drivers(is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);