-- Test OTP functionality
-- This checks if the OTP edge function is working

-- 1. Check if send-otp function exists (this is an edge function, not SQL function)
-- Edge functions are deployed separately and can't be checked via SQL

-- 2. Create a simple test rider account without OTP for testing
-- Use this ONLY for testing purposes

-- Test account details:
-- Phone: 07734166402
-- Password: Test123456
-- Email: 07734166402@raan.app

-- Step 1: Create user in auth.users (you need to do this via Supabase dashboard or signUp)
-- Step 2: After user is created, create profile

-- Manual profile creation (after user exists in auth.users)
/*
INSERT INTO profiles (user_id, full_name, phone, email)
VALUES (
    'USER_ID_HERE',  -- Replace with actual user_id from auth.users
    'Test Rider',
    '07734166402',
    '07734166402@raan.app'
);
*/

-- Alternative: Skip OTP verification for testing
-- This allows registration without OTP (DEVELOPMENT ONLY!)

-- Check current OTP settings
SELECT * FROM app_settings WHERE key LIKE '%otp%';

-- To disable OTP verification temporarily (CAREFUL!)
-- UPDATE app_settings SET value = 'false' WHERE key = 'require_otp_verification';

-- Check if edge functions are accessible
-- Try calling from browser console:
-- await supabase.functions.invoke('send-otp', { body: { action: 'send', phone: '07734166402', purpose: 'rider_registration' } });