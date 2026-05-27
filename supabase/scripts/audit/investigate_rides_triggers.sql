-- فحص حالة التريغر في الإنتاج الآن
SELECT
  t.tgname,
  t.tgenabled,
  p.proname AS function_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled'
    WHEN 'D' THEN 'disabled'
    WHEN 'R' THEN 'replica'
    WHEN 'A' THEN 'always'
  END AS status
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'rides'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
