-- حذف جميع المعالم ذات الأسماء العربية المشوّهة (تحتوي على ?)
-- مع الاحتفاظ بتلك التي تظهر بشكل صحيح

DELETE FROM public.landmarks
WHERE name_ar LIKE '%?%';

-- حذف المكررات — احتفظ بأحدث إدخال لكل (name_en, governorate_id)
DELETE FROM public.landmarks a
USING public.landmarks b
WHERE a.id < b.id
  AND a.name_en = b.name_en
  AND a.governorate_id = b.governorate_id
  AND a.name_en IS NOT NULL;

-- إحصاء ما تبقى
SELECT COUNT(*) as remaining,
       governorate_id,
       g.name_ar as gov_name
FROM public.landmarks lm
LEFT JOIN public.governorates g ON g.id = lm.governorate_id
GROUP BY lm.governorate_id, g.name_ar;
