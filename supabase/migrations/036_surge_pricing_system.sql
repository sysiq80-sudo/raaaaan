-- ران - نظام التسعير الديناميكي (Surge Pricing)
-- تاريخ: 2026-01-15
-- يحتسب أسعار الطلب العالي حسب الوقت والموقع

-- ============================================================================
-- 1. إنشاء جدول SURGE_PRICING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.surge_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- معلومات الفترة الزمنية
  time_period TEXT NOT NULL CHECK (time_period IN ('peak', 'off_peak', 'night', 'early_morning')),
  start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour < 24),
  end_hour INT NOT NULL CHECK (end_hour >= 0 AND end_hour < 24),
  days_of_week INT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7], -- 1=الاثنين، 7=الأحد
  
  -- معلومات الموقع
  governorate_id UUID REFERENCES public.governorates(id) ON DELETE CASCADE,
  route_zone TEXT, -- مثلاً 'downtown_baghdad'، NULL = كل المناطق
  
  -- معاملات التسعير
  base_multiplier DECIMAL(3, 2) NOT NULL DEFAULT 1.0 CHECK (base_multiplier >= 1.0 AND base_multiplier <= 3.0),
  demand_multiplier DECIMAL(3, 2) NOT NULL DEFAULT 1.0 CHECK (demand_multiplier >= 1.0 AND demand_multiplier <= 3.0),
  
  -- عتبات الطلب
  rides_in_area INT NOT NULL DEFAULT 10, -- عدد الرحلات النشطة في المنطقة
  active_drivers INT NOT NULL DEFAULT 5, -- عدد السائقين المتاحين
  demand_ratio DECIMAL(3, 2), -- ratio = rides / drivers، إذا تجاوز: تفعيل surge
  
  -- ملاحظات
  reason TEXT, -- السبب خلف surge (العطلات، الأحداث، إلخ)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.admins(user_id),
  
  CONSTRAINT valid_hours CHECK (
    CASE
      WHEN start_hour < end_hour THEN true
      WHEN start_hour > end_hour THEN true -- mulai malam (23:00-06:00)
      ELSE false
    END
  )
);

-- ============================================================================
-- 2. إنشاء جدول DYNAMIC_PRICING_HISTORY (لتتبع التغييرات)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dynamic_pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  
  -- الحسابات
  base_fare DECIMAL(10, 2) NOT NULL,
  distance_fare DECIMAL(10, 2),
  waiting_fare DECIMAL(10, 2),
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  final_fare DECIMAL(10, 2) NOT NULL,
  
  -- تفاصيل surge
  surge_reason TEXT,
  demand_level TEXT CHECK (demand_level IN ('low', 'normal', 'high', 'critical')),
  rides_in_area INT,
  available_drivers INT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. Function: حساب معامل Surge الحالي
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_surge_multiplier(
  p_governorate_id UUID,
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_time_of_day TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
  multiplier DECIMAL,
  demand_level TEXT,
  active_rides INT,
  available_drivers INT,
  reason TEXT
) AS $$
DECLARE
  v_hour INT;
  v_day INT; -- 1=Sat, 7=Fri in Iraq
  v_rides INT;
  v_drivers INT;
  v_ratio DECIMAL;
  v_base_mult DECIMAL := 1.0;
  v_demand_mult DECIMAL := 1.0;
  v_demand_level TEXT := 'normal';
  v_reason TEXT := 'No surge';
