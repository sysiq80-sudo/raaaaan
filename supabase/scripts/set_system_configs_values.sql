-- ═══════════════════════════════════════════════════════════════════
-- خطوة واحدة: تعيين القيم الفعلية لـ SUPABASE_URL و SUPABASE_ANON_KEY
-- ═══════════════════════════════════════════════════════════════════
--
-- 1) افتح Supabase Dashboard → مشروعك → Project Settings → API
-- 2) انسخ:
--    - Project URL  → استبدل بها النص الأول أدناه
--    - anon public  → استبدل بها النص الثاني أدناه
-- 3) في SQL Editor: استبدل السطرين أدناه بقيمك (احفظ النص بين علامتي الاقتباس فقط؛ إن احتوى المفتاح على ' فضعها مرتين '')
-- 4) Run
--
-- ═══════════════════════════════════════════════════════════════════

UPDATE system_configs SET key_value = 'https://YOUR_PROJECT_REF.supabase.co' WHERE key_name = 'SUPABASE_URL';
UPDATE system_configs SET key_value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY_PASTE_HERE' WHERE key_name = 'SUPABASE_ANON_KEY';

-- التحقق: بعد التشغيل يجب أن ترى بداية القيمة (مثل https://... أو eyJ...) وليس "(غير معيّن)"
SELECT key_name, 
       CASE WHEN key_value = '' OR key_value LIKE '%YOUR_%' THEN '(غير معيّن — عدّل السطرين أعلاه ثم نفّذ)' ELSE left(key_value, 40) || '...' END AS key_preview
FROM system_configs 
WHERE key_name IN ('SUPABASE_URL', 'SUPABASE_ANON_KEY');
