-- ═══════════════════════════════════════════════════════
-- إصلاح pgcrypto + verify_controller_login + reset password
-- ═══════════════════════════════════════════════════════

-- 1. تفعيل pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. إعادة بناء الـ function مع search_path صحيح
CREATE OR REPLACE FUNCTION public.verify_controller_login(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.email,
    c.full_name,
    c.role,
    (c.password_hash = extensions.crypt(p_password, c.password_hash)) AS is_valid
  FROM public.controller c
  WHERE c.email = p_email
    AND c.is_active = true;
END;
$$;

-- صلاحيات: service_role فقط
REVOKE ALL ON FUNCTION public.verify_controller_login(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.verify_controller_login(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_controller_login(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_controller_login(TEXT, TEXT) TO service_role;

-- 3. تعيين كلمة مرور جديدة للأدمن: Admin@2024
UPDATE public.controller
SET password_hash = extensions.crypt('Admin@2024', extensions.gen_salt('bf'))
WHERE email = 'klidmorre@gmail.com';

-- تأكيد
SELECT id, email, is_active, role FROM public.controller WHERE email = 'klidmorre@gmail.com';
