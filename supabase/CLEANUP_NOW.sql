TRUNCATE TABLE ride_ratings CASCADE;
TRUNCATE TABLE ride_messages CASCADE;
TRUNCATE TABLE driver_wallet_transactions CASCADE;
TRUNCATE TABLE scheduled_rides CASCADE;
TRUNCATE TABLE rides CASCADE;
TRUNCATE TABLE fake_drivers CASCADE;
TRUNCATE TABLE drivers CASCADE;
TRUNCATE TABLE saved_places CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE admin_notifications CASCADE;
TRUNCATE TABLE api_usage_logs CASCADE;
TRUNCATE TABLE ip_rate_limits CASCADE;
TRUNCATE TABLE blocked_phones CASCADE;

SELECT 'تم تنظيف قاعدة البيانات بنجاح' as result;

