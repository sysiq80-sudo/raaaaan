-- فحص حالة جداول البوت والرسائل
-- تحقق من وجود الجداول والبيانات

-- 1. فحص جدول bot_customers
SELECT 'bot_customers table exists' as check_result,
       COUNT(*) as total_customers
FROM information_schema.tables
WHERE table_name = 'bot_customers' AND table_schema = 'public';

-- 2. فحص جدول bot_conversation_messages
SELECT 'bot_conversation_messages table exists' as check_result,
       COUNT(*) as total_messages
FROM information_schema.tables
WHERE table_name = 'bot_conversation_messages' AND table_schema = 'public';

-- 3. عرض عينة من العملاء
SELECT id, platform, platform_id, display_name, phone_number, last_active, interaction_count
FROM bot_customers
ORDER BY last_active DESC
LIMIT 5;

-- 4. عرض عينة من الرسائل
SELECT bcm.id, bcm.bot_customer_id, bcm.message, bcm.direction, bcm.platform, bcm.created_at,
       bc.display_name, bc.platform_id
FROM bot_conversation_messages bcm
LEFT JOIN bot_customers bc ON bcm.bot_customer_id = bc.id
ORDER BY bcm.created_at DESC
LIMIT 10;

-- 5. فحص الصلاحيات (RLS)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('bot_customers', 'bot_conversation_messages')
AND schemaname = 'public';