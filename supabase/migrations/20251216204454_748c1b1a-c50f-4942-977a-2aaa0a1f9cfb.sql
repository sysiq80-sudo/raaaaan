-- Update existing cities with correct polygon coordinates

-- الفلوجة (33.353°N, 43.782°E) - ~4km radius
UPDATE regions SET coordinates = '[
  {"lat": 33.373, "lng": 43.752},
  {"lat": 33.373, "lng": 43.812},
  {"lat": 33.333, "lng": 43.812},
  {"lat": 33.333, "lng": 43.752}
]'::jsonb WHERE name_ar = 'الفلوجة';

-- الحبانية (33.368°N, 43.563°E) - ~3km radius
UPDATE regions SET coordinates = '[
  {"lat": 33.388, "lng": 43.533},
  {"lat": 33.388, "lng": 43.593},
  {"lat": 33.348, "lng": 43.593},
  {"lat": 33.348, "lng": 43.533}
]'::jsonb WHERE name_ar = 'الحبانية';

-- الخالدية (33.412°N, 43.658°E) - ~2km radius
UPDATE regions SET coordinates = '[
  {"lat": 33.427, "lng": 43.638},
  {"lat": 33.427, "lng": 43.678},
  {"lat": 33.397, "lng": 43.678},
  {"lat": 33.397, "lng": 43.638}
]'::jsonb WHERE name_ar = 'الخالدية';

-- القائم (34.376°N, 41.054°E) - ~3km radius
UPDATE regions SET coordinates = '[
  {"lat": 34.396, "lng": 41.024},
  {"lat": 34.396, "lng": 41.084},
  {"lat": 34.356, "lng": 41.084},
  {"lat": 34.356, "lng": 41.024}
]'::jsonb WHERE name_ar = 'القائم';

-- حديثة (34.137°N, 42.378°E) - ~2.5km radius
UPDATE regions SET coordinates = '[
  {"lat": 34.157, "lng": 42.353},
  {"lat": 34.157, "lng": 42.403},
  {"lat": 34.117, "lng": 42.403},
  {"lat": 34.117, "lng": 42.353}
]'::jsonb WHERE name_ar = 'حديثة';

-- هيت (33.646°N, 42.823°E) - ~2km radius
UPDATE regions SET coordinates = '[
  {"lat": 33.666, "lng": 42.803},
  {"lat": 33.666, "lng": 42.843},
  {"lat": 33.626, "lng": 42.843},
  {"lat": 33.626, "lng": 42.803}
]'::jsonb WHERE name_ar = 'هيت';

-- عانة (34.371°N, 41.954°E) - ~2km radius
UPDATE regions SET coordinates = '[
  {"lat": 34.391, "lng": 41.934},
  {"lat": 34.391, "lng": 41.974},
  {"lat": 34.351, "lng": 41.974},
  {"lat": 34.351, "lng": 41.934}
]'::jsonb WHERE name_ar = 'عانة';

-- راوة (34.483°N, 41.917°E) - ~1.5km radius
UPDATE regions SET coordinates = '[
  {"lat": 34.498, "lng": 41.902},
  {"lat": 34.498, "lng": 41.932},
  {"lat": 34.468, "lng": 41.932},
  {"lat": 34.468, "lng": 41.902}
]'::jsonb WHERE name_ar = 'راوة';

-- Fix حي الأندلس (convert from GeoJSON to array format)
UPDATE regions SET coordinates = '[
  {"lat": 33.438, "lng": 43.283},
  {"lat": 33.438, "lng": 43.303},
  {"lat": 33.418, "lng": 43.303},
  {"lat": 33.418, "lng": 43.283}
]'::jsonb WHERE name_ar = 'حي الأندلس';

-- Fix حي التميم
UPDATE regions SET coordinates = '[
  {"lat": 33.432, "lng": 43.268},
  {"lat": 33.432, "lng": 43.288},
  {"lat": 33.412, "lng": 43.288},
  {"lat": 33.412, "lng": 43.268}
]'::jsonb WHERE name_ar = 'حي التميم';

-- Add missing cities

-- الصقلاوية (33.463°N, 43.387°E)
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES ('الصقلاوية', 'Saqlawiyah', 1800, 450, 90, true, '[
  {"lat": 33.483, "lng": 43.367},
  {"lat": 33.483, "lng": 43.407},
  {"lat": 33.443, "lng": 43.407},
  {"lat": 33.443, "lng": 43.367}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- الكرمة (33.412°N, 43.579°E)
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES ('الكرمة', 'Karma', 1800, 450, 90, true, '[
  {"lat": 33.432, "lng": 43.559},
  {"lat": 33.432, "lng": 43.599},
  {"lat": 33.392, "lng": 43.599},
  {"lat": 33.392, "lng": 43.559}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- العامرية (33.371°N, 43.562°E)
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES ('العامرية', 'Ameriya', 1800, 450, 90, true, '[
  {"lat": 33.391, "lng": 43.542},
  {"lat": 33.391, "lng": 43.582},
  {"lat": 33.351, "lng": 43.582},
  {"lat": 33.351, "lng": 43.542}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- البغدادي (33.857°N, 42.534°E)
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES ('البغدادي', 'Baghdadi', 2000, 500, 100, true, '[
  {"lat": 33.877, "lng": 42.514},
  {"lat": 33.877, "lng": 43.554},
  {"lat": 33.837, "lng": 42.554},
  {"lat": 33.837, "lng": 42.514}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- النخيب (32.053°N, 42.226°E) - remote area, higher prices
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES ('النخيب', 'Nukhaib', 2200, 550, 110, true, '[
  {"lat": 32.083, "lng": 42.196},
  {"lat": 32.083, "lng": 42.256},
  {"lat": 32.023, "lng": 42.256},
  {"lat": 32.023, "lng": 42.196}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- الرمانة (34.250°N, 41.150°E) - border area
INSERT INTO regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min, is_active, coordinates)
VALUES ('الرمانة', 'Rummanah', 2000, 500, 100, true, '[
  {"lat": 34.265, "lng": 41.135},
  {"lat": 34.265, "lng": 41.165},
  {"lat": 34.235, "lng": 41.165},
  {"lat": 34.235, "lng": 41.135}
]'::jsonb)
ON CONFLICT DO NOTHING;