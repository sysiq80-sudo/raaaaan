-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  RPC Functions: أحجام الجداول وحالة Cron Jobs              ║
-- ║  تُستخدم بواسطة صفحة قدرة النظام /admin/system-capacity    ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- ───────────────────────────────────────────
-- 1) get_table_sizes: أكبر 15 جدول حسب الحجم
-- ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE (
  table_name text,
  total_size text,
  data_size text,
  size_bytes bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.schemaname || '.' || t.tablename,
    pg_size_pretty(pg_total_relation_size(t.schemaname || '.' || t.tablename)),
    pg_size_pretty(pg_relation_size(t.schemaname || '.' || t.tablename)),
    pg_total_relation_size(t.schemaname || '.' || t.tablename)
  FROM pg_tables t
  WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema', 'supabase_migrations')
  ORDER BY pg_total_relation_size(t.schemaname || '.' || t.tablename) DESC
  LIMIT 15;
$$;

-- ───────────────────────────────────────────
-- 2) get_cron_job_status: حالة cleanup jobs
-- ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS TABLE (
  job_name text,
  schedule text,
  last_run timestamptz,
  last_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.jobname::text,
    j.schedule::text,
    d.end_time,
    d.status::text
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT end_time, status
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY end_time DESC
    LIMIT 1
  ) d ON true
  WHERE j.jobname LIKE 'cleanup-%'
  ORDER BY j.jobname;
$$;

-- ───────────────────────────────────────────
-- الصلاحيات: فقط authenticated (الأدمن)
-- ───────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job_status() TO authenticated;
