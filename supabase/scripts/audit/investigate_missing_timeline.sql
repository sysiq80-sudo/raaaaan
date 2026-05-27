-- ════════════════════════════════════════════════════════════
-- تحقيق 2e: توزيع الرحلات المفقودة عبر الزمن
-- ════════════════════════════════════════════════════════════

SELECT
  date_trunc('day', r.completed_at AT TIME ZONE 'Asia/Baghdad') AS day,
  count(*) AS missing_rides,
  COALESCE(sum(r.final_fare), 0) AS missing_fare
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id IS NOT NULL
  AND r.final_fare > 0
  AND wt.id IS NULL
GROUP BY day
ORDER BY day;
