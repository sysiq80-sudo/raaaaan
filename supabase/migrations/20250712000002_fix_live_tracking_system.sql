-- ======================================
-- ران - إصلاح: ضمان وجود جدول ودوال تتبع الرحلة المباشر
-- هذا الترحيل يتأكد من وجود جميع المكونات المطلوبة
-- ======================================

-- جدول روابط مشاركة الرحلة
CREATE TABLE IF NOT EXISTS public.ride_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- إضافة العمود إذا كان الجدول موجوداً بدونه
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'ride_share_links' 
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.ride_share_links ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_ride_share_links_token ON public.ride_share_links(token);
CREATE INDEX IF NOT EXISTS idx_ride_share_links_ride_id ON public.ride_share_links(ride_id);

ALTER TABLE public.ride_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active share links" ON public.ride_share_links;
CREATE POLICY "Anyone can read active share links"
    ON public.ride_share_links FOR SELECT
    USING (is_active = true AND expires_at > now());

DROP POLICY IF EXISTS "Authenticated users can create share links" ON public.ride_share_links;
CREATE POLICY "Authenticated users can create share links"
    ON public.ride_share_links FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role full access share links" ON public.ride_share_links;
CREATE POLICY "Service role full access share links"
    ON public.ride_share_links FOR ALL
    USING (true);

-- جدول مواقع السائقين المباشرة
CREATE TABLE IF NOT EXISTS public.driver_live_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL,
    location JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0}'::jsonb,
    heading FLOAT,
    speed FLOAT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_live_locations_ride_id 
    ON public.driver_live_locations(ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_driver_id 
    ON public.driver_live_locations(driver_id);

ALTER TABLE public.driver_live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_live_locations" ON public.driver_live_locations;
CREATE POLICY "public_read_live_locations" 
    ON public.driver_live_locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "drivers_insert_live_locations" ON public.driver_live_locations;
CREATE POLICY "drivers_insert_live_locations" 
    ON public.driver_live_locations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "drivers_update_live_locations" ON public.driver_live_locations;
CREATE POLICY "drivers_update_live_locations" 
    ON public.driver_live_locations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "delete_live_locations" ON public.driver_live_locations;
CREATE POLICY "delete_live_locations" 
    ON public.driver_live_locations FOR DELETE USING (true);

-- دالة إنشاء رابط تتبع
CREATE OR REPLACE FUNCTION public.generate_ride_tracking_token(p_ride_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT token INTO v_token
    FROM ride_share_links
    WHERE ride_id = p_ride_id 
      AND expires_at > now()
      AND is_active = true
    LIMIT 1;

    IF v_token IS NOT NULL THEN
        RETURN v_token;
    END IF;

    v_token := encode(gen_random_bytes(12), 'hex');

    INSERT INTO ride_share_links (ride_id, token, expires_at, is_active)
    VALUES (p_ride_id, v_token, now() + INTERVAL '24 hours', true)
    ON CONFLICT (token) DO UPDATE SET
        expires_at = now() + INTERVAL '24 hours',
        is_active = true;

    RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_ride_tracking_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ride_tracking_token(UUID) TO service_role;

-- دالة جلب بيانات الرحلة بالتوكن
CREATE OR REPLACE FUNCTION public.get_ride_by_share_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ride_id UUID;
    v_result JSONB;
BEGIN
    SELECT ride_id INTO v_ride_id
    FROM ride_share_links
    WHERE token = p_token AND is_active = true AND expires_at > now();

    IF v_ride_id IS NULL THEN
        RETURN jsonb_build_object('error', 'رابط غير صالح أو منتهي الصلاحية');
    END IF;

    SELECT jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'pickup_address', r.pickup_address,
        'dropoff_address', r.dropoff_address,
        'pickup_location', r.pickup_location,
        'dropoff_location', r.dropoff_location,
        'estimated_fare', r.estimated_fare,
        'vehicle_type', r.vehicle_type,
        'driver', CASE 
            WHEN r.driver_id IS NOT NULL THEN jsonb_build_object(
                'full_name', d.full_name,
                'vehicle_model', d.vehicle_model,
                'vehicle_color', d.vehicle_color,
                'vehicle_plate', d.vehicle_plate,
                'rating', d.average_rating,
                'current_location', d.current_location
            )
            ELSE NULL
        END,
        'live_location', (
            SELECT jsonb_build_object(
                'location', dll.location,
                'heading', dll.heading,
                'speed', dll.speed,
                'updated_at', dll.updated_at
            )
            FROM driver_live_locations dll
            WHERE dll.ride_id = r.id
            LIMIT 1
        )
    ) INTO v_result
    FROM rides r
    LEFT JOIN drivers d ON d.user_id = r.driver_id
    WHERE r.id = v_ride_id;

    RETURN COALESCE(v_result, jsonb_build_object('error', 'الرحلة غير موجودة'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ride_by_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ride_by_share_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ride_by_share_token(text) TO service_role;

-- تمكين Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_live_locations;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;
