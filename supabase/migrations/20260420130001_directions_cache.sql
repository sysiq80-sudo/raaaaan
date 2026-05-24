-- ════════════════════════════════════════════════════════════
-- Phase 3 (Dispatch v2) — Directions Cache
-- يخزّن نتائج Google Directions API لتقليل التكلفة
-- المفتاح: شبكة 100م × 100م + ساعة اليوم
-- TTL: 24 ساعة
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.directions_cache (
    cache_key TEXT PRIMARY KEY,        -- "olat_olng_dlat_dlng_hour" بدقة 0.001 درجة (~100م)
    origin_lat NUMERIC(8, 5) NOT NULL,
    origin_lng NUMERIC(8, 5) NOT NULL,
    dest_lat NUMERIC(8, 5) NOT NULL,
    dest_lng NUMERIC(8, 5) NOT NULL,
    hour_bucket SMALLINT NOT NULL,     -- 0..23
    duration_seconds INTEGER NOT NULL,
    distance_meters INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'google',  -- 'google' | 'manual'
    cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    hit_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_directions_cache_expires ON public.directions_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_directions_cache_hour ON public.directions_cache(hour_bucket);

-- RLS — قراءة فقط للـ admin (لا حاجة للمستخدمين الوصول مباشرة)
ALTER TABLE public.directions_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view directions cache" ON public.directions_cache;
CREATE POLICY "Admins view directions cache" ON public.directions_cache
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- INSERT/UPDATE/DELETE فقط من service_role

-- ════════════════════════════════════════════════════════════
-- Cleanup: حذف السجلات المنتهية الصلاحية
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_expired_directions_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cln_dc$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.directions_cache WHERE expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$cln_dc$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_directions_cache() FROM anon, authenticated;

COMMENT ON TABLE public.directions_cache IS
    'Phase 3 — كاش نتائج Google Directions. مفتاح = شبكة 100م + ساعة. TTL 24h.';
