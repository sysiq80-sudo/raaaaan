-- ════════════════════════════════════════════════════════════════════════
-- Phase 3 Dispatch v2 → ROLLBACK to v1
-- استخدم هذا في حالة وجود مشكلة في الإنتاج مع dispatch v2
-- ════════════════════════════════════════════════════════════════════════
-- ملاحظة: لا نُسقط الجداول/الـ triggers — فقط نُعيد flag إلى v1
-- بحيث يبقى recompute متاحاً لاحقاً عند إعادة التفعيل
-- ════════════════════════════════════════════════════════════════════════

-- خطوة 1: عرض الحالة الحالية قبل التراجع
SELECT
  key,
  value->>'dispatch_version' AS current_version,
  updated_at
FROM public.app_settings
WHERE key = 'matching_settings';

-- خطوة 2: التراجع لـ v1
UPDATE public.app_settings
SET
  value = value || jsonb_build_object('dispatch_version', 'v1'),
  updated_at = NOW()
WHERE key = 'matching_settings';

-- خطوة 3: التحقق
SELECT
  key,
  value->>'dispatch_version' AS new_version,
  updated_at
FROM public.app_settings
WHERE key = 'matching_settings';

-- ════════════════════════════════════════════════════════════════════════
-- بعد التنفيذ:
--   - match-ride Edge Function ستقرأ dispatch_version='v1' وتستخدم
--     المنطق القديم (no scoring, no pre-filter)
--   - الـ triggers تظل تعبّى driver_matching_stats (لا ضرر)
--   - directions_cache يستمر في العمل (مفيد لـ ETA حتى في v1)
--
-- لإعادة التفعيل لاحقاً:
--   UPDATE public.app_settings
--   SET value = value || jsonb_build_object('dispatch_version','v2')
--   WHERE key='matching_settings';
-- ════════════════════════════════════════════════════════════════════════
