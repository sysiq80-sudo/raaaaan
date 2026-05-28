-- ============================================================================
-- Security Hardening Migration
-- Date: 2026-09-05
-- Closes:
--   1. complete_ride_transactional accessible by authenticated users directly
--   2. add_ride_earning_trigger causes double financial write (old table)
--   3. get_nearby_pending_rides_geospatial accepts any driver_id without auth check
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. REVOKE complete_ride_transactional from all non-service roles
--    Reason: function accepts p_caller_user_id as external input.
--    Any authenticated user who knows another driver's UUID can impersonate them.
--    The Edge Function calls this via service_role — no need for authenticated access.
--
--    Uses dynamic signature lookup via pg_get_function_identity_arguments to
--    avoid type-alias mismatches (float8 vs double precision, int4 vs integer).
--    Silently skips if the function does not yet exist (e.g. first-time push
--    where 20260905100000 is applied in the same batch — it will be committed
--    before this block runs, but if not: NOTICE is emitted, no hard failure).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_args text;
BEGIN
  SELECT pg_get_function_identity_arguments(p.oid)
    INTO v_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'complete_ride_transactional'
   LIMIT 1;

  IF v_args IS NULL THEN
    RAISE NOTICE 'complete_ride_transactional not found — skipping REVOKE (will be secured when function is created)';
  ELSE
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.complete_ride_transactional(%s) FROM PUBLIC, anon, authenticated',
      v_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.complete_ride_transactional(%s) TO service_role',
      v_args
    );
    RAISE NOTICE 'complete_ride_transactional access restricted to service_role only (args: %)', v_args;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. DROP the old add_ride_earning_trigger
--    Reason: complete_ride_transactional now calls process_ride_earnings()
--    which writes to wallet_transactions (new table, with idempotency key).
--    The old trigger writes to driver_wallet_transactions (legacy table).
--    Both fire on the same UPDATE rides SET status='completed' →
--    driver receives earnings in two different tables simultaneously.
--    The trigger function itself is left in place (safe fallback if needed).
-- ════════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS add_ride_earning_trigger ON public.rides;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Rewrite get_nearby_pending_rides_geospatial with fail-closed auth guard
--    Reason: previous version accepted any p_driver_id from any authenticated
--    user — a rider could query rides visible to a competitor driver.
--    Now: RAISE EXCEPTION 'UNAUTHORIZED_DRIVER' if caller does not own
--    p_driver_id, or if driver is not approved/available.
--    Converted from LANGUAGE sql to plpgsql to support RAISE.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_nearby_pending_rides_geospatial(
  p_driver_id     UUID,
  p_radius_meters INTEGER DEFAULT 12000,
  p_limit         INTEGER DEFAULT 5
)
RETURNS SETOF public.rides
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ═══ Auth guard: caller must own this driver record AND be active ═══
  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers
    WHERE id          = p_driver_id
      AND user_id     = auth.uid()
      AND status      = 'approved'
      AND is_available = true
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_DRIVER'
      USING HINT = 'p_driver_id must belong to the calling user and driver must be approved and available';
  END IF;

  -- ═══ Main query: PostGIS spatial search for pending rides ═══
  RETURN QUERY
  SELECT r.*
  FROM public.rides r
  JOIN public.driver_locations dl ON dl.driver_id = p_driver_id
  JOIN public.drivers d ON d.id = p_driver_id
  WHERE r.status IN ('pending', 'searching')
    AND r.driver_id IS NULL
    AND dl.is_online = true
    AND dl.location IS NOT NULL
    AND (
      (d.vehicle_type = 'women_only' AND r.vehicle_type = 'women_only')
      OR (d.vehicle_type = 'economy'    AND r.vehicle_type = 'economy')
      OR (d.vehicle_type = 'comfort'    AND r.vehicle_type IN ('economy', 'comfort'))
      OR (d.vehicle_type = 'premium'    AND r.vehicle_type IN ('economy', 'comfort', 'premium'))
    )
    AND ST_DWithin(
      dl.location,
      COALESCE(
        r.pickup_geom::GEOGRAPHY,
        CASE
          WHEN r.pickup_location ? 'lat' AND r.pickup_location ? 'lng'
          THEN ST_SetSRID(
            ST_MakePoint(
              (r.pickup_location->>'lng')::DOUBLE PRECISION,
              (r.pickup_location->>'lat')::DOUBLE PRECISION
            ),
            4326
          )::GEOGRAPHY
          ELSE NULL
        END
      ),
      p_radius_meters
    )
  ORDER BY r.created_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 20));
END;
$$;

-- Re-apply grant (SECURITY DEFINER function — only authenticated needed to call it)
-- Note: actual identity verification is now inside the function body
GRANT EXECUTE ON FUNCTION public.get_nearby_pending_rides_geospatial(UUID, INTEGER, INTEGER)
  TO authenticated;

COMMENT ON FUNCTION public.get_nearby_pending_rides_geospatial(UUID, INTEGER, INTEGER) IS
'PostGIS nearby dispatch — fail-closed: RAISES UNAUTHORIZED_DRIVER if caller does not own p_driver_id or driver is not approved/available.';
