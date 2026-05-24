-- ══════════════════════════════════════════════════════
-- جدول حسابات Messenger / Instagram
-- Facebook Page-based Messenger integration
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.messenger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- معلومات الصفحة
  account_name TEXT,                       -- اسم مخصص (اختياري)
  page_name TEXT NOT NULL,                 -- اسم صفحة Facebook
  page_id TEXT NOT NULL UNIQUE,            -- Facebook Page ID
  page_access_token TEXT NOT NULL,         -- Long-lived Page Access Token

  -- معلومات التطبيق (اختياري لكن مُوصى به)
  app_id TEXT,                             -- Facebook App ID
  app_secret TEXT,                         -- Facebook App Secret

  -- Webhook verification
  verify_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  -- حالة الحساب
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,       -- تم التحقق من Webhook
  platform TEXT DEFAULT 'messenger' CHECK (platform IN ('messenger', 'instagram', 'both')),

  -- إحصائيات
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  -- بيانات النظام
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_messenger_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messenger_accounts_updated_at
  BEFORE UPDATE ON public.messenger_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_messenger_accounts_updated_at();

-- Indexes
CREATE INDEX idx_messenger_accounts_page_id ON public.messenger_accounts(page_id);
CREATE INDEX idx_messenger_accounts_active ON public.messenger_accounts(is_active);

-- RLS
ALTER TABLE public.messenger_accounts ENABLE ROW LEVEL SECURITY;

-- Admin فقط يقدر يشوف ويعدل
CREATE POLICY "admin_full_access_messenger_accounts"
  ON public.messenger_accounts
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Edge Functions (service role) full access
CREATE POLICY "service_role_messenger_accounts"
  ON public.messenger_accounts
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.messenger_accounts IS 'حسابات Facebook Messenger / Instagram للبوت';
