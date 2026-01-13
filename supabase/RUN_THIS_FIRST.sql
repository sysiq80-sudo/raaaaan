-- ======================================
-- نظام المحافظات العراقية - شغّل هذا في Supabase SQL Editor
-- ======================================

-- 1. إنشاء جدول المحافظات
CREATE TABLE IF NOT EXISTS public.governorates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_ku TEXT,
    code TEXT NOT NULL,
    capital_city TEXT,
    population INTEGER,
    area_km2 INTEGER,
    coordinates JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. إضافة عمود المحافظة إلى جدول landmarks
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'landmarks' AND column_name = 'governorate_id') THEN
        ALTER TABLE public.landmarks ADD COLUMN governorate_id UUID;
    END IF;
END $$;

-- 3. RLS للمحافظات
ALTER TABLE public.governorates ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Anyone can view governorates" ON public.governorates;
DROP POLICY IF EXISTS "Admins can manage governorates" ON public.governorates;

-- إنشاء سياسات جديدة
CREATE POLICY "Anyone can view governorates"
    ON public.governorates FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage governorates"
    ON public.governorates FOR ALL
    USING (true);

-- 4. حذف البيانات القديمة وإدخال المحافظات
DELETE FROM public.governorates;

INSERT INTO public.governorates (name_ar, name_en, name_ku, code, capital_city, population, area_km2, coordinates) VALUES
    ('بغداد', 'Baghdad', 'Bexda', 'BG', 'بغداد', 8000000, 4555, '{"lat": 33.3152, "lng": 44.3661}'),
    ('البصرة', 'Basra', 'Besra', 'BS', 'البصرة', 2500000, 19070, '{"lat": 30.5085, "lng": 47.7836}'),
    ('نينوى', 'Nineveh', 'Nînewa', 'NI', 'الموصل', 3700000, 37323, '{"lat": 36.3350, "lng": 43.1189}'),
    ('الأنبار', 'Anbar', 'Enbûr', 'AN', 'الرمادي', 1600000, 138501, '{"lat": 33.4260, "lng": 43.2960}'),
    ('أربيل', 'Erbil', 'Hewlêr', 'ER', 'أربيل', 1900000, 15074, '{"lat": 36.1913, "lng": 44.0092}'),
    ('صلاح الدين', 'Saladin', 'Selahedîn', 'SD', 'تكريت', 1400000, 24751, '{"lat": 34.6097, "lng": 43.6782}'),
    ('ديالى', 'Diyala', 'Diyala', 'DI', 'بعقوبة', 1500000, 17685, '{"lat": 33.7481, "lng": 44.6358}'),
    ('ذي قار', 'Dhi Qar', 'Zîqar', 'DQ', 'الناصرية', 1800000, 12900, '{"lat": 31.0437, "lng": 46.2578}'),
    ('واسط', 'Wasit', 'Wasit', 'WA', 'الكوت', 1200000, 17153, '{"lat": 32.5129, "lng": 45.8189}'),
    ('كركوك', 'Kirkuk', 'Kerkûk', 'KI', 'كركوك', 1400000, 9679, '{"lat": 35.4681, "lng": 44.3922}'),
    ('بابل', 'Babylon', 'Babil', 'BB', 'الحلة', 1800000, 5119, '{"lat": 32.4632, "lng": 44.4207}'),
    ('كربلاء', 'Karbala', 'Kerbela', 'KA', 'كربلاء', 1000000, 5034, '{"lat": 32.6160, "lng": 44.0245}'),
    ('ميسان', 'Maysan', 'Mêsan', 'MA', 'العمارة', 900000, 16072, '{"lat": 31.8420, "lng": 47.1448}'),
    ('القادسية', 'Al-Qadisiyyah', 'Qadisiya', 'QA', 'الديوانية', 1100000, 8153, '{"lat": 31.9926, "lng": 44.9346}'),
    ('النجف', 'Najaf', 'Necef', 'NA', 'النجف', 1200000, 28824, '{"lat": 31.9996, "lng": 44.3315}'),
    ('المثنى', 'Al Muthanna', 'Musenna', 'MU', 'السماوة', 700000, 51740, '{"lat": 31.3159, "lng": 45.2936}'),
    ('دهوك', 'Duhok', 'Dihok', 'DA', 'دهوك', 1200000, 10955, '{"lat": 36.8670, "lng": 42.9963}'),
    ('السليمانية', 'Sulaymaniyah', 'Silêmanî', 'SU', 'السليمانية', 1900000, 17023, '{"lat": 35.5550, "lng": 45.4332}');

-- 5. التحقق من النتيجة
SELECT name_ar, code FROM public.governorates ORDER BY name_ar;
