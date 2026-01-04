-- جدول الأماكن المفضلة للمستخدمين
CREATE TABLE IF NOT EXISTS user_favorite_places (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS user_favorite_places_user_id_idx ON user_favorite_places(user_id);
CREATE INDEX IF NOT EXISTS user_favorite_places_usage_count_idx ON user_favorite_places(usage_count DESC);

-- جدول مشاركة الرحلات
CREATE TABLE IF NOT EXISTS ride_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_location JSONB,
  pickup_location JSONB NOT NULL,
  dropoff_location JSONB NOT NULL,
  estimated_fare INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  view_count INTEGER DEFAULT 0
);

-- فهرس لتحسين الأداء والتنظيف
CREATE INDEX IF NOT EXISTS ride_shares_ride_id_idx ON ride_shares(ride_id);
CREATE INDEX IF NOT EXISTS ride_shares_expires_at_idx ON ride_shares(expires_at);

-- دالة تنظيف الروابط المنتهية الصلاحية
CREATE OR REPLACE FUNCTION cleanup_expired_ride_shares()
RETURNS void AS $$
BEGIN
  DELETE FROM ride_shares
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- تعليق الجدول الأساسي للأماكن المفضلة
COMMENT ON TABLE user_favorite_places IS 'تخزين الأماكن المفضلة للمستخدمين مع عدد مرات الاستخدام';
COMMENT ON TABLE ride_shares IS 'روابط مشاركة الرحلات للمستخدمين الآخرين';

-- التحكم في الوصول (RLS)
ALTER TABLE user_favorite_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_shares ENABLE ROW LEVEL SECURITY;

-- سياسة قراءة الأماكن المفضلة (يرى كل مستخدم أماكنه فقط)
CREATE POLICY "Users can view their own favorite places"
ON user_favorite_places FOR SELECT
USING (auth.uid() = user_id);

-- سياسة إنشاء الأماكن المفضلة
CREATE POLICY "Users can create favorite places"
ON user_favorite_places FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- سياسة تحديث الأماكن المفضلة
CREATE POLICY "Users can update their own favorite places"
ON user_favorite_places FOR UPDATE
USING (auth.uid() = user_id);

-- سياسة حذف الأماكن المفضلة
CREATE POLICY "Users can delete their own favorite places"
ON user_favorite_places FOR DELETE
USING (auth.uid() = user_id);
