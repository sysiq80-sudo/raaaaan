-- Check all user-related tables to find where data exists

-- 1. Check auth.users table
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- 2. Check profiles table
SELECT COUNT(*) as total_profiles FROM profiles;

-- 3. Check drivers table
SELECT COUNT(*) as total_drivers FROM drivers;

-- 4. Show sample auth.users (first 5)
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 5. Search for user by phone in auth.users email
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email LIKE '%7734166402%'
   OR email LIKE '%773416640%';

-- 6. Check if user exists in auth.users
SELECT 
    id,
    email,
    phone,
    created_at
FROM auth.users
WHERE phone = '07734166402'
   OR email = '07734166402@raan.app'
   OR email = '7734166402@raan.app'
   OR email = '773416640@raan.app';

-- 7. Create profile for existing auth users (if needed)
-- Uncomment this to create profiles for all auth.users
/*
INSERT INTO profiles (user_id, phone)
SELECT 
    u.id,
    CASE 
        WHEN u.email LIKE '%@raan.app' THEN split_part(u.email, '@', 1)
        ELSE u.phone
    END as phone
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id);
*/