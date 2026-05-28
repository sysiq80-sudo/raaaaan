-- Phase 3: جدولة cron-dispatch عبر pg_cron
-- لا يوجد JWT مكشوف — يقرأ الـ secret من Supabase Vault عند الاستدعاء
-- cron-dispatch يقبل x-internal-secret فقط
--
-- بعد تشغيل هذا الـ migration:
--   1. Supabase Dashboard → Vault → Add new secret
--   2. Name: internal_edge_secret
--   3. Value: نفس قيمة INTERNAL_EDGE_SECRET في Edge Function Secrets

-- 1. إنشاء schema private إن لم يوجد
CREATE SCHEMA IF NOT EXISTS private;

-- 2. دالة مساعدة: تقرأ الـ secret من Vault ديناميكياً عند الاستدعاء
--    SECURITY DEFINER — تعمل بصلاحية منشئها (postgres) للوصول إلى vault
--    لا تُعدَّل vault.secrets هنا — يتم ذلك يدوياً عبر Dashboard
CREATE OR REPLACE FUNCTION private.trigger_cron_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'internal_edge_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING '[cron-dispatch] internal_edge_secret not found in vault — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/cron-dispatch',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-internal-secret', v_secret
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- 3. إلغاء الجدول القديم إن وُجد (idempotent)
SELECT cron.unschedule('cron-dispatch-retry')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cron-dispatch-retry'
);

-- 4. جدولة كل دقيقة — بدون أي secret في الكود
SELECT cron.schedule(
  'cron-dispatch-retry',
  '* * * * *',
  $$SELECT private.trigger_cron_dispatch()$$
);
