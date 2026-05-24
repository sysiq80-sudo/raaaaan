-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read share links by token" ON public.ride_share_links;

-- Create a more restrictive policy that only allows reading by token (through RPC function)
-- The token lookup should happen through a secure function, not direct table access
CREATE POLICY "Riders can view their own share links" 
ON public.ride_share_links 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM rides 
    WHERE rides.id = ride_share_links.ride_id 
    AND (
      rides.rider_id = auth.uid() 
      OR rides.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    )
  )
);

-- Create a secure function to lookup ride by share token (for public access)
CREATE OR REPLACE FUNCTION public.get_ride_by_share_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_id uuid;
  v_ride jsonb;
BEGIN
  -- Find the ride_id from the token (only if not expired)
  SELECT ride_id INTO v_ride_id
  FROM ride_share_links
  WHERE token = p_token
    AND expires_at > now();
  
  IF v_ride_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'رابط المشاركة غير صالح أو منتهي الصلاحية');
  END IF;
  
  -- Get ride details with driver info (only safe fields)
  SELECT jsonb_build_object(
    'success', true,
    'ride', jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'pickup_location', r.pickup_location,
      'dropoff_location', r.dropoff_location,
      'pickup_address', r.pickup_address,
      'dropoff_address', r.dropoff_address,
      'vehicle_type', r.vehicle_type,
      'driver', CASE WHEN d.id IS NOT NULL THEN jsonb_build_object(
        'full_name', d.full_name,
        'vehicle_model', d.vehicle_model,
        'vehicle_color', d.vehicle_color,
        'vehicle_plate', d.vehicle_plate,
        'rating', d.rating,
        'current_location', d.current_location
      ) ELSE NULL END
    )
  ) INTO v_ride
  FROM rides r
  LEFT JOIN drivers d ON r.driver_id = d.id
  WHERE r.id = v_ride_id;
  
  RETURN COALESCE(v_ride, jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة'));
END;
$$;