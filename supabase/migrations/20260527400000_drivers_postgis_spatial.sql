-- ═══════════════════════════════════════════════════════════════
-- Phase 3B: PostGIS Spatial Filter for Driver Matching
-- ═══════════════════════════════════════════════════════════════
-- Adds location_geog column to drivers, keeps it in sync with
-- current_location JSONB via trigger, and exposes an RPC used by
-- match-ride to replace the full-table-scan with ST_DWithin.
-- ═══════════════════════════════════════════════════════════════

-- Make sure PostGIS is available (enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 1. Add geography column ──────────────────────────────────────
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS location_geog geography(Point, 4326);

-- ── 2. Partial GIST index (only active/online drivers) ───────────
-- Partial index matches the WHERE clause used in get_nearby_drivers,
-- so Postgres can use it for index-only spatial scans.
CREATE INDEX IF NOT EXISTS idx_drivers_location_geog_active
  ON public.drivers USING GIST (location_geog)
  WHERE is_online = true
    AND is_available = true
    AND status = 'approved'
    AND location_geog IS NOT NULL;

-- ── 3. Sync trigger: current_location JSONB → location_geog ──────
CREATE OR REPLACE FUNCTION public.sync_driver_location_geog()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_location IS NOT NULL
    AND (NEW.current_location->>'lat') IS NOT NULL
    AND (NEW.current_location->>'lng') IS NOT NULL
  THEN
    NEW.location_geog := ST_SetSRID(
      ST_MakePoint(
        (NEW.current_location->>'lng')::float8,
        (NEW.current_location->>'lat')::float8
      ),
      4326
    )::geography;
  ELSE
    NEW.location_geog := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop first (idempotent re-run safety)
DROP TRIGGER IF EXISTS trg_sync_driver_location_geog ON public.drivers;

CREATE TRIGGER trg_sync_driver_location_geog
  BEFORE INSERT OR UPDATE OF current_location
  ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.sync_driver_location_geog();

-- ── 4. Backfill existing rows ────────────────────────────────────
UPDATE public.drivers
SET location_geog = ST_SetSRID(
  ST_MakePoint(
    (current_location->>'lng')::float8,
    (current_location->>'lat')::float8
  ),
  4326
)::geography
WHERE current_location IS NOT NULL
  AND (current_location->>'lat') IS NOT NULL
  AND (current_location->>'lng') IS NOT NULL
  AND location_geog IS NULL;

-- ── 5. RPC: get_nearby_drivers ───────────────────────────────────
-- Used by match-ride Edge Function instead of full-table-scan.
-- Returns all online/available/approved drivers within p_radius_km.
-- The caller (match-ride) still applies exact per-driver radius
-- filtering in JS — this is a cheap spatial pre-filter only.
CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
  p_lat       float8,
  p_lng       float8,
  p_radius_km float8
)
RETURNS TABLE (
  id                 uuid,
  user_id            uuid,
  full_name          text,
  vehicle_type       text,
  current_location   jsonb,
  rating             numeric,
  total_rides        integer,
  max_pickup_radius  integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.user_id,
    d.full_name,
    d.vehicle_type::text,
    d.current_location,
    d.rating,
    d.total_rides,
    d.max_pickup_radius
  FROM public.drivers d
  WHERE d.is_online    = true
    AND d.is_available = true
    AND d.status       = 'approved'
    AND d.location_geog IS NOT NULL
    AND ST_DWithin(
      d.location_geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000.0  -- km → metres
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_drivers(float8, float8, float8)
  TO service_role;
