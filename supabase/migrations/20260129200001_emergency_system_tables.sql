-- =====================================================
-- نظام الطوارئ المتقدم - الجداول الأساسية
-- تاريخ الإنشاء: 2026-01-29
-- الوصف: جداول لكشف التوقف المزدوج، تتبع الإساءة، والشكاوى
-- =====================================================

-- 1️⃣ إضافة حقول تتبع موقع الراكب في جدول rides
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS rider_last_location JSONB,
ADD COLUMN IF NOT EXISTS rider_location_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS emergency_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ended_by TEXT CHECK (ended_by IN ('rider', 'driver', 'admin', 'system')),
ADD COLUMN IF NOT EXISTS emergency_end_reason TEXT;

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_rides_emergency_completed ON rides(emergency_completed) WHERE emergency_completed = true;
CREATE INDEX IF NOT EXISTS idx_rides_ended_by ON rides(ended_by) WHERE ended_by IS NOT NULL;

COMMENT ON COLUMN rides.rider_last_location IS 'آخر موقع معروف للراكب أثناء الرحلة';
COMMENT ON COLUMN rides.rider_location_updated_at IS 'وقت آخر تحديث لموقع الراكب';
COMMENT ON COLUMN rides.emergency_completed IS 'هل تم إنهاء الرحلة عبر زر الطوارئ';
COMMENT ON COLUMN rides.ended_by IS 'من أنهى الرحلة (في حالة الطوارئ)';
COMMENT ON COLUMN rides.emergency_end_reason IS 'سبب إنهاء الرحلة عبر الطوارئ';

-- =====================================================
-- 2️⃣ جدول تنبيهات التوقف المزدوج
-- =====================================================
CREATE TABLE IF NOT EXISTS dual_stop_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id),
  rider_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- معلومات التوقف
  driver_last_location JSONB NOT NULL,
  rider_last_location JSONB NOT NULL,
  stop_duration_minutes INTEGER NOT NULL,
  distance_between_meters NUMERIC(8,2),
  
  -- الخطورة والحالة
  alert_severity TEXT NOT NULL CHECK (alert_severity IN ('warning', 'critical')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
  
  -- التنبيهات
  notified_at TIMESTAMPTZ DEFAULT now(),
  rider_acknowledged BOOLEAN DEFAULT FALSE,
  driver_acknowledged BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس
CREATE INDEX idx_dual_stop_alerts_ride_id ON dual_stop_alerts(ride_id);
CREATE INDEX idx_dual_stop_alerts_status ON dual_stop_alerts(status) WHERE status = 'active';
CREATE INDEX idx_dual_stop_alerts_severity ON dual_stop_alerts(alert_severity, created_at DESC);
CREATE INDEX idx_dual_stop_alerts_created_at ON dual_stop_alerts(created_at DESC);

-- RLS
ALTER TABLE dual_stop_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "riders_view_own_alerts" ON dual_stop_alerts
  FOR SELECT USING (rider_id = auth.uid());

CREATE POLICY "drivers_view_own_alerts" ON dual_stop_alerts
  FOR SELECT USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "admins_manage_all_alerts" ON dual_stop_alerts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "system_create_alerts" ON dual_stop_alerts
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE dual_stop_alerts IS 'تنبيهات كشف التوقف المزدوج للسائق والراكب';

-- =====================================================
-- 3️⃣ جدول سجل استخدام الطوارئ
-- =====================================================
CREATE TABLE IF NOT EXISTS emergency_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'driver')),
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  
  -- نوع الاستخدام
  action_type TEXT NOT NULL CHECK (action_type IN ('sos', 'end_ride')),
  reason TEXT,
  
  -- سياق إضافي
  location JSONB,
  device_info TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس
CREATE INDEX idx_emergency_usage_user_id ON emergency_usage_log(user_id, created_at DESC);
CREATE INDEX idx_emergency_usage_action_type ON emergency_usage_log(action_type, created_at DESC);
CREATE INDEX idx_emergency_usage_ride_id ON emergency_usage_log(ride_id) WHERE ride_id IS NOT NULL;

-- RLS
ALTER TABLE emergency_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_log" ON emergency_usage_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_log" ON emergency_usage_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_view_all_log" ON emergency_usage_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE emergency_usage_log IS 'سجل كامل لجميع استخدامات زر الطوارئ';

-- =====================================================
-- 4️⃣ جدول تنبيهات إساءة الاستخدام
-- =====================================================
CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'driver')),
  
  -- نوع التنبيه
  alert_type TEXT NOT NULL CHECK (alert_type IN ('emergency_abuse', 'complaint_spam', 'suspicious_behavior', 'other')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- التفاصيل
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB, -- مثل عدد الاستخدامات، التواريخ، الخ
  
  -- الحالة
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reviewing', 'action_taken', 'dismissed')),
  action_taken TEXT, -- مثل "تعطيل زر الطوارئ 30 يوم"
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ -- تاريخ انتهاء التنبيه/العقوبة
);

