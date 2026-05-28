-- ═══════════════════════════════════════════════════════════════
-- Phase 6A: System Events — Operational Health Monitoring
-- ═══════════════════════════════════════════════════════════════
-- Lightweight audit trail for critical backend events.
-- Edge Functions write here via log_system_event() RPC.
-- Admin can query this table to see operational health.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text        NOT NULL,          -- e.g. 'ride_abandoned', 'cron_batch_failed'
  severity     text        NOT NULL           -- 'info' | 'warn' | 'error'
                           CHECK (severity IN ('info', 'warn', 'error')),
  message      text        NOT NULL,
  metadata     jsonb,                         -- arbitrary context (ride_id, driver_count, …)
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index: recent events by severity (admin health dashboard)
CREATE INDEX IF NOT EXISTS idx_system_events_severity_time
  ON public.system_events (severity, created_at DESC);

-- Index: by type for filtering
CREATE INDEX IF NOT EXISTS idx_system_events_type_time
  ON public.system_events (event_type, created_at DESC);

-- RLS: only admins can read; service_role writes via RPC (bypasses RLS)
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read system events" ON public.system_events;
CREATE POLICY "Admins can read system events"
  ON public.system_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct INSERT policy — writes go through log_system_event() SECURITY DEFINER only

-- ── 2. RPC: log_system_event ──────────────────────────────────────
-- Called by Edge Functions (service_role key) to record critical events.
-- SECURITY DEFINER so Edge Functions don't need INSERT RLS permission.
CREATE OR REPLACE FUNCTION public.log_system_event(
  p_event_type  text,
  p_severity    text,
  p_message     text,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.system_events (event_type, severity, message, metadata)
  VALUES (p_event_type, p_severity, p_message, p_metadata);
$$;

GRANT EXECUTE ON FUNCTION public.log_system_event(text, text, text, jsonb)
  TO service_role;

-- ── 3. Auto-purge old events (keep 30 days) ──────────────────────
-- pg_cron job: runs every 7 days at 03:00 UTC, deletes events older than 30 days
SELECT cron.schedule(
  'purge-system-events',
  '0 3 */7 * *',
  $$DELETE FROM public.system_events WHERE created_at < now() - interval '30 days'$$
);
