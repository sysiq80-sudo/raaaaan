-- Delete all RIDERS (users who are not drivers) and their related data
-- NO RECOVERY POSSIBLE

-- Step 1: Find rider user_ids (users who are NOT drivers)
SELECT 
  u.id,
  u.email,
  p.full_name,
  p.phone,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.id NOT IN (SELECT user_id FROM public.drivers)
LIMIT 10;

-- Step 2: Count what will be deleted
SELECT 
  COUNT(*) as total_riders_to_delete,
  (SELECT COUNT(*) FROM public.rides WHERE rider_id IN (
    SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
  )) as related_rides,
  (SELECT COUNT(*) FROM public.saved_places WHERE user_id IN (
    SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
  )) as related_saved_places,
  (SELECT COUNT(*) FROM public.profiles WHERE user_id IN (
    SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
  )) as related_profiles,
  (SELECT COUNT(*) FROM public.rider_wallet_transactions WHERE user_id IN (
    SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
  )) as related_wallet_transactions,
  (SELECT COUNT(*) FROM public.emergency_contacts WHERE user_id IN (
    SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
  )) as related_emergency_contacts
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.drivers);

-- Step 3: DELETE ALL RIDERS AND RELATED DATA (Uncomment to execute)
-- WARNING: This will permanently delete all non-driver users

-- Delete emergency contacts
-- DELETE FROM public.emergency_contacts 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete rider wallet transactions
-- DELETE FROM public.rider_wallet_transactions 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete saved places
-- DELETE FROM public.saved_places 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete push tokens
-- DELETE FROM public.push_tokens 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete push subscriptions
-- DELETE FROM public.push_subscriptions 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete ride messages
-- DELETE FROM public.ride_messages 
-- WHERE ride_id IN (SELECT id FROM public.rides WHERE rider_id IN (
--   SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
-- ));

-- Delete ride ratings
-- DELETE FROM public.ride_ratings 
-- WHERE ride_id IN (SELECT id FROM public.rides WHERE rider_id IN (
--   SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
-- ));

-- Delete ride reviews
-- DELETE FROM public.ride_reviews 
-- WHERE rider_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete scheduled rides
-- DELETE FROM public.scheduled_rides 
-- WHERE rider_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete referrals where rider is involved
-- DELETE FROM public.referrals 
-- WHERE referrer_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers))
--    OR referee_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete rides (set rider_id to NULL instead of deleting completely)
-- UPDATE public.rides 
-- SET rider_id = NULL 
-- WHERE rider_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete profiles
-- DELETE FROM public.profiles 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Delete user roles
-- DELETE FROM public.user_roles 
-- WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Finally delete from auth.users (this will cascade delete identities, sessions, etc.)
-- DELETE FROM auth.users 
-- WHERE id NOT IN (SELECT user_id FROM public.drivers);

-- Verify deletion
-- SELECT COUNT(*) as remaining_non_driver_users 
-- FROM auth.users 
-- WHERE id NOT IN (SELECT user_id FROM public.drivers);