-- فهارس
CREATE INDEX idx_user_alerts_user_id ON user_alerts(user_id, status);
CREATE INDEX idx_user_alerts_status ON user_alerts(status, severity) WHERE status = 'active';
CREATE INDEX idx_user_alerts_type ON user_alerts(alert_type, created_at DESC);
CREATE INDEX idx_user_alerts_expires ON user_alerts(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_alerts" ON user_alerts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_manage_alerts" ON user_alerts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "system_create_alerts" ON user_alerts
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE user_alerts IS 'تنبيهات إساءة الاستخدام والسلوكيات المشبوهة';

-- =====================================================
-- 5️⃣ دالة للتحقق من إساءة استخدام الطوارئ
-- =====================================================
CREATE OR REPLACE FUNCTION check_emergency_abuse(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage_count INTEGER;
  v_alert_exists BOOLEAN;
  v_result JSON;
BEGIN
  -- حساب عدد استخدامات "إنهاء الرحلة" في آخر 7 أيام
  SELECT COUNT(*)
  INTO v_usage_count
  FROM emergency_usage_log
  WHERE user_id = p_user_id
    AND action_type = 'end_ride'
    AND created_at >= now() - INTERVAL '7 days';
  
  -- التحقق من وجود تنبيه نشط
  SELECT EXISTS(
    SELECT 1 FROM user_alerts
    WHERE user_id = p_user_id
      AND alert_type = 'emergency_abuse'
      AND status = 'active'
  ) INTO v_alert_exists;
  
  -- إذا >3 مرات ولا يوجد تنبيه، إنشاء تنبيه جديد
  IF v_usage_count > 3 AND NOT v_alert_exists THEN
    INSERT INTO user_alerts (
      user_id,
      user_type,
      alert_type,
      severity,
      title,
      description,
      evidence,
      status
    )
    SELECT
      p_user_id,
      CASE WHEN EXISTS(SELECT 1 FROM drivers WHERE user_id = p_user_id) THEN 'driver' ELSE 'rider' END,
      'emergency_abuse',
      'high',
      'استخدام مفرط لزر الطوارئ',
      format('تم استخدام زر إنهاء الرحلة %s مرات في آخر 7 أيام', v_usage_count),
      json_build_object(
        'usage_count', v_usage_count,
        'period_days', 7,
        'threshold', 3
      ),
      'active';
  END IF;
  
  v_result := json_build_object(
    'usage_count', v_usage_count,
    'threshold_exceeded', v_usage_count > 3,
    'alert_exists', v_alert_exists OR (v_usage_count > 3)
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION check_emergency_abuse(UUID) TO authenticated;

COMMENT ON FUNCTION check_emergency_abuse IS 'التحقق من إساءة استخدام زر الطوارئ وإنشاء تنبيه إذا لزم';

-- =====================================================
-- 6️⃣ دالة لتحديث موقع الراكب في الرحلة
-- =====================================================
CREATE OR REPLACE FUNCTION update_rider_location_in_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- تحديث موقع الراكب في الرحلة النشطة إذا وُجدت
  UPDATE rides
  SET 
    rider_last_location = NEW.current_location,
    rider_location_updated_at = now()
  WHERE 
    rider_id = NEW.user_id
    AND status IN ('accepted', 'arrived', 'in_progress')
    AND NEW.current_location IS NOT NULL;
  
  RETURN NEW;
END;
$$;

-- Trigger لتحديث موقع الراكب تلقائياً
DROP TRIGGER IF EXISTS trigger_update_rider_location ON profiles;
CREATE TRIGGER trigger_update_rider_location
  AFTER UPDATE OF current_location ON profiles
  FOR EACH ROW
  WHEN (NEW.current_location IS DISTINCT FROM OLD.current_location)
  EXECUTE FUNCTION update_rider_location_in_ride();

COMMENT ON FUNCTION update_rider_location_in_ride IS 'تحديث موقع الراكب في الرحلة النشطة تلقائياً';

-- =====================================================
-- 7️⃣ إعدادات النظام
-- =====================================================
INSERT INTO app_settings (key, value, description) VALUES
  ('dual_stop_detection_interval', '5', 'مدة التوقف بالدقائق قبل إرسال تنبيه (default: 5 min)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES
  ('dual_stop_distance_threshold', '50', 'المسافة القصوى بالأمتار لاعتبار التوقف مزدوجاً (default: 50m)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES
  ('emergency_abuse_limit', '3', 'الحد الأقصى لاستخدامات إنهاء الرحلة في أسبوع (default: 3)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES
  ('dual_stop_critical_threshold', '10', 'مدة التوقف بالدقائق لاعتبار الحالة حرجة (default: 10 min)')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- ✅ اكتمل إنشاء جداول نظام الطوارئ
-- =====================================================
