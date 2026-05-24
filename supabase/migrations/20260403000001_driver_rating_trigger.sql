-- ==========================================
-- تريقر لتحديث متوسط تقييم السائق تلقائياً
-- بدلاً من الحساب على جهة العميل (غير آمن)
-- ==========================================

CREATE OR REPLACE FUNCTION update_driver_rating_avg()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_id UUID;
  v_avg NUMERIC;
BEGIN
  v_driver_id := NEW.driver_id;

  -- لا نحسب إلا إذا كان هناك سائق وتقييم
  IF v_driver_id IS NULL OR NEW.driver_rating IS NULL THEN
    RETURN NEW;
  END IF;

  -- حساب المتوسط من جميع الرحلات المكتملة التي بها تقييم
  SELECT ROUND(AVG(driver_rating)::numeric, 1)
  INTO v_avg
  FROM rides
  WHERE driver_id = v_driver_id
    AND status = 'completed'
    AND driver_rating IS NOT NULL;

  -- تحديث تقييم السائق
  IF v_avg IS NOT NULL THEN
    UPDATE drivers SET rating = v_avg WHERE id = v_driver_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف التريقر إذا كان موجوداً
DROP TRIGGER IF EXISTS trg_update_driver_rating ON rides;

-- إنشاء التريقر عند تحديث driver_rating
CREATE TRIGGER trg_update_driver_rating
  AFTER UPDATE OF driver_rating ON rides
  FOR EACH ROW
  WHEN (NEW.driver_rating IS NOT NULL AND (OLD.driver_rating IS NULL OR OLD.driver_rating != NEW.driver_rating))
  EXECUTE FUNCTION update_driver_rating_avg();
