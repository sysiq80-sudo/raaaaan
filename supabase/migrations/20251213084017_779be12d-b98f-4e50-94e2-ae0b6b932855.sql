-- إضافة دور الأدمن للمستخدم الحالي
INSERT INTO public.user_roles (user_id, role) 
VALUES ('6d8eb7e2-8f96-402f-a791-8328541e9a00', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- إضافة مناطق بغداد مع أسعارها
INSERT INTO public.regions (name_ar, name_en, name_ku, base_fare, per_km_fare, waiting_fare_per_min, is_active) VALUES
('الكرادة', 'Karrada', 'کەرادە', 2000, 500, 100, true),
('المنصور', 'Mansour', 'مەنسوور', 2500, 600, 120, true),
('الكاظمية', 'Kadhimiya', 'کازمیە', 2000, 500, 100, true),
('زيونة', 'Zayouna', 'زەیوونە', 2000, 450, 100, true),
('الأعظمية', 'Adhamiya', 'ئەعزەمیە', 2200, 550, 110, true),
('الشعب', 'Al-Shaab', 'شەعب', 1800, 400, 80, true),
('البياع', 'Bayaa', 'بەیاع', 1800, 450, 90, true),
('الدورة', 'Dora', 'دۆرە', 2000, 500, 100, true)
ON CONFLICT DO NOTHING;