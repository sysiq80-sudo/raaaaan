CREATE TABLE IF NOT EXISTS driver_registration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Page Title and Description
  page_title TEXT NOT NULL DEFAULT 'انضم كسائق',
  page_subtitle TEXT NOT NULL DEFAULT 'سجل الآن وابدأ بكسب المال',
  
  -- Hero Section
  hero_title TEXT NOT NULL DEFAULT 'كن سائقاً معنا',
  hero_description TEXT NOT NULL DEFAULT 'انضم إلى فريقنا من السائقين واحصل على دخل مرن',
  
  -- Requirements Section
  requirements_title TEXT NOT NULL DEFAULT 'المتطلبات',
  min_age INTEGER NOT NULL DEFAULT 21,
  min_age_text TEXT NOT NULL DEFAULT 'العمر الأدنى 21 سنة',
  license_requirement TEXT NOT NULL DEFAULT 'رخصة قيادة سارية المفعول',
  vehicle_requirement TEXT NOT NULL DEFAULT 'سيارة بحالة جيدة',
  insurance_requirement TEXT NOT NULL DEFAULT 'تأمين ساري المفعول',
  
  -- Benefits Section
  benefits_title TEXT NOT NULL DEFAULT 'المزايا',
  benefit_1_title TEXT NOT NULL DEFAULT 'دخل مرن',
  benefit_1_description TEXT NOT NULL DEFAULT 'اعمل وفق جدولك الخاص',
  benefit_2_title TEXT NOT NULL DEFAULT 'دعم فوري',
  benefit_2_description TEXT NOT NULL DEFAULT 'فريق دعم متاح على مدار الساعة',
  benefit_3_title TEXT NOT NULL DEFAULT 'مكافآت',
  benefit_3_description TEXT NOT NULL DEFAULT 'احصل على مكافآت إضافية',
  benefit_4_title TEXT NOT NULL DEFAULT 'تأمين',
  benefit_4_description TEXT NOT NULL DEFAULT 'تغطية تأمينية شاملة',
  
  -- Commission and Earnings
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  commission_text TEXT NOT NULL DEFAULT 'عمولة 15% فقط',
  estimated_earnings_min INTEGER NOT NULL DEFAULT 500000,
  estimated_earnings_max INTEGER NOT NULL DEFAULT 1500000,
  earnings_text TEXT NOT NULL DEFAULT 'دخل متوقع شهرياً',
  
  -- Form Section
  form_title TEXT NOT NULL DEFAULT 'معلومات التسجيل',
  form_description TEXT NOT NULL DEFAULT 'املأ البيانات التالية لإكمال التسجيل',
  
  -- Contact Section
  contact_title TEXT NOT NULL DEFAULT 'تواصل معنا',
  contact_phone TEXT NOT NULL DEFAULT '+964 770 123 4567',
  contact_email TEXT NOT NULL DEFAULT 'drivers@taksi.iq',
  contact_hours TEXT NOT NULL DEFAULT 'متاح من 8 صباحاً حتى 10 مساءً',
  
  -- Status and Timestamps
  is_active BOOLEAN NOT NULL DEFAULT true,
  registration_enabled BOOLEAN NOT NULL DEFAULT true,
  maintenance_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_reg_settings_active 
ON driver_registration_settings(is_active);

ALTER TABLE driver_registration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active driver registration settings"
ON driver_registration_settings
FOR SELECT
USING (is_active = true);

CREATE POLICY "Allow authenticated users to read all driver registration settings"
ON driver_registration_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert driver registration settings"
ON driver_registration_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Only admins can update driver registration settings"
ON driver_registration_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Only admins can delete driver registration settings"
ON driver_registration_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION update_driver_registration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_registration_settings_updated_at
BEFORE UPDATE ON driver_registration_settings
FOR EACH ROW
EXECUTE FUNCTION update_driver_registration_settings_updated_at();

INSERT INTO driver_registration_settings (
  page_title,
  page_subtitle,
  hero_title,
  hero_description,
  requirements_title,
  min_age,
  min_age_text,
  license_requirement,
  vehicle_requirement,
  insurance_requirement,
  benefits_title,
  benefit_1_title,
  benefit_1_description,
  benefit_2_title,
  benefit_2_description,
  benefit_3_title,
  benefit_3_description,
  benefit_4_title,
  benefit_4_description,
  commission_rate,
  commission_text,
  estimated_earnings_min,
  estimated_earnings_max,
  earnings_text,
  form_title,
  form_description,
  contact_title,
  contact_phone,
  contact_email,
  contact_hours,
  is_active,
  registration_enabled
) VALUES (
  'انضم كسائق',
  'سجل الآن وابدأ بكسب المال',
  'كن سائقاً معنا',
  'انضم إلى فريقنا من السائقين واحصل على دخل مرن',
  'المتطلبات',
  21,
  'العمر الأدنى 21 سنة',
  'رخصة قيادة سارية المفعول',
  'سيارة بحالة جيدة',
  'تأمين ساري المفعول',
  'المزايا',
  'دخل مرن',
  'اعمل وفق جدولك الخاص',
  'دعم فوري',
  'فريق دعم متاح على مدار الساعة',
  'مكافآت',
  'احصل على مكافآت إضافية',
  'تأمين',
  'تغطية تأمينية شاملة',
  15.00,
  'عمولة 15% فقط',
  500000,
  1500000,
  'دخل متوقع شهرياً',
  'معلومات التسجيل',
  'املأ البيانات التالية لإكمال التسجيل',
  'تواصل معنا',
  '+964 770 123 4567',
  'drivers@taksi.iq',
  'متاح من 8 صباحاً حتى 10 مساءً',
  true,
  true
)
ON CONFLICT DO NOTHING;