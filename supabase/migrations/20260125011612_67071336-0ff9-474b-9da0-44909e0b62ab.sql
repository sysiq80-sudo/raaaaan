-- تحديث أولويات المناطق للاختبار
-- العراق (المنطقة الأم) = أولوية منخفضة
UPDATE public.regions SET priority = 1 WHERE name_ar = 'العراق';

-- الرمادي (منطقة فرعية) = أولوية عالية
UPDATE public.regions SET priority = 10 WHERE name_ar = 'الرمادي';

-- تحديث باقي المناطق الفرعية بأولوية عالية
UPDATE public.regions SET priority = 10 WHERE name_ar IN ('أربيل', 'الفلوجة', 'حديثة', 'القائم', 'الحبانية', 'الخالدية');

-- المناطق الصغيرة جداً (الأحياء) بأولوية أعلى
UPDATE public.regions SET priority = 15 WHERE name_ar LIKE 'حي %';