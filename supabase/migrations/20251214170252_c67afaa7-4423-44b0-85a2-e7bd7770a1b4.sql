-- Create notifications log table
CREATE TABLE public.notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_notifications_log_driver_id ON public.notifications_log(driver_id);
CREATE INDEX idx_notifications_log_created_at ON public.notifications_log(created_at DESC);
CREATE INDEX idx_notifications_log_type ON public.notifications_log(notification_type);

-- Enable RLS
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Drivers can view their own notifications
CREATE POLICY "Drivers can view their own notifications"
ON public.notifications_log
FOR SELECT
USING (driver_id IN (
  SELECT id FROM drivers WHERE user_id = auth.uid()
));

-- Only service role can insert (edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications_log
FOR INSERT
WITH CHECK (true);