-- فحص حالة قاعدة البيانات الحالية
-- تحقق من وجود الجداول والبيانات

-- 1. فحص الجداول
SELECT
  'bot_customers' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bot_customers' AND table_schema = 'public'
  ) THEN '✅ موجود' ELSE '❌ غير موجود' END as status,
  (SELECT COUNT(*) FROM bot_customers) as records_count
UNION ALL
SELECT
  'bot_conversation_messages' as table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bot_conversation_messages' AND table_schema = 'public'
  ) THEN '✅ موجود' ELSE '❌ غير موجود' END as status,
  (SELECT COUNT(*) FROM bot_conversation_messages) as records_count;

-- 2. فحص السياسات (RLS)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('bot_customers', 'bot_conversation_messages')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. عينة من البيانات الحالية
SELECT 'العملاء الحاليين:' as info;
SELECT
  platform,
  platform_id,
  display_name,
  last_active,
  interaction_count
FROM bot_customers
ORDER BY last_active DESC
LIMIT 5;

SELECT 'الرسائل الحالية:' as info;
SELECT
  bcm.message,
  bcm.direction,
  bcm.platform,
  bc.display_name,
  bcm.created_at
FROM bot_conversation_messages bcm
LEFT JOIN bot_customers bc ON bcm.bot_customer_id = bc.id
ORDER BY bcm.created_at DESC
LIMIT 10;