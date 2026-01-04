-- المرحلة 1: تحديث جدول notifications_log بأعمدة جديدة للتتبع
ALTER TABLE notifications_log 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_delay_ms INTEGER,
ADD COLUMN IF NOT EXISTS notification_id TEXT;

-- المرحلة 2: إنشاء جدول إحصائيات الإشعارات
CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  notification_type TEXT NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  avg_delivery_delay_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, notification_type)
);

-- المرحلة 4: إنشاء جدول اشتراكات المواضيع
CREATE TABLE IF NOT EXISTS notification_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(driver_id, topic)
);

-- إضافة index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_notification_topics_topic ON notification_topics(topic) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_topics_driver ON notification_topics(driver_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notifications_log_notification_id ON notifications_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_date ON notification_analytics(date DESC);

-- RLS لجدول notification_analytics
ALTER TABLE notification_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage analytics"
ON notification_analytics FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert analytics"
ON notification_analytics FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update analytics"
ON notification_analytics FOR UPDATE
USING (true);

-- RLS لجدول notification_topics
ALTER TABLE notification_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can manage their own topics"
ON notification_topics FOR ALL
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all topics"
ON notification_topics FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Function لتحديث الإحصائيات
CREATE OR REPLACE FUNCTION update_notification_analytics(
  p_notification_type TEXT,
  p_is_sent BOOLEAN DEFAULT false,
  p_is_delivered BOOLEAN DEFAULT false,
  p_is_opened BOOLEAN DEFAULT false,
  p_is_failed BOOLEAN DEFAULT false,
  p_delivery_delay_ms INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_analytics (date, notification_type, total_sent, total_delivered, total_opened, total_failed, avg_delivery_delay_ms)
  VALUES (
    CURRENT_DATE,
    p_notification_type,
    CASE WHEN p_is_sent THEN 1 ELSE 0 END,
    CASE WHEN p_is_delivered THEN 1 ELSE 0 END,
    CASE WHEN p_is_opened THEN 1 ELSE 0 END,
    CASE WHEN p_is_failed THEN 1 ELSE 0 END,
    COALESCE(p_delivery_delay_ms, 0)
  )
  ON CONFLICT (date, notification_type)
  DO UPDATE SET
    total_sent = notification_analytics.total_sent + CASE WHEN p_is_sent THEN 1 ELSE 0 END,
    total_delivered = notification_analytics.total_delivered + CASE WHEN p_is_delivered THEN 1 ELSE 0 END,
    total_opened = notification_analytics.total_opened + CASE WHEN p_is_opened THEN 1 ELSE 0 END,
    total_failed = notification_analytics.total_failed + CASE WHEN p_is_failed THEN 1 ELSE 0 END,
    avg_delivery_delay_ms = CASE 
      WHEN p_delivery_delay_ms IS NOT NULL THEN 
        (notification_analytics.avg_delivery_delay_ms * notification_analytics.total_delivered + p_delivery_delay_ms) / (notification_analytics.total_delivered + 1)
      ELSE notification_analytics.avg_delivery_delay_ms
    END,
    updated_at = now();
END;
$$;