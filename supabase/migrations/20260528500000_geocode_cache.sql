-- ═══════════════════════════════════════════════════════════════════
-- Migration: كاش Geocoding — يوفر 60-80% من تكلفة Google Maps API
-- ═══════════════════════════════════════════════════════════════════

-- جدول كاش للـ geocode و reverse-geocode
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  query_hash TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('geocode', 'reverse-geocode')),
  results JSONB NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- فهرس لتنظيف المنتهي
CREATE INDEX IF NOT EXISTS idx_geocode_cache_expires
  ON public.geocode_cache (expires_at);

-- فهرس للإحصائيات
CREATE INDEX IF NOT EXISTS idx_geocode_cache_action
  ON public.geocode_cache (action);

-- RLS: service_role فقط (Edge Function تستخدم service_role)
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geocode_cache_service_only" ON public.geocode_cache;
CREATE POLICY "geocode_cache_service_only" ON public.geocode_cache
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- تنظيف تلقائي أسبوعي
SELECT cron.schedule(
  'cleanup-geocode-cache',
  '0 4 * * 0', -- كل أحد الساعة 4 فجراً
  $$DELETE FROM public.geocode_cache WHERE expires_at < now()$$
);

COMMENT ON TABLE public.geocode_cache IS 'كاش server-side لنتائج Google Geocoding — يوفر 60-80% من تكلفة API';
