-- Phase X: Advanced Scheduled Rides (حجوزات متقدمة)
-- COPY & PASTE THIS ENTIRE FILE INTO SUPABASE DASHBOARD SQL EDITOR
-- ضع هذا الملف بالكامل في محرر SQL بـ Supabase Dashboard

-- 1) Extend ride_status enum to include scheduled (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ride_status'
      AND e.enumlabel = 'scheduled'
  ) THEN
    ALTER TYPE ride_status ADD VALUE 'scheduled';
  END IF;
END $$;

-- 2) Extend rides table for scheduled metadata
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stops JSONB,
  ADD COLUMN IF NOT EXISTS prefer_women_driver BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_priority BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trip_type TEXT,
  ADD COLUMN IF NOT EXISTS return_trip_id UUID;

-- 3) Extend scheduled_rides table for advanced scheduling
ALTER TABLE public.scheduled_rides
  ADD COLUMN IF NOT EXISTS trip_type TEXT DEFAULT 'one_way',
  ADD COLUMN IF NOT EXISTS return_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stops JSONB,
  ADD COLUMN IF NOT EXISTS prefer_women_driver BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS high_priority BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_id UUID;

-- 4) Update scheduled_rides status constraint to include reserved/confirmed
ALTER TABLE public.scheduled_rides
  DROP CONSTRAINT IF EXISTS scheduled_rides_status_check;

ALTER TABLE public.scheduled_rides
  ADD CONSTRAINT scheduled_rides_status_check
  CHECK (status IN ('scheduled', 'reserved', 'confirmed', 'processing', 'created', 'cancelled', 'expired'));

-- 5) Add driver scheduling block
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS scheduled_blocked_until TIMESTAMPTZ;

-- 6) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_rides_driver_id
ON public.scheduled_rides(driver_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_rides_status_time
ON public.scheduled_rides(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_rides_scheduled_at
ON public.rides(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_rides_high_priority
ON public.rides(high_priority) WHERE high_priority = true;

-- 7) Driver policies (read scheduled rides)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scheduled_rides'
      AND policyname = 'Drivers can view scheduled rides'
  ) THEN
    CREATE POLICY "Drivers can view scheduled rides"
    ON public.scheduled_rides
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.status = 'approved'
      )
    );
  END IF;
END $$;

-- 8) Accept scheduled ride (driver reserves)
CREATE OR REPLACE FUNCTION public.accept_scheduled_ride(
  p_scheduled_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_ride public.scheduled_rides%ROWTYPE;
  v_overlap_count INTEGER;
BEGIN
  -- تحقق من السائق
  SELECT * INTO v_driver
  FROM public.drivers
  WHERE user_id = auth.uid()
    AND status = 'approved'
    AND is_online = true
    AND is_available = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير متاح أو غير مصرح');
  END IF;

  -- تحقق من الحظر المؤقت
  IF v_driver.scheduled_blocked_until IS NOT NULL AND v_driver.scheduled_blocked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'أنت موقوف مؤقتاً عن الحجوزات المجدولة');
  END IF;

  -- جلب الرحلة المجدولة
  SELECT * INTO v_ride
  FROM public.scheduled_rides
  WHERE id = p_scheduled_ride_id
    AND status = 'scheduled'
    AND driver_id IS NULL
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير متاحة للحجز');
  END IF;

  -- منع التداخل: أي رحلة مجدولة لنفس السائق ضمن 60 دقيقة
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.scheduled_rides
  WHERE driver_id = v_driver.id
    AND status IN ('reserved', 'confirmed')
    AND ABS(EXTRACT(EPOCH FROM (scheduled_at - v_ride.scheduled_at))) < 3600;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لديك رحلة مجدولة متداخلة في نفس الوقت');
  END IF;

  -- حجز الرحلة للسائق
  UPDATE public.scheduled_rides
  SET driver_id = v_driver.id,
      status = 'reserved',
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_ride.id;

  RETURN jsonb_build_object('success', true, 'message', 'تم حجز الرحلة بنجاح');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_scheduled_ride(UUID) TO authenticated;

-- 9) تأكيد جاهزية السائق
CREATE OR REPLACE FUNCTION public.confirm_scheduled_ride(
  p_scheduled_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_ride public.scheduled_rides%ROWTYPE;
BEGIN
  SELECT * INTO v_driver
  FROM public.drivers
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير مصرح');
  END IF;

  SELECT * INTO v_ride
  FROM public.scheduled_rides
  WHERE id = p_scheduled_ride_id
    AND driver_id = v_driver.id
    AND status IN ('reserved', 'confirmed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير متاحة للتأكيد');
  END IF;

  UPDATE public.scheduled_rides
  SET status = 'confirmed',
      driver_confirmed_at = now(),
      updated_at = now()
  WHERE id = v_ride.id;

  RETURN jsonb_build_object('success', true, 'message', 'تم تأكيد الجاهزية');
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_scheduled_ride(UUID) TO authenticated;

-- 10) إلغاء السائق مع حظر مؤقت عند الإلغاء المتأخر
CREATE OR REPLACE FUNCTION public.cancel_scheduled_ride_by_driver(
  p_scheduled_ride_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_ride public.scheduled_rides%ROWTYPE;
  v_minutes_to_ride INTEGER;
BEGIN
  SELECT * INTO v_driver
  FROM public.drivers
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السائق غير مصرح');
  END IF;

  SELECT * INTO v_ride
  FROM public.scheduled_rides
  WHERE id = p_scheduled_ride_id
    AND driver_id = v_driver.id
    AND status IN ('reserved', 'confirmed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء هذه الرحلة');
  END IF;

  v_minutes_to_ride := EXTRACT(EPOCH FROM (v_ride.scheduled_at - now())) / 60;

  -- إعادة فتح الرحلة للسائقين
  UPDATE public.scheduled_rides
  SET driver_id = NULL,
      status = 'scheduled',
      updated_at = now()
  WHERE id = v_ride.id;

  -- حظر مؤقت عند الإلغاء قبل أقل من ساعة
  IF v_minutes_to_ride <= 60 THEN
    UPDATE public.drivers
    SET scheduled_blocked_until = now() + interval '1 hour',
        updated_at = now()
    WHERE id = v_driver.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'تم الإلغاء');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_scheduled_ride_by_driver(UUID) TO authenticated;
