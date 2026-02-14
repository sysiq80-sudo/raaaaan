-- Simple fix for missing columns
-- Run each ALTER TABLE command separately if needed

-- Add missing columns one by one
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_location JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_enabled BOOLEAN DEFAULT true;

-- Check the result
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;