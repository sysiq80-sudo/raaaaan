-- ==========================================
-- 📝 نظام طلبات تحديث بيانات السائق
-- ==========================================
-- يسمح للسائقين بطلب تحديث الصورة/العنوان/الهاتف
-- يتطلب موافقة Admin قبل التطبيق

CREATE TABLE IF NOT EXISTS driver_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- نوع التحديث
  update_type TEXT NOT NULL CHECK (update_type IN (
    'profile_photo',     -- تحديث الصورة الشخصية
    'address',           -- تحديث العنوان
    'phone_number',      -- تحديث رقم الهاتف
    'emergency_contact', -- تحديث جهة اتصال طوارئ
    'full_name'          -- تحديث الاسم الكامل
  )),
  
  -- القيم القديمة
  old_value TEXT,
  old_photo_url TEXT,
  
  -- القيم الجديدة المقترحة
  new_value TEXT,
  new_photo_url TEXT,
  
  -- سبب الطلب
  reason TEXT,
  additional_notes TEXT,
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- قيد المراجعة
    'approved',   -- موافق عليه ومطبق
    'rejected',   -- مرفوض
    'cancelled'   -- ملغي من السائق
  )),
  
  -- المراجعة
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- التطبيق
  applied_at TIMESTAMPTZ,
  
  -- التواريخ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- الفهارس
CREATE INDEX idx_update_requests_driver_id ON driver_update_requests(driver_id);
CREATE INDEX idx_update_requests_status ON driver_update_requests(status);
CREATE INDEX idx_update_requests_type ON driver_update_requests(update_type);
CREATE INDEX idx_update_requests_created_at ON driver_update_requests(created_at DESC);

-- ==========================================
-- Row Level Security
-- ==========================================

ALTER TABLE driver_update_requests ENABLE ROW LEVEL SECURITY;

-- السائق يرى طلباته فقط
CREATE POLICY "drivers_own_update_requests" ON driver_update_requests
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- السائق ينشئ طلب تحديث
CREATE POLICY "drivers_create_update_request" ON driver_update_requests
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- السائق يلغي طلبه (إذا كان pending)
CREATE POLICY "drivers_cancel_own_request" ON driver_update_requests
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

-- TODO: Admin policies عند إنشاء جدول admin_users
-- CREATE POLICY "admin_manages_requests" ON driver_update_requests FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ==========================================
-- الدوال المساعدة
-- ==========================================

-- حذف الدوال القديمة إن وجدت
DROP FUNCTION IF EXISTS apply_driver_update_request(UUID);
DROP FUNCTION IF EXISTS reject_driver_update_request(UUID, UUID, TEXT);

-- دالة: تطبيق طلب التحديث
CREATE OR REPLACE FUNCTION apply_driver_update_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_result JSONB;
BEGIN
  -- الحصول على الطلب
  SELECT * INTO v_request
  FROM driver_update_requests
  WHERE id = p_request_id;
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;
  
  IF v_request.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_approved');
  END IF;
  
  -- تطبيق التحديث حسب النوع
  CASE v_request.update_type
    WHEN 'profile_photo' THEN
      UPDATE profiles
      SET profile_image_url = v_request.new_photo_url
      WHERE id = (SELECT user_id FROM drivers WHERE id = v_request.driver_id);
      
    WHEN 'address' THEN
      UPDATE drivers
      SET address = v_request.new_value
      WHERE id = v_request.driver_id;
      
    WHEN 'phone_number' THEN
      UPDATE profiles
      SET phone = v_request.new_value
      WHERE id = (SELECT user_id FROM drivers WHERE id = v_request.driver_id);
      
    WHEN 'emergency_contact' THEN
      UPDATE drivers
      SET emergency_contact = v_request.new_value
      WHERE id = v_request.driver_id;
      
    WHEN 'full_name' THEN
      UPDATE profiles
      SET full_name = v_request.new_value
      WHERE id = (SELECT user_id FROM drivers WHERE id = v_request.driver_id);
      
  END CASE;
  
  -- تحديث حالة الطلب
  UPDATE driver_update_requests
  SET 
    applied_at = now(),
    updated_at = now()
  WHERE id = p_request_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'update_type', v_request.update_type,
    'applied_at', now()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة: رفض طلب التحديث
CREATE OR REPLACE FUNCTION reject_driver_update_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE driver_update_requests
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = p_admin_id,
    rejection_reason = p_rejection_reason,
    updated_at = now()
  WHERE id = p_request_id
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found_or_not_pending');
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Triggers
-- ==========================================

-- دالة تحديث updated_at (إن لم تكن موجودة)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تحديث updated_at تلقائياً
CREATE TRIGGER update_driver_update_requests_timestamp
  BEFORE UPDATE ON driver_update_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- التعليقات
-- ==========================================

COMMENT ON TABLE driver_update_requests IS 'طلبات تحديث بيانات السائقين - تتطلب موافقة Admin';
COMMENT ON FUNCTION apply_driver_update_request IS 'تطبيق طلب التحديث على جدول drivers/profiles';
COMMENT ON FUNCTION reject_driver_update_request IS 'رفض طلب التحديث مع السبب';