BEGIN
  -- استخراج الساعة واليوم
  v_hour := EXTRACT(HOUR FROM p_time_of_day)::INT;
  v_day := EXTRACT(DOW FROM p_time_of_day)::INT; -- 0=Sun, 6=Sat
  IF v_day = 0 THEN v_day := 7; END IF; -- تحويل الأحد لـ 7
  
  -- عد الرحلات النشطة والسائقين في المنطقة
  SELECT COUNT(*) INTO v_rides
  FROM public.rides
  WHERE status IN ('pending', 'accepted', 'arrived', 'in_progress')
    AND governorate_id = p_governorate_id
    AND created_at > NOW() - INTERVAL '30 minutes';
  
  SELECT COUNT(*) INTO v_drivers
  FROM public.drivers
  WHERE is_online = true
    AND is_available = true
    AND status = 'approved'
    AND (SELECT governorate_id FROM public.driver_locations 
         WHERE user_id = drivers.user_id ORDER BY updated_at DESC LIMIT 1) = p_governorate_id;
  
  -- حساب نسبة الطلب
  IF v_drivers > 0 THEN
    v_ratio := v_rides::DECIMAL / v_drivers::DECIMAL;
  ELSE
    v_ratio := v_rides::DECIMAL * 2; -- لا توجد سائقين، surge عالي
    v_drivers := 0;
  END IF;
  
  -- تحديد معامل surge بناءً على الطلب
  CASE
    WHEN v_ratio < 0.5 THEN
      v_demand_mult := 1.0;
      v_demand_level := 'low';
      v_reason := 'More drivers than rides';
    WHEN v_ratio < 1.0 THEN
      v_demand_mult := 1.1;
      v_demand_level := 'normal';
      v_reason := 'Balanced demand';
    WHEN v_ratio < 2.0 THEN
      v_demand_mult := 1.3;
      v_demand_level := 'high';
      v_reason := 'High demand';
    WHEN v_ratio < 3.5 THEN
      v_demand_mult := 1.6;
      v_demand_level := 'critical';
      v_reason := 'Very high demand';
    ELSE
      v_demand_mult := 2.0;
      v_demand_level := 'critical';
      v_reason := 'Extreme demand - very few drivers';
  END CASE;
  
  -- تطبيق معامل الوقت (الساعات الذروة)
  IF v_day IN (5, 6) THEN -- الجمعة والسبت
    CASE
      WHEN v_hour >= 8 AND v_hour < 11 THEN v_base_mult := 1.15; -- الصباح
      WHEN v_hour >= 12 AND v_hour < 14 THEN v_base_mult := 1.2; -- الغداء
      WHEN v_hour >= 18 AND v_hour < 21 THEN v_base_mult := 1.35; -- المساء
      WHEN v_hour >= 21 AND v_hour < 23 THEN v_base_mult := 1.15; -- الليل
      ELSE v_base_mult := 1.0;
    END CASE;
  ELSE -- أيام عادية
    CASE
      WHEN v_hour >= 7 AND v_hour < 9 THEN v_base_mult := 1.1; -- الذروة الصباحية
      WHEN v_hour >= 17 AND v_hour < 19 THEN v_base_mult := 1.2; -- ذروة المساء
      WHEN v_hour >= 23 OR v_hour < 5 THEN v_base_mult := 1.05; -- الليل
      ELSE v_base_mult := 1.0;
    END CASE;
  END IF;
  
  -- حساب المعامل النهائي
  multiplier := LEAST(v_base_mult * v_demand_mult, 2.5); -- حد أقصى 2.5x
  
  RETURN QUERY SELECT
    multiplier,
    v_demand_level,
    v_rides,
    v_drivers,
    v_reason;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. Function: تحديث معاملات Surge الافتراضية
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_default_surge_pricing()
RETURNS void AS $$
BEGIN
  -- حذف السياسات القديمة
  DELETE FROM public.surge_pricing
  WHERE created_at < NOW() - INTERVAL '30 days' AND created_by IS NULL;
  
  -- إدراج معاملات الذروة القياسية إذا لم تكن موجودة
  INSERT INTO public.surge_pricing (
    time_period, start_hour, end_hour, days_of_week,
    base_multiplier, demand_multiplier, rides_in_area, active_drivers,
    reason, active
  ) VALUES
  -- الذروة الصباحية (7-9 صباحاً)
  ('peak', 7, 9, ARRAY[1, 2, 3, 4, 5], 1.1, 1.2, 8, 4, 'Morning rush', true),
  
  -- الذروة المسائية (17-19 مساءً)
  ('peak', 17, 19, ARRAY[1, 2, 3, 4, 5], 1.2, 1.3, 10, 4, 'Evening rush', true),
  
  -- ساعات الليل (23-05)
  ('night', 23, 5, ARRAY[1, 2, 3, 4, 5, 6, 7], 1.05, 1.15, 5, 3, 'Late night', true),
  
  -- ساعات الصباح الباكر (5-7)
  ('early_morning', 5, 7, ARRAY[1, 2, 3, 4, 5, 6, 7], 1.0, 1.05, 3, 2, 'Early morning', true),
  
  -- ساعات خارج الذروة (9-17)
  ('off_peak', 9, 17, ARRAY[1, 2, 3, 4, 5], 1.0, 1.0, 5, 6, 'Off-peak', true),
  
  -- نهاية الأسبوع (الجمعة والسبت)
  ('peak', 18, 23, ARRAY[5, 6], 1.35, 1.5, 15, 5, 'Weekend evening', true)
  ON CONFLICT DO NOTHING;
  
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Function: تطبيق Surge في حساب الأجرة
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_surge_to_fare(
  p_base_fare DECIMAL,
  p_distance_fare DECIMAL,
  p_governorate_id UUID,
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION
) RETURNS TABLE (
  final_fare DECIMAL,
  surge_multiplier DECIMAL,
  surge_reason TEXT,
  demand_level TEXT
) AS $$
DECLARE
  v_multiplier DECIMAL;
  v_demand_level TEXT;
  v_rides INT;
  v_drivers INT;
  v_reason TEXT;
  v_final_fare DECIMAL;
BEGIN
  -- احصل على معامل Surge
  SELECT * INTO v_multiplier, v_demand_level, v_rides, v_drivers, v_reason
  FROM public.calculate_surge_multiplier(
    p_governorate_id,
    p_pickup_lat,
    p_pickup_lng
  );
  
  -- احسب الأجرة النهائية
  v_final_fare := (p_base_fare + p_distance_fare) * v_multiplier;
  
  -- تسجيل في السجل
  INSERT INTO public.dynamic_pricing_history (
    base_fare, distance_fare, surge_multiplier, final_fare,
    surge_reason, demand_level, rides_in_area, available_drivers
  ) VALUES (
    p_base_fare, p_distance_fare, v_multiplier, v_final_fare,
    v_reason, v_demand_level, v_rides, v_drivers
  );
  
  RETURN QUERY SELECT v_final_fare, v_multiplier, v_reason, v_demand_level;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. إنشاء Indices لتحسين الأداء
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_surge_pricing_governorate ON public.surge_pricing(governorate_id);
CREATE INDEX IF NOT EXISTS idx_surge_pricing_time_period ON public.surge_pricing(time_period);
CREATE INDEX IF NOT EXISTS idx_surge_pricing_active ON public.surge_pricing(active);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_ride_id ON public.dynamic_pricing_history(ride_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_created_at ON public.dynamic_pricing_history(created_at);

-- ============================================================================
-- 7. Trigger: تحديث معاملات Surge افتراضياً عند بدء Deployment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.init_surge_pricing()
RETURNS void AS $$
BEGIN
  PERFORM public.update_default_surge_pricing();
END;
$$ LANGUAGE plpgsql;

-- تشغيل التهيئة
SELECT public.init_surge_pricing();

-- ============================================================================
-- اختبار:
-- SELECT * FROM public.calculate_surge_multiplier(
--   (SELECT id FROM public.governorates LIMIT 1),
--   33.3156,
--   44.3661
-- );
-- ============================================================================
