-- Count all riders and related data before deletion
-- Run this in Supabase SQL Editor to see what will be deleted

-- 1. Count total riders
SELECT COUNT(*) as total_riders FROM riders;

-- 2. Count rides by riders
SELECT COUNT(*) as total_rides FROM rides WHERE rider_id IS NOT NULL;

-- 3. Count saved places
SELECT COUNT(*) as total_saved_places FROM saved_places;

-- 4. Count payments
SELECT COUNT(*) as total_payments FROM payments WHERE rider_id IS NOT NULL;

-- 5. Count notifications
SELECT COUNT(*) as total_notifications FROM notifications WHERE user_id IN (SELECT user_id FROM riders);

-- 6. Count ride requests
SELECT COUNT(*) as total_ride_requests FROM ride_requests WHERE rider_id IS NOT NULL;

-- 7. Count ratings
SELECT COUNT(*) as total_ratings FROM ratings WHERE rider_id IS NOT NULL;

-- 8. Show sample riders (first 5)
SELECT user_id, email, phone, full_name, created_at
FROM riders
LIMIT 5;