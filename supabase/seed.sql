-- =============================================================================
-- ران RAAN — بيانات أساسية أولية (Seed Data)
-- يُنفَّذ مرة واحدة بعد تطبيق جميع migrations على قاعدة بيانات جديدة
-- =============================================================================

BEGIN;

-- ─── 1. الدول ────────────────────────────────────────────────────────────────
INSERT INTO countries (code, name_ar, name_en, is_active)
VALUES ('IQ', 'العراق', 'Iraq', true)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. إعدادات التطبيق (app_settings) ───────────────────────────────────────

-- الإعدادات العامة
INSERT INTO app_settings (key, value, description) VALUES
('general', '{"maintenance_mode": false, "app_name": "ران", "default_language": "ar"}', 'الإعدادات العامة للتطبيق'),
('notifications', '{"enabled": true, "push_enabled": true, "sms_enabled": false}', 'إعدادات الإشعارات'),
('rides', '{"max_active_rides": 1, "auto_cancel_minutes": 5}', 'إعدادات الرحلات'),
('payments', '{"cash": true, "wallet": true, "card": false}', 'طرق الدفع المتاحة'),
('support', '{"phone": "+964 7884669922", "whatsapp": "+964 7884669922", "email": "support@raan.app"}', 'معلومات الدعم الفني'),
('maps', '{"provider": "google", "default_zoom": 14}', 'إعدادات الخرائط'),
('commission', '{"rate": 0.15, "min_amount": 500}', 'عمولة التطبيق — 15%'),
('fare_calculation', '{"base_fare": 2000, "per_km_rate": 500, "waiting_rate_per_min": 100, "min_fare": 2000, "max_surge": 2.0, "economy_multiplier": 1.0, "comfort_multiplier": 1.3, "premium_multiplier": 1.8, "women_only_multiplier": 1.2}', 'إعدادات حساب الأجرة'),
('security_settings', '{"max_active_rides_per_user": 1, "ride_creation_cooldown_seconds": 30, "whatsapp_rate_limit_per_minute": 5}', 'إعدادات الأمان'),
('matching_settings', '{"max_radius_km": 5, "timeout_seconds": 20, "max_attempts": 5}', 'إعدادات مطابقة السائقين'),
('cancellation_fee', '{"enabled": true, "applies_after_acceptance": true, "amount": 1000}', 'رسوم الإلغاء'),
('show_drivers_to_riders', 'true', 'عرض السائقين على الخريطة للراكب'),
('show_fake_drivers', 'false', 'عرض سائقين وهميين'),
('min_app_version', '"1.0.0"', 'الحد الأدنى لإصدار التطبيق'),
('default_wait_timeout', '5', 'مهلة انتظار الرحلة (دقائق)'),
('integrations', '{"zaincash": false, "nass": false, "whatsapp": false}', 'تكاملات خارجية')
ON CONFLICT (key) DO NOTHING;

-- إعدادات الطوارئ
INSERT INTO app_settings (key, value, description) VALUES
('dual_stop_detection_interval', '5', 'فحص توقف مزدوج — كل كم دقيقة'),
('dual_stop_warning_threshold', '10', 'عتبة تحذير التوقف المزدوج (دقائق)'),
('dual_stop_critical_threshold', '20', 'عتبة حرجة للتوقف المزدوج (دقائق)'),
('dual_stop_distance_threshold', '50', 'مسافة التوقف المزدوج (متر)'),
('emergency_abuse_limit', '3', 'حد إساءة استخدام الطوارئ')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. إعدادات تسجيل السائقين ──────────────────────────────────────────────
INSERT INTO driver_registration_settings (
  require_id_photo, require_license_photo, require_car_photo,
  require_car_registration, require_insurance, require_background_check,
  is_paid_registration, registration_fee, promo_enabled,
  promo_discount_percentage, auto_approve
) VALUES (
  true, true, true,
  true, false, false,
  false, 0, false,
  0, false
)
ON CONFLICT DO NOTHING;

-- ─── 4. وسوم التقييم (review_tags) ──────────────────────────────────────────
INSERT INTO review_tags (tag_ar, tag_en, tag_type, applies_to, icon, is_active) VALUES
-- وسوم إيجابية للسائق
('قيادة ممتازة', 'Excellent driving', 'positive', 'driver', '🚗', true),
('مهذب ولطيف', 'Polite and friendly', 'positive', 'driver', '😊', true),
('سيارة نظيفة', 'Clean car', 'positive', 'driver', '✨', true),
('وصل بسرعة', 'Arrived quickly', 'positive', 'driver', '⚡', true),
('يعرف الطريق', 'Knows the way', 'positive', 'driver', '🗺️', true),
('ملتزم بالسعر', 'Fair pricing', 'positive', 'driver', '💰', true),
-- وسوم سلبية للسائق
('قيادة متهورة', 'Reckless driving', 'negative', 'driver', '⚠️', true),
('سيارة غير نظيفة', 'Dirty car', 'negative', 'driver', '🚫', true),
('تأخر كثيراً', 'Very late', 'negative', 'driver', '⏰', true),
('طريق طويل', 'Took long route', 'negative', 'driver', '🔄', true),
-- وسوم إيجابية للراكب
('راكب مهذب', 'Polite rider', 'positive', 'rider', '👍', true),
('دقيق بالموعد', 'On time', 'positive', 'rider', '⏰', true),
-- وسوم سلبية للراكب
('تأخر بالنزول', 'Late to arrive at pickup', 'negative', 'rider', '⏳', true),
('موقع غير دقيق', 'Inaccurate location', 'negative', 'rider', '📍', true)
ON CONFLICT DO NOTHING;

COMMIT;
