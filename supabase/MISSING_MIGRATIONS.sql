-- ======================================
-- ران - الترحيلات المفقودة فقط
-- شغّل هذا الملف في Supabase SQL Editor
-- ======================================

-- ============================================
-- الجزء 1: نظام الإحالات
-- ============================================

-- جدول أكواد الإحالة
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    code TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT NULL,
    reward_amount INTEGER DEFAULT 5000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- جدول سجل الإحالات
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL UNIQUE,
    referral_code TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
    referrer_reward INTEGER DEFAULT 5000,
    referred_reward INTEGER DEFAULT 2500,
    referrer_paid BOOLEAN DEFAULT false,
    referred_paid BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- Row Level Security
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policies for referral_codes
DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;
CREATE POLICY "Users can view their own referral code"
    ON public.referral_codes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own referral code" ON public.referral_codes;
CREATE POLICY "Users can create their own referral code"
    ON public.referral_codes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all referral codes" ON public.referral_codes;
CREATE POLICY "Admins can manage all referral codes"
    ON public.referral_codes FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- Policies for referrals
DROP POLICY IF EXISTS "Users can view referrals they are part of" ON public.referrals;
CREATE POLICY "Users can view referrals they are part of"
    ON public.referrals FOR SELECT
    USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "System can insert referrals"
    ON public.referrals FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage all referrals" ON public.referrals;
CREATE POLICY "Admins can manage all referrals"
    ON public.referrals FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- دالة إنشاء كود إحالة فريد
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    SELECT code INTO v_code FROM referral_codes WHERE user_id = p_user_id;
    IF v_code IS NOT NULL THEN
        RETURN v_code;
    END IF;
    
    LOOP
        v_code := 'RAAN' || upper(substring(md5(random()::text) from 1 for 6));
        SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    INSERT INTO referral_codes (user_id, code) VALUES (p_user_id, v_code);
    RETURN v_code;
END;
$$;

-- دالة تطبيق كود الإحالة
CREATE OR REPLACE FUNCTION public.apply_referral(p_referred_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referrer_id UUID;
    v_referral_id UUID;
BEGIN
    IF EXISTS(SELECT 1 FROM referrals WHERE referred_id = p_referred_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'لقد استخدمت كود إحالة من قبل');
    END IF;
    
    SELECT user_id INTO v_referrer_id FROM referral_codes WHERE code = p_code AND is_active = true;
    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'كود الإحالة غير صالح');
    END IF;
    
    IF v_referrer_id = p_referred_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك استخدام كود الإحالة الخاص بك');
    END IF;
    
    INSERT INTO referrals (referrer_id, referred_id, referral_code, status)
    VALUES (v_referrer_id, p_referred_user_id, p_code, 'pending')
    RETURNING id INTO v_referral_id;
    
    UPDATE referral_codes SET usage_count = usage_count + 1, updated_at = now() WHERE code = p_code;
    
    RETURN jsonb_build_object('success', true, 'referral_id', v_referral_id, 'message', 'تم تطبيق كود الإحالة بنجاح!');
END;
$$;

-- دالة إكمال الإحالة عند أول رحلة
CREATE OR REPLACE FUNCTION public.complete_referral_on_first_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referral RECORD;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SELECT * INTO v_referral FROM referrals WHERE referred_id = NEW.rider_id AND status = 'pending' LIMIT 1;
        IF v_referral.id IS NOT NULL THEN
            UPDATE referrals SET status = 'completed', completed_at = now() WHERE id = v_referral.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_complete_referral ON public.rides;
CREATE TRIGGER trigger_complete_referral
    AFTER UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION public.complete_referral_on_first_ride();

-- View لإحصائيات الإحالات
CREATE OR REPLACE VIEW public.referral_stats AS
SELECT 
    rc.user_id,
    rc.code,
    rc.usage_count as total_referrals,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.referrer_reward ELSE 0 END), 0) as total_earned
FROM referral_codes rc
LEFT JOIN referrals r ON r.referral_code = rc.code
GROUP BY rc.user_id, rc.code, rc.usage_count;

GRANT SELECT ON public.referral_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral TO authenticated;

-- ============================================
-- الجزء 2: نظام التقييم المتقدم
-- ============================================

CREATE TABLE IF NOT EXISTS public.ride_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('rider', 'driver')),
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
    driving_rating INTEGER CHECK (driving_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    comment TEXT,
    tags TEXT[] DEFAULT '{}',
    is_anonymous BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (ride_id, reviewer_type)
);

