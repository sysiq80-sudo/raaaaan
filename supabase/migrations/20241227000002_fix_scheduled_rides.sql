-- Fix Scheduled Rides Issues
-- 1. Allow proper cancellation by riders
-- 2. Mark expired rides automatically
-- 3. Fix RLS policies

-- Drop existing UPDATE policy and create a more permissive one
DROP POLICY IF EXISTS "Riders can update their own scheduled rides" ON public.scheduled_rides;

-- Create new UPDATE policy that allows cancellation (status update)
CREATE POLICY "Riders can update their own scheduled rides"
ON public.scheduled_rides
FOR UPDATE
USING (auth.uid() = rider_id)
WITH CHECK (auth.uid() = rider_id);

-- Function to mark expired scheduled rides
CREATE OR REPLACE FUNCTION mark_expired_scheduled_rides()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.scheduled_rides
  SET status = 'expired', updated_at = now()
  WHERE status = 'scheduled'
    AND scheduled_at < (now() - INTERVAL '30 minutes');
END;
$$;

-- Run this function now to clean up old rides
SELECT mark_expired_scheduled_rides();

-- Create a function that riders can call to cancel their rides
CREATE OR REPLACE FUNCTION cancel_scheduled_ride(ride_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ride scheduled_rides%ROWTYPE;
BEGIN
  -- Get the ride and verify ownership
  SELECT * INTO v_ride
  FROM scheduled_rides
  WHERE id = ride_id
    AND rider_id = auth.uid()
    AND status IN ('scheduled', 'processing');
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'لم يتم العثور على الرحلة أو لا يمكن إلغاؤها'
    );
  END IF;
  
  -- Update the status to cancelled
  UPDATE scheduled_rides
  SET status = 'cancelled', updated_at = now()
  WHERE id = ride_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'تم إلغاء الرحلة المجدولة بنجاح'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cancel_scheduled_ride(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_expired_scheduled_rides() TO service_role;

-- Mark current expired rides
UPDATE public.scheduled_rides
SET status = 'expired', updated_at = now()
WHERE status = 'scheduled'
  AND scheduled_at < (now() - INTERVAL '30 minutes');
