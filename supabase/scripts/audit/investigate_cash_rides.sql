-- ════════════════════════════════════════════════════════════
-- تحقيق 2d: ما هي طرق الدفع للرحلات التي لديها قيد؟
-- ════════════════════════════════════════════════════════════

SELECT
  r.payment_method,
  count(DISTINCT r.id) AS ride_count,
  count(wt.id) AS wallet_tx_count
FROM rides r
JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id IS NOT NULL
GROUP BY r.payment_method
ORDER BY ride_count DESC;
