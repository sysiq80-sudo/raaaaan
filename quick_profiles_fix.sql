-- حل سريع لمشكلة جدول profiles الموجود
-- شغّل هذا الاستعلام في Supabase SQL Editor

-- التحقق من بنية الجدول الحالي
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- إذا كنت تريد إعادة إنشاء الجدول (سيحذف جميع البيانات!)
-- uncomment السطور التالية بحذر:
/*
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ثم أعد تشغيل أمر إنشاء الجدول من ملف الترحيل الأصلي
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
*/