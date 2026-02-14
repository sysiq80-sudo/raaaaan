-- إصلاح مشكلة عمود email المفقود
-- هذا الملف يحل مشكلة ERROR: 42703: column "email" does not exist

-- التحقق من وجود عمود email في جدول profiles
DO $$
BEGIN
    -- التحقق من وجود عمود email
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND table_schema = 'public'
          AND column_name = 'email'
    ) THEN
        -- إضافة عمود email إذا لم يكن موجوداً
        ALTER TABLE public.profiles ADD COLUMN email TEXT;

        RAISE NOTICE 'تم إضافة عمود email إلى جدول profiles';
    ELSE
        RAISE NOTICE 'عمود email موجود بالفعل في جدول profiles';
    END IF;
END $$;

-- التحقق من وجود عمود status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND table_schema = 'public'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active';
        RAISE NOTICE 'تم إضافة عمود status إلى جدول profiles';
    ELSE
        RAISE NOTICE 'عمود status موجود بالفعل في جدول profiles';
    END IF;
END $$;

-- التحقق من وجود عمود current_location
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND table_schema = 'public'
          AND column_name = 'current_location'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN current_location JSONB;
        RAISE NOTICE 'تم إضافة عمود current_location إلى جدول profiles';
    ELSE
        RAISE NOTICE 'عمود current_location موجود بالفعل في جدول profiles';
    END IF;
END $$;

-- التحقق من وجود عمود wallet_balance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND table_schema = 'public'
          AND column_name = 'wallet_balance'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN wallet_balance INTEGER DEFAULT 0;
        RAISE NOTICE 'تم إضافة عمود wallet_balance إلى جدول profiles';
    ELSE
        RAISE NOTICE 'عمود wallet_balance موجود بالفعل في جدول profiles';
    END IF;
END $$;

-- التحقق من وجود عمود wallet_enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND table_schema = 'public'
          AND column_name = 'wallet_enabled'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN wallet_enabled BOOLEAN DEFAULT true;
        RAISE NOTICE 'تم إضافة عمود wallet_enabled إلى جدول profiles';
    ELSE
        RAISE NOTICE 'عمود wallet_enabled موجود بالفعل في جدول profiles';
    END IF;
END $$;

-- عرض بنية الجدول بعد الإصلاح
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;