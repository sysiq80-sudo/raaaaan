SELECT
  proname AS function_name,
  CASE WHEN prosrc LIKE '%debt_limit%' THEN 'YES' ELSE 'NO' END AS reads_debt_limit,
  CASE WHEN prosrc LIKE '%v_new_balance < 0%' THEN 'STILL_HAS_ZERO_CHECK' ELSE 'CLEAN' END AS zero_check,
  CASE WHEN prosrc LIKE '%withdrawal%' THEN 'YES' ELSE 'NO' END AS withdrawal_guard,
  CASE WHEN prosrc LIKE '%FOR UPDATE%' THEN 'YES' ELSE 'NO' END AS row_lock
FROM pg_proc
WHERE proname IN ('create_wallet_transaction', 'deduct_driver_commission')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
