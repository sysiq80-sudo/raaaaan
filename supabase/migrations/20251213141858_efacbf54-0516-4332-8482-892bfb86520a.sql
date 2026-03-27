-- Add policy to allow drivers to view pending rides (for accepting new rides)
CREATE POLICY "Drivers can view pending rides"
ON public.rides
FOR SELECT
USING (
  status = 'pending' 
  AND driver_id IS NULL
  AND EXISTS (
    SELECT 1 FROM drivers 
    WHERE drivers.user_id = auth.uid() 
    AND drivers.status = 'approved'
    AND drivers.is_online = true
  )
);

-- Add policy to allow drivers to claim pending rides
CREATE POLICY "Drivers can accept pending rides"
ON public.rides
FOR UPDATE
USING (
  status = 'pending' 
  AND driver_id IS NULL
  AND EXISTS (
    SELECT 1 FROM drivers 
    WHERE drivers.user_id = auth.uid() 
    AND drivers.status = 'approved'
    AND drivers.is_online = true
  )
)
WITH CHECK (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
);