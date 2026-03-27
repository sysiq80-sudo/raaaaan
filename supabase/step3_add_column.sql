-- خطوة 3: إضافة عمود المحافظة للمعالم
-- شغل هذا بعد نجاح الخطوة 2

ALTER TABLE landmarks ADD COLUMN IF NOT EXISTS governorate_id UUID;
