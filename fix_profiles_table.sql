-- إصلاح مشكلة جدول profiles الموجود
-- هذا الملف يحل مشكلة ERROR: 42P07: relation "profiles" already exists

-- الحل 1: التحقق من وجود الجدول وإنشاؤه فقط إذا لم يكن موجوداً
DO $$
BEGIN
    -- التحقق من وجود جدول profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        -- إنشاء الجدول إذا لم يكن موجوداً
        CREATE TABLE public.profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
            full_name TEXT,
            phone TEXT,
            avatar_url TEXT,
            preferred_language TEXT DEFAULT 'ar',
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );

        -- تفعيل RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

        -- إضافة الصلاحيات
        CREATE POLICY "Users can view their own profile"
            ON public.profiles FOR SELECT
            USING (auth.uid() = user_id);

        CREATE POLICY "Users can update their own profile"
            ON public.profiles FOR UPDATE
            USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert their own profile"
            ON public.profiles FOR INSERT
            WITH CHECK (auth.uid() = user_id);

        RAISE NOTICE 'تم إنشاء جدول profiles بنجاح';
    ELSE
        RAISE NOTICE 'جدول profiles موجود بالفعل، تم تخطي الإنشاء';
    END IF;
END $$;

-- الحل 2: إعادة إنشاء الجدول (استخدم بحذر - سيحذف البيانات الموجودة)
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- ثم شغّل أمر إنشاء الجدول مرة أخرى

-- الحل 3: التحقق من بنية الجدول الحالي
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;
