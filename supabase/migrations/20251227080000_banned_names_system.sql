-- ======================================
-- ران - نظام الأسماء المحظورة
-- ======================================

-- جدول الأسماء المحظورة
CREATE TABLE IF NOT EXISTS public.banned_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    reason TEXT,
    added_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_banned_names_name ON public.banned_names(lower(name));
CREATE INDEX IF NOT EXISTS idx_banned_names_active ON public.banned_names(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE public.banned_names ENABLE ROW LEVEL SECURITY;

-- سياسة: الأدمن فقط يمكنه إدارة الأسماء المحظورة
DROP POLICY IF EXISTS "Admins can manage banned names" ON public.banned_names;
CREATE POLICY "Admins can manage banned names"
    ON public.banned_names FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- سياسة: الكل يمكنه قراءة الأسماء المحظورة (للتحقق)
DROP POLICY IF EXISTS "Anyone can read banned names" ON public.banned_names;
CREATE POLICY "Anyone can read banned names"
    ON public.banned_names FOR SELECT
    USING (is_active = true);

-- إدراج الأسماء المحظورة الافتراضية
INSERT INTO public.banned_names (name, reason) VALUES
-- عربي
('مستخدم', 'اسم افتراضي'),
('راكب', 'اسم افتراضي'),
('سائق', 'اسم افتراضي'),
('مجهول', 'اسم غير محدد'),
('اسم', 'اسم عام'),
('بدون اسم', 'اسم غير محدد'),
('لا يوجد', 'اسم غير محدد'),
('تجربة', 'اختبار'),
('تيست', 'اختبار'),
('اختبار', 'اختبار'),
('فلان', 'اسم وهمي'),
('علان', 'اسم وهمي'),
('شخص', 'اسم عام'),
('أنا', 'اسم غير محدد'),
('زائر', 'اسم افتراضي'),
('ضيف', 'اسم افتراضي'),
('عميل', 'اسم عام'),
('مشترك', 'اسم عام'),
('جديد', 'اسم عام'),
('الاسم', 'اسم عام'),
-- إنجليزي
('user', 'اسم افتراضي'),
('rider', 'اسم افتراضي'),
('driver', 'اسم افتراضي'),
('test', 'اختبار'),
('testing', 'اختبار'),
('unknown', 'اسم غير محدد'),
('anonymous', 'اسم غير محدد'),
('guest', 'اسم افتراضي'),
('customer', 'اسم عام'),
('new', 'اسم عام'),
('name', 'اسم عام'),
('null', 'قيمة فارغة'),
('undefined', 'قيمة فارغة'),
('none', 'اسم غير محدد'),
('admin', 'محجوز'),
('support', 'محجوز'),
('raan', 'اسم التطبيق'),
('ران', 'اسم التطبيق')
ON CONFLICT (name) DO NOTHING;

-- دالة للتحقق من الاسم
CREATE OR REPLACE FUNCTION public.is_name_banned(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name_lower TEXT;
BEGIN
    IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
        RETURN true;
    END IF;
    
    v_name_lower := lower(trim(p_name));
    
    -- التحقق المباشر
    IF EXISTS(SELECT 1 FROM banned_names WHERE is_active = true AND lower(name) = v_name_lower) THEN
        RETURN true;
    END IF;
    
    -- التحقق إذا كان الاسم يحتوي على اسم محظور (للأسماء القصيرة)
    IF length(v_name_lower) < 10 THEN
        IF EXISTS(SELECT 1 FROM banned_names WHERE is_active = true AND v_name_lower LIKE '%' || lower(name) || '%') THEN
            RETURN true;
        END IF;
    END IF;
    
    RETURN false;
END;
$$;

-- دالة لتحديث الاسم مع التحقق
CREATE OR REPLACE FUNCTION public.update_user_name(p_new_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_name_trimmed TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مسجل الدخول');
    END IF;
    
    v_name_trimmed := trim(p_new_name);
    
    -- التحقق من الطول
    IF length(v_name_trimmed) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'الاسم قصير جداً');
    END IF;
    
    IF length(v_name_trimmed) > 50 THEN
        RETURN jsonb_build_object('success', false, 'error', 'الاسم طويل جداً');
    END IF;
    
    -- التحقق من الأسماء المحظورة
    IF is_name_banned(v_name_trimmed) THEN
        RETURN jsonb_build_object('success', false, 'error', 'هذا الاسم غير مسموح به');
    END IF;
    
    -- التحقق من وجود كلمتين
    IF array_length(string_to_array(v_name_trimmed, ' '), 1) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرجاء إدخال الاسم الأول واسم العائلة');
    END IF;
    
    -- تحديث الاسم
    UPDATE profiles SET full_name = v_name_trimmed, updated_at = now() WHERE user_id = v_user_id;
    
    RETURN jsonb_build_object('success', true, 'name', v_name_trimmed);
END;
$$;

GRANT SELECT ON public.banned_names TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_name_banned TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_name TO authenticated;

-- تعليقات
COMMENT ON TABLE public.banned_names IS 'قائمة الأسماء المحظورة';
COMMENT ON FUNCTION public.is_name_banned IS 'التحقق إذا كان الاسم محظوراً';
COMMENT ON FUNCTION public.update_user_name IS 'تحديث اسم المستخدم مع التحقق';

SELECT 'تم إنشاء نظام الأسماء المحظورة بنجاح! ✅' as message;
