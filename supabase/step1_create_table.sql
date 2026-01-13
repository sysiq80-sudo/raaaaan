-- خطوة 1 فقط: إنشاء الجدول
-- انسخ هذا السكشن لوحده وشغله أولاً

CREATE TABLE IF NOT EXISTS governorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100),
  code VARCHAR(10) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
