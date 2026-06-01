SELECT
  proname AS function_name,
  CASE WHEN prosrc LIKE '%create_wallet_transaction%' THEN 'YES' ELSE 'NO' END AS new_system,
  CASE WHEN prosrc LIKE '%INSERT INTO driver_wallet_transactions%' THEN 'STILL HAS' ELSE 'CLEAN' END AS old_driver_tx,
  CASE WHEN prosrc LIKE '%UPDATE drivers%wallet_balance%' THEN 'STILL HAS' ELSE 'CLEAN' END AS old_driver_balance
FROM pg_proc
WHERE proname IN (
  'handle_driver_cancellation',
  'handle_rider_cancellation_penalty',
  'check_and_grant_incentives',
  'deduct_driver_commission'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
