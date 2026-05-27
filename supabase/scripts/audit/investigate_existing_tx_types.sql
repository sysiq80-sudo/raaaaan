-- ════════════════════════════════════════════════════════════
-- تحقيق 2f: ما نوع wallet_transactions للرحلات الموجودة؟
-- ════════════════════════════════════════════════════════════

-- نوع المعاملات في الرحلات الكاش التي لديها قيود
SELECT
  wt.transaction_type,
  count(*) AS count,
  min(wt.created_at) AS earliest,
  max(wt.created_at) AS latest
FROM rides r
JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id IS NOT NULL
  AND r.payment_method = 'cash'
GROUP BY wt.transaction_type
ORDER BY count DESC;
