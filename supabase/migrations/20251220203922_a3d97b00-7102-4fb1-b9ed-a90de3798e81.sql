-- Add wait timeout columns to regions table
ALTER TABLE public.regions 
ADD COLUMN IF NOT EXISTS wait_timeout_minutes INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS weekend_wait_timeout_minutes INTEGER DEFAULT 15;

-- Add comment for documentation
COMMENT ON COLUMN public.regions.wait_timeout_minutes IS 'وقت انتظار الراكب بالدقائق قبل الإلغاء التلقائي (أيام العمل)';
COMMENT ON COLUMN public.regions.weekend_wait_timeout_minutes IS 'وقت انتظار الراكب بالدقائق قبل الإلغاء التلقائي (أيام العطلة)';