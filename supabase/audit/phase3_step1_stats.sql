-- Step 1/3: driver_matching_stats
-- الصق كاملاً في SQL Editor ثم Run

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
AS $upd_dms$
DECLARE
    v_driver_id UUID;
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
            RETURN NEW;
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

        -- إعادة حساب acceptance_rate (inline — بدون SELECT INTO)
        UPDATE public.driver_matching_stats
        SET acceptance_rate = CASE
                WHEN (last_30d_accepted + last_30d_rejected + last_30d_timeout) >= 5
                THEN ROUND(
                    last_30d_accepted::numeric
                    / NULLIF(last_30d_accepted + last_30d_rejected + last_30d_timeout, 0),
                    3
                )
                ELSE acceptance_rate
            END,
            updated_at = now()
        WHERE driver_id = v_driver_id;

        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$upd_dms$;

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
AS $upd_dcs$
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

    -- إعادة حساب cancellation_rate (inline — بدون SELECT INTO)
    UPDATE public.driver_matching_stats
    SET cancellation_rate = CASE
            WHEN (last_30d_completed + last_30d_cancelled_by_driver) >= 5
            THEN ROUND(
                last_30d_cancelled_by_driver::numeric
                / NULLIF(last_30d_completed + last_30d_cancelled_by_driver, 0),
                3
            )
            ELSE cancellation_rate
        END,
        updated_at = now()
    WHERE driver_id = NEW.driver_id;

    RETURN NEW;
END;
$upd_dcs$;

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
AS $rcp_dms$
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
$rcp_dms$;

REVOKE EXECUTE ON FUNCTION public.recompute_driver_matching_stats() FROM anon, authenticated;

COMMENT ON TABLE public.driver_matching_stats IS
    'Phase 3 — مقاييس قبول/رفض/إلغاء السائق آخر 30 يوم. تُحدَّث تدريجياً عبر triggers + إعادة بناء يومية عبر recompute_driver_matching_stats()';

