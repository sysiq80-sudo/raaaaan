-- تحقق: هل create_wallet_transaction تُستدعى بشكل مباشر في handle_driver_cancellation؟
SELECT prosrc LIKE '%create_wallet_transaction%' AS has_new_system,
       prosrc LIKE '%driver_wallet_transactions%' AS has_old_system,
       prosrc LIKE '%drivers%wallet_balance%' AS has_old_balance
FROM pg_proc
WHERE proname = 'handle_driver_cancellation'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- تحقق: handle_rider_cancellation_penalty
SELECT prosrc LIKE '%create_wallet_transaction%' AS has_new_system,
       prosrc LIKE '%INSERT INTO driver_wallet_transactions%' AS has_old_driver_write,
       prosrc LIKE '%INSERT INTO rider_wallet_transactions%' AS has_rider_write
FROM pg_proc
WHERE proname = 'handle_rider_cancellation_penalty'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- تحقق: check_and_grant_incentives
SELECT prosrc LIKE '%create_wallet_transaction%' AS has_new_system,
       prosrc LIKE '%INSERT INTO driver_wallet_transactions%' AS has_old_system
FROM pg_proc
WHERE proname = 'check_and_grant_incentives'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- تحقق: deduct_driver_commission
SELECT prosrc LIKE '%create_wallet_transaction%' AS has_new_system,
       prosrc LIKE '%INSERT INTO driver_wallet_transactions%' AS has_old_system,
       prosrc LIKE '%drivers.wallet_balance%' AS has_old_balance
FROM pg_proc
WHERE proname = 'deduct_driver_commission'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- تحقق: captain_compensation_shield_trigger payload يتضمن distance_to_pickup_at_cancel
SELECT prosrc LIKE '%distance_to_pickup_at_cancel%' AS has_distance_field
FROM pg_proc
WHERE proname = 'captain_compensation_shield_trigger'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- تحقق: add_cancellation_compensation محذوفة
SELECT COUNT(*) AS orphaned_count
FROM pg_proc
WHERE proname = 'add_cancellation_compensation'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- تحقق: الـ migrations مسجلة
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20270527004000', '20270527005000', '20270527006000')
ORDER BY version;
