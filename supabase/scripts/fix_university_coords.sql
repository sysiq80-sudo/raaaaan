-- تحديث إحداثيات الجامعات بالإحداثيات الحقيقية (باستخدام الاسم الإنجليزي)

UPDATE public.landmarks
SET location = '{"lat":36.1043480,"lng":44.0337080}'::jsonb
WHERE name_en = 'Knowledge University';

UPDATE public.landmarks
SET location = '{"lat":36.2057,"lng":44.0186}'::jsonb
WHERE name_en = 'American University of Erbil';

UPDATE public.landmarks
SET location = '{"lat":36.1893,"lng":44.0223}'::jsonb
WHERE name_en = 'Livan University';

UPDATE public.landmarks
SET location = '{"lat":36.1887,"lng":44.0187}'::jsonb
WHERE name_en = 'Bahr al-Ghoom University';

-- تأكيد
SELECT name_en, location
FROM public.landmarks
WHERE name_en IN (
  'Knowledge University',
  'American University of Erbil',
  'Salahaddin University',
  'Erbil Technical University'
);
