-- =============================================
-- نظام أكواد الخصم (Promo Codes / Coupons)
-- مُستلهم من Ridy coupon system + تطوير لاحتياجات السوق العراقي
-- =============================================

-- جدول أكواد الخصم
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- معلومات الكود
    code TEXT NOT NULL UNIQUE,
    title_ar TEXT NOT NULL,                        -- اسم العرض بالعربية
    title_en TEXT,                                 -- اسم العرض بالإنجليزية
    description_ar TEXT,                           -- وصف العرض
    
    -- نوع الخصم
    discount_type TEXT NOT NULL DEFAULT 'percentage' 
        CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC NOT NULL DEFAULT 0,     -- قيمة الخصم (نسبة أو مبلغ ثابت)
    max_discount INTEGER,                          -- الحد الأقصى للخصم (بالدينار) — للنسبة فقط
    min_fare INTEGER DEFAULT 0,                    -- الحد الأدنى لقيمة الرحلة لتطبيق الخصم
    
    -- حدود الاستخدام
    max_uses INTEGER,                              -- عدد الاستخدامات الإجمالي (NULL = غير محدود)
    max_uses_per_user INTEGER DEFAULT 1,           -- عدد الاستخدامات لكل مستخدم
    used_count INTEGER NOT NULL DEFAULT 0,         -- عداد الاستخدامات
    
    -- الصلاحية
    starts_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,                        -- NULL = لا ينتهي
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- استهداف
    region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,  -- لمنطقة محددة (NULL = الكل)
    vehicle_type TEXT,                             -- لنوع مركبة محدد (NULL = الكل)
    new_users_only BOOLEAN DEFAULT false,          -- للمستخدمين الجدد فقط
    
    -- بيانات الإدارة
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- جدول سجل استخدام الأكواد
CREATE TABLE IF NOT EXISTS public.promo_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
    discount_amount INTEGER NOT NULL,              -- المبلغ الفعلي للخصم
    used_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- منع استخدام نفس الكود مرتين بنفس الرحلة
    UNIQUE(promo_code_id, ride_id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active, expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_user ON public.promo_code_usage(user_id, promo_code_id);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- السياسات — الجميع يشاهد الأكواد الفعالة
CREATE POLICY "Anyone can view active promo codes"
    ON public.promo_codes FOR SELECT
    USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- المدير فقط يدير الأكواد
CREATE POLICY "Admins manage promo codes"
    ON public.promo_codes FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- المستخدم يرى استخداماته فقط
CREATE POLICY "Users see own promo usage"
    ON public.promo_code_usage FOR SELECT
    USING (user_id = auth.uid());

-- المستخدم يمكنه إنشاء سجل استخدام لنفسه فقط
CREATE POLICY "Users create own promo usage"
    ON public.promo_code_usage FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- المدير يرى كل الاستخدامات
CREATE POLICY "Admins view all promo usage"
    ON public.promo_code_usage FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- دالة للتحقق من صلاحية كود الخصم
CREATE OR REPLACE FUNCTION public.validate_promo_code(
    p_code TEXT,
    p_user_id UUID,
    p_fare_amount INTEGER DEFAULT 0,
    p_vehicle_type TEXT DEFAULT NULL,
    p_region_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_promo promo_codes%ROWTYPE;
    v_user_usage_count INTEGER;
    v_discount_amount INTEGER;
    v_user_rides_count INTEGER;
BEGIN
    -- البحث عن الكود
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE code = UPPER(TRIM(p_code))
      AND is_active = true;
    
    IF v_promo IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'كود الخصم غير صالح');
    END IF;
    
    -- التحقق من الصلاحية الزمنية
    IF v_promo.starts_at IS NOT NULL AND v_promo.starts_at > now() THEN
        RETURN jsonb_build_object('valid', false, 'message', 'كود الخصم لم يبدأ بعد');
    END IF;
    
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
        RETURN jsonb_build_object('valid', false, 'message', 'كود الخصم منتهي الصلاحية');
    END IF;
    
    -- التحقق من الاستخدام الإجمالي
    IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'message', 'تم استنفاد كود الخصم');
    END IF;
    
    -- التحقق من استخدام المستخدم
    SELECT COUNT(*) INTO v_user_usage_count
    FROM promo_code_usage
    WHERE promo_code_id = v_promo.id AND user_id = p_user_id;
    
    IF v_promo.max_uses_per_user IS NOT NULL AND v_user_usage_count >= v_promo.max_uses_per_user THEN
        RETURN jsonb_build_object('valid', false, 'message', 'لقد استخدمت هذا الكود من قبل');
    END IF;
    
    -- التحقق من الحد الأدنى للأجرة
    IF p_fare_amount > 0 AND v_promo.min_fare > 0 AND p_fare_amount < v_promo.min_fare THEN
        RETURN jsonb_build_object('valid', false, 'message', 
            'الحد الأدنى للرحلة ' || v_promo.min_fare || ' دينار');
    END IF;
    
    -- التحقق من المنطقة
    IF v_promo.region_id IS NOT NULL AND p_region_id IS NOT NULL AND v_promo.region_id != p_region_id THEN
        RETURN jsonb_build_object('valid', false, 'message', 'الكود غير متاح في منطقتك');
    END IF;
    
    -- التحقق من نوع المركبة
    IF v_promo.vehicle_type IS NOT NULL AND p_vehicle_type IS NOT NULL AND v_promo.vehicle_type != p_vehicle_type THEN
        RETURN jsonb_build_object('valid', false, 'message', 'الكود غير متاح لهذا النوع من المركبات');
    END IF;
    
    -- التحقق من المستخدمين الجدد
    IF v_promo.new_users_only THEN
        SELECT COUNT(*) INTO v_user_rides_count
        FROM rides
        WHERE rider_id = p_user_id AND status = 'completed';
        
        IF v_user_rides_count > 0 THEN
            RETURN jsonb_build_object('valid', false, 'message', 'هذا الكود للمستخدمين الجدد فقط');
        END IF;
    END IF;
    
    -- حساب مبلغ الخصم
    IF v_promo.discount_type = 'percentage' THEN
        v_discount_amount := ROUND(p_fare_amount * v_promo.discount_value / 100);
        IF v_promo.max_discount IS NOT NULL THEN
            v_discount_amount := LEAST(v_discount_amount, v_promo.max_discount);
        END IF;
    ELSE
        v_discount_amount := v_promo.discount_value;
    END IF;
    
    RETURN jsonb_build_object(
        'valid', true,
        'promo_id', v_promo.id,
        'code', v_promo.code,
        'title_ar', v_promo.title_ar,
        'discount_type', v_promo.discount_type,
        'discount_value', v_promo.discount_value,
        'max_discount', v_promo.max_discount,
        'discount_amount', v_discount_amount,
        'message', COALESCE(v_promo.description_ar, 'تم تطبيق الخصم بنجاح!')
    );
END;
$$;

-- دالة لتطبيق كود الخصم على رحلة (تُستدعى عند إكمال الرحلة)
CREATE OR REPLACE FUNCTION public.apply_promo_code(
    p_promo_id UUID,
    p_user_id UUID,
    p_ride_id UUID,
    p_discount_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- تسجيل الاستخدام
    INSERT INTO promo_code_usage (promo_code_id, user_id, ride_id, discount_amount)
    VALUES (p_promo_id, p_user_id, p_ride_id, p_discount_amount);
    
    -- تحديث العداد
    UPDATE promo_codes
    SET used_count = used_count + 1,
        updated_at = now()
    WHERE id = p_promo_id;
    
    RETURN true;
EXCEPTION
    WHEN unique_violation THEN
        -- الكود مُستخدم بالفعل على هذه الرحلة
        RETURN false;
END;
$$;
