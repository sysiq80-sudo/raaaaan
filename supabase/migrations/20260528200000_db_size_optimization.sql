-- ═══════════════════════════════════════════════════════════════════
-- Migration: تحسين حجم قاعدة البيانات والـ WAL
-- DB Size & WAL Optimization — 2026-05-28
-- ═══════════════════════════════════════════════════════════════════
--
-- المشكلة:
--   • ثلاثة جداول بها REPLICA IDENTITY FULL بلا ضرورة فعلية.
--     كل UPDATE على rides (مثلاً) يكتب ~30+ عمود كاملاً في WAL حتى لو تغيّر عمود واحد.
--   • push_subscriptions في Realtime Publication بلا مستخدم يستمع.
--   • cleanup_old_analytics() موجودة منذ فبراير 2026 لكن لم تُجدَّل أبداً → analytics_events تتراكم.
--   • notifications_log و admin_audit_logs و bot_conversation_messages تتراكم بلا تنظيف.
--
-- التأثير المتوقع:
--   • تقليل WAL بنسبة ~30-40% عند تحديثات حالة الرحلات.
--   • تقليل حجم Realtime events لـ push_subscriptions.
--   • حذف 3+ أشهر بيانات analytics متراكمة (بعد أول تشغيل cron).
--   • منع تراكم البيانات مستقبلاً في 4 جداول.
--
-- ملاحظات التحقق (Frontend Safety):
--   • rides DEFAULT: DriverHome.tsx يستخدم payload.old.status كـ fallback فقط — عند DELETE مع
--     DEFAULT يصبح undefined → يدخل fetchActiveRideStatus() وهو السلوك الصحيح. ✅
--   • admin_notifications DEFAULT: AdminNotificationsBell.tsx يستمع INSERT فقط ويقرأ payload.new ✅
--   • dual_stop_alerts DEFAULT: لا يوجد مستمع Realtime يستخدم payload.old ✅
--   • profiles: تبقى كما هي في Realtime — RidersLiveMap.tsx تشترك في UPDATE events ✅
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. rides: REPLICA IDENTITY FULL → DEFAULT
-- ─────────────────────────────────────────────────────────────────
-- السبب: كل UPDATE على rides (تغيير status, driver_id, الخ) يكتب جميع أعمدة الجدول (~30 عمود)
-- في WAL. مع DEFAULT يكتب فقط العمود المفتاحي (id).
-- Frontend: لا يوجد كود يعتمد على payload.old من rides في Realtime بشكل ضروري.
ALTER TABLE public.rides REPLICA IDENTITY DEFAULT;

COMMENT ON TABLE public.rides IS 'جدول الرحلات — Realtime مفعّل، REPLICA IDENTITY DEFAULT (2026-05-28: تقليل WAL)';

-- ─────────────────────────────────────────────────────────────────
-- 2. admin_notifications: REPLICA IDENTITY FULL → DEFAULT
-- ─────────────────────────────────────────────────────────────────
-- السبب: AdminNotificationsBell.tsx يستمع INSERT فقط. لا حاجة لـ FULL.
ALTER TABLE public.admin_notifications REPLICA IDENTITY DEFAULT;

-- ─────────────────────────────────────────────────────────────────
-- 3. dual_stop_alerts: REPLICA IDENTITY FULL → DEFAULT
-- ─────────────────────────────────────────────────────────────────
-- السبب: لا يوجد مستمع Realtime يستخدم payload.old على هذا الجدول.
ALTER TABLE public.dual_stop_alerts REPLICA IDENTITY DEFAULT;

-- ─────────────────────────────────────────────────────────────────
-- 4. إزالة push_subscriptions من Realtime Publication
-- ─────────────────────────────────────────────────────────────────
-- السبب: لا يوجد .channel() في الكود يشترك في push_subscriptions.
-- كل UPDATE على FCM tokens يسبب WAL write + Realtime broadcast بلا مستقبل.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'push_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.push_subscriptions;
    RAISE NOTICE 'push_subscriptions removed from supabase_realtime publication';
  ELSE
    RAISE NOTICE 'push_subscriptions was not in supabase_realtime publication — skipping';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 5. جدولة cleanup_old_analytics() — كانت منسية منذ فبراير 2026!
-- ─────────────────────────────────────────────────────────────────
-- الدالة موجودة في migration 20260226140000 لكن لم تُجدَّل أبداً.
-- analytics_events تتراكم منذ 3+ أشهر بلا حذف.
-- الجدول: كل أحد الساعة 02:00 UTC
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- إلغاء الجدولة القديمة إن وجدت
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-analytics-events') THEN
      PERFORM cron.unschedule('cleanup-analytics-events');
    END IF;
    -- جدولة أسبوعية كل أحد 02:00 UTC
    PERFORM cron.schedule(
      'cleanup-analytics-events',
      '0 2 * * 0',
      $$SELECT public.cleanup_old_analytics()$$
    );
    RAISE NOTICE 'cleanup-analytics-events scheduled: every Sunday 02:00 UTC';
  ELSE
    RAISE NOTICE 'pg_cron not available — cleanup-analytics-events NOT scheduled';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error scheduling cleanup-analytics-events: %', SQLERRM;
END $do$;

