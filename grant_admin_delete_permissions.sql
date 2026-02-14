-- Temporary solution: Grant admin full delete permissions
-- Run this to allow admin to delete rides and related data

-- Create or replace function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Add admin delete policy for rides
DROP POLICY IF EXISTS "admin_can_delete_rides" ON public.rides;
CREATE POLICY "admin_can_delete_rides"
  ON public.rides
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for ride_ratings
DROP POLICY IF EXISTS "admin_can_delete_ride_ratings" ON public.ride_ratings;
CREATE POLICY "admin_can_delete_ride_ratings"
  ON public.ride_ratings
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for ride_share_links
DROP POLICY IF EXISTS "admin_can_delete_ride_share_links" ON public.ride_share_links;
CREATE POLICY "admin_can_delete_ride_share_links"
  ON public.ride_share_links
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for ride_matching_log
DROP POLICY IF EXISTS "admin_can_delete_ride_matching_log" ON public.ride_matching_log;
CREATE POLICY "admin_can_delete_ride_matching_log"
  ON public.ride_matching_log
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for emergency_alerts
DROP POLICY IF EXISTS "admin_can_delete_emergency_alerts" ON public.emergency_alerts;
CREATE POLICY "admin_can_delete_emergency_alerts"
  ON public.emergency_alerts
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for ride_messages
DROP POLICY IF EXISTS "admin_can_delete_ride_messages" ON public.ride_messages;
CREATE POLICY "admin_can_delete_ride_messages"
  ON public.ride_messages
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for scheduled_rides
DROP POLICY IF EXISTS "admin_can_delete_scheduled_rides" ON public.scheduled_rides;
CREATE POLICY "admin_can_delete_scheduled_rides"
  ON public.scheduled_rides
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for driver_wallet_transactions
DROP POLICY IF EXISTS "admin_can_delete_driver_wallet_transactions" ON public.driver_wallet_transactions;
CREATE POLICY "admin_can_delete_driver_wallet_transactions"
  ON public.driver_wallet_transactions
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for company_earnings
DROP POLICY IF EXISTS "admin_can_delete_company_earnings" ON public.company_earnings;
CREATE POLICY "admin_can_delete_company_earnings"
  ON public.company_earnings
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for ride_reviews
DROP POLICY IF EXISTS "admin_can_delete_ride_reviews" ON public.ride_reviews;
CREATE POLICY "admin_can_delete_ride_reviews"
  ON public.ride_reviews
  FOR DELETE
  USING (public.is_admin());

-- Add admin delete policy for rider_wallet_transactions
DROP POLICY IF EXISTS "admin_can_delete_rider_wallet_transactions" ON public.rider_wallet_transactions;
CREATE POLICY "admin_can_delete_rider_wallet_transactions"
  ON public.rider_wallet_transactions
  FOR DELETE
  USING (public.is_admin());

-- Verify policies were created
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE 'admin_can_delete%'
ORDER BY tablename;