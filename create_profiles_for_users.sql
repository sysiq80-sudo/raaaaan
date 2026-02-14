-- Create profiles for existing auth.users
-- This will link auth.users with profiles table

-- Step 1: Create profile for admin user
INSERT INTO profiles (user_id, full_name, email, phone)
SELECT 
    id as user_id,
    'Admin' as full_name,
    email,
    NULL as phone
FROM auth.users
WHERE email = 'klidmorre@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.users.id);

-- Step 2: Search for rider by phone in auth.users
SELECT 
    id,
    email,
    phone,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email LIKE '%7734166402%'
   OR email LIKE '%07734166402%'
   OR phone = '07734166402'
   OR phone = '7734166402';

-- Step 3: List all auth.users to find the rider
SELECT 
    id,
    email,
    phone,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- Step 4: Check if profiles were created
SELECT COUNT(*) as profiles_count FROM profiles;

-- Step 5: View all profiles
SELECT 
    id,
    user_id,
    full_name,
    phone,
    email,
    created_at
FROM profiles
ORDER BY created_at DESC;