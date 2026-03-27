-- Drop the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.api_usage_daily_stats;

-- Create regular view (not security definer)
CREATE VIEW public.api_usage_daily_stats AS
SELECT 
  date,
  api_type,
  SUM(request_count) as total_requests,
  SUM(estimated_cost) as total_cost
FROM public.api_usage_logs
GROUP BY date, api_type
ORDER BY date DESC, api_type;