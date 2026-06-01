-- التحقق من captain_compensation_shield_trigger و add_cancellation_compensation
SELECT
  'captain_compensation_shield_trigger' AS check_name,
  CASE WHEN prosrc LIKE '%distance_to_pickup_at_cancel%' THEN 'YES' ELSE 'MISSING' END AS has_distance_field
FROM pg_proc
WHERE proname = 'captain_compensation_shield_trigger'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

UNION ALL

SELECT
  'add_cancellation_compensation (should be 0)',
  COUNT(*)::TEXT
FROM pg_proc
WHERE proname = 'add_cancellation_compensation'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
