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
