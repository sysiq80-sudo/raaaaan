-- Create Admin User with Full Permissions
-- Email: klidmorre@gmail.com
-- Password: @A123

-- OPTION 1: If user already exists, grant admin role
-- Check if user exists first
SELECT id, email FROM auth.users WHERE email = 'klidmorre@gmail.com';

-- If user exists, add admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'klidmorre@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify admin role
SELECT 
  u.id,
  u.email,
  u.created_at,
  ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'klidmorre@gmail.com';

-- OPTION 2: If user does NOT exist
-- You need to create user via Supabase Dashboard or Auth API first:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User"
-- 3. Enter:
--    Email: klidmorre@gmail.com
--    Password: @A123
--    Auto Confirm User: Yes
-- 4. After creation, run the INSERT statement above to grant admin role

-- To create profile for new admin user (run after user creation):
INSERT INTO public.profiles (user_id, full_name, phone, preferred_language)
SELECT 
  id,
  'Admin User',
  NULL,
  'ar'
FROM auth.users
WHERE email = 'klidmorre@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET full_name = 'Admin User';

-- Final verification - should show admin role
SELECT 
  u.id,
  u.email,
  p.full_name,
  ur.role,
  u.email_confirmed_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'klidmorre@gmail.com';