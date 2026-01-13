-- ===================================
-- 🔧 السكربت الشامل لإصلاح نظام المعالم
-- ===================================
-- يجب تشغيل هذا السكربت في Supabase SQL Editor
-- ===================================

-- الخطوة 1: إنشاء جدول المحافظات
-- ===================================
CREATE TABLE IF NOT EXISTS governorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100),
  code VARCHAR(10) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- الخطوة 2: إدراج المحافظات العراقية
-- ===================================
INSERT INTO governorates (name_ar, name_en, code) VALUES
  ('بغداد', 'Baghdad', 'BGW'),
  ('البصرة', 'Basra', 'BSR'),
  ('نينوى', 'Nineveh', 'NIN'),
  ('الأنبار', 'Anbar', 'ANB'),
  ('أربيل', 'Erbil', 'EBL'),
  ('النجف', 'Najaf', 'NJF'),
  ('كربلاء', 'Karbala', 'KRB'),
  ('ديالى', 'Diyala', 'DIY'),
  ('كركوك', 'Kirkuk', 'KRK'),
  ('صلاح الدين', 'Saladin', 'SLD'),
  ('بابل', 'Babylon', 'BBL'),
  ('واسط', 'Wasit', 'WST'),
  ('ذي قار', 'Dhi Qar', 'DHQ'),
  ('ميسان', 'Maysan', 'MYS'),
  ('المثنى', 'Muthanna', 'MTH'),
  ('القادسية', 'Qadisiyah', 'QDS'),
  ('دهوك', 'Duhok', 'DHK'),
  ('السليمانية', 'Sulaymaniyah', 'SLM')
ON CONFLICT (name_ar) DO NOTHING;

-- الخطوة 3: إضافة عمود المحافظة للمعالم
-- ===================================
ALTER TABLE landmarks DROP CONSTRAINT IF EXISTS landmarks_governorate_id_fkey;
ALTER TABLE landmarks ADD COLUMN IF NOT EXISTS governorate_id UUID;

-- الخطوة 4: تفعيل RLS على المحافظات
-- ===================================
ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governorates_read_all" ON governorates;
CREATE POLICY "governorates_read_all" 
ON governorates FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "governorates_admin_all" ON governorates;
CREATE POLICY "governorates_admin_all" 
ON governorates FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- الخطوة 5: إصلاح RLS للمعالم
-- ===================================

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Anyone can view active landmarks" ON landmarks;
DROP POLICY IF EXISTS "Admins can manage landmarks" ON landmarks;
DROP POLICY IF EXISTS "landmarks_admin_all" ON landmarks;
DROP POLICY IF EXISTS "landmarks_read_active" ON landmarks;
DROP POLICY IF EXISTS "landmarks_select_active" ON landmarks;
DROP POLICY IF EXISTS "landmarks_select_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_insert_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_update_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_delete_admin" ON landmarks;

-- إنشاء سياسات جديدة واضحة
CREATE POLICY "landmarks_select_active" 
ON landmarks FOR SELECT 
USING (is_active = true);

CREATE POLICY "landmarks_select_admin" 
ON landmarks FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_insert_admin" 
ON landmarks FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_update_admin" 
ON landmarks FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_delete_admin" 
ON landmarks FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- الخطوة 6: إضافة القيد الخارجي
-- ===================================
ALTER TABLE landmarks 
ADD CONSTRAINT landmarks_governorate_id_fkey 
FOREIGN KEY (governorate_id) 
REFERENCES governorates(id) 
ON DELETE SET NULL;

-- الخطوة 7: التحقق من النتائج
-- ===================================
SELECT 
  'المحافظات: ' || COUNT(*) || ' محافظة' AS governorates_count
FROM governorates;

SELECT 
  'المعالم: ' || COUNT(*) || ' معلم' AS landmarks_count
FROM landmarks;

SELECT 
  'السياسات: ' || COUNT(*) || ' سياسة RLS' AS policies_count
FROM pg_policies 
WHERE tablename IN ('landmarks', 'governorates');

-- ✅ تم الحمد لله رب العالمين
SELECT '✅ تم إصلاح نظام المعالم بنجاح' AS result;
