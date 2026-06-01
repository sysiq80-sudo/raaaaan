-- ═══════════════════════════════════════════════════════════════════
-- Migration: إصلاحات التدقيق الأمني الحرجة
-- Critical Audit Fixes — 2026-05-28
-- ═══════════════════════════════════════════════════════════════════
--
-- يعالج:
--   1. driver-documents bucket عام → private (ثغرة خصوصية KYC)
--   2. RLS على driver-documents: SELECT مفتوح للعامة → authenticated فقط
--   3. verify_controller_login RPC مفقود (DB drift)
--   4. rate_limit_log في Realtime بلا مستمع → إزالة (WAL مهدر)
--
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. driver-documents bucket → private
-- ─────────────────────────────────────────────────────────────────
-- السبب: bucket مضبوط public=true + SELECT TO public = أي شخص بالعالم
-- يقدر يوصل لوثائق السائقين (هويات، رخص قيادة، صور شخصية)
-- هذه ثغرة خصوصية/قانونية خطيرة.
--
-- ⚠️ ملاحظة: storage.buckets ملك supabase_storage_admin
-- يجب تحويل الـ bucket إلى private يدوياً من Dashboard:
--   Supabase Dashboard → Storage → driver-documents → Settings → Public = OFF
-- أو تنفيذ الأمر التالي كـ superuser:
DO $$
BEGIN
  UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';
  RAISE NOTICE 'driver-documents bucket set to private';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Cannot update storage.buckets — please set driver-documents to PRIVATE manually from Supabase Dashboard → Storage → Settings';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. تحديث RLS: SELECT فقط للمالك أو الأدمن (بدل public)
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "driver_documents_select" ON storage.objects;
CREATE POLICY "driver_documents_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents' AND
  (
    -- السائق يرى ملفاته فقط
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- الأدمن يرى الكل
    public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- ─────────────────────────────────────────────────────────────────
-- 3. verify_controller_login RPC (كان مفقوداً من migrations)
-- ─────────────────────────────────────────────────────────────────
-- تُستدعى من admin-login Edge Function
-- تتحقق من email + password مقابل جدول controller
-- تُرجع بيانات الأدمن مع is_valid boolean
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.email,
    c.full_name,
    c.role,
    (c.password_hash = crypt(p_password, c.password_hash)) AS is_valid
  FROM public.controller c
  WHERE c.email = p_email
    AND c.is_active = true;
END;
$$;

-- صلاحيات: فقط service_role (Edge Function تستخدم service_role)
REVOKE ALL ON FUNCTION public.verify_controller_login(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.verify_controller_login(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_controller_login(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_controller_login(TEXT, TEXT) TO service_role;

-- تأكد من وجود extension pgcrypto (مطلوبة لـ crypt())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────
-- 4. إزالة rate_limit_log من Realtime publication
-- ─────────────────────────────────────────────────────────────────
-- السبب: مضاف لـ supabase_realtime لكن لا يوجد .channel() يستمع له
-- كل OTP/SMS يكتب row → WAL event → Realtime broadcast → لا مستقبل
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rate_limit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.rate_limit_log;
    RAISE NOTICE 'rate_limit_log removed from supabase_realtime publication';
  ELSE
    RAISE NOTICE 'rate_limit_log was not in supabase_realtime — skipping';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- ✅ ملاحظات ما بعد التطبيق:
--
-- 1. بعد تطبيق هذا الـ migration، كل URLs القديمة (getPublicUrl)
--    للوثائق ستتوقف عن العمل. يجب تحديث الكود ليستخدم
--    createSignedUrl() بدلاً منها.
--
-- 2. تحقق أن pgcrypto extension مفعّلة:
--    SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
--
-- 3. اختبر verify_controller_login:
--    SELECT * FROM verify_controller_login('admin@raan.app', 'test');
--    يجب أن ترجع صف واحد مع is_valid = true/false
--
-- 4. تحقق من Publications:
--    SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--    rate_limit_log يجب أن لا تظهر
-- ═══════════════════════════════════════════════════════════════════
