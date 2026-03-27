-- إضافة صفحة الخريطة مع العروض إلى صفحات الراكب
INSERT INTO rider_page_layouts (name, display_name, route_path, layout_type, is_active, description, settings)
VALUES (
  'map_with_promos',
  'الخريطة مع العروض',
  '/rider-map',
  'custom',
  true,
  'شاشة ترحيبية تجمع الخريطة الحية مع العروض الترويجية',
  '{"components": []}'::jsonb
)
ON CONFLICT (name) DO NOTHING;