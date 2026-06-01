-- ============================================================
-- إصلاح race condition: تنظيف تكرارات company_earnings
-- ثم تأمين بـ UNIQUE constraint
-- يعمل في transaction واحدة
-- ============================================================

BEGIN;

-- الخطوة 1: احتفظ بأقدم سجل لكل ride_id واحذف الباقي
DELETE FROM company_earnings
WHERE id NOT IN (
  SELECT DISTINCT ON (ride_id) id
  FROM company_earnings
  ORDER BY ride_id, created_at ASC
);

-- الخطوة 2: تحقق من عدم وجود تكرارات بعد الحذف
DO $$
DECLARE
  remaining_dupes INT;
BEGIN
  SELECT count(*) INTO remaining_dupes
  FROM (
    SELECT ride_id FROM company_earnings
    GROUP BY ride_id HAVING count(*) > 1
  ) sub;

  IF remaining_dupes > 0 THEN
    RAISE EXCEPTION 'لا تزال توجد % رحلة مكررة بعد الحذف — تراجع عن الـ transaction', remaining_dupes;
  END IF;

  RAISE NOTICE 'تم التحقق: لا تكرارات متبقية';
END;
$$;

-- الخطوة 3: إضافة UNIQUE constraint
ALTER TABLE company_earnings
  ADD CONSTRAINT unique_ride_commission UNIQUE (ride_id);

COMMIT;

-- التحقق النهائي
SELECT
  count(*) AS total_rows,
  count(DISTINCT ride_id) AS unique_rides,
  count(*) - count(DISTINCT ride_id) AS remaining_duplicates
FROM company_earnings;
