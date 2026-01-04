-- Enable REPLICA IDENTITY FULL for rides table to capture complete row data
ALTER TABLE public.rides REPLICA IDENTITY FULL;

-- Add rides table to realtime publication for INSTANT updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;

-- Also add drivers table for location updates
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;