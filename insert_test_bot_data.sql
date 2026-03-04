-- إدراج بيانات تجريبية لاختبار واجهة محادثات البوت

-- 1. إدراج عملاء تجريبيين
INSERT INTO bot_customers (platform, platform_id, display_name, phone_number, last_active, interaction_count)
VALUES
  ('whatsapp', '9647501234567', 'أحمد محمد', '+9647501234567', NOW(), 5),
  ('whatsapp', '9647512345678', 'فاطمة علي', '+9647512345678', NOW() - INTERVAL '1 hour', 3),
  ('telegram', '123456789', 'محمد حسن', NULL, NOW() - INTERVAL '2 hours', 2),
  ('sms', '9647523456789', 'سارة أحمد', '+9647523456789', NOW() - INTERVAL '30 minutes', 1)
ON CONFLICT (platform, platform_id) DO NOTHING;

-- 2. إدراج رسائل تجريبية
-- الحصول على معرفات العملاء
DO $$
DECLARE
    ahmed_id UUID;
    fatima_id UUID;
    mohammed_id UUID;
    sara_id UUID;
BEGIN
    -- الحصول على معرفات العملاء
    SELECT id INTO ahmed_id FROM bot_customers WHERE platform_id = '9647501234567' LIMIT 1;
    SELECT id INTO fatima_id FROM bot_customers WHERE platform_id = '9647512345678' LIMIT 1;
    SELECT id INTO mohammed_id FROM bot_customers WHERE platform_id = '123456789' LIMIT 1;
    SELECT id INTO sara_id FROM bot_customers WHERE platform_id = '9647523456789' LIMIT 1;

    -- إدراج رسائل لأحمد
    IF ahmed_id IS NOT NULL THEN
        INSERT INTO bot_conversation_messages (bot_customer_id, message, direction, platform, created_at)
        VALUES
          (ahmed_id, 'مرحبا، أريد حجز تاكسي', 'incoming', 'whatsapp', NOW() - INTERVAL '10 minutes'),
          (ahmed_id, 'مرحبا أحمد! من وين تريد تروح؟', 'outgoing', 'whatsapp', NOW() - INTERVAL '9 minutes'),
          (ahmed_id, 'من التأميم للجامعة', 'incoming', 'whatsapp', NOW() - INTERVAL '8 minutes'),
          (ahmed_id, 'تمام، شو وقت راح تطلع؟', 'outgoing', 'whatsapp', NOW() - INTERVAL '7 minutes'),
          (ahmed_id, 'الساعة 8 صباحاً', 'incoming', 'whatsapp', NOW() - INTERVAL '6 minutes');
    END IF;

    -- إدراج رسائل لفاطمة
    IF fatima_id IS NOT NULL THEN
        INSERT INTO bot_conversation_messages (bot_customer_id, message, direction, platform, created_at)
        VALUES
          (fatima_id, 'كم سعر الرحلة من الكرادة للمنصور؟', 'incoming', 'whatsapp', NOW() - INTERVAL '1 hour'),
          (fatima_id, 'السعر التقريبي 15000 دينار. هل تريدين الحجز؟', 'outgoing', 'whatsapp', NOW() - INTERVAL '59 minutes'),
          (fatima_id, 'اي نعم', 'incoming', 'whatsapp', NOW() - INTERVAL '58 minutes');
    END IF;

    -- إدراج رسائل لمحمد (تليجرام)
    IF mohammed_id IS NOT NULL THEN
        INSERT INTO bot_conversation_messages (bot_customer_id, message, direction, platform, created_at)
        VALUES
          (mohammed_id, 'Hello, I need a taxi', 'incoming', 'telegram', NOW() - INTERVAL '2 hours'),
          (mohammed_id, 'Hello! Where would you like to go?', 'outgoing', 'telegram', NOW() - INTERVAL '119 minutes');
    END IF;

    -- إدراج رسائل لسارة (SMS)
    IF sara_id IS NOT NULL THEN
        INSERT INTO bot_conversation_messages (bot_customer_id, message, direction, platform, created_at)
        VALUES
          (sara_id, 'URGENT: Need taxi now', 'incoming', 'sms', NOW() - INTERVAL '30 minutes'),
          (sara_id, 'We will send a driver soon. Please share your location.', 'outgoing', 'sms', NOW() - INTERVAL '29 minutes');
    END IF;

END $$;