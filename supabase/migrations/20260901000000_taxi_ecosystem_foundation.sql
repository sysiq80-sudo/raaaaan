-- ============================================================================
-- Taxi Ecosystem Foundation (Incremental, backward-compatible)
-- Scope:
-- 1) PostGIS enablement + geospatial indexes
-- 2) Canonical tables: users, vehicles, driver_locations, payments
-- 3) rides table extensions: pickup_geom, dropoff_geom (multi-stop), fare_amount, otp_code
-- 4) RLS hardening helpers + nearby dispatch visibility for drivers
-- 5) Atomic ride acceptance RPC (race-condition safe)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- Types required by canonical schema
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'taxi_user_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.taxi_user_role AS ENUM ('rider', 'driver', 'admin');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'kyc_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.kyc_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payment_state' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.payment_state AS ENUM ('pending', 'paid', 'failed', 'refunded');
  END IF;
END $$;

-- Add searching status required by dispatch flow.
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'searching' AFTER 'pending';

-- ----------------------------------------------------------------------------
-- Canonical Users table (mapped to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.taxi_user_role NOT NULL DEFAULT 'rider',
  full_name TEXT,
  phone TEXT,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON public.users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE phone IS NOT NULL;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin
ON public.users
FOR SELECT
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS users_insert_own_or_service ON public.users;
CREATE POLICY users_insert_own_or_service
ON public.users
FOR INSERT
WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS users_update_own_or_admin ON public.users;
CREATE POLICY users_update_own_or_admin
ON public.users
FOR UPDATE
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Keep updated_at in sync.
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill users from profiles/user_roles/drivers.
INSERT INTO public.users (id, role, full_name, phone, wallet_balance, rating, kyc_status, created_at, updated_at)
SELECT
  p.user_id AS id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'admin'
    ) THEN 'admin'::public.taxi_user_role
    WHEN EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = p.user_id
    ) THEN 'driver'::public.taxi_user_role
    ELSE 'rider'::public.taxi_user_role
  END AS role,
  p.full_name,
  p.phone,
  0::NUMERIC(12,2) AS wallet_balance,
  COALESCE((SELECT d.rating::NUMERIC(3,2) FROM public.drivers d WHERE d.user_id = p.user_id LIMIT 1), 5.00) AS rating,
  COALESCE(
    (
      SELECT CASE d.status
        WHEN 'approved' THEN 'approved'::public.kyc_status
        WHEN 'rejected' THEN 'rejected'::public.kyc_status
        WHEN 'suspended' THEN 'suspended'::public.kyc_status
        ELSE 'pending'::public.kyc_status
      END
      FROM public.drivers d
      WHERE d.user_id = p.user_id
      LIMIT 1
    ),
    'pending'::public.kyc_status
  ) AS kyc_status,
  p.created_at,
  p.updated_at
FROM public.profiles p
ON CONFLICT (id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  phone = COALESCE(EXCLUDED.phone, public.users.phone),
  role = EXCLUDED.role,
  rating = COALESCE(EXCLUDED.rating, public.users.rating),
  kyc_status = EXCLUDED.kyc_status,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- Canonical Vehicles table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  make TEXT,
  model TEXT,
  plate_number TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vehicles_plate_number UNIQUE (plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON public.vehicles(driver_id);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicles_select_driver_or_admin ON public.vehicles;
CREATE POLICY vehicles_select_driver_or_admin
ON public.vehicles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
);

DROP POLICY IF EXISTS vehicles_insert_driver_or_admin ON public.vehicles;
CREATE POLICY vehicles_insert_driver_or_admin
ON public.vehicles
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
);

DROP POLICY IF EXISTS vehicles_update_driver_or_admin ON public.vehicles;
CREATE POLICY vehicles_update_driver_or_admin
ON public.vehicles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
);

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed one vehicle row per driver when no vehicle record exists.
INSERT INTO public.vehicles (driver_id, make, model, plate_number, color)
SELECT d.id, NULL, d.vehicle_model, COALESCE(NULLIF(d.vehicle_plate, ''), CONCAT('DRV-', d.id::TEXT)), d.vehicle_color
FROM public.drivers d
WHERE NOT EXISTS (
  SELECT 1 FROM public.vehicles v WHERE v.driver_id = d.id
)
ON CONFLICT (plate_number) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Canonical Driver Locations table (PostGIS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326),
  heading DOUBLE PRECISION,
  is_online BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_geo ON public.driver_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON public.driver_locations(is_online);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_locations_select_self_or_admin ON public.driver_locations;
CREATE POLICY driver_locations_select_self_or_admin
ON public.driver_locations
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
);

