-- ════════════════════════════════════════════════════════════════════
-- Phase 4: Receipt Transactions — جدول معاملات الإيصالات المالية
-- ════════════════════════════════════════════════════════════════════
-- يستخدم لتتبع إيصالات الدفع المرسلة من العملاء عبر الواتساب/تليجرام
-- ويتم مراجعتها من قبل الأدمن عبر بوت تليجرام خاص

CREATE TABLE IF NOT EXISTS receipt_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  platform_user_id TEXT NOT NULL,
  amount NUMERIC(12, 2),
  transaction_reference TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  receipt_image_url TEXT,
  parsed_data JSONB DEFAULT '{}',
  admin_message_id TEXT,
  admin_chat_id TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  customer_notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_user_id ON receipt_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_status ON receipt_transactions(status);
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_platform ON receipt_transactions(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_reference ON receipt_transactions(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_receipt_transactions_created_at ON receipt_transactions(created_at DESC);

-- منع التكرار: نفس رقم المعاملة لا يمكن إضافته مرتين
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_unique_reference 
  ON receipt_transactions(transaction_reference) 
  WHERE transaction_reference IS NOT NULL AND transaction_reference != '';

-- RLS: Row Level Security
ALTER TABLE receipt_transactions ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى معاملاته فقط
DROP POLICY IF EXISTS "users_own_receipts" ON receipt_transactions;
CREATE POLICY "users_own_receipts" ON receipt_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Service role يمكنه إدراج/تعديل (البوتات تعمل بـ service role)
DROP POLICY IF EXISTS "service_role_all" ON receipt_transactions;
CREATE POLICY "service_role_all" ON receipt_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Admin يرى كل المعاملات
DROP POLICY IF EXISTS "admin_view_all_receipts" ON receipt_transactions;
CREATE POLICY "admin_view_all_receipts" ON receipt_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_receipt_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_receipt_transactions_updated_at ON receipt_transactions;
CREATE TRIGGER trigger_update_receipt_transactions_updated_at
  BEFORE UPDATE ON receipt_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_transactions_updated_at();

-- إضافة إعدادات البوت الإداري في system_configs
INSERT INTO system_configs (category, key_name, key_value, is_secret, description) VALUES
  ('admin_bot', 'ADMIN_TELEGRAM_BOT_TOKEN', '8500563443:AAFpTzAk8AWKvmo9nlkDv56655YnYi8kFjY', true, 'توكن بوت تليجرام الإداري للموافقة/الرفض'),
  ('admin_bot', 'ADMIN_GROUP_CHAT_ID', '-1003353713214', false, 'معرف مجموعة الأدمن في تليجرام')
ON CONFLICT (key_name) DO NOTHING;
