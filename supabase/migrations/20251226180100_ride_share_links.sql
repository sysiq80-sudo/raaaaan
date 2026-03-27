-- ======================================
-- ران - نظام مشاركة الرحلة
-- ======================================

-- جدول روابط مشاركة الرحلة
CREATE TABLE IF NOT EXISTS public.ride_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    shared_with_name TEXT,
    shared_with_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_viewed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ride_share_links_ride_id ON public.ride_share_links(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_share_links_token ON public.ride_share_links(token);
CREATE INDEX IF NOT EXISTS idx_ride_share_links_active ON public.ride_share_links(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE public.ride_share_links ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Riders can create share links for their rides" ON public.ride_share_links;
CREATE POLICY "Riders can create share links for their rides"
    ON public.ride_share_links FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rides
            WHERE id = ride_id AND rider_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Riders can view their own share links" ON public.ride_share_links;
CREATE POLICY "Riders can view their own share links"
    ON public.ride_share_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.rides
            WHERE id = ride_id AND rider_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Anyone can view active share links by token" ON public.ride_share_links;
CREATE POLICY "Anyone can view active share links by token"
    ON public.ride_share_links FOR SELECT
    USING (is_active = true AND expires_at > now());

DROP POLICY IF EXISTS "Riders can deactivate their share links" ON public.ride_share_links;
CREATE POLICY "Riders can deactivate their share links"
    ON public.ride_share_links FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.rides
            WHERE id = ride_id AND rider_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage all share links" ON public.ride_share_links;
CREATE POLICY "Admins can manage all share links"
    ON public.ride_share_links FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- دالة لإنشاء رابط مشاركة
CREATE OR REPLACE FUNCTION public.create_ride_share_link(
    p_ride_id UUID,
    p_shared_with_name TEXT DEFAULT NULL,
    p_shared_with_phone TEXT DEFAULT NULL,
    p_hours_valid INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
    v_link_id UUID;
    v_rider_id UUID;
BEGIN
    -- التحقق من ملكية الرحلة
    SELECT rider_id INTO v_rider_id
    FROM public.rides
    WHERE id = p_ride_id;
    
    IF v_rider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة');
    END IF;
    
    IF v_rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية لمشاركة هذه الرحلة');
    END IF;
    
    -- إنشاء token فريد
    v_token := encode(gen_random_bytes(16), 'hex');
    
    -- إنشاء رابط المشاركة
    INSERT INTO public.ride_share_links (
        ride_id,
        token,
        shared_with_name,
        shared_with_phone,
        expires_at
    ) VALUES (
        p_ride_id,
        v_token,
        p_shared_with_name,
        p_shared_with_phone,
        now() + (p_hours_valid || ' hours')::INTERVAL
    )
    RETURNING id INTO v_link_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_link_id,
        'token', v_token,
        'expires_at', now() + (p_hours_valid || ' hours')::INTERVAL
    );
END;
$$;

-- دالة لجلب بيانات الرحلة عبر الرابط
CREATE OR REPLACE FUNCTION public.get_shared_ride(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link RECORD;
    v_ride RECORD;
    v_driver RECORD;
BEGIN
    -- جلب رابط المشاركة
    SELECT * INTO v_link
    FROM public.ride_share_links
    WHERE token = p_token
      AND is_active = true
      AND expires_at > now();
    
    IF v_link IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرابط غير صالح أو منتهي الصلاحية');
    END IF;
    
    -- تحديث عدد المشاهدات
    UPDATE public.ride_share_links
    SET view_count = view_count + 1,
        last_viewed_at = now()
    WHERE id = v_link.id;
    
    -- جلب بيانات الرحلة
    SELECT * INTO v_ride
    FROM public.rides
    WHERE id = v_link.ride_id;
    
    IF v_ride IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة');
    END IF;
    
    -- جلب بيانات السائق إذا موجود
    IF v_ride.driver_id IS NOT NULL THEN
        SELECT 
            full_name,
            phone,
            vehicle_model,
            vehicle_color,
            vehicle_plate,
            rating,
            current_location
        INTO v_driver
        FROM public.drivers
        WHERE id = v_ride.driver_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'ride', jsonb_build_object(
            'id', v_ride.id,
            'status', v_ride.status,
            'pickup_location', v_ride.pickup_location,
            'pickup_address', v_ride.pickup_address,
            'dropoff_location', v_ride.dropoff_location,
            'dropoff_address', v_ride.dropoff_address,
            'vehicle_type', v_ride.vehicle_type,
            'estimated_fare', v_ride.estimated_fare,
            'created_at', v_ride.created_at
        ),
        'driver', CASE WHEN v_driver IS NOT NULL THEN
            jsonb_build_object(
                'name', v_driver.full_name,
                'phone', v_driver.phone,
                'vehicle', v_driver.vehicle_model || ' ' || v_driver.vehicle_color,
                'plate', v_driver.vehicle_plate,
                'rating', v_driver.rating,
                'location', v_driver.current_location
            )
        ELSE NULL END,
        'share_info', jsonb_build_object(
            'shared_with', v_link.shared_with_name,
            'view_count', v_link.view_count + 1,
            'expires_at', v_link.expires_at
        )
    );
END;
$$;

-- تعليقات
COMMENT ON TABLE public.ride_share_links IS 'روابط مشاركة الرحلة مع الأهل والأصدقاء';
COMMENT ON FUNCTION public.create_ride_share_link IS 'إنشاء رابط آمن لمشاركة تتبع الرحلة';
COMMENT ON FUNCTION public.get_shared_ride IS 'جلب بيانات الرحلة المشاركة للعرض';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_ride_share_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_ride TO anon, authenticated;
