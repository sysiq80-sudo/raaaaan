-- Check column names for tables that reference users
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('emergency_contacts', 'rider_wallet_transactions', 'saved_places', 'push_tokens', 'push_subscriptions', 'ride_messages', 'ride_ratings', 'ride_reviews', 'scheduled_rides', 'referrals', 'profiles', 'user_roles')
  AND column_name LIKE '%user%' OR column_name LIKE '%rider%'
ORDER BY table_name, column_name;