-- ================================================================
-- 🧹 سكريبت تنظيف قاعدة البيانات - RAAN App
-- تاريخ: 2026-01-13
-- الغرض: حذف جميع البيانات التجريبية للسائقين والركاب
-- ================================================================

-- تعطيل فحص المفاتيح الأجنبية مؤقتاً
SET session_replication_role = 'replica';

-- ================================================================
-- المرحلة 1: حذف الجداول المعتمدة على الرحلات
-- ================================================================

-- حذف تقييمات الرحلات
DELETE FROM ride_ratings;
RAISE NOTICE 'تم حذف ride_ratings';

-- حذف رسائل الرحلات
DELETE FROM ride_messages;
RAISE NOTICE 'تم حذف ride_messages';

-- حذف معاملات محفظة السائق
DELETE FROM driver_wallet_transactions;
RAISE NOTICE 'تم حذف driver_wallet_transactions';

-- حذف معاملات المحفظة
DELETE FROM wallet_transactions;
RAISE NOTICE 'تم حذف wallet_transactions';

-- حذف الرحلات المجدولة
DELETE FROM scheduled_rides;
RAISE NOTICE 'تم حذف scheduled_rides';

-- ================================================================
-- المرحلة 2: حذف الرحلات والبيانات المرتبطة
-- ================================================================

-- حذف جميع الرحلات
DELETE FROM rides;
RAISE NOTICE 'تم حذف rides';

-- حذف سجل مواقع السائقين
DELETE FROM driver_location_history;
RAISE NOTICE 'تم حذف driver_location_history';

-- حذف تحديات السائقين
DELETE FROM driver_challenges;
RAISE NOTICE 'تم حذف driver_challenges';

-- حذف عروض السائقين
DELETE FROM driver_offers;
RAISE NOTICE 'تم حذف driver_offers';

-- ================================================================
-- المرحلة 3: حذف بيانات السائقين
-- ================================================================

-- حذف السائقين الوهميين
DELETE FROM fake_drivers;
RAISE NOTICE 'تم حذف fake_drivers';

-- حذف السائقين الحقيقيين
DELETE FROM drivers;
RAISE NOTICE 'تم حذف drivers';

-- ================================================================
-- المرحلة 4: حذف بيانات المستخدمين
-- ================================================================

-- حذف الأماكن المحفوظة
DELETE FROM saved_places;
RAISE NOTICE 'تم حذف saved_places';

-- حذف ملفات المستخدمين
DELETE FROM profiles;
RAISE NOTICE 'تم حذف profiles';

-- ================================================================
-- المرحلة 5: تنظيف الإشعارات والسجلات
-- ================================================================

-- حذف إشعارات المدير
DELETE FROM admin_notifications;
RAISE NOTICE 'تم حذف admin_notifications';

-- حذف سجلات API
DELETE FROM api_usage_logs;
RAISE NOTICE 'تم حذف api_usage_logs';

-- حذف حدود المعدل
DELETE FROM ip_rate_limits;
RAISE NOTICE 'تم حذف ip_rate_limits';

-- حذف الهواتف المحظورة
DELETE FROM blocked_phones;
RAISE NOTICE 'تم حذف blocked_phones';

-- ================================================================
-- إعادة تفعيل فحص المفاتيح الأجنبية
-- ================================================================
SET session_replication_role = 'origin';

-- ================================================================
-- ✅ اكتمل التنظيف بنجاح!
-- ================================================================
