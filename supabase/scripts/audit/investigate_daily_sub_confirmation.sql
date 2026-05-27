-- تحقق 3: هل الرحلات الـ 71 موجودة في company_earnings؟
-- وتحقق من تاريخ تبديل monetization_mode

-- 1. company_earnings للرحلات المفقودة
SELECT
  COUNT(*) AS rides_in_company_earnings,
  MIN(ce.created_at) AS earliest,
  MAX(ce.created_at) AS latest,
  SUM(ce.total_fare) AS total_fare_sum,
  SUM(ce.commission_amount) AS total_commission,
  MIN(ce.commission_rate) AS min_rate,
  MAX(ce.commission_rate) AS max_rate
FROM rides r
LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
JOIN company_earnings ce ON ce.ride_id = r.id
WHERE r.status = 'completed'
  AND r.driver_id = '362a73fc-8315-4266-9ebf-1de6b97fd245'
  AND r.payment_method = 'cash'
  AND wt.id IS NULL;
