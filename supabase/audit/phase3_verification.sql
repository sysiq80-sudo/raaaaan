-- ════════════════════════════════════════════════════════════════════════
-- Phase 3 Dispatch v2 — Verification Script
-- نفّذ هذا في Supabase SQL Editor للتحقق من سلامة كل الأجزاء
-- ════════════════════════════════════════════════════════════════════════

-- 1) جداول Phase 3 موجودة + RLS مفعّل
SELECT
  'driver_matching_stats' AS object,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='driver_matching_stats') AS exists,
  (SELECT relrowsecurity FROM pg_class
   WHERE relname='driver_matching_stats' AND relnamespace='public'::regnamespace) AS rls_enabled
UNION ALL
SELECT
  'directions_cache',
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='directions_cache'),
  (SELECT relrowsecurity FROM pg_class
   WHERE relname='directions_cache' AND relnamespace='public'::regnamespace);

-- 2) الـ triggers مُسجّلة
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN (
  'trg_update_driver_matching_stats',
  'trg_update_driver_cancellation_stats'
)
ORDER BY trigger_name;

-- 3) الدوال موجودة + SECURITY DEFINER
SELECT
  proname AS function_name,
  prosecdef AS is_security_definer,
  pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname IN (
  'update_driver_matching_stats',
  'update_driver_cancellation_stats',
  'recompute_driver_matching_stats',
  'cleanup_expired_directions_cache'
)
ORDER BY proname;

-- 4) dispatch_version فعلاً = v2 + الأوزان موجودة
SELECT
  key,
  value->>'dispatch_version' AS dispatch_version,
  value->>'weight_eta'       AS w_eta,
  value->>'weight_rating'    AS w_rating,
  value->>'weight_acceptance' AS w_acceptance,
  value->>'weight_cancellation' AS w_cancellation,
  value->>'weight_fairness'  AS w_fairness,
  value->>'eta_topk'         AS topk
FROM public.app_settings
WHERE key = 'matching_settings';

-- 5) عدّاد ride_matching_log الحالي (لمعرفة هل triggers تعمل في الإنتاج)
SELECT
  COUNT(*) AS total_logs,
  COUNT(*) FILTER (WHERE outcome = 'accepted')  AS accepted,
  COUNT(*) FILTER (WHERE outcome = 'rejected')  AS rejected,
  COUNT(*) FILTER (WHERE outcome = 'timeout')   AS timeouts,
  MAX(created_at) AS last_log_at
FROM public.ride_matching_log
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 6) عدد السائقين الذين لديهم stats محسوبة
SELECT
  COUNT(*) AS drivers_with_stats,
  AVG(acceptance_rate)::numeric(5,2) AS avg_acceptance,
  AVG(cancellation_rate)::numeric(5,2) AS avg_cancellation,
  MAX(updated_at) AS last_stats_update
FROM public.driver_matching_stats;

-- 7) directions_cache — حجم وعمر الإدخالات
SELECT
  COUNT(*) AS cached_routes,
  COUNT(*) FILTER (WHERE expires_at > NOW()) AS valid,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) AS expired,
  pg_size_pretty(pg_total_relation_size('public.directions_cache')) AS table_size
FROM public.directions_cache;

-- ════════════════════════════════════════════════════════════════════════
-- النتيجة المتوقعة:
--   1) كلا الجدولين exists=true, rls_enabled=true
--   2) trigger_name x2 ظاهر
--   3) أربع دوال is_security_definer=true
--   4) dispatch_version='v2'
--   5,6,7) أرقام (قد تكون صفر إذا لم يحدث طلب بعد)
-- ════════════════════════════════════════════════════════════════════════
