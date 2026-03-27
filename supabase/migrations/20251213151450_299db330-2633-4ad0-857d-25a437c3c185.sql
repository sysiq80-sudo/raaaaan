-- إضافة حقول منطقة العمل ونطاق البحث للسائقين
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS working_region_id UUID REFERENCES public.regions(id),
ADD COLUMN IF NOT EXISTS max_pickup_radius INTEGER DEFAULT 10;

-- إنشاء دالة حساب المسافة باستخدام صيغة Haversine
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 FLOAT, 
  lng1 FLOAT, 
  lat2 FLOAT, 
  lng2 FLOAT
) RETURNS FLOAT AS $$
DECLARE
  R FLOAT := 6371; -- نصف قطر الأرض بالكيلومترات
  dlat FLOAT;
  dlng FLOAT;
  a FLOAT;
  c FLOAT;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- إنشاء دالة جلب الطلبات القريبة من السائق
CREATE OR REPLACE FUNCTION public.get_nearby_pending_rides(
  driver_lat FLOAT,
  driver_lng FLOAT,
  max_radius_km FLOAT DEFAULT 10,
  driver_vehicle_type vehicle_type DEFAULT 'economy'
) RETURNS SETOF rides AS $$
BEGIN
  RETURN QUERY
  SELECT r.* 
  FROM rides r
  WHERE r.status = 'pending'
    AND r.driver_id IS NULL
    AND r.vehicle_type = driver_vehicle_type
    AND public.calculate_distance(
      driver_lat, 
      driver_lng,
      (r.pickup_location->>'lat')::FLOAT,
      (r.pickup_location->>'lng')::FLOAT
    ) <= max_radius_km
  ORDER BY r.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- إضافة إعداد فلترة المنطقة إذا لم يكن موجوداً
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'region_filtering_enabled',
  'true',
  'تفعيل فلترة الطلبات حسب المنطقة'
)
ON CONFLICT (key) DO NOTHING;

-- التأكد من وجود إعداد نطاق البحث
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'max_search_radius',
  '10',
  'أقصى نطاق بحث للسائقين بالكيلومترات'
)
ON CONFLICT (key) DO NOTHING;