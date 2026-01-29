-- ==========================================
-- 🚗 نظام رفع صور السيارة
-- ==========================================

CREATE TABLE IF NOT EXISTS vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- نوع الصورة
  photo_type TEXT NOT NULL CHECK (photo_type IN (
    'front',         -- واجهة أمامية
    'back',          -- واجهة خلفية
    'left_side',     -- جانب أيسر
    'right_side',    -- جانب أيمن
    'interior',      -- داخلية
    'license_plate', -- لوحة الترخيص
    'inspection',    -- فحص فني
    'insurance'      -- تأمين
  )),
  
  -- رابط الصورة
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- الحالة
  is_verified BOOLEAN DEFAULT false,
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- البيانات الوصفية
  file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  
  -- التواريخ
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- للمستندات ذات صلاحية محددة
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- الفهارس
CREATE INDEX idx_vehicle_photos_driver_id ON vehicle_photos(driver_id);
CREATE INDEX idx_vehicle_photos_type ON vehicle_photos(photo_type);
CREATE INDEX idx_vehicle_photos_verified ON vehicle_photos(is_verified);

-- ==========================================
-- 📞 نظام الاتصال الطارئ
-- ==========================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'driver')),
  
  -- معلومات جهة الاتصال
  contact_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  relationship TEXT, -- صديق، عائلة، زميل، إلخ
  
  -- الأولوية (1 = الأعلى)
  priority_order INTEGER DEFAULT 1,
  
  -- التفعيل
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, phone_number)
);

-- سجل مكالمات الطوارئ
CREATE TABLE IF NOT EXISTS emergency_alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  
  -- معلومات الطوارئ
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'sos',              -- طوارئ عامة
    'accident',         -- حادث
    'safety_concern',   -- مخاوف أمنية
    'medical',          -- طوارئ طبية
    'breakdown'         -- عطل مركبة
  )),
  
  -- الموقع وقت الإرسال
  location JSONB,
  
  -- جهات الاتصال التي تم إشعارها
  notified_contacts JSONB DEFAULT '[]'::jsonb,
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',      -- نشط
    'resolved',    -- تم الحل
    'cancelled'    -- ملغي
  )),
  
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- 🔔 تحسينات نظام الإشعارات
-- ==========================================

-- إنشاء جدول notifications إن لم يكن موجوداً
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- إعدادات الإشعارات للمستخدم
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- تفعيل حسب النوع
  ride_updates BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT true,
  system_alerts BOOLEAN DEFAULT true,
  chat_messages BOOLEAN DEFAULT true,
  earnings BOOLEAN DEFAULT true,
  
  -- Push Notifications
  push_enabled BOOLEAN DEFAULT true,
  push_token TEXT,
  push_platform TEXT CHECK (push_platform IN ('fcm', 'apns', null)),
  
  -- الصوت والاهتزاز
  sound_enabled BOOLEAN DEFAULT true,
  vibration_enabled BOOLEAN DEFAULT true,
  
  -- ساعات الهدوء (لا إشعارات)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- اللغة المفضلة للإشعارات
  notification_language TEXT DEFAULT 'ar' CHECK (notification_language IN ('ar', 'en', 'ku')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- جدول محسّن للإشعارات
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
    'ride',
    'payment',
    'system',
    'promo',
    'chat',
    'alert'
  )),
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- فهرس للإشعارات غير المقروءة
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority, created_at DESC);

-- ==========================================
-- Row Level Security
-- ==========================================

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- vehicle_photos: السائق يرى صوره فقط
CREATE POLICY "drivers_own_vehicle_photos" ON vehicle_photos
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- emergency_contacts: المستخدم يدير جهات اتصاله
CREATE POLICY "users_own_emergency_contacts" ON emergency_contacts
  FOR ALL USING (user_id = auth.uid());

-- emergency_alerts_log: المستخدم يرى سجله
CREATE POLICY "users_own_emergency_alerts" ON emergency_alerts_log
  FOR ALL USING (user_id = auth.uid());

-- notification_preferences: المستخدم يدير إعداداته
CREATE POLICY "users_own_notification_prefs" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- TODO: Admin policies
-- CREATE POLICY "admin_sees_all_vehicle_photos" ON vehicle_photos FOR SELECT USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ==========================================
-- الدوال المساعدة
-- ==========================================

-- حذف الدوال القديمة إن وجدت
DROP FUNCTION IF EXISTS trigger_emergency_alert(UUID, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS mark_notifications_as_read(UUID, UUID[]);

-- دالة: إرسال تنبيه طوارئ
CREATE OR REPLACE FUNCTION trigger_emergency_alert(
  p_user_id UUID,
  p_alert_type TEXT,
  p_location JSONB DEFAULT NULL,
  p_ride_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
  v_contacts JSONB;
BEGIN
  -- الحصول على جهات الاتصال النشطة
  SELECT jsonb_agg(jsonb_build_object(
    'name', contact_name,
    'phone', phone_number,
    'relationship', relationship
  ))
  INTO v_contacts
  FROM emergency_contacts
  WHERE user_id = p_user_id
  AND is_active = true
  ORDER BY priority_order;
  
  -- إنشاء التنبيه
  INSERT INTO emergency_alerts_log (
    user_id,
    ride_id,
    alert_type,
    location,
    notified_contacts,
    status
  ) VALUES (
    p_user_id,
    p_ride_id,
    p_alert_type,
    p_location,
    COALESCE(v_contacts, '[]'::jsonb),
    'active'
  )
  RETURNING id INTO v_alert_id;
  
  -- TODO: إرسال SMS/Push لجهات الاتصال هنا
  
  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة: وضع علامة "مقروء" على الإشعارات
CREATE OR REPLACE FUNCTION mark_notifications_as_read(p_user_id UUID, p_notification_ids UUID[] DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- تحديد الكل
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = p_user_id
    AND read_at IS NULL;
  ELSE
    -- تحديد محددة
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids)
    AND read_at IS NULL;
  END IF;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Triggers
-- ==========================================

-- دالة تحديث updated_at (إن لم تكن موجودة)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_emergency_contacts_timestamp
  BEFORE UPDATE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- التعليقات
-- ==========================================

COMMENT ON TABLE vehicle_photos IS 'صور المركبة من زوايا مختلفة للتحقق';
COMMENT ON TABLE emergency_contacts IS 'جهات الاتصال للطوارئ (صديق/عائلة)';
COMMENT ON TABLE emergency_alerts_log IS 'سجل تنبيهات SOS المرسلة';
COMMENT ON TABLE notification_preferences IS 'إعدادات الإشعارات المفصلة لكل مستخدم';

COMMENT ON FUNCTION trigger_emergency_alert IS 'إرسال تنبيه طوارئ لجميع جهات الاتصال المسجلة';
COMMENT ON FUNCTION mark_notifications_as_read IS 'وضع علامة مقروء على إشعارات محددة أو الكل';
