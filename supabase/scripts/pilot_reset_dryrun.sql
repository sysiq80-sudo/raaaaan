-- Pilot Reset Script - DRY RUN (Safe Mode via CTE & ROLLBACK)
-- This script does NOT commit any changes. It uses ROLLBACK at the end.
-- It returns a single JSON object containing all the counts of affected rows.

BEGIN;

WITH 
t1_act AS (
  UPDATE rides
  SET status = 'cancelled',
      updated_at = now()
  WHERE status IN ('pending', 'searching')
    AND created_at < now() - interval '30 minutes'
  RETURNING id
),
t1 AS (
  SELECT count(*) AS rides_cancelled FROM t1_act
),
t2_act AS (
  DELETE FROM driver_locations
  WHERE driver_id = '362a73fc-8315-4266-9ebf-1de6b97fd245'
  RETURNING driver_id
),
t2 AS (
  SELECT count(*) AS driver_locations_test_driver_deleted FROM t2_act
),
t3_act AS (
  UPDATE driver_locations
  SET is_online = false,
      updated_at = now()
  WHERE is_online = true
  RETURNING driver_id
),
t3 AS (
  SELECT count(*) AS driver_locations_set_offline FROM t3_act
),
t4_act AS (
  UPDATE drivers
  SET is_online = false,
      is_available = false,
      updated_at = now()
  WHERE is_online = true OR is_available = true
  RETURNING id
),
t4 AS (
  SELECT count(*) AS drivers_set_offline FROM t4_act
),
t5_act AS (
  DELETE FROM ride_tracking_points
  RETURNING id
),
t5 AS (
  SELECT count(*) AS ride_tracking_points_deleted FROM t5_act
)
SELECT 
  json_build_object(
    '1_rides_actually_cancelled', (SELECT rides_cancelled FROM t1),
    '2_driver_locations_test_driver_deleted', (SELECT driver_locations_test_driver_deleted FROM t2),
    '3_driver_locations_set_offline', (SELECT driver_locations_set_offline FROM t3),
    '4_drivers_set_offline', (SELECT drivers_set_offline FROM t4),
    '5_ride_tracking_points_deleted', (SELECT ride_tracking_points_deleted FROM t5)
  ) AS dry_run_summary;

ROLLBACK;
