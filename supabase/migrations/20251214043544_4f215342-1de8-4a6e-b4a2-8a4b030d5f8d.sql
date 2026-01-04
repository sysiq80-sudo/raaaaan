-- Enable RLS on ride_ratings table
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- Create policies for ride_ratings
CREATE POLICY "Users can view their own ratings"
ON public.ride_ratings
FOR SELECT
USING (
  rider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);

CREATE POLICY "Riders can create ratings for their rides"
ON public.ride_ratings
FOR INSERT
WITH CHECK (
  rider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all ratings"
ON public.ride_ratings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));