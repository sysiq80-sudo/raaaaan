-- ══════════════════════════════════════════════════════════════════
-- ران — إصلاح محادثات البوت بالكامل
-- تطبيق الهجرة + بيانات تجريبية
-- ══════════════════════════════════════════════════════════════════

-- ============ الجزء 1: تطبيق الهجرة ============

-- Create bot_conversation_messages table for storing all bot interactions
CREATE TABLE IF NOT EXISTS public.bot_conversation_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_customer_id   UUID NOT NULL REFERENCES public.bot_customers(id) ON DELETE CASCADE,
  message           TEXT NOT NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  platform          TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram', 'sms')),
  message_id        TEXT, -- Platform-specific message ID
  metadata          JSONB DEFAULT '{}', -- Additional platform-specific data
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Comments for documentation
COMMENT ON TABLE public.bot_conversation_messages IS 'Stores all bot conversation messages across WhatsApp, Telegram, and SMS platforms';
COMMENT ON COLUMN public.bot_conversation_messages.bot_customer_id IS 'Reference to the bot customer who sent/received this message';
COMMENT ON COLUMN public.bot_conversation_messages.message IS 'The actual message content';
COMMENT ON COLUMN public.bot_conversation_messages.direction IS 'incoming = from customer, outgoing = from bot';
COMMENT ON COLUMN public.bot_conversation_messages.platform IS 'Communication platform: whatsapp, telegram, or sms';
COMMENT ON COLUMN public.bot_conversation_messages.message_id IS 'Platform-specific message identifier for deduplication';
COMMENT ON COLUMN public.bot_conversation_messages.metadata IS 'Additional data like delivery status, media info, etc.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_conversation_messages_customer_id
  ON public.bot_conversation_messages(bot_customer_id);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_messages_created_at
  ON public.bot_conversation_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_messages_platform
  ON public.bot_conversation_messages(platform);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_messages_direction
  ON public.bot_conversation_messages(direction);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_messages_customer_created
  ON public.bot_conversation_messages(bot_customer_id, created_at DESC);

-- RLS Policies
ALTER TABLE public.bot_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all messages
CREATE POLICY "admin_all_bot_messages" ON public.bot_conversation_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Service role can insert/update messages (for webhooks)
CREATE POLICY "service_bot_messages_insert" ON public.bot_conversation_messages
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_bot_messages_update" ON public.bot_conversation_messages
  FOR UPDATE USING (auth.role() = 'service_role');

-- Function to get conversation history for a bot customer
CREATE OR REPLACE FUNCTION public.get_bot_conversation_history(
  p_bot_customer_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  message TEXT,
  direction TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    bcm.id,
    bcm.message,
    bcm.direction,
    bcm.platform,
    bcm.created_at,
    bcm.metadata
  FROM public.bot_conversation_messages bcm
  WHERE bcm.bot_customer_id = p_bot_customer_id
  ORDER BY bcm.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to log incoming bot message
CREATE OR REPLACE FUNCTION public.log_bot_incoming_message(
  p_bot_customer_id UUID,
  p_message TEXT,
  p_platform TEXT,
  p_message_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_message_id UUID;
BEGIN
  INSERT INTO public.bot_conversation_messages (
    bot_customer_id,
    message,
    direction,
    platform,
    message_id,
    metadata
  ) VALUES (
    p_bot_customer_id,
    p_message,
    'incoming',
    p_platform,
    p_message_id,
    p_metadata
  ) RETURNING id INTO v_message_id;

  -- Update bot customer last activity
  UPDATE public.bot_customers
  SET
    last_active = NOW(),
    last_seen = NOW(),
    interaction_count = COALESCE(interaction_count, 0) + 1
  WHERE id = p_bot_customer_id;

  RETURN v_message_id;
END;
$$;

-- Function to log outgoing bot message
CREATE OR REPLACE FUNCTION public.log_bot_outgoing_message(
  p_bot_customer_id UUID,
  p_message TEXT,
  p_platform TEXT,
  p_message_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_message_id UUID;
BEGIN
  INSERT INTO public.bot_conversation_messages (
    bot_customer_id,
    message,
    direction,
    platform,
    message_id,
    metadata
  ) VALUES (
    p_bot_customer_id,
    p_message,
    'outgoing',
    p_platform,
    p_message_id,
    p_metadata
  ) RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

-- ============ الجزء 2: البيانات التجريبية ============

-- إدراج عملاء تجريبيين
INSERT INTO bot_customers (platform, platform_id, display_name, phone_number, last_active, interaction_count)
VALUES
  ('whatsapp', '9647501234567', 'أحمد محمد', '+9647501234567', NOW(), 5),
  ('whatsapp', '9647512345678', 'فاطمة علي', '+9647512345678', NOW() - INTERVAL '1 hour', 3),
  ('telegram', '123456789', 'محمد حسن', NULL, NOW() - INTERVAL '2 hours', 2),
  ('sms', '9647523456789', 'سارة أحمد', '+9647523456789', NOW() - INTERVAL '30 minutes', 1)
ON CONFLICT (platform, platform_id) DO NOTHING;

-- إدراج رسائل تجريبية
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

-- ============ الجزء 3: التحقق ============

-- فحص النتائج
SELECT 'Migration completed successfully!' as status,
       (SELECT COUNT(*) FROM bot_customers) as total_customers,
       (SELECT COUNT(*) FROM bot_conversation_messages) as total_messages;