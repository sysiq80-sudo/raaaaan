-- =====================================================================
-- Migration: Hybrid Pricing Engine — نظام التسعير الهجين
-- التاريخ: 2026-02-15
-- الوصف: تتبع المسافة الفعلية + تعديل الأجرة تلقائياً عند انحراف >15%
-- =====================================================================
--
-- 📌 الفكرة:
--   - عند الحجز: يُحسب سعر ثابت (estimated_fare) بناءً على Google Directions
--   - أثناء الركوب: يُتتبع موقع السائق كل 30 ثانية (ride_tracking_points)
--   - عند الإكمال: يرسل تطبيق السائق المسافة الفعلية GPS
--   - إذا الفرق > 15% → يُعاد حساب الأجرة
--   - إذا الفرق ≤ 15% → تبقى الأجرة الأصلية
--
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════
-- 1️⃣ جدول نقاط التتبع (ride_tracking_points)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ride_tracking_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,          -- سرعة السائق (م/ث) — اختياري
  heading DOUBLE PRECISION,        -- اتجاه السائق (درجات) — اختياري
  accuracy DOUBLE PRECISION,       -- دقة GPS (متر) — اختياري
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس لتسريع الاستعلامات
CREATE INDEX idx_tracking_points_ride_id ON ride_tracking_points(ride_id);
CREATE INDEX idx_tracking_points_recorded_at ON ride_tracking_points(ride_id, recorded_at);

-- RLS
ALTER TABLE public.ride_tracking_points ENABLE ROW LEVEL SECURITY;

-- السائق يمكنه إضافة نقاط لرحلاته فقط
CREATE POLICY "drivers_insert_own_tracking" ON ride_tracking_points
  FOR INSERT WITH CHECK (
    ride_id IN (
      SELECT r.id FROM rides r
      JOIN drivers d ON d.id = r.driver_id
      WHERE d.user_id = auth.uid()
      AND r.status = 'in_progress'
    )
  );

-- السائق والراكب يمكنهم قراءة نقاط رحلاتهم
CREATE POLICY "participants_read_tracking" ON ride_tracking_points
  FOR SELECT USING (
    ride_id IN (
      SELECT r.id FROM rides r
      LEFT JOIN drivers d ON d.id = r.driver_id
      WHERE r.rider_id = auth.uid() OR d.user_id = auth.uid()
    )
  );

-- المدير يرى الكل
CREATE POLICY "admin_all_tracking" ON ride_tracking_points
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- النظام يمكنه الإدخال (SECURITY DEFINER functions)
CREATE POLICY "system_insert_tracking" ON ride_tracking_points
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE ride_tracking_points IS 'نقاط تتبع GPS للسائق أثناء الرحلة — كل 30 ثانية';


-- ═══════════════════════════════════════════════════════════════════
-- 2️⃣ أعمدة جديدة في جدول rides
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS actual_distance_km DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS fare_adjustment_reason TEXT,
ADD COLUMN IF NOT EXISTS fare_variance_percent DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS original_estimated_fare INTEGER;

COMMENT ON COLUMN rides.actual_distance_km IS 'المسافة الفعلية المقاسة بـ GPS من تطبيق السائق (كم)';
COMMENT ON COLUMN rides.fare_adjustment_reason IS 'سبب تعديل الأجرة (route_longer / shortcut_taken / null = لم يُعدّل)';
COMMENT ON COLUMN rides.fare_variance_percent IS 'نسبة الانحراف بين المسافة المقدرة والفعلية (0.15 = +15%)';
COMMENT ON COLUMN rides.original_estimated_fare IS 'الأجرة المقدرة الأصلية قبل التعديل (يُحفظ فقط إذا تم التعديل)';

-- فهرس للرحلات المُعدّلة (للتقارير)
CREATE INDEX IF NOT EXISTS idx_rides_fare_adjusted 
ON rides(fare_adjustment_reason) 
WHERE fare_adjustment_reason IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 3️⃣ دالة حساب المسافة من نقاط التتبع
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_tracked_distance(p_ride_id UUID)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_km DOUBLE PRECISION := 0;
  v_prev_lat DOUBLE PRECISION;
  v_prev_lng DOUBLE PRECISION;
  v_point RECORD;
BEGIN
  FOR v_point IN 
    SELECT lat, lng 
    FROM ride_tracking_points
    WHERE ride_id = p_ride_id
    ORDER BY recorded_at ASC
  LOOP
    IF v_prev_lat IS NOT NULL THEN
      v_total_km := v_total_km + public.calculate_distance(
        v_prev_lat, v_prev_lng, v_point.lat, v_point.lng
      );
    END IF;
    v_prev_lat := v_point.lat;
    v_prev_lng := v_point.lng;
  END LOOP;

  RETURN ROUND(v_total_km::NUMERIC, 2)::DOUBLE PRECISION;
