-- Migration: جدول سجل حذف الحسابات
-- التاريخ: 2026-01-29
-- الوصف: تسجيل عمليات حذف الحسابات للإحصائيات

-- إنشاء جدول account_deletions
CREATE TABLE IF NOT EXISTS account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- لا نضع FK لأن المستخدم سيُحذف
  user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'driver')),
  reason TEXT,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  
  -- معلومات إضافية
  total_rides INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  account_age_days INTEGER DEFAULT 0,
  
  -- فهرس للتاريخ
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_account_deletions_deleted_at ON account_deletions(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletions_user_type ON account_deletions(user_type);

-- RLS - فقط Admin يمكنه القراءة (TODO: تفعيل بعد إنشاء جدول admin_users)
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "only_admins_can_view_deletions"
--   ON account_deletions
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM admin_users
--       WHERE admin_users.user_id = auth.uid()
--         AND admin_users.role IN ('super_admin', 'admin')
--     )
--   );

-- النظام يمكنه الإدراج
CREATE POLICY "system_can_insert_deletions"
  ON account_deletions
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE account_deletions IS 'سجل عمليات حذف الحسابات - للإحصائيات وتحليل أسباب المغادرة';
