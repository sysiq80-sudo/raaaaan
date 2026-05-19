-- ════════════════════════════════════════════════════════════════════════
-- إعادة تفعيل Dispatch v2 (بعد اختبار rollback)
-- ════════════════════════════════════════════════════════════════════════

-- الحالة قبل
SELECT key, value->>'dispatch_version' AS before_version
FROM public.app_settings WHERE key = 'matching_settings';

-- إعادة لـ v2
UPDATE public.app_settings
SET
  value = value || jsonb_build_object('dispatch_version', 'v2'),
  updated_at = NOW()
WHERE key = 'matching_settings';

-- الحالة بعد
SELECT key, value->>'dispatch_version' AS after_version, updated_at
FROM public.app_settings WHERE key = 'matching_settings';
