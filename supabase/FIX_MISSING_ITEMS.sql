-- 🔧 سكريبت إصلاح العناصر الناقصة
-- نفذ هذا السكريبت لإضافة ما ينقص

-- ========================================
-- 1️⃣ إضافة الأعمدة الناقصة في جدول rides
-- ========================================

-- التحقق من كل عمود وإضافته إن كان مفقوداً
DO $$
BEGIN
  -- rider_location
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' AND column_name = 'rider_location'
  ) THEN
    ALTER TABLE rides ADD COLUMN rider_location JSONB;
    RAISE NOTICE '✅ تمت إضافة rider_location';
  ELSE
    RAISE NOTICE '⏭️ rider_location موجود بالفعل';
  END IF;

  -- rider_last_update
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' AND column_name = 'rider_last_update'
  ) THEN
    ALTER TABLE rides ADD COLUMN rider_last_update TIMESTAMPTZ;
    RAISE NOTICE '✅ تمت إضافة rider_last_update';
  ELSE
    RAISE NOTICE '⏭️ rider_last_update موجود بالفعل';
  END IF;

  -- emergency_completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' AND column_name = 'emergency_completed'
  ) THEN
    ALTER TABLE rides ADD COLUMN emergency_completed BOOLEAN DEFAULT FALSE;
    RAISE NOTICE '✅ تمت إضافة emergency_completed';
  ELSE
    RAISE NOTICE '⏭️ emergency_completed موجود بالفعل';
  END IF;
END $$;

-- ========================================
-- 2️⃣ إضافة الإعدادات الناقصة
-- ========================================

-- إضافة جميع الإعدادات (إن لم تكن موجودة)
INSERT INTO app_settings (key, value, description)
VALUES 
  ('dual_stop_detection_interval', '3', 'فترة البحث عن رحلات متوقفة (بالدقائق)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES 
  ('dual_stop_warning_threshold', '5', 'حد التحذير لتوقف الرحلة (بالدقائق)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES 
  ('dual_stop_critical_threshold', '10', 'الحد الحرج لتوقف الرحلة (بالدقائق)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES 
  ('dual_stop_distance_threshold', '50', 'المسافة القصوى بين السائق والراكب للتوقف المزدوج (بالمتر)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES 
  ('emergency_abuse_limit', '3', 'عدد استخدامات زر الطوارئ المسموحة في 7 أيام')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 3️⃣ التحقق من النتيجة
-- ========================================

-- عرض حالة الأعمدة
SELECT '=== حالة الأعمدة بعد الإصلاح ===' as section;

SELECT 
  col,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rides' AND column_name = checks.col
  ) THEN '✅ موجود' ELSE '❌ لا يزال مفقوداً' END as status
FROM (
  VALUES 
    ('rider_location'),
    ('rider_last_update'),
    ('emergency_completed')
) AS checks(col);

-- عرض حالة الإعدادات
SELECT '=== حالة الإعدادات بعد الإصلاح ===' as section;

SELECT 
  key,
  value,
  '✅ موجود' as status
FROM app_settings
WHERE key IN (
  'dual_stop_detection_interval',
  'dual_stop_warning_threshold',
  'dual_stop_critical_threshold',
  'dual_stop_distance_threshold',
  'emergency_abuse_limit'
)
ORDER BY key;

-- الملخص النهائي
SELECT '=== الملخص النهائي ===' as section;

WITH checks AS (
  SELECT 
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'rides' 
       AND column_name IN ('rider_location', 'rider_last_update', 'emergency_completed')) as columns_count,
    
    (SELECT COUNT(*) FROM app_settings 
     WHERE key IN ('dual_stop_detection_interval', 'dual_stop_warning_threshold', 
                   'dual_stop_critical_threshold', 'dual_stop_distance_threshold', 
                   'emergency_abuse_limit')) as settings_count
)
SELECT
  'الأعمدة في rides' as item,
  columns_count || ' / 3' as result,
  CASE WHEN columns_count = 3 THEN '✅ مكتمل' ELSE '❌ لا يزال ناقصاً' END as status
FROM checks
UNION ALL
SELECT
  'الإعدادات',
  settings_count || ' / 5',
  CASE WHEN settings_count = 5 THEN '✅ مكتمل' ELSE '❌ لا يزال ناقصاً' END
FROM checks;

-- رسالة النجاح
DO $$
DECLARE
  v_columns_count INTEGER;
  v_settings_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_columns_count
  FROM information_schema.columns 
  WHERE table_name = 'rides' 
    AND column_name IN ('rider_location', 'rider_last_update', 'emergency_completed');
  
  SELECT COUNT(*) INTO v_settings_count
  FROM app_settings 
  WHERE key IN ('dual_stop_detection_interval', 'dual_stop_warning_threshold', 
                'dual_stop_critical_threshold', 'dual_stop_distance_threshold', 
                'emergency_abuse_limit');
  
  IF v_columns_count = 3 AND v_settings_count = 5 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅✅✅ تم الإصلاح بنجاح! النظام جاهز الآن ✅✅✅';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING 'لا تزال هناك بعض المشاكل - راجع النتائج أعلاه';
  END IF;
END $$;