DROP POLICY IF EXISTS driver_locations_upsert_self_or_service ON public.driver_locations;
CREATE POLICY driver_locations_upsert_self_or_service
ON public.driver_locations
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
);

DROP POLICY IF EXISTS driver_locations_update_self_or_service ON public.driver_locations;
CREATE POLICY driver_locations_update_self_or_service
ON public.driver_locations
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
)
WITH CHECK (
  auth.role() = 'service_role'
  OR driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
);

-- Backfill from drivers.current_location JSON if present.
INSERT INTO public.driver_locations (driver_id, location, heading, is_online, updated_at)
SELECT
  d.id,
  CASE
    WHEN d.current_location ? 'lat' AND d.current_location ? 'lng'
    THEN ST_SetSRID(
      ST_MakePoint((d.current_location->>'lng')::DOUBLE PRECISION, (d.current_location->>'lat')::DOUBLE PRECISION),
      4326
    )::GEOGRAPHY
    ELSE NULL
  END AS location,
  NULL::DOUBLE PRECISION AS heading,
  COALESCE(d.is_online, false),
  now()
FROM public.drivers d
ON CONFLICT (driver_id) DO UPDATE
SET
  location = COALESCE(EXCLUDED.location, public.driver_locations.location),
  is_online = EXCLUDED.is_online,
  updated_at = now();

-- ----------------------------------------------------------------------------
-- rides table extensions to match canonical requirements
-- ----------------------------------------------------------------------------
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS pickup_geom GEOMETRY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS dropoff_geom JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fare_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS otp_code TEXT;

-- Keep fare_amount in sync for old/new code paths.
UPDATE public.rides
SET fare_amount = COALESCE(fare_amount, final_fare::NUMERIC(12,2), estimated_fare::NUMERIC(12,2));

-- Backfill pickup_geom from pickup_location json.
UPDATE public.rides
SET pickup_geom = ST_SetSRID(
  ST_MakePoint((pickup_location->>'lng')::DOUBLE PRECISION, (pickup_location->>'lat')::DOUBLE PRECISION),
  4326
)
WHERE pickup_geom IS NULL
  AND pickup_location IS NOT NULL
  AND pickup_location ? 'lat'
  AND pickup_location ? 'lng';

CREATE INDEX IF NOT EXISTS idx_rides_pickup_geom_gist ON public.rides USING GIST (pickup_geom);
CREATE INDEX IF NOT EXISTS idx_rides_status_driver_id ON public.rides(status, driver_id);

-- Keep pickup_geom automatically aligned with pickup_location.
CREATE OR REPLACE FUNCTION public.sync_pickup_geom_from_json()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pickup_location IS NOT NULL
     AND NEW.pickup_location ? 'lat'
     AND NEW.pickup_location ? 'lng'
  THEN
    NEW.pickup_geom := ST_SetSRID(
      ST_MakePoint(
        (NEW.pickup_location->>'lng')::DOUBLE PRECISION,
        (NEW.pickup_location->>'lat')::DOUBLE PRECISION
      ),
      4326
    );
  END IF;

  IF NEW.fare_amount IS NULL THEN
    NEW.fare_amount := COALESCE(NEW.final_fare::NUMERIC(12,2), NEW.estimated_fare::NUMERIC(12,2));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pickup_geom_from_json ON public.rides;
CREATE TRIGGER trg_sync_pickup_geom_from_json
BEFORE INSERT OR UPDATE OF pickup_location, estimated_fare, final_fare, fare_amount
ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.sync_pickup_geom_from_json();

