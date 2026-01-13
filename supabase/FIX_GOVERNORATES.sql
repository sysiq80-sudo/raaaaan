-- ======================================
-- إصلاح مشكلة المحافظات - شغّل هذا في Supabase SQL Editor
-- ======================================

-- 1. حذف القيد القديم إن وجد
ALTER TABLE public.landmarks DROP CONSTRAINT IF EXISTS landmarks_governorate_id_fkey;

-- 2. إنشاء جدول المحافظات إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.governorates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_ku TEXT,
    code TEXT NOT NULL,
    capital_city TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. إضافة عمود governorate_id إذا لم يكن موجوداً (بدون foreign key أولاً)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'landmarks' 
                   AND column_name = 'governorate_id') THEN
        ALTER TABLE public.landmarks ADD COLUMN governorate_id UUID;
    END IF;
END $$;

-- 4. RLS للمحافظات
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Anyone can view governorates" ON public.governorates;
DROP POLICY IF EXISTS "Anyone can view active governorates" ON public.governorates;
DROP POLICY IF EXISTS "Admins can manage governorates" ON public.governorates;

-- سياسات جديدة
CREATE POLICY "Anyone can view governorates" ON public.governorates FOR SELECT USING (true);
CREATE POLICY "Admins can manage governorates" ON public.governorates FOR ALL USING (true);

-- 5. حذف البيانات القديمة
TRUNCATE TABLE public.governorates CASCADE;

-- 6. إدخال المحافظات الـ 18
INSERT INTO public.governorates (name_ar, name_en, name_ku, code, capital_city) VALUES
    ('بغداد', 'Baghdad', 'Bexda', 'BG', 'بغداد'),
    ('البصرة', 'Basra', 'Besra', 'BS', 'البصرة'),
    ('نينوى', 'Nineveh', 'Nînewa', 'NI', 'الموصل'),
    ('الأنبار', 'Anbar', 'Enbûr', 'AN', 'الرمادي'),
    ('أربيل', 'Erbil', 'Hewlêr', 'ER', 'أربيل'),
    ('صلاح الدين', 'Saladin', 'Selahedîn', 'SD', 'تكريت'),
    ('ديالى', 'Diyala', 'Diyala', 'DI', 'بعقوبة'),
    ('ذي قار', 'Dhi Qar', 'Zîqar', 'DQ', 'الناصرية'),
    ('واسط', 'Wasit', 'Wasit', 'WA', 'الكوت'),
    ('كركوك', 'Kirkuk', 'Kerkûk', 'KI', 'كركوك'),
    ('بابل', 'Babylon', 'Babil', 'BB', 'الحلة'),
    ('كربلاء', 'Karbala', 'Kerbela', 'KA', 'كربلاء'),
    ('ميسان', 'Maysan', 'Mêsan', 'MA', 'العمارة'),
    ('القادسية', 'Al-Qadisiyyah', 'Qadisiya', 'QA', 'الديوانية'),
    ('النجف', 'Najaf', 'Necef', 'NA', 'النجف'),
    ('المثنى', 'Al Muthanna', 'Musenna', 'MU', 'السماوة'),
    ('دهوك', 'Duhok', 'Dihok', 'DA', 'دهوك'),
    ('السليمانية', 'Sulaymaniyah', 'Silêmanî', 'SU', 'السليمانية');

-- 7. الآن إضافة الـ foreign key
ALTER TABLE public.landmarks 
ADD CONSTRAINT landmarks_governorate_id_fkey 
FOREIGN KEY (governorate_id) REFERENCES public.governorates(id) ON DELETE SET NULL;

-- 8. التحقق
SELECT 'المحافظات تم إنشاؤها بنجاح!' as status, count(*) as count FROM public.governorates;
