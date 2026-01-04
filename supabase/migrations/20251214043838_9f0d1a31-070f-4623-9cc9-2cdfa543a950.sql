-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to notify drivers when new ride is created
CREATE OR REPLACE FUNCTION public.notify_drivers_new_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pickup_lat FLOAT;
  pickup_lng FLOAT;
BEGIN
  -- Only trigger for pending rides
  IF NEW.status = 'pending' THEN
    -- Extract pickup coordinates
    pickup_lat := (NEW.pickup_location->>'lat')::FLOAT;
    pickup_lng := (NEW.pickup_location->>'lng')::FLOAT;
    
    -- Call Edge Function to notify nearby drivers
    PERFORM extensions.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'notify_new_ride',
        'ride_id', NEW.id,
        'pickup_lat', pickup_lat,
        'pickup_lng', pickup_lng,
        'pickup_address', NEW.pickup_address,
        'dropoff_address', NEW.dropoff_address,
        'vehicle_type', NEW.vehicle_type,
        'estimated_fare', NEW.estimated_fare
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on rides table
DROP TRIGGER IF EXISTS on_new_ride_notify_drivers ON public.rides;
CREATE TRIGGER on_new_ride_notify_drivers
  AFTER INSERT ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_drivers_new_ride();