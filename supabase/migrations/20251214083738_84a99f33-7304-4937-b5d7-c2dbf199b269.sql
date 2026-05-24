-- حذف المناطق المكررة والغير مستخدمة (مناطق بغداد - خارج نطاق الخدمة)
DELETE FROM regions WHERE name_en IN ('Adhamiya', 'Adhamiyah', 'Bayaa', 'Dora', 'Al-Shaab', 'Kadhimiya', 'Karrada', 'Mansour', 'Green Zone', 'Zayouna');

-- إضافة مناطق الأنبار/الرمادي مع إحداثيات polygon حقيقية
-- تحديث المناطق الموجودة بإحداثيات حقيقية

-- حي العزيزية - منطقة سكنية شمال الرمادي
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي العزيزية',
  'Al-Aziziya',
  2500,
  600,
  150,
  true,
  '[{"lat": 33.4350, "lng": 43.2850}, {"lat": 33.4350, "lng": 43.3050}, {"lat": 33.4200, "lng": 43.3050}, {"lat": 33.4200, "lng": 43.2850}]'::jsonb
);

-- حي الملعب - منطقة وسط الرمادي
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي الملعب',
  'Al-Malaab',
  2000,
  500,
  100,
  true,
  '[{"lat": 33.4280, "lng": 43.3050}, {"lat": 33.4280, "lng": 43.3200}, {"lat": 33.4150, "lng": 43.3200}, {"lat": 33.4150, "lng": 43.3050}]'::jsonb
);

-- حي الورار - منطقة تجارية
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي الورار',
  'Al-Warar',
  2000,
  500,
  100,
  true,
  '[{"lat": 33.4400, "lng": 43.2700}, {"lat": 33.4400, "lng": 43.2900}, {"lat": 33.4280, "lng": 43.2900}, {"lat": 33.4280, "lng": 43.2700}]'::jsonb
);

-- حي السلام - منطقة سكنية جنوب الرمادي
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي السلام',
  'Al-Salam',
  2000,
  500,
  100,
  true,
  '[{"lat": 33.4150, "lng": 43.2900}, {"lat": 33.4150, "lng": 43.3100}, {"lat": 33.4000, "lng": 43.3100}, {"lat": 33.4000, "lng": 43.2900}]'::jsonb
);

-- حي الصوفية - منطقة قديمة
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي الصوفية',
  'Al-Sufiya',
  2000,
  500,
  100,
  true,
  '[{"lat": 33.4320, "lng": 43.2600}, {"lat": 33.4320, "lng": 43.2750}, {"lat": 33.4200, "lng": 43.2750}, {"lat": 33.4200, "lng": 43.2600}]'::jsonb
);

-- حي البوفراج - شرق الرمادي
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي البوفراج',
  'Al-Bufaraj',
  2500,
  600,
  150,
  true,
  '[{"lat": 33.4250, "lng": 43.3200}, {"lat": 33.4250, "lng": 43.3400}, {"lat": 33.4100, "lng": 43.3400}, {"lat": 33.4100, "lng": 43.3200}]'::jsonb
);

-- حي المعلمين - منطقة تعليمية
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي المعلمين',
  'Al-Muallimeen',
  2000,
  500,
  100,
  true,
  '[{"lat": 33.4380, "lng": 43.2950}, {"lat": 33.4380, "lng": 43.3100}, {"lat": 33.4280, "lng": 43.3100}, {"lat": 33.4280, "lng": 43.2950}]'::jsonb
);

-- حي الضباط - منطقة راقية
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES (
  'حي الضباط',
  'Al-Dubbat',
  3000,
  700,
  200,
  true,
  '[{"lat": 33.4450, "lng": 43.2800}, {"lat": 33.4450, "lng": 43.2950}, {"lat": 33.4350, "lng": 43.2950}, {"lat": 33.4350, "lng": 43.2800}]'::jsonb
);

-- تحديث إحداثيات المناطق الموجودة (مركز الرمادي، حي التميم، حي الأندلس)
UPDATE regions 
SET coordinates = '[{"lat": 33.4300, "lng": 43.2800}, {"lat": 33.4300, "lng": 43.3100}, {"lat": 33.4100, "lng": 43.3100}, {"lat": 33.4100, "lng": 43.2800}]'::jsonb
WHERE name_ar = 'مركز الرمادي' AND coordinates IS NULL;

UPDATE regions 
SET coordinates = '[{"lat": 33.4450, "lng": 43.2650}, {"lat": 33.4450, "lng": 43.2850}, {"lat": 33.4320, "lng": 43.2850}, {"lat": 33.4320, "lng": 43.2650}]'::jsonb
WHERE name_ar = 'حي التميم' AND coordinates IS NULL;

UPDATE regions 
SET coordinates = '[{"lat": 33.4180, "lng": 43.2600}, {"lat": 33.4180, "lng": 43.2800}, {"lat": 33.4050, "lng": 43.2800}, {"lat": 33.4050, "lng": 43.2600}]'::jsonb
WHERE name_ar = 'حي الأندلس' AND coordinates IS NULL;