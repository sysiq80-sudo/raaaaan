-- تحقيق القضية 3: fare_vs_earnings gap
-- أي الرحلات لديها final_fare لكن بلا company_earnings؟

SELECT
  COUNT(*) AS rides_without_company_earnings,
  SUM(r.final_fare) AS total_fare_gap,
  MIN(r.completed_at) AS earliest,
  MAX(r.completed_at) AS latest,
  COUNT(*) FILTER (WHERE r.driver_id IS NULL) AS rides_no_driver,
  COUNT(*) FILTER (WHERE r.driver_id IS NOT NULL) AS rides_with_driver
FROM rides r
LEFT JOIN company_earnings ce ON ce.ride_id = r.id
WHERE r.status = 'completed'
  AND r.final_fare > 0
  AND ce.id IS NULL;
