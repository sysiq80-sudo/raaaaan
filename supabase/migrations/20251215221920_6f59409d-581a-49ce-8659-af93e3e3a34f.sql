-- Function to link driver by phone to current authenticated user
-- This bypasses RLS to allow linking existing driver records to new user accounts
CREATE OR REPLACE FUNCTION public.link_driver_by_phone(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_driver_status driver_status;
  v_current_user_id uuid;
BEGIN
  -- Get the current authenticated user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- First check if user already has a driver record
  SELECT id, status INTO v_driver_id, v_driver_status
  FROM drivers
  WHERE user_id = v_current_user_id;
  
  IF v_driver_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'status', v_driver_status, 'linked', false);
  END IF;
  
  -- Try to find driver by phone
  SELECT id, status INTO v_driver_id, v_driver_status
  FROM drivers
  WHERE phone = p_phone;
  
  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No driver found with this phone');
  END IF;
  
  -- Update the driver's user_id to link to current user
  UPDATE drivers
  SET user_id = v_current_user_id, updated_at = now()
  WHERE id = v_driver_id;
  
  RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'status', v_driver_status, 'linked', true);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.link_driver_by_phone(text) TO authenticated;