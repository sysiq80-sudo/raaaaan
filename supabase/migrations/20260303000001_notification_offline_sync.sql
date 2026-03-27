-- ══════════════════════════════════════════════════════════════════
-- ران — Hybrid Notification & Offline Sync Infrastructure
-- Migration: 20260303000001
-- ══════════════════════════════════════════════════════════════════

-- 1. profiles — FCM token & device type for native wake-up
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'pwa'
    CHECK (device_type IN ('pwa', 'android', 'ios'));

COMMENT ON COLUMN public.profiles.fcm_token   IS 'FCM token for native Android/iOS push wake-up';
COMMENT ON COLUMN public.profiles.device_type IS 'pwa | android | ios';

CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token
  ON public.profiles(fcm_token) WHERE fcm_token IS NOT NULL;

-- 2. notifications_log — ACK tracking for 15-second WhatsApp fallback loop
ALTER TABLE public.notifications_log
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ack_method      TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fallback_sent   BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fallback_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ride_id         UUID
    REFERENCES public.rides(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notifications_log.acknowledged_at IS 'NULL = unacknowledged → triggers WhatsApp fallback after 15s';
COMMENT ON COLUMN public.notifications_log.ack_method      IS 'How acknowledged: app | whatsapp | sms';
COMMENT ON COLUMN public.notifications_log.fallback_sent   IS 'Whether the WhatsApp fallback was triggered';

CREATE INDEX IF NOT EXISTS idx_notifications_log_ack
  ON public.notifications_log(acknowledged_at, created_at)
  WHERE acknowledged_at IS NULL AND fallback_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_log_ride_id
  ON public.notifications_log(ride_id)
  WHERE ride_id IS NOT NULL;

-- 3. RPC: mark_notification_acknowledged
CREATE OR REPLACE FUNCTION public.mark_notification_acknowledged(
  p_notification_id UUID,
  p_method          TEXT DEFAULT 'app'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications_log
  SET acknowledged_at = NOW(), ack_method = p_method
  WHERE id = p_notification_id AND acknowledged_at IS NULL;
END;
$$;

-- 4. driver_live_locations — add accuracy + offline flag
ALTER TABLE public.driver_live_locations
  ADD COLUMN IF NOT EXISTS accuracy   FLOAT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.driver_live_locations.is_offline IS 'TRUE = buffered offline, synced later';
