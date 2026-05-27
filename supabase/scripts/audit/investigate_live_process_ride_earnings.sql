-- فحص الكود الحالي لـ process_ride_earnings في قاعدة البيانات
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'process_ride_earnings';
