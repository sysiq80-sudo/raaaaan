-- تفصيل الـ 18 رحلة ذات الأجرة غير المتطابقة
SELECT
  r.id,
  r.payment_method,
  r.final_fare AS ride_final_fare,
  ce.total_fare AS earnings_total_fare,
  r.final_fare - ce.total_fare AS difference,
  r.estimated_fare,
  r.completed_at,
  (r.metadata->'receipt'->>'fare_adjusted')::TEXT AS fare_adjusted,
  (r.metadata->'receipt'->>'monetization_mode') AS monetization_mode,
  r.driver_id IS NOT NULL AS has_driver
FROM rides r
JOIN company_earnings ce ON ce.ride_id = r.id
WHERE r.status = 'completed'
  AND r.final_fare > 0
  AND r.final_fare != ce.total_fare
ORDER BY ABS(r.final_fare - ce.total_fare) DESC;
