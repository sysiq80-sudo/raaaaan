-- ═══════════════════════════════════════════════════════════
-- أثقل الاستعلامات بناءً على pg_stat_statements
-- ═══════════════════════════════════════════════════════════

-- 1. أثقل 20 استعلاماً بإجمالي وقت التنفيذ
SELECT
  LEFT(query, 120)                                        AS query_preview,
  calls,
  ROUND((total_exec_time / 1000)::numeric, 2)             AS total_sec,
  ROUND((mean_exec_time)::numeric, 2)                     AS mean_ms,
  ROUND((max_exec_time)::numeric, 2)                      AS max_ms,
  ROUND((stddev_exec_time)::numeric, 2)                   AS stddev_ms,
  ROUND((rows / NULLIF(calls, 0))::numeric, 1)            AS avg_rows,
  ROUND((shared_blks_hit /
    NULLIF(shared_blks_hit + shared_blks_read, 0) * 100)::numeric, 1) AS cache_hit_pct
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat%'
  AND query NOT ILIKE '%BEGIN%'
  AND calls > 5
ORDER BY total_exec_time DESC
LIMIT 20;
