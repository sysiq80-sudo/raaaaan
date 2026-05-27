-- تحقيق القضية 3 (عمق): اختلاف بين company_earnings.total_fare و rides.final_fare
SELECT
  COUNT(*) AS mismatched_rows,
  SUM(r.final_fare - ce.total_fare) AS total_difference,
  SUM(r.final_fare) AS rides_sum,
  SUM(ce.total_fare) AS earnings_sum,
  -- هل هناك صفوف إضافية في company_earnings بلا رحلة مكتملة؟
  (SELECT COALESCE(SUM(ce2.total_fare), 0) FROM company_earnings ce2
   LEFT JOIN rides r2 ON r2.id = ce2.ride_id
   WHERE r2.id IS NULL OR r2.status != 'completed' OR COALESCE(r2.final_fare, 0) = 0
  ) AS orphan_or_incomplete_earnings
FROM rides r
JOIN company_earnings ce ON ce.ride_id = r.id
WHERE r.status = 'completed'
  AND r.final_fare > 0
  AND r.final_fare != ce.total_fare;
