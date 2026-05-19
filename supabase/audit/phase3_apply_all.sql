-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RAAN — Phase 3 (Dispatch v2) — Single-Paste Apply Script        ║
-- ║  انسخ كامل هذا الملف ولصقه في Supabase SQL Editor ثم Run         ║
-- ║  آمن للتشغيل أكثر من مرة (idempotent)                            ║
-- ╚══════════════════════════════════════════════════════════════════╝

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- [1/3] driver_matching_stats + triggers + recompute function
-- ════════════════════════════════════════════════════════════════════
-- ════════════════════════════════════════════════════════════
-- Phase 3 (Dispatch v2) — Driver Matching Stats
-- يحفظ مقاييس قبول/رفض/إكمال السائق آخر 30 يوم
-- يُحدَّث تدريجياً عبر trigger على ride_matching_log
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.driver_matching_stats (
    driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
    last_30d_offered INTEGER NOT NULL DEFAULT 0,
    last_30d_accepted INTEGER NOT NULL DEFAULT 0,
    last_30d_rejected INTEGER NOT NULL DEFAULT 0,
    last_30d_timeout INTEGER NOT NULL DEFAULT 0,
    last_30d_completed INTEGER NOT NULL DEFAULT 0,
    last_30d_cancelled_by_driver INTEGER NOT NULL DEFAULT 0,
    -- معدلات محسوبة (0..1) — تُحدَّث مع كل تغيير
    acceptance_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.700,
    cancellation_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    -- daily counter (يُصفّر يومياً عبر cron)
    today_offered INTEGER NOT NULL DEFAULT 0,
    today_accepted INTEGER NOT NULL DEFAULT 0,
    today_completed INTEGER NOT NULL DEFAULT 0,
    last_offered_at TIMESTAMPTZ,
    last_accepted_at TIMESTAMPTZ,
    last_recomputed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dms_acceptance_rate ON public.driver_matching_stats(acceptance_rate DESC);
CREATE INDEX IF NOT EXISTS idx_dms_today_offered ON public.driver_matching_stats(today_offered);

-- RLS
ALTER TABLE public.driver_matching_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers view own stats" ON public.driver_matching_stats;
CREATE POLICY "Drivers view own stats" ON public.driver_matching_stats
    FOR SELECT
    USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins view all stats" ON public.driver_matching_stats;
CREATE POLICY "Admins view all stats" ON public.driver_matching_stats
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- لا INSERT/UPDATE/DELETE من الـ clients — فقط service_role عبر trigger أو دوال SECURITY DEFINER

-- ════════════════════════════════════════════════════════════
-- Trigger: يحدّث driver_matching_stats عند INSERT/UPDATE في ride_matching_log
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_driver_matching_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_driver_id UUID;
    v_offered INTEGER;
    v_accepted INTEGER;
    v_rejected INTEGER;
    v_timeout INTEGER;
    v_total_responses INTEGER;
BEGIN
    -- INSERT: زيادة عدّاد العرض فقط
    IF TG_OP = 'INSERT' THEN
        v_driver_id := NEW.driver_id;
        IF v_driver_id IS NULL THEN
            RETURN NEW;
        END IF;

        INSERT INTO public.driver_matching_stats AS dms (
            driver_id, last_30d_offered, today_offered, last_offered_at, updated_at
        )
        VALUES (v_driver_id, 1, 1, now(), now())
        ON CONFLICT (driver_id) DO UPDATE SET
            last_30d_offered = dms.last_30d_offered + 1,
            today_offered    = dms.today_offered + 1,
            last_offered_at  = now(),
            updated_at       = now();

        RETURN NEW;
    END IF;

    -- UPDATE: عند تغيير الـ response من NULL إلى accepted/rejected/timeout/ignored
    IF TG_OP = 'UPDATE' THEN
        IF NEW.response IS NOT DISTINCT FROM OLD.response THEN
            RETURN NEW; -- لا تغيير
        END IF;

        v_driver_id := NEW.driver_id;
        IF v_driver_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- تأكد من وجود السجل
        INSERT INTO public.driver_matching_stats (driver_id)
        VALUES (v_driver_id)
        ON CONFLICT (driver_id) DO NOTHING;

        IF NEW.response = 'accepted' THEN
            UPDATE public.driver_matching_stats
            SET last_30d_accepted = last_30d_accepted + 1,
                today_accepted    = today_accepted + 1,
                last_accepted_at  = now(),
                updated_at        = now()
            WHERE driver_id = v_driver_id;
        ELSIF NEW.response = 'rejected' THEN
            UPDATE public.driver_matching_stats
            SET last_30d_rejected = last_30d_rejected + 1,
                updated_at        = now()
            WHERE driver_id = v_driver_id;
        ELSIF NEW.response IN ('timeout', 'ignored') THEN
            UPDATE public.driver_matching_stats
            SET last_30d_timeout = last_30d_timeout + 1,
                updated_at       = now()
            WHERE driver_id = v_driver_id;
        END IF;

        -- إعادة حساب acceptance_rate
        SELECT last_30d_offered, last_30d_accepted, last_30d_rejected, last_30d_timeout
        INTO v_offered, v_accepted, v_rejected, v_timeout
        FROM public.driver_matching_stats
        WHERE driver_id = v_driver_id;

        v_total_responses := COALESCE(v_accepted, 0) + COALESCE(v_rejected, 0) + COALESCE(v_timeout, 0);

        IF v_total_responses >= 5 THEN
            -- بيانات كافية للحساب الفعلي
            UPDATE public.driver_matching_stats
            SET acceptance_rate = ROUND(v_accepted::numeric / NULLIF(v_total_responses, 0), 3),
                updated_at = now()
            WHERE driver_id = v_driver_id;
        END IF;

        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$func$;

DROP TRIGGER IF EXISTS trg_update_driver_matching_stats ON public.ride_matching_log;
CREATE TRIGGER trg_update_driver_matching_stats
    AFTER INSERT OR UPDATE OF response ON public.ride_matching_log
    FOR EACH ROW
    EXECUTE FUNCTION public.update_driver_matching_stats();

-- ════════════════════════════════════════════════════════════
-- Trigger: تحديث cancellation_rate عند إلغاء الرحلة من السائق
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_driver_cancellation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_completed INTEGER;
    v_cancelled INTEGER;
    v_total INTEGER;
BEGIN
    -- نهتم فقط بالحالات التي تخص السائق
    IF NEW.driver_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    -- تأكد من وجود سجل في الإحصائيات
    INSERT INTO public.driver_matching_stats (driver_id)
    VALUES (NEW.driver_id)
    ON CONFLICT (driver_id) DO NOTHING;

    IF NEW.status = 'completed' THEN
        UPDATE public.driver_matching_stats
        SET last_30d_completed = last_30d_completed + 1,
            today_completed    = today_completed + 1,
            updated_at         = now()
        WHERE driver_id = NEW.driver_id;
    ELSIF NEW.status = 'cancelled' AND COALESCE(NEW.cancelled_by, '') = 'driver' THEN
        UPDATE public.driver_matching_stats
        SET last_30d_cancelled_by_driver = last_30d_cancelled_by_driver + 1,
            updated_at = now()
        WHERE driver_id = NEW.driver_id;
    END IF;

    -- إعادة حساب cancellation_rate
    SELECT last_30d_completed, last_30d_cancelled_by_driver
    INTO v_completed, v_cancelled
    FROM public.driver_matching_stats
    WHERE driver_id = NEW.driver_id;

    v_total := COALESCE(v_completed, 0) + COALESCE(v_cancelled, 0);

    IF v_total >= 5 THEN
        UPDATE public.driver_matching_stats
        SET cancellation_rate = ROUND(v_cancelled::numeric / NULLIF(v_total, 0), 3),
            updated_at = now()
        WHERE driver_id = NEW.driver_id;
    END IF;

    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_update_driver_cancellation_stats ON public.rides;
CREATE TRIGGER trg_update_driver_cancellation_stats
    AFTER UPDATE OF status ON public.rides
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'cancelled'))
    EXECUTE FUNCTION public.update_driver_cancellation_stats();

