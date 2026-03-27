-- Add RLS policy for riders/authenticated users to view available drivers
-- This is needed for showing driver availability counts and ETA estimates

CREATE POLICY "Authenticated users can view available drivers" 
ON public.drivers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_online = true 
  AND is_available = true 
  AND status = 'approved'
);