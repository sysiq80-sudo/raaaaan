-- Create in-app notifications table for drivers
CREATE TABLE public.driver_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Drivers can view their own notifications"
ON public.driver_notifications FOR SELECT
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can update their own notifications"
ON public.driver_notifications FOR UPDATE
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can delete their own notifications"
ON public.driver_notifications FOR DELETE
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "System can insert notifications"
ON public.driver_notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage all notifications"
ON public.driver_notifications FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_driver_notifications_driver_id ON driver_notifications(driver_id);
CREATE INDEX idx_driver_notifications_is_read ON driver_notifications(driver_id, is_read);

-- Update bonus notification trigger to also create in-app notification
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
  
  -- Create in-app notification
  INSERT INTO driver_notifications (driver_id, title, body, type, data)
  VALUES (
    NEW.driver_id,
    '🎉 مبروك! حصلت على مكافأة',
    'لقد حصلت على مكافأة "' || COALESCE(v_incentive_name, 'حافز') || '" بقيمة ' || NEW.bonus_earned || ' د.ع',
    'bonus',
    jsonb_build_object('incentive_id', NEW.incentive_id, 'amount', NEW.bonus_earned)
  );
  
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
      'data', jsonb_build_object('type', 'bonus_earned', 'incentive_id', NEW.incentive_id, 'amount', NEW.bonus_earned)
    )
  ) INTO request_id;
  
  RAISE LOG 'Bonus notification sent for driver %: % IQD', NEW.driver_id, NEW.bonus_earned;
  
  RETURN NEW;
END;
$function$;