-- ======================================
-- ران - تحسين دالة ربط السائق بالرقم
-- ======================================

-- دالة محسنة لربط السائق بالهاتف مع دعم تنسيقات متعددة
CREATE OR REPLACE FUNCTION public.link_driver_by_phone(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
  v_driver_status driver_status;
  v_current_user_id uuid;
  v_phone_clean text;
  v_phone_with_zero text;
  v_phone_without_zero text;
BEGIN
  -- Get the current authenticated user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- First check if user already has a driver record
  SELECT id, status INTO v_driver_id, v_driver_status
  FROM drivers
  WHERE user_id = v_current_user_id;
  
  IF v_driver_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'status', v_driver_status, 'linked', false);
  END IF;
  
  -- تنظيف الرقم
  v_phone_clean := regexp_replace(p_phone, '\D', '', 'g');
  
  -- إزالة 964 في البداية
  IF v_phone_clean LIKE '964%' THEN
    v_phone_clean := substring(v_phone_clean from 4);
  END IF;
  
  -- إنشاء التنسيقات المختلفة
  IF v_phone_clean LIKE '0%' THEN
    v_phone_with_zero := v_phone_clean;
    v_phone_without_zero := substring(v_phone_clean from 2);
  ELSE
    v_phone_without_zero := v_phone_clean;
    v_phone_with_zero := '0' || v_phone_clean;
  END IF;
  
  -- Try to find driver by different phone formats
  SELECT id, status INTO v_driver_id, v_driver_status
  FROM drivers
  WHERE phone = p_phone  -- الرقم كما هو
     OR phone = v_phone_with_zero  -- مع صفر
     OR phone = v_phone_without_zero  -- بدون صفر
     OR phone = '964' || v_phone_without_zero  -- مع 964
     OR phone LIKE '%' || v_phone_without_zero  -- ينتهي بالرقم
  LIMIT 1;
  
  IF v_driver_id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'No driver found with this phone',
      'tried_formats', json_build_array(p_phone, v_phone_with_zero, v_phone_without_zero, '964' || v_phone_without_zero)
    );
  END IF;
  
  -- Update the driver's user_id to link to current user
  UPDATE drivers
  SET user_id = v_current_user_id, updated_at = now()
  WHERE id = v_driver_id;
  
  RETURN json_build_object('success', true, 'driver_id', v_driver_id, 'status', v_driver_status, 'linked', true);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.link_driver_by_phone(text) TO authenticated;

-- دالة مساعدة للبحث عن سائق برقم الهاتف (للإدمن)
CREATE OR REPLACE FUNCTION public.find_driver_by_phone(p_phone text)
RETURNS TABLE(id uuid, phone text, full_name text, status driver_status, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_clean text;
  v_phone_with_zero text;
  v_phone_without_zero text;
BEGIN
  -- تنظيف الرقم
  v_phone_clean := regexp_replace(p_phone, '\D', '', 'g');
  
  -- إزالة 964 في البداية
  IF v_phone_clean LIKE '964%' THEN
    v_phone_clean := substring(v_phone_clean from 4);
  END IF;
  
  -- إنشاء التنسيقات المختلفة
  IF v_phone_clean LIKE '0%' THEN
    v_phone_with_zero := v_phone_clean;
    v_phone_without_zero := substring(v_phone_clean from 2);
  ELSE
    v_phone_without_zero := v_phone_clean;
    v_phone_with_zero := '0' || v_phone_clean;
  END IF;
  
  RETURN QUERY
  SELECT d.id, d.phone, d.full_name, d.status, d.user_id
  FROM drivers d
  WHERE d.phone = p_phone  -- الرقم كما هو
     OR d.phone = v_phone_with_zero  -- مع صفر
     OR d.phone = v_phone_without_zero  -- بدون صفر
     OR d.phone = '964' || v_phone_without_zero  -- مع 964
     OR d.phone LIKE '%' || v_phone_without_zero;  -- ينتهي بالرقم
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_driver_by_phone(text) TO authenticated;

-- تعليق
COMMENT ON FUNCTION public.link_driver_by_phone IS 'ربط سائق موجود بحساب مستخدم جديد عبر رقم الهاتف (يدعم تنسيقات متعددة)';
COMMENT ON FUNCTION public.find_driver_by_phone IS 'البحث عن سائق برقم الهاتف (للإدمن)';
