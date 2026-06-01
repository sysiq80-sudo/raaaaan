-- Drop the custom policy if it exists to clean up
DROP POLICY IF EXISTS "riders can view their ride drivers" ON public.drivers;
DROP POLICY IF EXISTS "Riders can view details of drivers they had rides with" ON public.drivers;

-- Create a security definer function to check if the rider has had any ride with the driver
-- This avoids circular RLS references between rides and drivers tables
CREATE OR REPLACE FUNCTION public.rider_has_had_ride_with_driver(driver_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.driver_id = driver_id_param
      AND r.rider_id = auth.uid()
  );
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.rider_has_had_ride_with_driver(UUID) TO authenticated;

-- Create the new policy allowing riders to select drivers they have had rides with
CREATE POLICY "Riders can view details of drivers they had rides with"
ON public.drivers FOR SELECT
USING (
  public.rider_has_had_ride_with_driver(id)
);
