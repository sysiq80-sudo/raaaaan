-- ============================================================
-- تحقيق تفصيلي: فحص 2 — رحلات بدون قيد wallet_transactions
-- 70 رحلة مكتملة بدون سجل أرباح سائق
-- ============================================================

-- ملخص: توزيع هذه الرحلات على payment_method
SELECT
  r.payment_method::text AS payment_method,
  count(*) AS count,
  sum(r.final_fare) AS total_fare,
  min(r.completed_at) AS earliest,
  max(r.completed_at) AS latest
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id IS NOT NULL
  AND r.final_fare > 0
  AND wt.id IS NULL
GROUP BY r.payment_method::text
ORDER BY count DESC;
