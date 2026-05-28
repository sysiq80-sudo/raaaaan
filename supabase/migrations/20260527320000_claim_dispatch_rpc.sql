-- Phase 3: RPC ذرية لحجز dispatch jobs
-- تجمع SELECT + UPDATE في transaction واحد مع FOR UPDATE SKIP LOCKED
-- تمنع المعالجة المزدوجة حتى لو تزامن تشغيلان من cron-dispatch

CREATE OR REPLACE FUNCTION public.claim_dispatch_retry_jobs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(ride_id UUID, retry_round INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id
    FROM public.rides
    WHERE status = 'pending'
      AND dispatch_next_retry_at IS NOT NULL
      AND dispatch_next_retry_at <= NOW()
    ORDER BY dispatch_next_retry_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED  -- يتجاهل الصفوف المقفولة بدلاً من الانتظار
  )
  UPDATE public.rides r
  SET dispatch_next_retry_at = NULL
  FROM claimed c
  WHERE r.id = c.id
  RETURNING r.id AS ride_id, r.dispatch_retry_round AS retry_round;
$$;

-- منح الصلاحية لـ service_role (يُستخدم بواسطة cron-dispatch Edge Function)
GRANT EXECUTE ON FUNCTION public.claim_dispatch_retry_jobs(INTEGER) TO service_role;
