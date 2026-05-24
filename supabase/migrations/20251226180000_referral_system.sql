-- ======================================
-- ران - نظام الإحالات والمكافآت
-- ======================================

-- جدول أكواد الإحالة
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    code TEXT UNIQUE NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- جدول الإحالات
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    referral_code TEXT NOT NULL,
    referrer_reward INTEGER DEFAULT 5000, -- مكافأة المُحيل (5000 د.ع)
    referred_reward INTEGER DEFAULT 5000, -- مكافأة المُحال (5000 د.ع)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (referred_id) -- كل مستخدم يمكن أن يُحال مرة واحدة فقط
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

-- Policies لجدول referral_codes
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

-- Policies لجدول referrals
DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
CREATE POLICY "Users can view their own referrals"
    ON public.referrals FOR SELECT
    USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admins can manage all referrals" ON public.referrals;
CREATE POLICY "Admins can manage all referrals"
    ON public.referrals FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- دالة لإنشاء كود إحالة فريد
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
    LOOP
        -- إنشاء كود من 8 أحرف
        v_code := 'RAAN' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
        
        -- التحقق من عدم وجود الكود
        SELECT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    -- إدراج الكود
    INSERT INTO public.referral_codes (user_id, code)
    VALUES (p_user_id, v_code)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN v_code;
END;
$$;

-- دالة لتطبيق إحالة
CREATE OR REPLACE FUNCTION public.apply_referral(p_referred_id UUID, p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referrer_id UUID;
    v_referral_id UUID;
    v_referrer_reward INTEGER := 5000;
    v_referred_reward INTEGER := 5000;
BEGIN
    -- التحقق من صحة الكود
    SELECT user_id INTO v_referrer_id
    FROM public.referral_codes
    WHERE code = p_referral_code AND is_active = true;
    
    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'كود الإحالة غير صالح');
    END IF;
    
    -- التحقق من أن المستخدم لا يحيل نفسه
    IF v_referrer_id = p_referred_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكنك استخدام كود الإحالة الخاص بك');
    END IF;
    
    -- التحقق من أن المستخدم لم يتم إحالته من قبل
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'لقد استخدمت كود إحالة من قبل');
    END IF;
    
    -- إنشاء الإحالة
    INSERT INTO public.referrals (referrer_id, referred_id, referral_code, referrer_reward, referred_reward, status)
    VALUES (v_referrer_id, p_referred_id, p_referral_code, v_referrer_reward, v_referred_reward, 'pending')
    RETURNING id INTO v_referral_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'referral_id', v_referral_id,
        'reward', v_referred_reward,
        'message', 'تم تطبيق كود الإحالة بنجاح! ستحصل على مكافأتك بعد إكمال أول رحلة.'
    );
END;
$$;

-- دالة لإكمال الإحالة بعد أول رحلة
CREATE OR REPLACE FUNCTION public.complete_referral_on_first_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referral RECORD;
    v_ride_count INTEGER;
BEGIN
    -- تحقق من أن الرحلة مكتملة
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- احسب عدد رحلات المستخدم
        SELECT COUNT(*) INTO v_ride_count
        FROM public.rides
        WHERE rider_id = NEW.rider_id AND status = 'completed';
        
        -- إذا كانت هذه أول رحلة
        IF v_ride_count = 1 THEN
            -- ابحث عن إحالة معلقة
            SELECT * INTO v_referral
            FROM public.referrals
            WHERE referred_id = NEW.rider_id AND status = 'pending';
            
            IF v_referral IS NOT NULL THEN
                -- أكمل الإحالة
                UPDATE public.referrals
                SET status = 'completed', completed_at = now()
                WHERE id = v_referral.id;
                
                -- حدث إحصائيات المُحيل
                UPDATE public.referral_codes
                SET 
                    total_referrals = total_referrals + 1,
                    total_earned = total_earned + v_referral.referrer_reward
                WHERE user_id = v_referral.referrer_id;
                
                -- TODO: أضف المكافآت للمحافظ
                -- سيتم تنفيذه لاحقاً عند تفعيل نظام المحفظة
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger لإكمال الإحالة
DROP TRIGGER IF EXISTS complete_referral_trigger ON public.rides;
CREATE TRIGGER complete_referral_trigger
    AFTER UPDATE ON public.rides
    FOR EACH ROW
    EXECUTE FUNCTION public.complete_referral_on_first_ride();

-- View لإحصائيات الإحالات
CREATE OR REPLACE VIEW public.referral_stats AS
SELECT 
    rc.user_id,
    rc.code,
    rc.total_referrals,
    rc.total_earned,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals
FROM public.referral_codes rc
LEFT JOIN public.referrals r ON rc.user_id = r.referrer_id
GROUP BY rc.user_id, rc.code, rc.total_referrals, rc.total_earned;

-- Grant permissions
GRANT SELECT ON public.referral_stats TO authenticated;

-- تعليقات
COMMENT ON TABLE public.referral_codes IS 'أكواد الإحالة للمستخدمين';
COMMENT ON TABLE public.referrals IS 'سجل الإحالات بين المستخدمين';
COMMENT ON FUNCTION public.generate_referral_code IS 'إنشاء كود إحالة فريد للمستخدم';
COMMENT ON FUNCTION public.apply_referral IS 'تطبيق كود إحالة على مستخدم جديد';
COMMENT ON FUNCTION public.complete_referral_on_first_ride IS 'إكمال الإحالة بعد أول رحلة';
