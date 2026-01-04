-- Allow drivers to view rider profile info during active rides
CREATE POLICY "Drivers can view rider profile for active rides" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM rides 
    WHERE rides.rider_id = profiles.user_id
    AND rides.status IN ('accepted', 'arrived', 'in_progress')
    AND rides.driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  )
);