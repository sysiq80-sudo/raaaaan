-- ════════════════════════════════════════════════════════════
-- تحقيق 2c: تحليل الرحلات المفقودة — ما الذي يجمعها؟
-- ════════════════════════════════════════════════════════════

SELECT
  r.payment_method,
  r.driver_id,
  count(*) AS missing_count,
  COALESCE(sum(r.final_fare), 0) AS missing_fare,
  -- هل لديها أي commission في wallet_transactions؟
  count(wt_comm.id) AS has_commission_tx
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
LEFT JOIN wallet_transactions wt_comm
  ON wt_comm.ride_id = r.id AND wt_comm.transaction_type = 'commission'
WHERE r.status = 'completed'
  AND r.driver_id IS NOT NULL
  AND r.final_fare > 0
  AND wt.id IS NULL
GROUP BY r.payment_method, r.driver_id
ORDER BY missing_count DESC;
