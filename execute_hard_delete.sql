-- FINAL EXECUTION: Hard Delete ALL Riders
-- This will PERMANENTLY DELETE all 11 riders and related data
-- NO RECOVERY POSSIBLE

-- Step 1: Delete emergency contacts
DELETE FROM public.emergency_contacts
WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 2: Delete rider wallet transactions
DELETE FROM public.rider_wallet_transactions
WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 3: Delete saved places
DELETE FROM public.saved_places
WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 4: Delete push tokens
DELETE FROM public.push_tokens
WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 5: Delete ride ratings (by ride_id from riders' rides)
DELETE FROM public.ride_ratings
WHERE ride_id IN (SELECT id FROM public.rides WHERE rider_id IN (
  SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)
));

-- Step 6: Delete scheduled rides
DELETE FROM public.scheduled_rides
WHERE rider_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 7: Update rides (set rider_id to NULL instead of deleting completely)
UPDATE public.rides
SET rider_id = NULL
WHERE rider_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 8: Delete profiles
DELETE FROM public.profiles
WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 9: Delete user roles
DELETE FROM public.user_roles
WHERE user_id IN (SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers));

-- Step 10: Finally delete from auth.users (this will cascade delete identities, sessions, etc.)
DELETE FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.drivers);

-- Step 11: Verify deletion
SELECT
  (SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.drivers)) as remaining_riders,
  (SELECT COUNT(*) FROM public.rides WHERE rider_id IS NOT NULL) as rides_with_riders,
  (SELECT COUNT(*) FROM public.profiles) as remaining_profiles,
  (SELECT COUNT(*) FROM public.saved_places) as remaining_saved_places,
  (SELECT COUNT(*) FROM public.rider_wallet_transactions) as remaining_wallet_transactions,
  (SELECT COUNT(*) FROM public.emergency_contacts) as remaining_emergency_contacts;