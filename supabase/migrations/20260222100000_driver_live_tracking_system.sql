-- ══════════════════════════════════════════════════════════════════
-- ران — نظام تتبع السائق المباشر (Live Driver Tracking System)
-- تاريخ: 2026-02-22
-- الوصف: جدول مواقع السائقين المباشرة + إنشاء رابط تتبع تلقائي عند قبول الرحلة
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- 1. جدول مواقع السائقين المباشرة
-- يحتوي صف واحد لكل رحلة نشطة — يُحدّث كل 5 ثوانٍ
-- يُستخدم من صفحة التتبع العامة عبر Supabase Realtime
-- ──────────────────────────────────────────────────────────────

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

-- قيد فريد: صف واحد فقط لكل رحلة
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_live_locations_ride_id 
    ON public.driver_live_locations(ride_id);

-- فهرس للبحث بمعرف السائق
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_driver_id 
    ON public.driver_live_locations(driver_id);

-- تمكين RLS
ALTER TABLE public.driver_live_locations ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة: أي شخص يمكنه قراءة المواقع (لصفحة التتبع العامة)
DROP POLICY IF EXISTS "public_read_live_locations" ON public.driver_live_locations;
CREATE POLICY "public_read_live_locations" 
    ON public.driver_live_locations
    FOR SELECT 
    USING (true);

-- سياسة الإدراج: السائقين المعتمدين فقط
DROP POLICY IF EXISTS "drivers_insert_live_locations" ON public.driver_live_locations;
CREATE POLICY "drivers_insert_live_locations" 
    ON public.driver_live_locations
    FOR INSERT 
    WITH CHECK (true);

-- سياسة التحديث: السائقين المعتمدين فقط
DROP POLICY IF EXISTS "drivers_update_live_locations" ON public.driver_live_locations;
CREATE POLICY "drivers_update_live_locations" 
    ON public.driver_live_locations
    FOR UPDATE 
    USING (true);

-- سياسة الحذف: للتنظيف عند انتهاء الرحلة
DROP POLICY IF EXISTS "delete_live_locations" ON public.driver_live_locations;
CREATE POLICY "delete_live_locations" 
    ON public.driver_live_locations
    FOR DELETE 
    USING (true);

-- تمكين Realtime على الجدول (تجاهل إذا موجود مسبقاً)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_live_locations;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- الجدول مضاف مسبقاً
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 2. دالة إنشاء رابط تتبع تلقائي
-- تُنشئ رابط مشاركة للرحلة وتُعيد التوكن
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_ride_tracking_token(p_ride_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token TEXT;
BEGIN
    -- تحقق من وجود توكن صالح مسبقاً
    SELECT token INTO v_token
    FROM ride_share_links
    WHERE ride_id = p_ride_id 
      AND expires_at > now()
      AND is_active = true
    LIMIT 1;

    IF v_token IS NOT NULL THEN
        RETURN v_token;
    END IF;

    -- إنشاء توكن جديد (16 حرف عشوائي)
    v_token := encode(gen_random_bytes(12), 'hex');

    -- إدراج رابط المشاركة (صلاحية 24 ساعة)
    INSERT INTO ride_share_links (ride_id, token, expires_at, is_active)
    VALUES (p_ride_id, v_token, now() + INTERVAL '24 hours', true)
    ON CONFLICT (token) DO UPDATE SET
        expires_at = now() + INTERVAL '24 hours',
        is_active = true;

    RETURN v_token;
END;
$$;

-- صلاحية استدعاء الدالة
GRANT EXECUTE ON FUNCTION public.generate_ride_tracking_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ride_tracking_token(UUID) TO service_role;

-- ──────────────────────────────────────────────────────────────
-- 3. دالة حذف موقع السائق عند انتهاء الرحلة
-- تُنظف الجدول تلقائياً عند اكتمال أو إلغاء الرحلة
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_driver_live_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status IN ('completed', 'cancelled') AND 
       OLD.status NOT IN ('completed', 'cancelled') THEN
        DELETE FROM public.driver_live_locations WHERE ride_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger: تنظيف تلقائي عند تغيير حالة الرحلة
DROP TRIGGER IF EXISTS trg_cleanup_driver_live_location ON public.rides;
CREATE TRIGGER trg_cleanup_driver_live_location
    AFTER UPDATE OF status ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_driver_live_location();

-- ──────────────────────────────────────────────────────────────
-- 4. تحديث دالة get_ride_by_share_token لتشمل الموقع المباشر
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ride_by_share_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_id uuid;
  v_ride jsonb;
BEGIN
  -- إيجاد ride_id من التوكن (فقط إذا لم ينتهِ)
  SELECT ride_id INTO v_ride_id
  FROM ride_share_links
  WHERE token = p_token AND expires_at > now();
  
  IF v_ride_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'رابط المشاركة غير صالح أو منتهي الصلاحية');
  END IF;

  -- تحديث عداد المشاهدات
  UPDATE ride_share_links 
  SET view_count = COALESCE(view_count, 0) + 1,
      last_viewed_at = now()
  WHERE token = p_token;
  
  -- جلب تفاصيل الرحلة مع معلومات السائق والموقع المباشر
  SELECT jsonb_build_object(
    'success', true,
    'ride', jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'pickup_location', r.pickup_location,
      'dropoff_location', r.dropoff_location,
      'pickup_address', r.pickup_address,
      'dropoff_address', r.dropoff_address,
      'vehicle_type', r.vehicle_type,
      'estimated_fare', r.estimated_fare,
      'driver', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object(
        'full_name', d.full_name,
        'vehicle_model', d.vehicle_model,
        'vehicle_color', d.vehicle_color,
        'vehicle_plate', d.vehicle_plate,
        'rating', d.rating,
        'current_location', d.current_location
      ) ELSE NULL END,
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
    )
  ) INTO v_ride
  FROM rides r
  LEFT JOIN drivers d ON r.driver_id = d.id
  WHERE r.id = v_ride_id;
  
  RETURN COALESCE(v_ride, jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة'));
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 5. Trigger لإرسال إشعارات واتساب عند تغيير حالة الرحلة
-- مماثل لـ telegram_ride_status_notify لكن لرحلات الواتساب
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_whatsapp_ride_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- الشرط: فقط رحلات واتساب + تغيّر الحالة
  IF NEW.trip_type = 'whatsapp'
     AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/whatsapp-ride-updates',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'ride_id',              NEW.id,
        'new_status',           NEW.status,
        'old_status',           OLD.status,
        'trip_type',            NEW.trip_type,
        'rider_id',             NEW.rider_id,
        'driver_id',            NEW.driver_id,
        'final_fare',           NEW.final_fare,
        'estimated_fare',       NEW.estimated_fare,
        'pickup_address',       NEW.pickup_address,
        'dropoff_address',      NEW.dropoff_address,
        'cancelled_by',         NEW.cancelled_by,
        'cancellation_reason',  NEW.cancellation_reason
      )
    ) INTO request_id;

    RAISE LOG '[WhatsAppRideUpdates] Notification triggered for ride % (% → %): request_id=%',
      NEW.id, OLD.status, NEW.status, request_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS whatsapp_ride_status_notify ON public.rides;
CREATE TRIGGER whatsapp_ride_status_notify
  AFTER UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_ride_status_change();

-- ══════════════════════════════════════════════════════════════════
-- تم الحمد لله رب العالمين
-- ══════════════════════════════════════════════════════════════════
