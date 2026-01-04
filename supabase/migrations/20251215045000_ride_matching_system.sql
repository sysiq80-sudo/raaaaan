-- ======================================
-- تحسينات نظام مطابقة الرحلات
-- ======================================
-- إضافة حقول جديدة لجدول الرحلات
ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notified_drivers JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS matching_attempts INTEGER DEFAULT 0;
-- إنشاء جدول لتتبع محاولات المطابقة
CREATE TABLE IF NOT EXISTS public.ride_matching_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE
    SET NULL,
        distance_km NUMERIC(6, 2),
        priority_score INTEGER,
        notified_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        response TEXT CHECK (
            response IN ('accepted', 'rejected', 'timeout', 'ignored')
        ),
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_ride_matching_log_ride_id ON public.ride_matching_log(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_matching_log_driver_id ON public.ride_matching_log(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_matching_log_notified_at ON public.ride_matching_log(notified_at);
CREATE INDEX IF NOT EXISTS idx_rides_matched_at ON public.rides(matched_at);
CREATE INDEX IF NOT EXISTS idx_rides_status_vehicle_type ON public.rides(status, vehicle_type);
-- إنشاء جدول لتخزين FCM tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT NOT NULL UNIQUE,
    device_type TEXT,
    platform TEXT CHECK (platform IN ('web', 'android', 'ios')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- إنشاء indexes لجدول push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active)
WHERE is_active = true;
-- Row Level Security للجداول الجديدة
ALTER TABLE public.ride_matching_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
-- Policies لجدول ride_matching_log
DROP POLICY IF EXISTS "Drivers can view their matching logs" ON public.ride_matching_log;
CREATE POLICY "Drivers can view their matching logs" ON public.ride_matching_log FOR
SELECT USING (
        driver_id IN (
            SELECT id
            FROM public.drivers
            WHERE user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS "Admins can view all matching logs" ON public.ride_matching_log;
CREATE POLICY "Admins can view all matching logs" ON public.ride_matching_log FOR
SELECT USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "System can insert matching logs" ON public.ride_matching_log;
CREATE POLICY "System can insert matching logs" ON public.ride_matching_log FOR
INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "System can update matching logs" ON public.ride_matching_log;
CREATE POLICY "System can update matching logs" ON public.ride_matching_log FOR
UPDATE USING (true);
-- Policies لجدول push_tokens
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.push_tokens;
CREATE POLICY "Users can view their own tokens" ON public.push_tokens FOR
SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.push_tokens;
CREATE POLICY "Users can insert their own tokens" ON public.push_tokens FOR
INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.push_tokens;
CREATE POLICY "Users can update their own tokens" ON public.push_tokens FOR
UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.push_tokens;
CREATE POLICY "Users can delete their own tokens" ON public.push_tokens FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all tokens" ON public.push_tokens;
CREATE POLICY "Admins can manage all tokens" ON public.push_tokens FOR ALL USING (public.has_role(auth.uid(), 'admin'));
-- Trigger لتحديث last_used_at تلقائياً
CREATE OR REPLACE FUNCTION public.update_push_token_last_used() RETURNS TRIGGER AS $$ BEGIN NEW.last_used_at = now();
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
DROP TRIGGER IF EXISTS update_push_tokens_last_used ON public.push_tokens;
CREATE TRIGGER update_push_tokens_last_used BEFORE
UPDATE ON public.push_tokens FOR EACH ROW
    WHEN (
        OLD.token IS DISTINCT
        FROM NEW.token
            OR OLD.is_active IS DISTINCT
        FROM NEW.is_active
    ) EXECUTE FUNCTION public.update_push_token_last_used();
-- دالة لتنظيف الـ tokens القديمة (أكثر من 90 يوم)
CREATE OR REPLACE FUNCTION public.cleanup_old_push_tokens() RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM public.push_tokens
WHERE last_used_at < now() - INTERVAL '90 days'
    AND is_active = false;
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
-- دالة لتحديث استجابة السائق في matching log
CREATE OR REPLACE FUNCTION public.update_driver_response(
        p_ride_id UUID,
        p_driver_id UUID,
        p_response TEXT
    ) RETURNS BOOLEAN AS $$ BEGIN
UPDATE public.ride_matching_log
SET response = p_response,
    responded_at = now()
WHERE ride_id = p_ride_id
    AND driver_id = p_driver_id
    AND response IS NULL;
RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
-- إنشاء view لإحصائيات المطابقة
CREATE OR REPLACE VIEW public.ride_matching_stats AS
SELECT r.id as ride_id,
    r.status,
    r.vehicle_type,
    r.matching_attempts,
    r.matched_at,
    r.created_at,
    COUNT(rml.id) as drivers_notified,
    COUNT(
        CASE
            WHEN rml.response = 'accepted' THEN 1
        END
    ) as drivers_accepted,
    COUNT(
        CASE
            WHEN rml.response = 'rejected' THEN 1
        END
    ) as drivers_rejected,
    COUNT(
        CASE
            WHEN rml.response = 'timeout' THEN 1
        END
    ) as drivers_timeout,
    MIN(rml.distance_km) as nearest_driver_distance,
    AVG(rml.distance_km) as avg_driver_distance
FROM public.rides r
    LEFT JOIN public.ride_matching_log rml ON r.id = rml.ride_id
WHERE r.created_at > now() - INTERVAL '30 days'
GROUP BY r.id,
    r.status,
    r.vehicle_type,
    r.matching_attempts,
    r.matched_at,
    r.created_at;
-- منح صلاحيات على الـ view
GRANT SELECT ON public.ride_matching_stats TO authenticated;
-- تعليق على الجداول والدوال
COMMENT ON TABLE public.ride_matching_log IS 'سجل محاولات مطابقة السائقين مع الرحلات';
COMMENT ON TABLE public.push_tokens IS 'رموز FCM للإشعارات الفورية';
COMMENT ON FUNCTION public.update_driver_response IS 'تحديث استجابة السائق على طلب الرحلة';
COMMENT ON FUNCTION public.cleanup_old_push_tokens IS 'تنظيف رموز الإشعارات القديمة';
COMMENT ON VIEW public.ride_matching_stats IS 'إحصائيات مطابقة الرحلات';