-- ════════════════════════════════════════════════════════════
-- Cron-callable: إعادة احتساب الإحصاء كل 24 ساعة من ride_matching_log التاريخي
-- يُنظف "اليوم" + يُعيد بناء آخر 30 يوم بدقة
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recompute_driver_matching_stats()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_count INTEGER;
BEGIN
    -- إعادة بناء كاملة آخر 30 يوم
    WITH agg AS (
        SELECT
            l.driver_id,
            COUNT(*)                                       AS offered,
            COUNT(*) FILTER (WHERE l.response = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE l.response = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE l.response IN ('timeout','ignored')) AS timeout_n
        FROM public.ride_matching_log l
        WHERE l.notified_at >= now() - INTERVAL '30 days'
          AND l.driver_id IS NOT NULL
        GROUP BY l.driver_id
    ),
    agg_rides AS (
        SELECT
            r.driver_id,
            COUNT(*) FILTER (WHERE r.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE r.status = 'cancelled' AND COALESCE(r.cancelled_by,'') = 'driver') AS cancelled
        FROM public.rides r
        WHERE r.created_at >= now() - INTERVAL '30 days'
          AND r.driver_id IS NOT NULL
        GROUP BY r.driver_id
    )
    INSERT INTO public.driver_matching_stats AS dms (
        driver_id,
        last_30d_offered, last_30d_accepted, last_30d_rejected, last_30d_timeout,
        last_30d_completed, last_30d_cancelled_by_driver,
        acceptance_rate, cancellation_rate,
        today_offered, today_accepted, today_completed,
        last_recomputed_at, updated_at
    )
    SELECT
        d.id,
        COALESCE(a.offered, 0),
        COALESCE(a.accepted, 0),
        COALESCE(a.rejected, 0),
        COALESCE(a.timeout_n, 0),
        COALESCE(ar.completed, 0),
        COALESCE(ar.cancelled, 0),
        CASE
            WHEN COALESCE(a.accepted, 0) + COALESCE(a.rejected, 0) + COALESCE(a.timeout_n, 0) >= 5
            THEN ROUND(COALESCE(a.accepted, 0)::numeric
                       / NULLIF(COALESCE(a.accepted, 0) + COALESCE(a.rejected, 0) + COALESCE(a.timeout_n, 0), 0), 3)
            ELSE 0.700
        END,
        CASE
            WHEN COALESCE(ar.completed, 0) + COALESCE(ar.cancelled, 0) >= 5
            THEN ROUND(COALESCE(ar.cancelled, 0)::numeric
                       / NULLIF(COALESCE(ar.completed, 0) + COALESCE(ar.cancelled, 0), 0), 3)
            ELSE 0.000
        END,
        0, 0, 0,  -- reset daily counters
        now(), now()
    FROM public.drivers d
    LEFT JOIN agg a       ON a.driver_id = d.id
    LEFT JOIN agg_rides ar ON ar.driver_id = d.id
    ON CONFLICT (driver_id) DO UPDATE SET
        last_30d_offered             = EXCLUDED.last_30d_offered,
        last_30d_accepted            = EXCLUDED.last_30d_accepted,
        last_30d_rejected            = EXCLUDED.last_30d_rejected,
        last_30d_timeout             = EXCLUDED.last_30d_timeout,
        last_30d_completed           = EXCLUDED.last_30d_completed,
        last_30d_cancelled_by_driver = EXCLUDED.last_30d_cancelled_by_driver,
        acceptance_rate              = EXCLUDED.acceptance_rate,
        cancellation_rate            = EXCLUDED.cancellation_rate,
        today_offered                = 0,
        today_accepted               = 0,
        today_completed              = 0,
        last_recomputed_at           = now(),
        updated_at                   = now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.recompute_driver_matching_stats() FROM anon, authenticated;