CREATE INDEX IF NOT EXISTS idx_ride_reviews_ride_id ON public.ride_reviews(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_reviewer_id ON public.ride_reviews(reviewer_id);

ALTER TABLE public.ride_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reviews for their rides" ON public.ride_reviews;
CREATE POLICY "Users can create reviews for their rides"
    ON public.ride_reviews FOR INSERT
    WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Users can view reviews" ON public.ride_reviews;
CREATE POLICY "Users can view reviews"
    ON public.ride_reviews FOR SELECT
    USING (is_public = true OR reviewer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.ride_reviews;
CREATE POLICY "Admins can manage all reviews"
    ON public.ride_reviews FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- قائمة التقييمات الشائعة
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
('سائق محترف', 'Professional driver', 'positive', 'driver', '👨‍✈️'),
('سيارة نظيفة', 'Clean car', 'positive', 'driver', '✨'),
('وصل بسرعة', 'Fast arrival', 'positive', 'driver', '⚡'),
('ودود ومحترم', 'Friendly and respectful', 'positive', 'driver', '😊'),
('قيادة آمنة', 'Safe driving', 'positive', 'driver', '🛡️'),
('يعرف الطرق جيداً', 'Knows routes well', 'positive', 'driver', '🗺️'),
('تأخر في الوصول', 'Late arrival', 'negative', 'driver', '⏰'),
('سيارة غير نظيفة', 'Dirty car', 'negative', 'driver', '🚗'),
('قيادة متهورة', 'Reckless driving', 'negative', 'driver', '⚠️'),
('غير ودود', 'Unfriendly', 'negative', 'driver', '😐'),
('محترم', 'Respectful', 'positive', 'rider', '🙏'),
('جاهز في الموعد', 'Ready on time', 'positive', 'rider', '⏱️'),
('تواصل جيد', 'Good communication', 'positive', 'rider', '💬'),
('تأخر في الخروج', 'Late to come out', 'negative', 'rider', '⏰'),
('موقع خاطئ', 'Wrong location', 'negative', 'rider', '📍'),
('غير محترم', 'Disrespectful', 'negative', 'rider', '😠')
ON CONFLICT DO NOTHING;

GRANT SELECT ON public.review_tags TO authenticated;

-- ============================================
-- الجزء 3: دوال مهمة
-- ============================================

-- تحسين ربط السائق بالهاتف
CREATE OR REPLACE FUNCTION public.link_driver_by_phone(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_driver_status driver_status;
  v_current_user_id uuid;
  v_phone_clean text;
  v_phone_with_zero text;
  v_phone_without_zero text;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT id, status INTO v_driver_id, v_driver_status FROM drivers WHERE user_id = v_current_user_id;
  IF v_driver_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'status', v_driver_status);
  END IF;
  
  v_phone_clean := regexp_replace(p_phone, '\D', '', 'g');
  IF v_phone_clean LIKE '964%' THEN
    v_phone_clean := substring(v_phone_clean from 4);
  END IF;
  
  IF v_phone_clean LIKE '0%' THEN
    v_phone_with_zero := v_phone_clean;
    v_phone_without_zero := substring(v_phone_clean from 2);
  ELSE
    v_phone_without_zero := v_phone_clean;
    v_phone_with_zero := '0' || v_phone_clean;
  END IF;
  
  SELECT id, status INTO v_driver_id, v_driver_status FROM drivers
  WHERE phone = p_phone OR phone = v_phone_with_zero OR phone = v_phone_without_zero
     OR phone LIKE '%' || v_phone_without_zero
  LIMIT 1;
  
  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'لا يوجد سائق بهذا الرقم');
  END IF;
  
  UPDATE drivers SET user_id = v_current_user_id, updated_at = now() WHERE id = v_driver_id;
  RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'status', v_driver_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_driver_by_phone(text) TO authenticated;

-- إصلاح الملفات الشخصية المفقودة
CREATE OR REPLACE FUNCTION public.ensure_all_users_have_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
  v_phone TEXT;
  v_email TEXT;
  v_phone_exists BOOLEAN;
BEGIN
  FOR v_user IN 
    SELECT u.id, u.email, u.raw_user_meta_data->>'full_name' as full_name, u.phone
    FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE p.id IS NULL
  LOOP
    IF v_user.email ~ '^[0-9]+@' THEN
      v_phone := substring(v_user.email from '^([0-9]+)@');
      v_email := NULL;
    ELSE
      v_phone := v_user.phone;
      v_email := v_user.email;
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM profiles WHERE phone = v_phone) INTO v_phone_exists;
    
    IF v_phone_exists THEN
      INSERT INTO public.profiles (user_id, full_name, phone, email)
      VALUES (v_user.id, COALESCE(v_user.full_name, 'مستخدم'), NULL, v_email)
      ON CONFLICT (user_id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (user_id, full_name, phone, email)
      VALUES (v_user.id, COALESCE(v_user.full_name, 'مستخدم'), v_phone, v_email)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_all_users_have_profiles() TO authenticated;

-- ============================================
-- انتهى! تحقق من النتيجة
-- ============================================
SELECT 'تم تنفيذ جميع الترحيلات المفقودة بنجاح! ✅' as message;
