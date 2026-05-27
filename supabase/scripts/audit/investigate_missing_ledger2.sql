-- ════════════════════════════════════════════════════════════
-- تحقيق 2b: تصنيف الـ 71 رحلة المفقودة
-- هل هي قبل 2026-04-03 (بداية نظام wallet_transactions)؟
-- ════════════════════════════════════════════════════════════

SELECT
  CASE
    WHEN r.completed_at < '2026-04-03 17:07:15+00' THEN 'pre_wallet_system'
    ELSE 'post_wallet_system — خلل محتمل'
  END AS category,
  count(*) AS ride_count,
  COALESCE(sum(r.final_fare), 0) AS total_fare,
  min(r.completed_at) AS earliest,
  max(r.completed_at) AS latest
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id IS NOT NULL
  AND r.final_fare > 0
  AND wt.id IS NULL
GROUP BY category
ORDER BY category;
