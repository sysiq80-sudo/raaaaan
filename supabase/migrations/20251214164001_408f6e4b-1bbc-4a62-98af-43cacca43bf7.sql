-- Create function to notify driver on status change
CREATE OR REPLACE FUNCTION public.notify_driver_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  request_id BIGINT;
BEGIN
  -- Only trigger when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Call Edge Function using pg_net to notify driver
    SELECT net.http_post(
      url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
      ),
      body := jsonb_build_object(
        'action', 'notify_driver_status_change',
        'driver_id', NEW.id,
        'driver_name', NEW.full_name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    ) INTO request_id;
    
    RAISE LOG 'Driver status change notification sent for driver % (% -> %): request_id=%', 
      NEW.id, OLD.status, NEW.status, request_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for driver status changes
DROP TRIGGER IF EXISTS on_driver_status_change ON drivers;
CREATE TRIGGER on_driver_status_change
  AFTER UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION notify_driver_status_change();