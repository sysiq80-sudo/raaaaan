-- Phase 3: Stateless dispatch retry
-- يُزيل setTimeout من match-ride ويستبدله بحقلَين على جدول rides
-- يُشغَّل cron-dispatch كل دقيقة ويستدعي match-ride للرحلات المعلّقة

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS dispatch_next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_retry_round   INTEGER NOT NULL DEFAULT 0;

-- فهرس جزئي: يُسرّع استعلام cron-dispatch (rides pending فقط)
CREATE INDEX IF NOT EXISTS idx_rides_dispatch_retry
  ON public.rides (dispatch_next_retry_at)
  WHERE status = 'pending' AND dispatch_next_retry_at IS NOT NULL;

COMMENT ON COLUMN public.rides.dispatch_next_retry_at IS
  'متى يُعاد استدعاء match-ride لهذه الرحلة — NULL تعني لا يوجد retry مجدوَل';

COMMENT ON COLUMN public.rides.dispatch_retry_round IS
  'رقم جولة الـ retry الحالية — يرتفع مع كل محاولة';
