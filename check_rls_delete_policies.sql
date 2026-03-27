-- Check RLS policies for all tables related to rides
-- This will show which tables might be blocking the delete

-- Check ride_ratings policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ride_ratings' AND cmd = 'DELETE';

-- Check ride_share_links policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ride_share_links' AND cmd = 'DELETE';

-- Check ride_matching_log policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ride_matching_log' AND cmd = 'DELETE';

-- Check emergency_alerts policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'emergency_alerts' AND cmd = 'DELETE';

-- Check ride_messages policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ride_messages' AND cmd = 'DELETE';

-- Check scheduled_rides policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'scheduled_rides' AND cmd = 'DELETE';

-- Check driver_wallet_transactions policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'driver_wallet_transactions' AND cmd = 'DELETE';

-- Check company_earnings policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'company_earnings' AND cmd = 'DELETE';

-- Check ride_reviews policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ride_reviews' AND cmd = 'DELETE';

-- Check rider_wallet_transactions policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'rider_wallet_transactions' AND cmd = 'DELETE';

-- Check rides policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'rides' AND cmd = 'DELETE';