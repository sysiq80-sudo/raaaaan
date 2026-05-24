CREATE TABLE IF NOT EXISTS driver_registration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  enable_promo BOOLEAN NOT NULL DEFAULT true,
  promo_end_date TIMESTAMPTZ NOT NULL DEFAULT '2026-01-30T23:59:59+00:00',
  
  promo_title TEXT NOT NULL DEFAULT 'وية ران.. التسجيل بلاش والرصيد علينا! 😉',
  promo_subtitle TEXT NOT NULL DEFAULT 'كابتنا، لا تفوت الفرصة وسجل قبل ما يخلص الوقت!',
  promo_activation_fee INTEGER NOT NULL DEFAULT 0,
  promo_activation_fee_text TEXT NOT NULL DEFAULT 'التفعيل الحين مجاني 100%!',
  promo_bonus_amount INTEGER NOT NULL DEFAULT 50000,
  promo_bonus_text TEXT NOT NULL DEFAULT 'رصيدك الترحيبي جاهز من اليوم الأول!',
  promo_urgency_text TEXT NOT NULL DEFAULT '🔥 الفرصة لفترة محدودة! سجل الحين واستفد!',
  promo_button_text TEXT NOT NULL DEFAULT 'يلا نبدأ التسجيل! 🚀',
  
  paid_title TEXT NOT NULL DEFAULT 'انضم لعائلة ران وابدأ رحلتك',
  paid_subtitle TEXT NOT NULL DEFAULT 'استثمر في مستقبلك مع ران',
  paid_activation_fee INTEGER NOT NULL DEFAULT 150000,
  paid_wallet_bonus INTEGER NOT NULL DEFAULT 50000,
  paid_wallet_bonus_text TEXT NOT NULL DEFAULT 'رصيد ترحيبي: 50,000 دينار في محفظتك',
  paid_challenge_rides INTEGER NOT NULL DEFAULT 10,
  paid_challenge_bonus INTEGER NOT NULL DEFAULT 100000,
  paid_challenge_text TEXT NOT NULL DEFAULT 'تحدي المبتدئين: أكمل 10 رحلات واربح 100,000 دينار إضافي!',
  paid_summary_text TEXT NOT NULL DEFAULT 'رسوم التفعيل لمرة واحدة فقط - استثمار في مستقبلك',
  paid_warning_text TEXT NOT NULL DEFAULT 'مرة تدفع وتشتغل للأبد، بدون رسوم شهرية أو خفية',
  paid_button_text TEXT NOT NULL DEFAULT 'ابدأ التسجيل الآن',
  
  terms_text TEXT NOT NULL DEFAULT 'أوافق على الشروط والأحكام وسياسة الخصوصية',
  countdown_text TEXT NOT NULL DEFAULT 'باقي على نهاية العرض:',
  days_text TEXT NOT NULL DEFAULT 'يوم',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_reg_settings_active 
ON driver_registration_settings(enable_promo);

ALTER TABLE driver_registration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to driver registration settings"
ON driver_registration_settings
FOR SELECT
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
  enable_promo,
  promo_end_date,
  promo_title,
  promo_subtitle,
  promo_activation_fee,
  promo_activation_fee_text,
  promo_bonus_amount,
  promo_bonus_text,
  promo_urgency_text,
  promo_button_text,
  paid_title,
  paid_subtitle,
  paid_activation_fee,
  paid_wallet_bonus,
  paid_wallet_bonus_text,
  paid_challenge_rides,
  paid_challenge_bonus,
  paid_challenge_text,
  paid_summary_text,
  paid_warning_text,
  paid_button_text,
  terms_text,
  countdown_text,
  days_text
) VALUES (
  true,
  '2026-01-30T23:59:59+00:00',
  'وية ران.. التسجيل بلاش والرصيد علينا! 😉',
  'كابتنا، لا تفوت الفرصة وسجل قبل ما يخلص الوقت!',
  0,
  'التفعيل الحين مجاني 100%!',
  50000,
  'رصيدك الترحيبي جاهز من اليوم الأول!',
  '🔥 الفرصة لفترة محدودة! سجل الحين واستفد!',
  'يلا نبدأ التسجيل! 🚀',
  'انضم لعائلة ران وابدأ رحلتك',
  'استثمر في مستقبلك مع ران',
  150000,
  50000,
  'رصيد ترحيبي: 50,000 دينار في محفظتك',
  10,
  100000,
  'تحدي المبتدئين: أكمل 10 رحلات واربح 100,000 دينار إضافي!',
  'رسوم التفعيل لمرة واحدة فقط - استثمار في مستقبلك',
  'مرة تدفع وتشتغل للأبد، بدون رسوم شهرية أو خفية',
  'ابدأ التسجيل الآن',
  'أوافق على الشروط والأحكام وسياسة الخصوصية',
  'باقي على نهاية العرض:',
  'يوم'
)
ON CONFLICT DO NOTHING;