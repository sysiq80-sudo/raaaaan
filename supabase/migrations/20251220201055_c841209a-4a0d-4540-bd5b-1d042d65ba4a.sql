-- إضافة مواقع تجريبية لبعض الركاب لاختبار الخريطة
UPDATE profiles 
SET current_location = '{"lat": 33.3152, "lng": 44.3661}'::jsonb 
WHERE id = 'b5f03230-1846-4029-9ee5-3421537ee2c4';

UPDATE profiles 
SET current_location = '{"lat": 33.4262, "lng": 44.3922}'::jsonb 
WHERE id = '70125120-5f3e-4038-adb0-276400e59f88';

UPDATE profiles 
SET current_location = '{"lat": 33.3055, "lng": 44.3687}'::jsonb 
WHERE id = '16f0c72c-9289-43e3-b22f-6db4e35172d2';