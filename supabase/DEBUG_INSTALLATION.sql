-- 🔍 سكريبت تشخيص مفصل لنظام الطوارئ
-- قم بتشغيل هذا للحصول على تقرير دقيق عن كل عنصر

-- ========================================
-- 1️⃣ فحص الجداول (يجب أن يكون 6)
-- ========================================
SELECT '=== الجداول ===' as section;

SELECT 
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables t 
    WHERE t.table_name = checks.table_name
  ) THEN '✅ موجود' ELSE '❌ مفقود' END as status
FROM (
  VALUES 
    ('dual_stop_alerts'),
    ('emergency_usage_log'),
    ('user_alerts'),
    ('ride_complaints'),
    ('complaint_responses'),
    ('financial_decisions_log')
) AS checks(table_name);

-- ========================================
-- 2️⃣ فحص الأعمدة في rides (يجب 3)
-- ========================================
SELECT '=== أعمدة rides الجديدة ===' as section;

SELECT 
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' AND column_name = checks.col
  ) THEN '✅ موجود' ELSE '❌ مفقود' END as status
FROM (
  VALUES 
    ('rider_location'),
    ('rider_last_update'),
    ('emergency_completed')
) AS checks(col);

-- ========================================
-- 3️⃣ فحص الوظائف (يجب 4)
-- ========================================
SELECT '=== الوظائف (Functions) ===' as section;

SELECT 
  func_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = checks.func_name
  ) THEN '✅ موجود' ELSE '❌ مفقود' END as status
FROM (
  VALUES 
    ('check_emergency_abuse'),
    ('update_rider_location_in_ride'),
    ('set_complaint_priority'),
    ('execute_financial_decision')
) AS checks(func_name);

-- ========================================
-- 4️⃣ فحص المشغلات (Triggers) (يجب 2)
-- ========================================
SELECT '=== المشغلات (Triggers) ===' as section;

SELECT 
  trigger_name,
  event_object_table,
  '✅ موجود' as status
FROM information_schema.triggers
WHERE trigger_name IN (
  'update_rider_location_trigger',
  'trigger_set_complaint_priority'
);

-- ========================================
-- 5️⃣ فحص الإعدادات (يجب 5)
-- ========================================
SELECT '=== إعدادات النظام ===' as section;

SELECT 
  setting_key,
  CASE WHEN EXISTS (
    SELECT 1 FROM app_settings 
    WHERE key = checks.setting_key
  ) THEN '✅ موجود' ELSE '❌ مفقود' END as status,
  (SELECT value FROM app_settings WHERE key = checks.setting_key) as current_value
FROM (
  VALUES 
    ('dual_stop_detection_interval'),
    ('dual_stop_warning_threshold'),
    ('dual_stop_critical_threshold'),
    ('dual_stop_distance_threshold'),
    ('emergency_abuse_limit')
) AS checks(setting_key);

-- ========================================
-- 6️⃣ فحص العروض (Views) (يجب 1)
-- ========================================
SELECT '=== العروض (Views) ===' as section;

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'complaints_stats'
  ) THEN '✅ complaints_stats موجود' 
    ELSE '❌ complaints_stats مفقود' 
  END as status;

-- ========================================
-- 7️⃣ فحص سياسات RLS
-- ========================================
SELECT '=== سياسات RLS ===' as section;

SELECT 
  tablename,
  COUNT(*) as policies_count,
  string_agg(policyname, ', ') as policy_names
FROM pg_policies
WHERE tablename IN (
  'dual_stop_alerts',
  'emergency_usage_log',
  'user_alerts',
  'ride_complaints',
  'complaint_responses',
  'financial_decisions_log'
)
GROUP BY tablename
ORDER BY tablename;

-- ========================================
-- 8️⃣ الملخص النهائي
-- ========================================
SELECT '=== الملخص النهائي ===' as section;

WITH checks AS (
  SELECT 
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name IN ('dual_stop_alerts', 'emergency_usage_log', 'user_alerts', 
                          'ride_complaints', 'complaint_responses', 'financial_decisions_log')) as tables_count,
    
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'rides' 
       AND column_name IN ('rider_location', 'rider_last_update', 'emergency_completed')) as columns_count,
    
    (SELECT COUNT(*) FROM information_schema.routines 
     WHERE routine_name IN ('check_emergency_abuse', 'update_rider_location_in_ride', 
                            'set_complaint_priority', 'execute_financial_decision')) as functions_count,
    
    (SELECT COUNT(*) FROM app_settings 
     WHERE key IN ('dual_stop_detection_interval', 'dual_stop_warning_threshold', 
                   'dual_stop_critical_threshold', 'dual_stop_distance_threshold', 
                   'emergency_abuse_limit')) as settings_count
)
SELECT
  'الجداول' as item,
  tables_count || ' / 6' as result,
  CASE WHEN tables_count = 6 THEN '✅' ELSE '❌' END as status
FROM checks
UNION ALL
SELECT
  'الأعمدة في rides',
  columns_count || ' / 3',
  CASE WHEN columns_count = 3 THEN '✅' ELSE '❌' END
FROM checks
UNION ALL
SELECT
  'الوظائف',
  functions_count || ' / 4',
  CASE WHEN functions_count = 4 THEN '✅' ELSE '❌' END
FROM checks
UNION ALL
SELECT
  'الإعدادات',
  settings_count || ' / 5',
  CASE WHEN settings_count = 5 THEN '✅' ELSE '❌' END
FROM checks;

-- ========================================
-- 9️⃣ إذا كانت النتيجة سلبية، نفذ هذه الأوامر
-- ========================================
/*
إذا ظهرت أخطاء:

1. تحقق أن الـ migrations طُبقت:
   SELECT * FROM supabase_migrations.schema_migrations 
   WHERE version LIKE '202601292000%';

2. إذا لم تُطبق، نفذ الملفات يدوياً:
   - افتح: supabase/migrations/20260129200001_emergency_system_tables.sql
   - انسخ المحتوى وشغله في SQL Editor
   - افتح: supabase/migrations/20260129200002_complaints_system.sql  
   - انسخ المحتوى وشغله في SQL Editor

3. بعد التطبيق، أعد تشغيل هذا السكريبت
*/
