-- DANGER: Hard Delete ALL Riders and Related Data
-- This will PERMANENTLY DELETE all riders and all related data
-- NO RECOVERY POSSIBLE!

-- Order matters due to foreign key constraints
-- Delete in reverse dependency order

-- 1. Delete ratings (references riders)
DELETE FROM ratings WHERE rider_id IS NOT NULL;

-- 2. Delete ride requests (references riders)
DELETE FROM ride_requests WHERE rider_id IS NOT NULL;

-- 3. Delete payments (references riders)
DELETE FROM payments WHERE rider_id IS NOT NULL;

-- 4. Delete notifications (references user_id from riders)
DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM riders);

-- 5. Delete saved places (references user_id from riders)
DELETE FROM saved_places WHERE user_id IN (SELECT user_id FROM riders);

-- 6. Delete rides (references riders)
DELETE FROM rides WHERE rider_id IS NOT NULL;

-- 7. Finally, delete riders themselves
DELETE FROM riders;

-- Verify deletion
SELECT
  (SELECT COUNT(*) FROM riders) as remaining_riders,
  (SELECT COUNT(*) FROM rides WHERE rider_id IS NOT NULL) as remaining_rides,
  (SELECT COUNT(*) FROM saved_places) as remaining_saved_places,
  (SELECT COUNT(*) FROM payments WHERE rider_id IS NOT NULL) as remaining_payments,
  (SELECT COUNT(*) FROM notifications WHERE user_id IN (SELECT user_id FROM riders)) as remaining_notifications,
  (SELECT COUNT(*) FROM ride_requests WHERE rider_id IS NOT NULL) as remaining_requests,
  (SELECT COUNT(*) FROM ratings WHERE rider_id IS NOT NULL) as remaining_ratings;