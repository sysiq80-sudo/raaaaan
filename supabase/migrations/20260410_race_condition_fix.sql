-- ران - إصلاح حالات التسابق في مطابقة الرحلات (Race Conditions Fix)
-- تاريخ: 2026-04-10
-- هذا الملف يضيف دالة RPC لقفل الرحلة أثناء المطابقة

-- إنشاء دالة RPC لجلب الرحلة مع قفل (SELECT FOR UPDATE)
CREATE OR REPLACE FUNCTION get_ride_for_update(ride_id UUID)
RETURNS rides
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ride_record rides;
BEGIN
  -- قفل الصف لمنع التعديل المتزامن
  SELECT * INTO ride_record
  FROM rides
  WHERE id = ride_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;

  RETURN ride_record;
END;
$$;

-- منح صلاحية التنفيذ للمستخدمين المصادق عليهم
GRANT EXECUTE ON FUNCTION get_ride_for_update(UUID) TO authenticated;