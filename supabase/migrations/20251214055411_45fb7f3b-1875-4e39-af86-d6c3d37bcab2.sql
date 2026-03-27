-- Add polygon coordinates for Anbar/Ramadi region
UPDATE regions 
SET coordinates = '{
  "type": "Polygon",
  "coordinates": [[
    [43.15, 33.35],
    [43.45, 33.35],
    [43.45, 33.52],
    [43.15, 33.52],
    [43.15, 33.35]
  ]]
}'::jsonb
WHERE name_ar = 'الرمادي' OR name_ar = 'الأنبار';

-- If no region exists, create the main Ramadi region with coordinates
INSERT INTO regions (name_ar, name_en, name_ku, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
SELECT 
  'مركز الرمادي',
  'Ramadi Center', 
  'ناوەندی ڕامادی',
  2500,
  750,
  150,
  true,
  '{
    "type": "Polygon",
    "coordinates": [[
      [43.25, 33.40],
      [43.35, 33.40],
      [43.35, 33.46],
      [43.25, 33.46],
      [43.25, 33.40]
    ]]
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE name_ar = 'مركز الرمادي');

-- Add Al-Tamim neighborhood
INSERT INTO regions (name_ar, name_en, name_ku, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
SELECT 
  'حي التميم',
  'Al-Tamim', 
  'گەڕەکی تەمیم',
  2000,
  600,
  100,
  true,
  '{
    "type": "Polygon",
    "coordinates": [[
      [43.28, 33.43],
      [43.32, 33.43],
      [43.32, 33.46],
      [43.28, 33.46],
      [43.28, 33.43]
    ]]
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE name_ar = 'حي التميم');

-- Add Al-Andalus neighborhood  
INSERT INTO regions (name_ar, name_en, name_ku, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
SELECT 
  'حي الأندلس',
  'Al-Andalus', 
  'گەڕەکی ئەندەلوس',
  2000,
  600,
  100,
  true,
  '{
    "type": "Polygon",
    "coordinates": [[
      [43.30, 33.41],
      [43.34, 33.41],
      [43.34, 33.44],
      [43.30, 33.44],
      [43.30, 33.41]
    ]]
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM regions WHERE name_ar = 'حي الأندلس');

-- Add common landmarks in Ramadi
INSERT INTO landmarks (name_ar, name_en, category, location, region_id, is_active)
SELECT 
  'جامعة الأنبار',
  'University of Anbar',
  'تعليم',
  '{"lat": 33.4285, "lng": 43.3012}'::jsonb,
  (SELECT id FROM regions WHERE name_ar = 'مركز الرمادي' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM landmarks WHERE name_ar = 'جامعة الأنبار');

INSERT INTO landmarks (name_ar, name_en, category, location, region_id, is_active)
SELECT 
  'مستشفى الرمادي التعليمي',
  'Ramadi Teaching Hospital',
  'صحة',
  '{"lat": 33.4350, "lng": 43.3100}'::jsonb,
  (SELECT id FROM regions WHERE name_ar = 'مركز الرمادي' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM landmarks WHERE name_ar = 'مستشفى الرمادي التعليمي');

INSERT INTO landmarks (name_ar, name_en, category, location, region_id, is_active)
SELECT 
  'سوق الرمادي المركزي',
  'Ramadi Central Market',
  'تسوق',
  '{"lat": 33.4280, "lng": 43.3050}'::jsonb,
  (SELECT id FROM regions WHERE name_ar = 'مركز الرمادي' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM landmarks WHERE name_ar = 'سوق الرمادي المركزي');

INSERT INTO landmarks (name_ar, name_en, category, location, region_id, is_active)
SELECT 
  'محطة القطار الرئيسية',
  'Main Train Station',
  'مواصلات',
  '{"lat": 33.4200, "lng": 43.2900}'::jsonb,
  (SELECT id FROM regions WHERE name_ar = 'مركز الرمادي' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM landmarks WHERE name_ar = 'محطة القطار الرئيسية');

INSERT INTO landmarks (name_ar, name_en, category, location, region_id, is_active)
SELECT 
  'مجمع الرمادي التجاري',
  'Ramadi Commercial Complex',
  'تسوق',
  '{"lat": 33.4320, "lng": 43.3080}'::jsonb,
  (SELECT id FROM regions WHERE name_ar = 'مركز الرمادي' LIMIT 1),
  true
WHERE NOT EXISTS (SELECT 1 FROM landmarks WHERE name_ar = 'مجمع الرمادي التجاري');