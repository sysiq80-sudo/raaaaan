-- Create trigger function to notify driver when they receive a bonus
CREATE OR REPLACE FUNCTION public.notify_driver_bonus_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  request_id BIGINT;
  v_incentive_name TEXT;
BEGIN
  -- Get incentive name
  SELECT name INTO v_incentive_name
  FROM driver_incentives
  WHERE id = NEW.incentive_id;
  
  -- Call Edge Function to send push notification
  SELECT net.http_post(
    url := 'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
    ),
    body := jsonb_build_object(
      'action', 'notify_driver',
      'driver_id', NEW.driver_id,
      'title', '🎉 مبروك! حصلت على مكافأة',
      'body', 'لقد حصلت على مكافأة "' || COALESCE(v_incentive_name, 'حافز') || '" بقيمة ' || NEW.bonus_earned || ' د.ع',
      'data', jsonb_build_object(
        'type', 'bonus_earned',
        'incentive_id', NEW.incentive_id,
        'amount', NEW.bonus_earned
      )
    )
  ) INTO request_id;
  
  RAISE LOG 'Bonus notification sent for driver %: % IQD, request_id=%', 
    NEW.driver_id, NEW.bonus_earned, request_id;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on driver_incentive_claims
DROP TRIGGER IF EXISTS notify_driver_on_bonus ON driver_incentive_claims;
CREATE TRIGGER notify_driver_on_bonus
  AFTER INSERT ON driver_incentive_claims
  FOR EACH ROW
  EXECUTE FUNCTION notify_driver_bonus_earned();