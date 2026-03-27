-- Migration: إنشاء جدول تنبيهات التأخير
-- التاريخ: 2026-01-29
-- الوصف: جدول لتتبع وتسجيل تنبيهات التأخير أثناء الرحلات

-- إنشاء جدول delay_alerts
CREATE TABLE IF NOT EXISTS delay_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- معلومات التأخير
  estimated_arrival_minutes INTEGER NOT NULL, -- الوقت المتوقع للوصول
  actual_delay_minutes INTEGER NOT NULL, -- التأخير الفعلي بالدقائق
  ride_status TEXT NOT NULL CHECK (ride_status IN ('accepted', 'arrived', 'in_progress')),
  
  -- المواقع وقت التنبيه
  driver_location JSONB NOT NULL,
  target_location JSONB NOT NULL,
  
  -- التوقيتات
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_delay_alerts_ride_id ON delay_alerts(ride_id);
CREATE INDEX IF NOT EXISTS idx_delay_alerts_driver_id ON delay_alerts(driver_id);
CREATE INDEX IF NOT EXISTS idx_delay_alerts_rider_id ON delay_alerts(rider_id);
CREATE INDEX IF NOT EXISTS idx_delay_alerts_created_at ON delay_alerts(created_at DESC);

-- RLS Policies
ALTER TABLE delay_alerts ENABLE ROW LEVEL SECURITY;

-- السائق يرى تنبيهاته فقط
CREATE POLICY "drivers_see_own_delay_alerts"
  ON delay_alerts
  FOR SELECT
  USING (driver_id = auth.uid());

-- الراكب يرى تنبيهاته فقط
CREATE POLICY "riders_see_own_delay_alerts"
  ON delay_alerts
  FOR SELECT
  USING (rider_id = auth.uid());

-- Admin يرى كل التنبيهات (TODO: تفعيل بعد إنشاء جدول admin_users)
-- CREATE POLICY "admins_see_all_delay_alerts"
--   ON delay_alerts
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM admin_users
--       WHERE admin_users.user_id = auth.uid()
--         AND admin_users.role IN ('super_admin', 'admin')
--     )
--   );

-- النظام يمكنه الإدراج
CREATE POLICY "system_can_insert_delay_alerts"
  ON delay_alerts
  FOR INSERT
  WITH CHECK (true);

-- دالة RPC لإنشاء الجدول (للاستخدام من التطبيق)
CREATE OR REPLACE FUNCTION create_delay_alerts_table()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- الجدول موجود بالفعل، لا حاجة لعمل شيء
  RETURN true;
END;
$$;

-- إضافة حقل has_profile_photo لجدول drivers (إذا لم يكن موجوداً)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'has_profile_photo'
  ) THEN
    ALTER TABLE drivers ADD COLUMN has_profile_photo BOOLEAN DEFAULT false;
    
    -- تحديث القيم الحالية بناءً على profile_image_url
    UPDATE drivers 
    SET has_profile_photo = true 
    WHERE profile_image_url IS NOT NULL 
      AND profile_image_url != '';
  END IF;
END $$;

-- إضافة comment لتوضيح الجدول
COMMENT ON TABLE delay_alerts IS 'جدول تنبيهات التأخير - يسجل حالات تأخر السائقين عن الوقت المتوقع';
COMMENT ON COLUMN delay_alerts.estimated_arrival_minutes IS 'الوقت المتوقع للوصول بالدقائق';
COMMENT ON COLUMN delay_alerts.actual_delay_minutes IS 'التأخير الفعلي بالدقائق';
COMMENT ON COLUMN delay_alerts.ride_status IS 'حالة الرحلة عند التنبيه: accepted (في الطريق للراكب), arrived (وصل متأخر), in_progress (الرحلة تستغرق وقتاً أطول)';
