-- Function to clean up stale draft rides (older than 30 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_stale_draft_rides()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Cancel draft rides older than 30 minutes
  WITH cancelled AS (
    UPDATE rides
    SET status = 'cancelled',
        cancellation_reason = 'تم الإلغاء تلقائياً - انتهاء المهلة',
        updated_at = now()
    WHERE status = 'draft'
      AND created_at < now() - interval '30 minutes'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM cancelled;
  
  RETURN deleted_count;
END;
$$;

-- Create a cron-like trigger using pg_cron if available, otherwise use a simple approach
-- We'll call this from an edge function or periodically
COMMENT ON FUNCTION public.cleanup_stale_draft_rides IS 'Cancels draft rides older than 30 minutes. Call periodically.';
