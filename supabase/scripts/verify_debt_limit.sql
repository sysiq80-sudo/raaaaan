-- التحقق من create_wallet_transaction: هل تقرأ debt_limit بدلاً من الصفر؟
SELECT
  proname AS function_name,
  CASE WHEN prosrc LIKE '%debt_limit%' THEN 'YES' ELSE 'NO' END AS reads_debt_limit,
  CASE WHEN prosrc LIKE '%v_new_balance < 0%' THEN 'STILL HAS ZERO CHECK' ELSE 'OK' END AS zero_check_removed,
  CASE WHEN prosrc LIKE '%withdrawal%' THEN 'YES' ELSE 'NO' END AS has_withdrawal_guard,
  CASE WHEN prosrc LIKE '%FOR UPDATE%' THEN 'YES' ELSE 'NO' END AS has_row_lock
FROM pg_proc
WHERE proname IN ('create_wallet_transaction', 'deduct_driver_commission')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- التحقق من قيمة debt_limit الحالية في app_settings
SELECT value->>'debt_limit' AS debt_limit
FROM app_settings
WHERE key = 'monetization';
