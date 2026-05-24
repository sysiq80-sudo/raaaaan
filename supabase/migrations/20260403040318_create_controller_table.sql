-- ============================================================
-- جدول controller: حسابات مشرفي لوحة التحكم
-- مفصول تماماً عن auth.users (الركاب والسواق)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.controller (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهرس للبحث بالإيميل بسرعة
CREATE INDEX IF NOT EXISTS idx_controller_email ON public.controller (email);

-- تفعيل RLS
ALTER TABLE public.controller ENABLE ROW LEVEL SECURITY;

-- سياسة: فقط service_role يمكنه القراءة/الكتابة (لأن Edge Function تستخدم service_role)
-- لا يُسمح للمستخدمين العاديين (anon) بالوصول لهذا الجدول
DROP POLICY IF EXISTS "service_role_full_access" ON public.controller;
CREATE POLICY "service_role_full_access" ON public.controller
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- تعليق للتوضيح
COMMENT ON TABLE public.controller IS 'حسابات مشرفي لوحة التحكم - منفصلة عن المستخدمين العاديين';
