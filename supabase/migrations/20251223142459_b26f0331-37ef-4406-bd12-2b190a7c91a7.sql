-- جدول قواعد تسعير ساعات الذروة
CREATE TABLE surge_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  day_of_week INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6], -- أيام الأسبوع (0=أحد)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  surge_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  commission_bonus NUMERIC DEFAULT 0, -- زيادة العمولة أثناء الذروة
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- جدول خطط الاشتراك
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30,
  price INTEGER NOT NULL,
  commission_discount NUMERIC NOT NULL DEFAULT 0, -- نسبة الخصم من العمولة
  max_commission_rate NUMERIC, -- أقصى عمولة للمشترك
  priority_rides BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- جدول اشتراكات السائقين
CREATE TABLE driver_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  payment_method TEXT,
  amount_paid INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- جدول مستويات العمولة المتدرجة
CREATE TABLE commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  min_rides_monthly INTEGER DEFAULT 0,
  min_rating NUMERIC DEFAULT 0,
  commission_discount NUMERIC NOT NULL DEFAULT 0,
  badge_icon TEXT DEFAULT '🥉',
  badge_color TEXT DEFAULT '#CD7F32',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إضافة إعدادات التسعير
INSERT INTO app_settings (key, value, description)
VALUES ('fare_calculation', jsonb_build_object(
  'service_fee_percentage', 5,
  'min_service_fee', 500,
  'surge_pricing_enabled', true,
  'max_surge_multiplier', 3.0,
  'subscription_discounts_enabled', true,
  'tier_discounts_enabled', true
), 'إعدادات حساب الأجرة والعمولات')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- بيانات افتراضية لمستويات العمولة
INSERT INTO commission_tiers (name_ar, name_en, min_rides_monthly, min_rating, commission_discount, badge_icon, badge_color, priority) VALUES
('برونزي', 'Bronze', 0, 4.0, 0, '🥉', '#CD7F32', 1),
('فضي', 'Silver', 50, 4.3, 2, '🥈', '#C0C0C0', 2),
('ذهبي', 'Gold', 100, 4.5, 5, '🥇', '#FFD700', 3),
('بلاتيني', 'Platinum', 200, 4.7, 8, '💎', '#E5E4E2', 4),
('ماسي', 'Diamond', 300, 4.9, 12, '👑', '#B9F2FF', 5);

-- بيانات افتراضية لخطط الاشتراك
INSERT INTO subscription_plans (name_ar, name_en, description_ar, duration_days, price, commission_discount, priority_rides, sort_order) VALUES
('شهري', 'Monthly', 'اشتراك شهري مع خصم 3% على العمولة', 30, 25000, 3, false, 1),
('ربع سنوي', 'Quarterly', 'اشتراك 3 أشهر مع خصم 5% على العمولة', 90, 60000, 5, true, 2),
('سنوي', 'Yearly', 'اشتراك سنوي مع خصم 8% على العمولة وأولوية الطلبات', 365, 200000, 8, true, 3);

-- بيانات افتراضية لأوقات الذروة
INSERT INTO surge_pricing_rules (name_ar, name_en, day_of_week, start_time, end_time, surge_multiplier, commission_bonus, priority) VALUES
('ذروة الصباح', 'Morning Rush', ARRAY[0,1,2,3,4], '07:00', '09:00', 1.3, 2, 1),
('ذروة المساء', 'Evening Rush', ARRAY[0,1,2,3,4], '16:00', '19:00', 1.5, 3, 2),
('ذروة نهاية الأسبوع', 'Weekend Peak', ARRAY[5,6], '18:00', '23:00', 1.4, 2, 3);

-- تفعيل RLS
ALTER TABLE surge_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_tiers ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لـ surge_pricing_rules
CREATE POLICY "Admins can manage surge pricing" ON surge_pricing_rules
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active surge rules" ON surge_pricing_rules
FOR SELECT USING (is_active = true);

-- سياسات RLS لـ subscription_plans
CREATE POLICY "Admins can manage subscription plans" ON subscription_plans
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active plans" ON subscription_plans
FOR SELECT USING (is_active = true);

-- سياسات RLS لـ driver_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON driver_subscriptions
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers can view their own subscriptions" ON driver_subscriptions
FOR SELECT USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can create their own subscriptions" ON driver_subscriptions
FOR INSERT WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- سياسات RLS لـ commission_tiers
CREATE POLICY "Admins can manage commission tiers" ON commission_tiers
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active tiers" ON commission_tiers
FOR SELECT USING (is_active = true);

-- دالة لحساب مستوى السائق
CREATE OR REPLACE FUNCTION get_driver_commission_tier(p_driver_id UUID)
RETURNS TABLE(tier_id UUID, tier_name_ar TEXT, commission_discount NUMERIC, badge_icon TEXT, badge_color TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_monthly_rides INTEGER;
  v_rating NUMERIC;
BEGIN
  -- حساب عدد الرحلات في الشهر الحالي
  SELECT COUNT(*) INTO v_monthly_rides
  FROM rides
  WHERE driver_id = p_driver_id
    AND status = 'completed'
    AND completed_at >= date_trunc('month', CURRENT_DATE);
  
  -- جلب تقييم السائق
  SELECT COALESCE(d.rating, 5.0) INTO v_rating
  FROM drivers d
  WHERE d.id = p_driver_id;
  
  -- إرجاع أعلى مستوى مؤهل له
  RETURN QUERY
  SELECT ct.id, ct.name_ar, ct.commission_discount, ct.badge_icon, ct.badge_color
  FROM commission_tiers ct
  WHERE ct.is_active = true
    AND ct.min_rides_monthly <= v_monthly_rides
    AND ct.min_rating <= v_rating
  ORDER BY ct.priority DESC
  LIMIT 1;
END;
$$;

-- دالة للحصول على اشتراك السائق النشط
CREATE OR REPLACE FUNCTION get_active_driver_subscription(p_driver_id UUID)
RETURNS TABLE(subscription_id UUID, plan_name_ar TEXT, commission_discount NUMERIC, priority_rides BOOLEAN, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT ds.id, sp.name_ar, sp.commission_discount, sp.priority_rides, ds.expires_at
  FROM driver_subscriptions ds
  JOIN subscription_plans sp ON ds.plan_id = sp.id
  WHERE ds.driver_id = p_driver_id
    AND ds.status = 'active'
    AND ds.expires_at > now()
  ORDER BY ds.expires_at DESC
  LIMIT 1;
END;
$$;

-- دالة للحصول على معامل الذروة الحالي
CREATE OR REPLACE FUNCTION get_current_surge_multiplier(p_region_id UUID DEFAULT NULL)
RETURNS TABLE(surge_multiplier NUMERIC, commission_bonus NUMERIC, rule_name_ar TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_time TIME;
  v_current_day INTEGER;
BEGIN
  v_current_time := CURRENT_TIME;
  v_current_day := EXTRACT(DOW FROM CURRENT_DATE)::INTEGER;
  
  RETURN QUERY
  SELECT spr.surge_multiplier, spr.commission_bonus, spr.name_ar
  FROM surge_pricing_rules spr
  WHERE spr.is_active = true
    AND v_current_day = ANY(spr.day_of_week)
    AND v_current_time >= spr.start_time
    AND v_current_time <= spr.end_time
    AND (spr.region_id IS NULL OR spr.region_id = p_region_id)
  ORDER BY spr.priority DESC
  LIMIT 1;
END;
$$;