-- إضافة مفتاح Google Maps API إلى app_settings
-- تاريخ: 2026-02-01

-- حذف المفتاح القديم إذا كان موجوداً
DELETE FROM app_settings WHERE key = 'google_maps_api_key';

-- إضافة المفتاح الجديد
INSERT INTO app_settings (key, value, description)
VALUES (
  'google_maps_api_key',
  '{"api_key": "YOUR_GOOGLE_MAPS_API_KEY"}'::jsonb,
  'Google Maps API Key for the application - includes Maps JavaScript API, Directions API, Geocoding API, and Static Maps API'
);

-- التحقق من الإضافة
SELECT * FROM app_settings WHERE key = 'google_maps_api_key';
