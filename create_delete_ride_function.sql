-- Alternative solution: Use SQL function to delete ride with CASCADE logic
-- This bypasses some RLS and constraint issues

CREATE OR REPLACE FUNCTION delete_ride_cascade(ride_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT := 0;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Delete in correct order to avoid foreign key conflicts
  
  -- 1. ride_ratings
  DELETE FROM public.ride_ratings WHERE ride_id = ride_id_param;
  
  -- 2. ride_share_links
  DELETE FROM public.ride_share_links WHERE ride_id = ride_id_param;
  
  -- 3. ride_matching_log
  DELETE FROM public.ride_matching_log WHERE ride_id = ride_id_param;
  
  -- 4. emergency_alerts
  DELETE FROM public.emergency_alerts WHERE ride_id = ride_id_param;
  
  -- 5. ride_messages
  DELETE FROM public.ride_messages WHERE ride_id = ride_id_param;
  
  -- 6. scheduled_rides
  DELETE FROM public.scheduled_rides WHERE ride_id = ride_id_param;
  
  -- 7. driver_wallet_transactions
  DELETE FROM public.driver_wallet_transactions WHERE ride_id = ride_id_param;
  
  -- 8. company_earnings
  DELETE FROM public.company_earnings WHERE ride_id = ride_id_param;
  
  -- 9. ride_reviews
  DELETE FROM public.ride_reviews WHERE ride_id = ride_id_param;
  
  -- 10. rider_wallet_transactions
  DELETE FROM public.rider_wallet_transactions WHERE ride_id = ride_id_param;
  
  -- 11. Finally delete the ride
  DELETE FROM public.rides WHERE id = ride_id_param;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count = 0 THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Ride and all related data deleted successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_ride_cascade(UUID) TO authenticated;

-- Test the function (replace with actual ride ID)
-- SELECT delete_ride_cascade('8fe0ed63-a785-4071-858a-eec2109e09d7');