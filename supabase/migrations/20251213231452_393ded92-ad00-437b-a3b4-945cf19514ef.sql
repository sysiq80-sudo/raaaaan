-- Drop existing policy that only allows updating pending rides
DROP POLICY IF EXISTS "Riders can update their pending rides" ON public.rides;

-- Create new policy that allows riders to cancel their pending or accepted rides
CREATE POLICY "Riders can cancel their rides" 
ON public.rides 
FOR UPDATE 
USING (
  auth.uid() = rider_id 
  AND status IN ('pending', 'accepted')
)
WITH CHECK (
  auth.uid() = rider_id 
  AND status = 'cancelled'
);