END;
$$;

COMMENT ON FUNCTION public.calculate_tracked_distance IS 
'حساب المسافة الفعلية من مجموع نقاط التتبع GPS (Haversine بين كل نقطتين متتاليتين)';


-- ═══════════════════════════════════════════════════════════════════
-- 4️⃣ دالة التدقيق: مقارنة المقدر بالفعلي وتعديل الأجرة
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_ride_fare(
  p_ride_id UUID,
  p_actual_distance_km DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ride RECORD;
  v_actual_km DOUBLE PRECISION;
  v_estimated_km DOUBLE PRECISION;
  v_variance DOUBLE PRECISION;
  v_new_distance_fare DOUBLE PRECISION;
  v_new_total DOUBLE PRECISION;
  v_per_km_rate INTEGER;
  v_base_fare INTEGER;
  v_waiting_fare INTEGER;
  v_vehicle_multiplier DOUBLE PRECISION;
  v_surge_multiplier DOUBLE PRECISION := 1.0;
  v_service_fee_percent DOUBLE PRECISION := 5.0;
  v_min_service_fee INTEGER := 500;
  v_vehicle_min_fare INTEGER := 2000;
  v_region RECORD;
  v_vehicle RECORD;
  v_fare_settings JSONB;
  v_adjustment_reason TEXT := NULL;
  v_new_fare INTEGER;
  v_service_fee INTEGER;
  v_subtotal DOUBLE PRECISION;
  v_vehicle_adjusted DOUBLE PRECISION;
BEGIN
  -- ═══ 1. جلب بيانات الرحلة ═══
  SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
  
  IF v_ride IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ride_not_found');
  END IF;

  v_estimated_km := COALESCE(v_ride.distance_km, 0);
  
  -- ═══ 2. تحديد المسافة الفعلية ═══
  -- الأولوية: القيمة المرسلة من التطبيق > نقاط التتبع
  IF p_actual_distance_km IS NOT NULL AND p_actual_distance_km > 0 THEN
    v_actual_km := p_actual_distance_km;
  ELSE
    -- محاولة حسابها من نقاط التتبع
    v_actual_km := public.calculate_tracked_distance(p_ride_id);
    IF v_actual_km IS NULL OR v_actual_km <= 0 THEN
      -- لا يوجد بيانات تتبع — نستخدم المقدر
      RETURN jsonb_build_object(
        'success', true,
        'adjusted', false,
        'reason', 'no_tracking_data',
        'final_fare', v_ride.final_fare,
        'estimated_distance', v_estimated_km
      );
    END IF;
  END IF;

  -- ═══ 3. حساب نسبة الانحراف ═══
  IF v_estimated_km > 0 THEN
    v_variance := (v_actual_km - v_estimated_km) / v_estimated_km;
  ELSE
    v_variance := 0;
  END IF;

  -- ═══ 4. قرار التعديل ═══
  IF ABS(v_variance) <= 0.15 THEN
    -- الانحراف ≤ 15% — نحتفظ بالسعر المقدر
    UPDATE rides
    SET actual_distance_km = v_actual_km,
        fare_variance_percent = ROUND(v_variance::NUMERIC, 4)::DOUBLE PRECISION
    WHERE id = p_ride_id;

    RETURN jsonb_build_object(
      'success', true,
      'adjusted', false,
      'reason', 'within_tolerance',
      'variance_percent', ROUND(v_variance * 100, 1),
      'estimated_distance', v_estimated_km,
      'actual_distance', v_actual_km,
      'final_fare', v_ride.final_fare
    );
  END IF;

  -- ═══ الانحراف > 15% — إعادة حساب الأجرة ═══

  IF v_variance > 0.15 THEN
    v_adjustment_reason := 'route_longer';
  ELSE
    v_adjustment_reason := 'shortcut_taken';
  END IF;

  -- ═══ 5. جلب أسعار المنطقة ═══
  IF v_ride.region_id IS NOT NULL THEN
    SELECT base_fare, per_km_fare, waiting_fare_per_min 
    INTO v_region
    FROM regions WHERE id = v_ride.region_id AND is_active = true;
  END IF;

  IF v_region IS NULL THEN
    -- محاولة تحديد المنطقة من إحداثيات الانطلاق
    SELECT r.base_fare, r.per_km_fare, r.waiting_fare_per_min
    INTO v_region
    FROM regions r
    WHERE r.is_active = true
    LIMIT 1;
  END IF;

  v_base_fare := COALESCE(v_region.base_fare, 2000);
  v_per_km_rate := COALESCE(v_region.per_km_fare, 500);
  v_waiting_fare := COALESCE(v_ride.waiting_minutes, 0) * COALESCE(v_region.waiting_fare_per_min, 100);

  -- ═══ 6. جلب معامل المركبة ═══
  SELECT multiplier, min_fare INTO v_vehicle
  FROM vehicle_types
  WHERE id = COALESCE(v_ride.vehicle_type, 'economy')
  AND is_active = true;

  v_vehicle_multiplier := COALESCE(v_vehicle.multiplier, 1.0);
  v_vehicle_min_fare := COALESCE(v_vehicle.min_fare, 2000);

  -- ═══ 7. جلب إعدادات الخدمة ═══
  SELECT value INTO v_fare_settings
  FROM app_settings WHERE key = 'fare_calculation';

  IF v_fare_settings IS NOT NULL THEN
    v_service_fee_percent := COALESCE((v_fare_settings->>'service_fee_percentage')::DOUBLE PRECISION, 5.0);
    v_min_service_fee := COALESCE((v_fare_settings->>'min_service_fee')::INTEGER, 500);
  END IF;

  -- ═══ 8. إعادة حساب الأجرة ═══
  v_new_distance_fare := v_actual_km * v_per_km_rate;
  v_subtotal := v_base_fare + v_new_distance_fare + v_waiting_fare;
  v_vehicle_adjusted := v_subtotal * v_vehicle_multiplier;

  -- لا نطبق surge عند إعادة الحساب (السعر النهائي عادل)
  v_new_fare := GREATEST(ROUND(v_vehicle_adjusted)::INTEGER, v_vehicle_min_fare);
  
  -- رسوم الخدمة
  v_service_fee := GREATEST(
    v_min_service_fee,
    ROUND(v_new_fare * v_service_fee_percent / 100)::INTEGER
  );

  v_new_fare := v_new_fare + v_service_fee;

  -- ═══ 9. تحديث الرحلة ═══
  UPDATE rides
  SET 
    actual_distance_km = v_actual_km,
    fare_variance_percent = ROUND(v_variance::NUMERIC, 4)::DOUBLE PRECISION,
    fare_adjustment_reason = v_adjustment_reason,
    original_estimated_fare = COALESCE(v_ride.estimated_fare, v_ride.final_fare),
    final_fare = v_new_fare
  WHERE id = p_ride_id;

  RETURN jsonb_build_object(
    'success', true,
    'adjusted', true,
    'reason', v_adjustment_reason,
    'variance_percent', ROUND(v_variance * 100, 1),
    'estimated_distance', v_estimated_km,
    'actual_distance', v_actual_km,
    'old_fare', COALESCE(v_ride.estimated_fare, v_ride.final_fare),
    'new_fare', v_new_fare,
    'per_km_rate', v_per_km_rate,
    'base_fare', v_base_fare,
    'distance_fare', ROUND(v_new_distance_fare)::INTEGER,
    'service_fee', v_service_fee,
    'vehicle_multiplier', v_vehicle_multiplier
  );
END;
$$;

COMMENT ON FUNCTION public.audit_ride_fare IS
'تدقيق الأجرة عند إكمال الرحلة: إذا الانحراف > 15% → إعادة حساب بالمسافة الفعلية';


-- ═══════════════════════════════════════════════════════════════════
-- 5️⃣ تنظيف تلقائي لنقاط التتبع القديمة (أكثر من 30 يوم)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_old_tracking_points()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ride_tracking_points
  WHERE recorded_at < now() - INTERVAL '30 days'
  AND ride_id IN (
    SELECT id FROM rides WHERE status IN ('completed', 'cancelled')
  );
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_tracking_points IS
'حذف نقاط التتبع للرحلات المكتملة/الملغاة الأقدم من 30 يوم';


-- ═══════════════════════════════════════════════════════════════════
-- ⬇️ ROLLBACK
-- ═══════════════════════════════════════════════════════════════════
/*
DROP TABLE IF EXISTS ride_tracking_points CASCADE;
DROP FUNCTION IF EXISTS public.calculate_tracked_distance(UUID);
DROP FUNCTION IF EXISTS public.audit_ride_fare(UUID, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.cleanup_old_tracking_points();
DROP INDEX IF EXISTS idx_rides_fare_adjusted;
ALTER TABLE rides DROP COLUMN IF EXISTS actual_distance_km;
ALTER TABLE rides DROP COLUMN IF EXISTS fare_adjustment_reason;
ALTER TABLE rides DROP COLUMN IF EXISTS fare_variance_percent;
ALTER TABLE rides DROP COLUMN IF EXISTS original_estimated_fare;
*/
