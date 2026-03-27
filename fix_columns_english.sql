-- Fix missing columns in profiles table
-- This script adds missing columns: email, status, current_location, wallet_balance, wallet_enabled

-- Add email column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
          AND table_schema = 'public'
          AND column_name = 'email'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
        RAISE NOTICE 'Added email column to profiles table';
    ELSE
        RAISE NOTICE 'Email column already exists in profiles table';
    END IF;
END $$;

-- Add status column if not exists
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
        RAISE NOTICE 'Added status column to profiles table';
    ELSE
        RAISE NOTICE 'Status column already exists in profiles table';
    END IF;
END $$;

-- Add current_location column if not exists
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
        RAISE NOTICE 'Added current_location column to profiles table';
    ELSE
        RAISE NOTICE 'Current_location column already exists in profiles table';
    END IF;
END $$;

-- Add wallet_balance column if not exists
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
        RAISE NOTICE 'Added wallet_balance column to profiles table';
    ELSE
        RAISE NOTICE 'Wallet_balance column already exists in profiles table';
    END IF;
END $$;

-- Add wallet_enabled column if not exists
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
        RAISE NOTICE 'Added wallet_enabled column to profiles table';
    ELSE
        RAISE NOTICE 'Wallet_enabled column already exists in profiles table';
    END IF;
END $$;

-- Show final table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;