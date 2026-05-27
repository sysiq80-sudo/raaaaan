-- تفصيل الـ 71 رحلة المفقودة حسب monetization_mode
SELECT
  (r.metadata->'receipt'->>'monetization_mode') AS monetization_mode,
  COUNT(*) AS rides,
  SUM(r.final_fare) AS total_fare,
  SUM((r.metadata->'receipt'->>'commission_amount')::NUMERIC) AS total_commission,
  MIN(r.completed_at) AS earliest,
  MAX(r.completed_at) AS latest
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id = '362a73fc-8315-4266-9ebf-1de6b97fd245'
  AND r.payment_method = 'cash'
  AND wt.id IS NULL
GROUP BY (r.metadata->'receipt'->>'monetization_mode')
ORDER BY rides DESC;
