-- ======================================
-- ران - نظام التقييم المتقدم
-- ======================================

-- جدول التقييمات المفصلة
CREATE TABLE IF NOT EXISTS public.ride_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('rider', 'driver')),
    
    -- التقييمات المتعددة
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
    driving_rating INTEGER CHECK (driving_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    
    -- تعليق وتفاصيل
    comment TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- معلومات إضافية
    is_anonymous BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    admin_response TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- كل رحلة لها تقييم واحد من كل طرف
    UNIQUE (ride_id, reviewer_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ride_reviews_ride_id ON public.ride_reviews(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_reviewer_id ON public.ride_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_overall_rating ON public.ride_reviews(overall_rating);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_created_at ON public.ride_reviews(created_at);

-- Row Level Security
ALTER TABLE public.ride_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can create reviews for their rides" ON public.ride_reviews;
CREATE POLICY "Users can create reviews for their rides"
    ON public.ride_reviews FOR INSERT
    WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Users can view reviews" ON public.ride_reviews;
CREATE POLICY "Users can view reviews"
    ON public.ride_reviews FOR SELECT
    USING (
        is_public = true 
        OR reviewer_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
    );

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.ride_reviews;
CREATE POLICY "Users can update their own reviews"
    ON public.ride_reviews FOR UPDATE
    USING (reviewer_id = auth.uid() AND created_at > now() - INTERVAL '24 hours');

DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.ride_reviews;
CREATE POLICY "Admins can manage all reviews"
    ON public.ride_reviews FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- Trigger لتحديث updated_at
CREATE TRIGGER update_ride_reviews_updated_at
    BEFORE UPDATE ON public.ride_reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger لتحديث تقييم السائق/الراكب
CREATE OR REPLACE FUNCTION public.update_user_rating_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ride RECORD;
    v_avg_rating NUMERIC(2,1);
BEGIN
    -- جلب بيانات الرحلة
    SELECT * INTO v_ride FROM public.rides WHERE id = NEW.ride_id;
    
    IF NEW.reviewer_type = 'rider' THEN
        -- الراكب قيّم السائق
        -- حدث تقييم السائق
        IF v_ride.driver_id IS NOT NULL THEN
            SELECT AVG(overall_rating)::NUMERIC(2,1) INTO v_avg_rating
            FROM public.ride_reviews rr
            JOIN public.rides r ON rr.ride_id = r.id
            WHERE r.driver_id = v_ride.driver_id
              AND rr.reviewer_type = 'rider';
            
            UPDATE public.drivers
            SET rating = COALESCE(v_avg_rating, 5.0)
            WHERE id = v_ride.driver_id;
        END IF;
        
        -- حدث تقييم السائق في الرحلة
        UPDATE public.rides
        SET driver_rating = NEW.overall_rating
        WHERE id = NEW.ride_id;
        
    ELSIF NEW.reviewer_type = 'driver' THEN
        -- السائق قيّم الراكب
        -- حدث تقييم الراكب في الرحلة
        UPDATE public.rides
        SET rider_rating = NEW.overall_rating
        WHERE id = NEW.ride_id;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_rating_on_review ON public.ride_reviews;
CREATE TRIGGER update_rating_on_review
    AFTER INSERT ON public.ride_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_rating_on_review();

-- View لإحصائيات التقييمات
CREATE OR REPLACE VIEW public.driver_rating_breakdown AS
SELECT 
    d.id as driver_id,
    d.full_name,
    d.rating as current_rating,
    COUNT(rr.id) as total_reviews,
    AVG(rr.overall_rating)::NUMERIC(2,1) as avg_overall,
    AVG(rr.cleanliness_rating)::NUMERIC(2,1) as avg_cleanliness,
    AVG(rr.driving_rating)::NUMERIC(2,1) as avg_driving,
    AVG(rr.communication_rating)::NUMERIC(2,1) as avg_communication,
    AVG(rr.punctuality_rating)::NUMERIC(2,1) as avg_punctuality,
    COUNT(CASE WHEN rr.overall_rating = 5 THEN 1 END) as five_star,
    COUNT(CASE WHEN rr.overall_rating = 4 THEN 1 END) as four_star,
    COUNT(CASE WHEN rr.overall_rating = 3 THEN 1 END) as three_star,
    COUNT(CASE WHEN rr.overall_rating = 2 THEN 1 END) as two_star,
    COUNT(CASE WHEN rr.overall_rating = 1 THEN 1 END) as one_star
FROM public.drivers d
LEFT JOIN public.rides r ON d.id = r.driver_id
LEFT JOIN public.ride_reviews rr ON r.id = rr.ride_id AND rr.reviewer_type = 'rider'
GROUP BY d.id, d.full_name, d.rating;

-- قائمة التقييمات الشائعة (tags)
CREATE TABLE IF NOT EXISTS public.review_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_ar TEXT NOT NULL,
    tag_en TEXT,
    tag_type TEXT NOT NULL CHECK (tag_type IN ('positive', 'negative', 'neutral')),
    applies_to TEXT NOT NULL CHECK (applies_to IN ('driver', 'rider', 'both')),
    icon TEXT,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- إدراج تقييمات شائعة
INSERT INTO public.review_tags (tag_ar, tag_en, tag_type, applies_to, icon) VALUES
-- تقييمات إيجابية للسائق
('سائق محترف', 'Professional driver', 'positive', 'driver', '👨‍✈️'),
('سيارة نظيفة', 'Clean car', 'positive', 'driver', '✨'),
('وصل بسرعة', 'Fast arrival', 'positive', 'driver', '⚡'),
('ودود ومحترم', 'Friendly and respectful', 'positive', 'driver', '😊'),
('قيادة آمنة', 'Safe driving', 'positive', 'driver', '🛡️'),
('يعرف الطرق جيداً', 'Knows routes well', 'positive', 'driver', '🗺️'),

-- تقييمات سلبية للسائق
('تأخر في الوصول', 'Late arrival', 'negative', 'driver', '⏰'),
('سيارة غير نظيفة', 'Dirty car', 'negative', 'driver', '🚗'),
('قيادة متهورة', 'Reckless driving', 'negative', 'driver', '⚠️'),
('غير ودود', 'Unfriendly', 'negative', 'driver', '😐'),

-- تقييمات إيجابية للراكب
('محترم', 'Respectful', 'positive', 'rider', '🙏'),
('جاهز في الموعد', 'Ready on time', 'positive', 'rider', '⏱️'),
('تواصل جيد', 'Good communication', 'positive', 'rider', '💬'),

-- تقييمات سلبية للراكب
('تأخر في الخروج', 'Late to come out', 'negative', 'rider', '⏰'),
('موقع خاطئ', 'Wrong location', 'negative', 'rider', '📍'),
('غير محترم', 'Disrespectful', 'negative', 'rider', '😠')

ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.driver_rating_breakdown TO authenticated;
GRANT SELECT ON public.review_tags TO authenticated;

-- تعليقات
COMMENT ON TABLE public.ride_reviews IS 'التقييمات المفصلة للرحلات';
COMMENT ON TABLE public.review_tags IS 'قائمة التقييمات الشائعة المحددة مسبقاً';
COMMENT ON VIEW public.driver_rating_breakdown IS 'تحليل تقييمات السائقين';
