-- ============================================================
-- اختبار أمني: تأكيد أن RPCs المالية ترفض غير الأدمن
-- ============================================================
SELECT
  'approve_topup_request' AS function_name,
  CASE
    WHEN pg_catalog.has_function_privilege(
      'authenticated',
      'public.approve_topup_request(uuid, text)',
      'EXECUTE'
    ) THEN 'authenticated_can_call'
    ELSE 'no_direct_privilege'
  END AS privilege_check;

SELECT
  'reject_topup_request' AS function_name,
  CASE
    WHEN pg_catalog.has_function_privilege(
      'authenticated',
      'public.reject_topup_request(uuid, text)',
      'EXECUTE'
    ) THEN 'authenticated_can_call'
    ELSE 'no_direct_privilege'
  END AS privilege_check;

-- تحقق: هل guard موجود في أول 5 أسطر من body الدالتين
SELECT
  proname,
  CASE
    WHEN prosrc LIKE '%IF NOT public.has_role(auth.uid(), ''admin''::app_role) THEN%'
     AND prosrc LIKE '%RAISE EXCEPTION ''UNAUTHORIZED_ADMIN''%'
    THEN 'GUARD_PRESENT'
    ELSE 'GUARD_MISSING'
  END AS guard_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('approve_topup_request', 'reject_topup_request')
ORDER BY p.proname;
