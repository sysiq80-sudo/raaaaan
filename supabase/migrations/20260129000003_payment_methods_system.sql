-- Migration: نظام خيارات الدفع المرن
-- التاريخ: 2026-01-29
-- الوصف: إدارة طرق الدفع المتاحة من لوحة Admin

-- جدول خيارات الدفع
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key TEXT UNIQUE NOT NULL, -- 'cash', 'wallet', 'card', 'zain_cash', etc.
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon_name TEXT, -- اسم الأيقونة أو emoji
  is_enabled BOOLEAN DEFAULT true,
  is_available_for_riders BOOLEAN DEFAULT true,
  is_available_for_drivers BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- رسوم المعالجة (اختياري)
  processing_fee_percentage DECIMAL(5,2) DEFAULT 0,
  processing_fee_fixed DECIMAL(10,2) DEFAULT 0,
  
  -- حد أدنى/أقصى (اختياري)
  min_amount DECIMAL(10,2),
  max_amount DECIMAL(10,2),
  
  -- معلومات إضافية
  description_ar TEXT,
  description_en TEXT,
  requires_verification BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- بيانات افتراضية
INSERT INTO payment_methods (method_key, name_ar, name_en, icon_name, display_order) VALUES
  ('cash', 'نقداً', 'Cash', '💵', 1),
  ('wallet', 'المحفظة', 'Wallet', '👛', 2),
  ('card', 'البطاقة البنكية', 'Debit/Credit Card', '💳', 3),
  ('zain_cash', 'زين كاش', 'Zain Cash', '📱', 4),
  ('super_key', 'سوبر كي', 'Super Key', '🔑', 5),
  ('nas_wallet', 'ناس ولت', 'Nas Wallet', '💼', 6)
ON CONFLICT (method_key) DO NOTHING;

-- فهارس
CREATE INDEX IF NOT EXISTS idx_payment_methods_enabled ON payment_methods(is_enabled);
CREATE INDEX IF NOT EXISTS idx_payment_methods_order ON payment_methods(display_order);

-- RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- الجميع يمكنهم القراءة
CREATE POLICY "everyone_can_read_payment_methods"
  ON payment_methods
  FOR SELECT
  USING (true);

-- فقط الـ Service Role يمكنه التعديل (من Admin Panel)
CREATE POLICY "service_role_can_manage_payment_methods"
  ON payment_methods
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- دالة للحصول على طرق الدفع المتاحة
CREATE OR REPLACE FUNCTION get_available_payment_methods(
  user_type TEXT DEFAULT 'rider'
)
RETURNS TABLE (
  id UUID,
  method_key TEXT,
  name_ar TEXT,
  name_en TEXT,
  icon_name TEXT,
  processing_fee_percentage DECIMAL,
  processing_fee_fixed DECIMAL,
  min_amount DECIMAL,
  max_amount DECIMAL,
  description_ar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.method_key,
    pm.name_ar,
    pm.name_en,
    pm.icon_name,
    pm.processing_fee_percentage,
    pm.processing_fee_fixed,
    pm.min_amount,
    pm.max_amount,
    pm.description_ar
  FROM payment_methods pm
  WHERE pm.is_enabled = true
    AND (
      (user_type = 'rider' AND pm.is_available_for_riders = true) OR
      (user_type = 'driver' AND pm.is_available_for_drivers = true)
    )
  ORDER BY pm.display_order;
END;
$$;

-- Trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_methods_updated_at();

COMMENT ON TABLE payment_methods IS 'خيارات الدفع المتاحة - يمكن إدارتها من Admin Panel';
COMMENT ON FUNCTION get_available_payment_methods IS 'الحصول على طرق الدفع المتاحة حسب نوع المستخدم (rider/driver)';