COMMENT ON TABLE public.driver_matching_stats IS
    'Phase 3 — مقاييس قبول/رفض/إلغاء السائق آخر 30 يوم. تُحدَّث تدريجياً عبر triggers + إعادة بناء يومية عبر recompute_driver_matching_stats()';


-- ════════════════════════════════════════════════════════════════════
-- [2/3] directions_cache + cleanup function
-- ════════════════════════════════════════════════════════════════════

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
AS $func$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.directions_cache WHERE expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_directions_cache() FROM anon, authenticated;

COMMENT ON TABLE public.directions_cache IS
    'Phase 3 — كاش نتائج Google Directions. مفتاح = شبكة 100م + ساعة. TTL 24h.';


-- ════════════════════════════════════════════════════════════════════
-- [3/3] app_settings (dispatch_version + weights)
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════
-- Phase 3 (Dispatch v2) — App Settings keys
-- يدمج مفاتيح v2 الجديدة في matching_settings مع الإبقاء على v1 keys
-- يبدأ dispatch_version = 'v2' (بعد التحقق يمكن rollback بتغيير القيمة)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.app_settings (key, value, description, updated_at)
VALUES (
    'matching_settings',
    jsonb_build_object(
        -- v1 keys (يبقى للتوافق)
        'matching_mode',         'hybrid',
        'max_retry_rounds',      5,
        'retry_delay_ms',        30000,
        'radius_expansion_km',   3,
        'max_drivers_notify',    5,
        'sequential_delay_ms',   8000,
        'fairness_weight',       0.1,
        -- v2 keys (Phase 3)
        'dispatch_version',      'v2',
        'weight_eta',            0.45,
        'weight_rating',         0.20,
        'weight_acceptance',     0.20,
        'weight_cancellation',   0.10,
        'weight_fairness_v2',    0.05,
        'eta_topk',              10,
        'eta_max_seconds',       1200,
        'new_driver_acceptance', 0.700
    ),
    'Phase 3: Dispatch v2 — ETA حقيقي + acceptance/cancellation scoring',
    now()
)
ON CONFLICT (key) DO UPDATE SET
    -- ندمج v2 keys مع القيم الموجودة (لا نعطّل أي إعداد مدير قام بتخصيصه)
    value = COALESCE(public.app_settings.value, '{}'::jsonb) || jsonb_build_object(
        'dispatch_version',      COALESCE(public.app_settings.value->>'dispatch_version', 'v2'),
        'weight_eta',            COALESCE((public.app_settings.value->>'weight_eta')::numeric, 0.45),
        'weight_rating',         COALESCE((public.app_settings.value->>'weight_rating')::numeric, 0.20),
        'weight_acceptance',     COALESCE((public.app_settings.value->>'weight_acceptance')::numeric, 0.20),
        'weight_cancellation',   COALESCE((public.app_settings.value->>'weight_cancellation')::numeric, 0.10),
        'weight_fairness_v2',    COALESCE((public.app_settings.value->>'weight_fairness_v2')::numeric, 0.05),
        'eta_topk',              COALESCE((public.app_settings.value->>'eta_topk')::integer, 10),
        'eta_max_seconds',       COALESCE((public.app_settings.value->>'eta_max_seconds')::integer, 1200),
        'new_driver_acceptance', COALESCE((public.app_settings.value->>'new_driver_acceptance')::numeric, 0.700)
    ),
    description = 'Phase 3: Dispatch v2 — ETA حقيقي + acceptance/cancellation scoring',
    updated_at = now();

