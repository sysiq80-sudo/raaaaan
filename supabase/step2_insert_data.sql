-- خطوة 2: إدراج المحافظات
-- شغل هذا بعد نجاح الخطوة 1

INSERT INTO governorates (name_ar, name_en, code) VALUES
  ('بغداد', 'Baghdad', 'BGW'),
  ('البصرة', 'Basra', 'BSR'),
  ('نينوى', 'Nineveh', 'NIN'),
  ('الأنبار', 'Anbar', 'ANB'),
  ('أربيل', 'Erbil', 'EBL'),
  ('النجف', 'Najaf', 'NJF'),
  ('كربلاء', 'Karbala', 'KRB'),
  ('ديالى', 'Diyala', 'DIY'),
  ('كركوك', 'Kirkuk', 'KRK'),
  ('صلاح الدين', 'Saladin', 'SLD'),
  ('بابل', 'Babylon', 'BBL'),
  ('واسط', 'Wasit', 'WST'),
  ('ذي قار', 'Dhi Qar', 'DHQ'),
  ('ميسان', 'Maysan', 'MYS'),
  ('المثنى', 'Muthanna', 'MTH'),
  ('القادسية', 'Qadisiyah', 'QDS'),
  ('دهوك', 'Duhok', 'DHK'),
  ('السليمانية', 'Sulaymaniyah', 'SLM')
ON CONFLICT (name_ar) DO NOTHING;

SELECT COUNT(*) FROM governorates;
