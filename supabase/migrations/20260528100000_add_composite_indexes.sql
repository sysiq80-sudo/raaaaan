-- =====================================================================
-- Composite Indexes for Query Performance
-- Date: 2026-05-28
-- Reason: Query pattern analysis revealed seq-scans on hot paths:
--   1. match-ride: active rides per user check (rider_id + status)
--   2. match-ride: fairness daily count (driver_id + status + created_at)
--   3. match-ride re-match: rejected drivers cleanup (ride_id + response)
--   4. DriverScheduledRidesBoard: scheduled rides lookup
-- =====================================================================

-- 1. rides(rider_id, status) — for active rides count in match-ride
--    Query: .eq("rider_id", uid).in("status", ["pending","accepted","in_progress"])
CREATE INDEX IF NOT EXISTS idx_rides_rider_id_status
  ON public.rides (rider_id, status);

-- 2. rides(driver_id, status, created_at) — fairness daily count in match-ride
--    Query: .in("driver_id", ids).eq("status","completed").gte("created_at", todayStart)
CREATE INDEX IF NOT EXISTS idx_rides_driver_id_status_created_at
  ON public.rides (driver_id, status, created_at DESC);

-- 3. ride_matching_log(ride_id, response) — re-match: clear rejected drivers
--    Query: .eq("ride_id", id).in("response", ["rejected","timeout"])
CREATE INDEX IF NOT EXISTS idx_ride_matching_log_ride_id_response
  ON public.ride_matching_log (ride_id, response);

-- 4. scheduled_rides(status, driver_id, scheduled_at) — DriverScheduledRidesBoard
--    Query: .eq("status","scheduled").is("driver_id",null).gte("scheduled_at",now)
CREATE INDEX IF NOT EXISTS idx_scheduled_rides_status_driver_id
  ON public.scheduled_rides (status, driver_id, scheduled_at ASC);
