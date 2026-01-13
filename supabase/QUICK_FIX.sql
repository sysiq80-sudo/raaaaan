-- ===================================
-- إصلاح سريع - شغّل هذا أولاً
-- ===================================

-- 1. إزالة القيد الخارجي إذا وجد
ALTER TABLE landmarks DROP CONSTRAINT IF EXISTS landmarks_governorate_id_fkey;

-- 2. إنشاء جدول المحافظات
CREATE TABLE IF NOT EXISTS governorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100),
  code VARCHAR(10) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. حذف البيانات القديمة وإدراج المحافظات
DELETE FROM governorates;
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
  ('السليمانية', 'Sulaymaniyah', 'SLM');

-- 4. إضافة عمود governorate_id للمعالم
ALTER TABLE landmarks ADD COLUMN IF NOT EXISTS governorate_id UUID;

-- 5. تفعيل RLS
ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;

-- 6. سياسة القراءة للجميع
DROP POLICY IF EXISTS "governorates_read_all" ON governorates;
CREATE POLICY "governorates_read_all" ON governorates FOR SELECT USING (true);

-- 7. سياسة الكتابة للأدمن فقط
DROP POLICY IF EXISTS "governorates_admin_all" ON governorates;
CREATE POLICY "governorates_admin_all" ON governorates FOR ALL 
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- تم ✅
SELECT 'تم إنشاء جدول المحافظات بنجاح - يوجد ' || COUNT(*) || ' محافظة' AS result 
FROM governorates;
