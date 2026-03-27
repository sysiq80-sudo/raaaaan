-- خطوة 6: إضافة Foreign Key
-- شغل هذا بعد نجاح الخطوة 5

ALTER TABLE landmarks DROP CONSTRAINT IF EXISTS landmarks_governorate_id_fkey;
ALTER TABLE landmarks ADD CONSTRAINT landmarks_governorate_id_fkey 
FOREIGN KEY (governorate_id) 
REFERENCES governorates(id) 
ON DELETE SET NULL;
