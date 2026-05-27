-- فحص بنية الـ 71 رحلة المفقودة: هل لها final_fare و metadata/receipt؟
SELECT
  r.id,
  r.status,
  r.payment_method,
  r.final_fare,
  r.estimated_fare,
  r.completed_at,
  CASE
    WHEN r.metadata ? 'receipt' THEN 'has_receipt'
    ELSE 'no_receipt'
  END AS metadata_receipt,
  (r.metadata->'receipt'->>'monetization_mode') AS monetization_mode,
  (r.metadata->'receipt'->>'commission_amount')::NUMERIC AS commission_amount
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id = '362a73fc-8315-4266-9ebf-1de6b97fd245'
  AND r.payment_method = 'cash'
  AND wt.id IS NULL
ORDER BY r.completed_at DESC
LIMIT 10;