-- ----------------------------------------------------------------------------
-- Canonical payments table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'Digital Wallet', 'Credit Card')),
  status public.payment_state NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON public.payments(ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_owner_or_admin ON public.payments;
CREATE POLICY payments_select_owner_or_admin
ON public.payments
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS payments_insert_owner_or_service ON public.payments;
CREATE POLICY payments_insert_owner_or_service
ON public.payments
FOR INSERT
WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS payments_update_admin_or_service ON public.payments;
CREATE POLICY payments_update_admin_or_service
ON public.payments
FOR UPDATE
USING (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Dispatch visibility helper functions for RLS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.drivers d
  WHERE d.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_nearby_dispatch_ride(p_ride_id UUID, p_radius_meters INTEGER DEFAULT 12000)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rides r
    JOIN public.driver_locations dl ON dl.driver_id = public.current_driver_id()
    WHERE r.id = p_ride_id
      AND r.status IN ('pending', 'searching')
      AND r.driver_id IS NULL
      AND dl.is_online = true
      AND dl.location IS NOT NULL
      AND ST_DWithin(
        dl.location,
        COALESCE(
          r.pickup_geom::GEOGRAPHY,
          CASE
            WHEN r.pickup_location ? 'lat' AND r.pickup_location ? 'lng'
            THEN ST_SetSRID(
              ST_MakePoint((r.pickup_location->>'lng')::DOUBLE PRECISION, (r.pickup_location->>'lat')::DOUBLE PRECISION),
              4326
            )::GEOGRAPHY
            ELSE NULL
          END
        ),
        p_radius_meters
      )
  )
$$;

-- Drivers can see assigned rides and nearby broadcastable rides.
DROP POLICY IF EXISTS drivers_can_view_assigned_or_nearby_rides ON public.rides;
CREATE POLICY drivers_can_view_assigned_or_nearby_rides
ON public.rides
FOR SELECT
USING (
  driver_id = public.current_driver_id()
  OR public.is_nearby_dispatch_ride(id)
  OR public.has_role(auth.uid(), 'admin')
);

-- ----------------------------------------------------------------------------
-- Atomic acceptance RPC (single winner)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_ride_atomic(
  target_ride_id UUID,
  acc_driver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride public.rides%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
BEGIN
  -- Validate driver ownership and lock driver row.
  SELECT * INTO v_driver
  FROM public.drivers d
  WHERE d.id = acc_driver_id
    AND (d.user_id = auth.uid() OR auth.role() = 'service_role')
    AND d.status = 'approved'
    AND d.is_online = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'السائق غير صالح أو غير متصل.');
  END IF;

  -- Lock the ride row; skip if already accepted/cancelled/completed.
  SELECT * INTO v_ride
  FROM public.rides r
  WHERE r.id = target_ride_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'الرحلة غير موجودة.');
  END IF;

  IF v_ride.status NOT IN ('pending', 'searching') OR v_ride.driver_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'الرحلة لم تعد متاحة.');
  END IF;

  UPDATE public.rides
  SET
    driver_id = acc_driver_id,
    status = 'accepted',
    matched_at = COALESCE(matched_at, now()),
    updated_at = now()
  WHERE id = target_ride_id
    AND status IN ('pending', 'searching')
    AND driver_id IS NULL
  RETURNING * INTO v_ride;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'الرحلة تم قبولها بواسطة سائق آخر.');
  END IF;

  UPDATE public.drivers
  SET is_available = false, updated_at = now()
  WHERE id = acc_driver_id;

  INSERT INTO public.ride_matching_log (ride_id, driver_id, response, responded_at)
  VALUES (target_ride_id, acc_driver_id, 'accepted', now())
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'message', 'تم قبول الرحلة بنجاح.',
    'ride', row_to_json(v_ride)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_ride_atomic(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_ride_atomic(UUID, UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- Nearby rides RPC (PostGIS-backed) for driver dispatch feeds
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nearby_pending_rides_geospatial(
  p_driver_id UUID,
  p_radius_meters INTEGER DEFAULT 12000,
  p_limit INTEGER DEFAULT 5
)
RETURNS SETOF public.rides
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      OR (d.vehicle_type = 'economy' AND r.vehicle_type = 'economy')
      OR (d.vehicle_type = 'comfort' AND r.vehicle_type IN ('economy', 'comfort'))
      OR (d.vehicle_type = 'premium' AND r.vehicle_type IN ('economy', 'comfort', 'premium'))
    )
    AND ST_DWithin(
      dl.location,
      COALESCE(
        r.pickup_geom::GEOGRAPHY,
        CASE
          WHEN r.pickup_location ? 'lat' AND r.pickup_location ? 'lng'
          THEN ST_SetSRID(
            ST_MakePoint((r.pickup_location->>'lng')::DOUBLE PRECISION, (r.pickup_location->>'lat')::DOUBLE PRECISION),
            4326
          )::GEOGRAPHY
          ELSE NULL
        END
      ),
      p_radius_meters
    )
  ORDER BY r.created_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 20))
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_pending_rides_geospatial(UUID, INTEGER, INTEGER) TO authenticated;

COMMENT ON TABLE public.users IS 'Canonical app users table aligned with rider/driver/admin roles.';
COMMENT ON TABLE public.vehicles IS 'Canonical vehicle records linked to drivers.';
COMMENT ON TABLE public.driver_locations IS 'Latest online driver location stored as PostGIS geography point.';
COMMENT ON TABLE public.payments IS 'Ride payment records with user ownership and admin controls.';
COMMENT ON FUNCTION public.accept_ride_atomic(UUID, UUID) IS 'Atomic ride acceptance function with row locking to avoid race conditions.';
COMMENT ON FUNCTION public.get_nearby_pending_rides_geospatial(UUID, INTEGER, INTEGER) IS 'PostGIS nearby dispatch function for pending/searching rides.';