-- ─────────────────────────────────────────────────────────────────
-- 6. notifications_log: دالة تنظيف + جدولة (احتفاظ 60 يوم)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.notifications_log
  WHERE created_at < now() - interval '60 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-notifications-log') THEN
      PERFORM cron.unschedule('cleanup-notifications-log');
    END IF;
    -- كل اثنين 03:00 UTC
    PERFORM cron.schedule(
      'cleanup-notifications-log',
      '0 3 * * 1',
      $$SELECT public.cleanup_old_notifications_log()$$
    );
    RAISE NOTICE 'cleanup-notifications-log scheduled: every Monday 03:00 UTC';
  ELSE
    RAISE NOTICE 'pg_cron not available — cleanup-notifications-log NOT scheduled';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error scheduling cleanup-notifications-log: %', SQLERRM;
END $do$;

-- ─────────────────────────────────────────────────────────────────
-- 7. admin_audit_logs: دالة تنظيف + جدولة (احتفاظ 365 يوم)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_admin_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.admin_audit_logs
  WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-admin-audit-logs') THEN
      PERFORM cron.unschedule('cleanup-admin-audit-logs');
    END IF;
    -- أول يوم كل شهر 04:00 UTC
    PERFORM cron.schedule(
      'cleanup-admin-audit-logs',
      '0 4 1 * *',
      $$SELECT public.cleanup_old_admin_audit_logs()$$
    );
    RAISE NOTICE 'cleanup-admin-audit-logs scheduled: 1st of every month 04:00 UTC';
  ELSE
    RAISE NOTICE 'pg_cron not available — cleanup-admin-audit-logs NOT scheduled';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error scheduling cleanup-admin-audit-logs: %', SQLERRM;
END $do$;

-- ─────────────────────────────────────────────────────────────────
-- 8. bot_conversation_messages: دالة تنظيف + جدولة (احتفاظ 90 يوم)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_bot_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.bot_conversation_messages
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-bot-messages') THEN
      PERFORM cron.unschedule('cleanup-bot-messages');
    END IF;
    -- كل أربعاء 03:00 UTC
    PERFORM cron.schedule(
      'cleanup-bot-messages',
      '0 3 * * 3',
      $$SELECT public.cleanup_old_bot_messages()$$
    );
    RAISE NOTICE 'cleanup-bot-messages scheduled: every Wednesday 03:00 UTC';
  ELSE
    RAISE NOTICE 'pg_cron not available — cleanup-bot-messages NOT scheduled';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error scheduling cleanup-bot-messages: %', SQLERRM;
END $do$;

-- ─────────────────────────────────────────────────────────────────
-- 9. net._http_response: تنظيف يومي (احتفاظ 3 أيام)
-- ─────────────────────────────────────────────────────────────────
-- السبب: كل net.http_post() في الـ triggers (إشعارات واتساب، push) يحفظ الـ response هنا.
-- كان حجمه 197 MB = 47% من حجم الـ DB الكلي!
-- كل يوم 01:00 UTC
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-http-responses') THEN
      PERFORM cron.unschedule('cleanup-http-responses');
    END IF;
    PERFORM cron.schedule(
      'cleanup-http-responses',
      '0 1 * * *',
      $$DELETE FROM net._http_response WHERE created < now() - interval '3 days'$$
    );
    RAISE NOTICE 'cleanup-http-responses scheduled: daily 01:00 UTC';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error scheduling cleanup-http-responses: %', SQLERRM;
END $do$;

-- ─────────────────────────────────────────────────────────────────
-- 10. cron.job_run_details: تنظيف يومي (احتفاظ 7 أيام)
-- ─────────────────────────────────────────────────────────────────
-- السبب: كل تشغيل cron job يسجّل النتيجة هنا.
-- process_scheduled_notifications يعمل كل دقيقة = 1,440 صف/يوم.
-- كان حجمه 141 MB = 33% من حجم الـ DB الكلي!
-- كل يوم 01:30 UTC
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-run-details') THEN
      PERFORM cron.unschedule('cleanup-cron-run-details');
    END IF;
    PERFORM cron.schedule(
      'cleanup-cron-run-details',
      '30 1 * * *',
      $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
    );
    RAISE NOTICE 'cleanup-cron-run-details scheduled: daily 01:30 UTC';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error scheduling cleanup-cron-run-details: %', SQLERRM;
END $do$;

-- ═══════════════════════════════════════════════════════════════════
-- ✅ انتهى — ملاحظات ما بعد التطبيق:
--
-- 1. تحقق من Publications:
--    Supabase Dashboard → Database → Publications → supabase_realtime
--    تأكد أن push_subscriptions لم تعد موجودة في القائمة.
--
-- 2. تحقق من pg_cron jobs:
--    SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
--    يجب أن تظهر 4 jobs: cleanup-analytics-events, cleanup-notifications-log,
--    cleanup-admin-audit-logs, cleanup-bot-messages.
--
-- 3. خطوة يدوية (بعد أول تشغيل cleanup):
--    VACUUM ANALYZE rides;
--    VACUUM ANALYZE driver_live_locations;
--    VACUUM ANALYZE notifications_log;
--    (تُنفَّذ من Supabase SQL Editor في وقت هادئ)
--
-- 4. مراقبة الحجم:
--    SELECT pg_size_pretty(pg_total_relation_size('public.rides')) AS rides_size;
--    بعد أسبوع يجب أن يتوقف النمو المتسارع في حجم DB.
-- ═══════════════════════════════════════════════════════════════════
