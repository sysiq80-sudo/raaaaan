-- ════════════════════════════════════════════════════════════════════════════
-- Migration: financial-watchdog pg_cron schedule
-- ════════════════════════════════════════════════════════════════════════════
--
-- يُجدوِل تشغيل financial-watchdog كل ساعة عبر pg_cron
-- يستدعي الـ Edge Function باستخدام WATCHDOG_SECRET من app_settings
-- يجب ضبط WATCHDOG_SECRET في:
--   Supabase Dashboard → Edge Functions → Secrets → WATCHDOG_SECRET
--
-- ملاحظة: pg_cron extension يجب أن يكون مُفعَّلاً في المشروع.
--         تحقق من: Dashboard → Database → Extensions → pg_cron
-- ════════════════════════════════════════════════════════════════════════════

-- إلغاء الجدولة القديمة إن وجدت
SELECT cron.unschedule('financial-watchdog-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'financial-watchdog-hourly'
);

-- جدولة financial-watchdog كل ساعة (في الدقيقة 15 من كل ساعة)
-- توقيت 15 دقيقة لتجنب التزامن مع detect-fraud-patterns (إذا كان في الدقيقة 0)
SELECT cron.schedule(
  'financial-watchdog-hourly',
  '15 * * * *',  -- كل ساعة في الدقيقة 15
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/financial-watchdog',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', current_setting('app.watchdog_secret', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
