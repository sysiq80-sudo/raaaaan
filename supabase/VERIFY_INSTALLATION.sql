-- ✅ سكريبت التحقق من تثبيت نظام الطوارئ والشكاوى
-- قم بتشغيل هذا السكريبت في Supabase SQL Editor للتحقق من صحة التثبيت

-- 1️⃣ التحقق من الجداول
SELECT 
  'dual_stop_alerts' as table_name,
  COUNT(*) as exists_count
FROM information_schema.tables 
WHERE table_name = 'dual_stop_alerts'
UNION ALL
SELECT 'emergency_usage_log', COUNT(*) FROM information_schema.tables WHERE table_name = 'emergency_usage_log'
UNION ALL
SELECT 'user_alerts', COUNT(*) FROM information_schema.tables WHERE table_name = 'user_alerts'
UNION ALL
SELECT 'ride_complaints', COUNT(*) FROM information_schema.tables WHERE table_name = 'ride_complaints'
UNION ALL
SELECT 'complaint_responses', COUNT(*) FROM information_schema.tables WHERE table_name = 'complaint_responses'
UNION ALL
SELECT 'financial_decisions_log', COUNT(*) FROM information_schema.tables WHERE table_name = 'financial_decisions_log';

-- النتيجة المتوقعة: 6 صفوف، كل صف بقيمة 1

-- 2️⃣ التحقق من الأعمدة الجديدة في rides
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'rides' 
  AND column_name IN ('rider_location', 'rider_last_update', 'emergency_completed');

-- النتيجة المتوقعة: 3 أعمدة

-- 3️⃣ التحقق من الوظائف (Functions)
SELECT 
  routine_name
FROM information_schema.routines
WHERE routine_name IN (
  'check_emergency_abuse',
  'update_rider_location_in_ride',
  'set_complaint_priority',
  'execute_financial_decision'
);

-- النتيجة المتوقعة: 4 وظائف

-- 4️⃣ التحقق من المشغلات (Triggers)
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'update_rider_location_trigger';

-- النتيجة المتوقعة: 1 مشغل على جدول profiles

-- 5️⃣ التحقق من الإعدادات
SELECT 
  key,
  value,
  description
FROM app_settings
WHERE key IN (
  'dual_stop_detection_interval',
  'dual_stop_warning_threshold',
  'dual_stop_critical_threshold',
  'dual_stop_distance_threshold',
  'emergency_abuse_limit'
);

-- النتيجة المتوقعة: 5 إعدادات

-- 6️⃣ التحقق من العرض (View)
SELECT 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name = 'complaints_stats';

-- النتيجة المتوقعة: 1 عرض

-- 7️⃣ التحقق من سياسات RLS على الجداول الجديدة
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN (
  'dual_stop_alerts',
  'emergency_usage_log',
  'user_alerts',
  'ride_complaints',
  'complaint_responses',
  'financial_decisions_log'
)
ORDER BY tablename, policyname;

-- النتيجة المتوقعة: عدة سياسات لكل جدول

-- 8️⃣ اختبار وظيفة check_emergency_abuse
-- (استبدل USER_ID بـ UUID حقيقي من جدول profiles)
-- SELECT check_emergency_abuse('USER_ID_HERE');

-- النتيجة المتوقعة: JSON object مع usage_count و is_blocked

-- 9️⃣ التحقق من Storage Bucket (يدوياً في Dashboard)
-- انتقل إلى Storage → تحقق من وجود 'complaint-evidence'

-- 🔟 التحقق من Edge Function (يدوياً في Dashboard)
-- انتقل إلى Edge Functions → تحقق من 'detect-dual-stop'

-- ✅ إذا نجحت جميع الاستعلامات أعلاه، فالنظام مثبت بنجاح!

-- 📊 معلومات إضافية
SELECT 
  'System Status' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('dual_stop_alerts', 'emergency_usage_log', 'user_alerts', 'ride_complaints', 'complaint_responses', 'financial_decisions_log')) = 6
      AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('check_emergency_abuse', 'update_rider_location_in_ride', 'set_complaint_priority', 'execute_financial_decision')) = 4
      AND (SELECT COUNT(*) FROM app_settings WHERE key IN ('dual_stop_detection_interval', 'dual_stop_warning_threshold', 'dual_stop_critical_threshold', 'dual_stop_distance_threshold', 'emergency_abuse_limit')) = 5
    THEN '✅ نظام الطوارئ مثبت بنجاح!'
    ELSE '❌ هناك أخطاء في التثبيت - راجع الاستعلامات أعلاه'
  END as status;
