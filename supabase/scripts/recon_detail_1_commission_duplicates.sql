-- ============================================================
-- تحقيق تفصيلي: فحص 1 — تكرار company_earnings
-- هل يوجد أكثر من صف واحد لنفس ride_id؟
-- ============================================================
SELECT
  ce.ride_id,
  count(*) AS entries_per_ride,
  sum(ce.total_fare) AS sum_fare,
  sum(ce.commission_amount) AS sum_commission,
  min(ce.created_at) AS first_entry,
  max(ce.created_at) AS last_entry
FROM company_earnings ce
GROUP BY ce.ride_id
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 20;
