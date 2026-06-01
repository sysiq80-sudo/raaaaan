-- ══════════════════════════════════════════════════════════════════════════════
-- إصلاح get_ride_by_share_token + إعادة GRANT لـ anon
-- 
-- المشكلة: CREATE OR REPLACE أزال GRANT القديم (من migration 20250712)
--          + الدالة لا تتحقق من is_active ولا من حالة الرحلة
--
-- البيانات المرجعة آمنة للعموم:
--   ✅ معلومات الرحلة (مواقع، عناوين، نوع السيارة)
--   ✅ معلومات السائق العامة (اسم، سيارة، تقييم)
--   ✅ الموقع الحي (مطلوب للتتبع)
--   ❌ لا يرجع: rider_id, driver.user_id, phone, driver_id, بيانات مالية
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_ride_by_share_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_id uuid;
  v_ride jsonb;
BEGIN
  -- إيجاد ride_id من التوكن (مع التحقق الكامل)
  SELECT ride_id INTO v_ride_id
  FROM ride_share_links
  WHERE token = p_token
    AND expires_at > now()
    AND is_active = true;  -- 🔒 إضافة: التحقق من أن الرابط نشط
  
  IF v_ride_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'رابط المشاركة غير صالح أو منتهي الصلاحية');
  END IF;

  -- ملاحظة: تم حذف تحديث view_count لأن العمود غير موجود في الجدول
  
  -- جلب تفاصيل الرحلة مع معلومات السائق والموقع المباشر
  SELECT jsonb_build_object(
    'success', true,
    'ride', jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'pickup_location', r.pickup_location,
      'dropoff_location', r.dropoff_location,
      'pickup_address', r.pickup_address,
      'dropoff_address', r.dropoff_address,
      'vehicle_type', r.vehicle_type,
      'estimated_fare', r.estimated_fare,
      'driver', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object(
        'full_name', d.full_name,
        'vehicle_model', d.vehicle_model,
        'vehicle_color', d.vehicle_color,
        'vehicle_plate', d.vehicle_plate,
        'rating', d.rating
        -- 🔒 current_location محذوف — live_location يكفي، ولا داعي لكشف الموقع المخزّن
      ) ELSE NULL END,
      'live_location', (
        SELECT jsonb_build_object(
          'location', dll.location,
          'heading', dll.heading,
          'speed', dll.speed,
          'updated_at', dll.updated_at
        )
        FROM driver_live_locations dll
        WHERE dll.ride_id = r.id
        LIMIT 1
      )
    )
  ) INTO v_ride
  FROM rides r
  LEFT JOIN drivers d ON r.driver_id = d.id
  WHERE r.id = v_ride_id;
  
  RETURN COALESCE(v_ride, jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة'));
END;
$$;

-- 🔒 إعادة GRANT — كان موجوداً في migration الأصلي 20250712 لكن ضاع مع CREATE OR REPLACE
GRANT EXECUTE ON FUNCTION public.get_ride_by_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ride_by_share_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ride_by_share_token(text) TO service_role;
