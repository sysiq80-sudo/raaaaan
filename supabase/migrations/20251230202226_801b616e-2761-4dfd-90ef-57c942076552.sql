-- إعداد إظهار السائقين للراكب (التلقائي: مخفي)
INSERT INTO app_settings (key, value, description)
VALUES ('show_drivers_to_riders', 'false', 'إظهار السائقين الحقيقيين على خريطة الراكب')
ON CONFLICT (key) DO NOTHING;

-- إعداد إظهار السائقين الوهميين
INSERT INTO app_settings (key, value, description)
VALUES ('show_fake_drivers', 'false', 'إظهار السائقين الوهميين على خريطة الراكب')
ON CONFLICT (key) DO NOTHING;

-- جدول السائقين الوهميين
CREATE TABLE IF NOT EXISTS fake_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'سائق',
  vehicle_type vehicle_type NOT NULL DEFAULT 'economy',
  location JSONB NOT NULL,
  rating NUMERIC DEFAULT 4.8,
  vehicle_model TEXT DEFAULT 'تويوتا كورولا',
  vehicle_color TEXT DEFAULT 'أبيض',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE fake_drivers ENABLE ROW LEVEL SECURITY;

-- سياسة للمشرفين لإدارة السائقين الوهميين
CREATE POLICY "Admins can manage fake drivers"
ON fake_drivers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسة للقراءة العامة للسائقين النشطين
CREATE POLICY "Anyone can view active fake drivers"
ON fake_drivers FOR SELECT
USING (is_active = true);