-- ════════════════════════════════════════════════════════════
-- ملاحظة rollback: لإيقاف v2 والعودة لـ v1، نفّذ:
--   UPDATE public.app_settings
--   SET value = value || jsonb_build_object('dispatch_version', 'v1')
--   WHERE key = 'matching_settings';
-- ════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
-- ✅ Verification
-- ════════════════════════════════════════════════════════════════════
COMMIT;

SELECT 'driver_matching_stats' AS table_name,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='driver_matching_stats') AS exists,
       (SELECT relrowsecurity FROM pg_class WHERE relname='driver_matching_stats') AS rls_enabled
UNION ALL
SELECT 'directions_cache',
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='directions_cache'),
       (SELECT relrowsecurity FROM pg_class WHERE relname='directions_cache');

SELECT key,
       value->>'dispatch_version' AS dispatch_version,
       value->>'weight_eta'       AS w_eta,
       value->>'weight_rating'    AS w_rating,
       value->>'weight_acceptance' AS w_accept,
       value->>'eta_topk'         AS topk
FROM public.app_settings
WHERE key = 'matching_settings';

SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN ('trg_update_driver_matching_stats','trg_update_driver_cancellation_stats')
ORDER BY trigger_name;

SELECT p.proname,
       p.prosecdef AS security_definer,
       array_to_string(p.proconfig, ', ') AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('update_driver_matching_stats','update_driver_cancellation_stats','recompute_driver_matching_stats','cleanup_expired_directions_cache')
ORDER BY p.proname;

SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('recompute_driver_matching_stats','cleanup_expired_directions_cache')
ORDER BY p.proname;
