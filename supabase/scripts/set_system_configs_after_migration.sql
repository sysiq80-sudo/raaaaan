-- ═══════════════════════════════════════════════════════════════════
-- تعيين قيم system_configs بعد تطبيق migration (بدون أسرار في المستودع)
-- استخدم هذا الملف بعد تشغيل 20260301000000_production_fixes_sms.sql
-- ═══════════════════════════════════════════════════════════════════
--
-- الطريقة 1: تشغيل من Supabase SQL Editor
-- 1) استبدل REPLACE_SUPABASE_URL و REPLACE_SUPABASE_ANON_KEY بالقيم الفعلية
-- 2) الصق المحتوى في SQL Editor ثم نفّذ
--
-- الطريقة 2: تشغيل سكربت Node من البيئة (انظر scripts/update-system-configs.mjs)
--   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/update-system-configs.mjs
--
-- ═══════════════════════════════════════════════════════════════════

-- التأكد من وجود الصفوف (الـ migration يدرجها بقيم فارغة)
INSERT INTO system_configs (category, key_name, key_value, description)
VALUES 
  ('system', 'SUPABASE_URL', '', 'Supabase project URL — set via dashboard'),
  ('system', 'SUPABASE_ANON_KEY', '', 'Supabase anon key — set via dashboard')
ON CONFLICT (key_name) DO NOTHING;

-- تحديث القيم (استبدل placeholders قبل التشغيل)
UPDATE system_configs SET key_value = 'REPLACE_SUPABASE_URL'   WHERE key_name = 'SUPABASE_URL';
UPDATE system_configs SET key_value = 'REPLACE_SUPABASE_ANON_KEY' WHERE key_name = 'SUPABASE_ANON_KEY';

-- التحقق
SELECT key_name, 
       CASE WHEN key_value = '' OR key_value LIKE 'REPLACE_%' THEN '(غير معيّن)' ELSE left(key_value, 20) || '...' END AS key_preview
FROM system_configs 
WHERE key_name IN ('SUPABASE_URL', 'SUPABASE_ANON_KEY');
