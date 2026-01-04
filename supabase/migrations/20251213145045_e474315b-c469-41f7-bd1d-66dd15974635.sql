-- Deactivate Baghdad regions
UPDATE public.regions SET is_active = false WHERE name_ar LIKE '%بغداد%' OR name_ar LIKE '%كرادة%' OR name_ar LIKE '%منصور%' OR name_ar LIKE '%كاظمية%' OR name_ar LIKE '%أعظمية%';

-- Deactivate Baghdad landmarks
UPDATE public.landmarks SET is_active = false WHERE name_ar LIKE '%بغداد%' OR name_ar LIKE '%كرادة%' OR name_ar LIKE '%منصور%' OR name_ar LIKE '%كاظمية%';

-- Insert Anbar regions
INSERT INTO public.regions (name_ar, name_en, name_ku, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES 
  ('الرمادي', 'Ramadi', 'ڕامادی', 2000, 500, 100, true, '{"lat": 33.4262, "lng": 43.2954}'),
  ('الفلوجة', 'Fallujah', 'فەلوجە', 2500, 600, 120, true, '{"lat": 33.3530, "lng": 43.7820}'),
  ('هيت', 'Hit', 'هیت', 2000, 500, 100, true, '{"lat": 33.6400, "lng": 42.8200}'),
  ('حديثة', 'Haditha', 'حەدیسە', 2200, 550, 110, true, '{"lat": 34.1369, "lng": 42.3780}'),
  ('عنة', 'Anah', 'عانە', 2000, 500, 100, true, '{"lat": 34.3720, "lng": 41.9850}'),
  ('راوة', 'Rawa', 'ڕاوە', 1800, 450, 90, true, '{"lat": 34.4790, "lng": 41.9170}'),
  ('القائم', 'Al-Qaim', 'قائم', 2000, 500, 100, true, '{"lat": 34.3760, "lng": 41.0540}'),
  ('الحبانية', 'Habbaniyah', 'حەبانییە', 1800, 450, 90, true, '{"lat": 33.3680, "lng": 43.5630}'),
  ('الخالدية', 'Khalidiyah', 'خالدییە', 1800, 450, 90, true, '{"lat": 33.4120, "lng": 43.6580}')
ON CONFLICT DO NOTHING;

-- Get the region IDs for landmarks
DO $$
DECLARE
  ramadi_id uuid;
  fallujah_id uuid;
  haditha_id uuid;
  habbaniyah_id uuid;
BEGIN
  SELECT id INTO ramadi_id FROM public.regions WHERE name_ar = 'الرمادي' LIMIT 1;
  SELECT id INTO fallujah_id FROM public.regions WHERE name_ar = 'الفلوجة' LIMIT 1;
  SELECT id INTO haditha_id FROM public.regions WHERE name_ar = 'حديثة' LIMIT 1;
  SELECT id INTO habbaniyah_id FROM public.regions WHERE name_ar = 'الحبانية' LIMIT 1;

  -- Insert Anbar landmarks
  INSERT INTO public.landmarks (name_ar, name_en, category, region_id, location, is_active)
  VALUES 
    ('جامعة الأنبار', 'Anbar University', 'جامعة', ramadi_id, '{"lat": 33.4310, "lng": 43.2820}', true),
    ('مستشفى الرمادي العام', 'Ramadi General Hospital', 'مستشفى', ramadi_id, '{"lat": 33.4280, "lng": 43.2900}', true),
    ('سوق الرمادي المركزي', 'Ramadi Central Market', 'سوق', ramadi_id, '{"lat": 33.4250, "lng": 43.2980}', true),
    ('ملعب الأنبار الدولي', 'Anbar International Stadium', 'ملعب', ramadi_id, '{"lat": 33.4180, "lng": 43.3100}', true),
    ('جسر الرمادي الحديدي', 'Ramadi Iron Bridge', 'جسر', ramadi_id, '{"lat": 33.4200, "lng": 43.2850}', true),
    ('محطة قطار الرمادي', 'Ramadi Train Station', 'محطة', ramadi_id, '{"lat": 33.4150, "lng": 43.2750}', true),
    ('مستشفى الفلوجة التعليمي', 'Fallujah Teaching Hospital', 'مستشفى', fallujah_id, '{"lat": 33.3510, "lng": 43.7750}', true),
    ('جامع الفلوجة الكبير', 'Fallujah Grand Mosque', 'مسجد', fallujah_id, '{"lat": 33.3550, "lng": 43.7800}', true),
    ('جسر الفلوجة الحديدي', 'Fallujah Iron Bridge', 'جسر', fallujah_id, '{"lat": 33.3480, "lng": 43.7900}', true),
    ('سد حديثة', 'Haditha Dam', 'سد', haditha_id, '{"lat": 34.2050, "lng": 42.3950}', true),
    ('بحيرة الحبانية', 'Habbaniyah Lake', 'منتجع', habbaniyah_id, '{"lat": 33.3550, "lng": 43.5450}', true);
END $$;