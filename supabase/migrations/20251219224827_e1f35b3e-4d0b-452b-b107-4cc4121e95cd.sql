-- إضافة إعداد غرامة الإلغاء
INSERT INTO app_settings (key, value, description)
VALUES (
  'cancellation_fee',
  '{"amount": 2000, "enabled": true, "applies_after_acceptance": true}'::jsonb,
  'غرامة إلغاء الرحلة بعد قبول السائق (بالدينار العراقي)'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- إضافة أعمدة لتتبع غرامة الإلغاء في جدول الرحلات
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS cancellation_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_fee_paid BOOLEAN DEFAULT FALSE;