-- Create table for API usage tracking
CREATE TABLE public.api_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_type text NOT NULL, -- 'mapbox_directions', 'mapbox_geocode', 'mapbox_static', 'mapbox_token', 'google_directions', 'google_geocode'
  endpoint text,
  request_count integer DEFAULT 1,
  estimated_cost numeric(10,6) DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  date date DEFAULT CURRENT_DATE
);

-- Create index for efficient querying
CREATE INDEX idx_api_usage_logs_date ON public.api_usage_logs(date);
CREATE INDEX idx_api_usage_logs_api_type ON public.api_usage_logs(api_type);
CREATE INDEX idx_api_usage_logs_created_at ON public.api_usage_logs(created_at);

-- Enable RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view API usage logs"
ON public.api_usage_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert logs (from edge functions)
CREATE POLICY "System can insert API usage logs"
ON public.api_usage_logs
FOR INSERT
WITH CHECK (true);

-- Create aggregated view for daily stats
CREATE OR REPLACE VIEW public.api_usage_daily_stats AS
SELECT 
  date,
  api_type,
  SUM(request_count) as total_requests,
  SUM(estimated_cost) as total_cost
FROM public.api_usage_logs
GROUP BY date, api_type
ORDER BY date DESC, api_type;

-- Create function to log API usage
CREATE OR REPLACE FUNCTION public.log_api_usage(
  p_api_type text,
  p_endpoint text DEFAULT NULL,
  p_request_count integer DEFAULT 1,
  p_estimated_cost numeric DEFAULT 0,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.api_usage_logs (api_type, endpoint, request_count, estimated_cost, metadata)
  VALUES (p_api_type, p_endpoint, p_request_count, p_estimated_cost, p_metadata);
END;
$$;