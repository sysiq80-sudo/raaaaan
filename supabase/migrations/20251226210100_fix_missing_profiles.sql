-- ======================================
-- ران - إصلاح الملفات الشخصية المفقودة
-- ======================================

-- دالة لإنشاء ملفات شخصية للمستخدمين الذين ليس لديهم
CREATE OR REPLACE FUNCTION public.ensure_all_users_have_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
  v_phone TEXT;
  v_email TEXT;
  v_existing_profile_id UUID;
BEGIN
  -- البحث عن مستخدمين ليس لديهم profiles
  FOR v_user IN 
    SELECT 
      u.id,
      u.email,
      u.raw_user_meta_data->>'full_name' as full_name,
      u.phone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- استخراج الهاتف من البريد الإلكتروني إذا كان بتنسيق phone@domain
    IF v_user.email ~ '^[0-9]+@' THEN
      v_phone := substring(v_user.email from '^([0-9]+)@');
      v_email := NULL;
    ELSE
      v_phone := v_user.phone;
      v_email := v_user.email;
    END IF;
    
    -- التحقق من وجود profile برقم الهاتف نفسه
    SELECT id INTO v_existing_profile_id
    FROM public.profiles
    WHERE phone = v_phone AND v_phone IS NOT NULL;
    
    IF v_existing_profile_id IS NOT NULL THEN
      -- الهاتف موجود، ربط المستخدم بالـ profile الموجود
      UPDATE public.profiles
      SET user_id = v_user.id,
          updated_at = now()
      WHERE id = v_existing_profile_id
        AND user_id IS NULL; -- فقط إذا لم يكن مربوط بمستخدم آخر
      
      -- إذا كان مربوط بالفعل، أنشئ profile بدون رقم هاتف
      IF NOT FOUND THEN
        INSERT INTO public.profiles (user_id, full_name, phone, email)
        VALUES (
          v_user.id,
          COALESCE(v_user.full_name, 'مستخدم'),
          NULL, -- لا رقم هاتف لتجنب التكرار
          v_email
        )
        ON CONFLICT (user_id) DO NOTHING;
      END IF;
    ELSE
      -- إنشاء profile جديد
      INSERT INTO public.profiles (user_id, full_name, phone, email)
      VALUES (
        v_user.id,
        COALESCE(v_user.full_name, 'مستخدم'),
        v_phone,
        v_email
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- تنفيذ الدالة لإنشاء الملفات الشخصية المفقودة
DO $$
DECLARE
  v_created INTEGER;
BEGIN
  SELECT public.ensure_all_users_have_profiles() INTO v_created;
  RAISE NOTICE 'Created % missing profiles', v_created;
END $$;

-- دالة لمزامنة بيانات المستخدم مع الملف الشخصي
CREATE OR REPLACE FUNCTION public.sync_profile_with_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_email TEXT;
BEGIN
  -- استخراج الهاتف من البريد الإلكتروني إذا كان بتنسيق phone@domain
  IF NEW.email ~ '^[0-9]+@' THEN
    v_phone := substring(NEW.email from '^([0-9]+)@');
    v_email := NULL;
  ELSE
    v_phone := NEW.phone;
    v_email := NEW.email;
  END IF;
  
  -- تحديث أو إنشاء الملف الشخصي
  INSERT INTO public.profiles (user_id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'مستخدم'),
    v_phone,
    v_email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(
      NULLIF(EXCLUDED.full_name, 'مستخدم'),
      profiles.full_name
    ),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_with_auth();

-- دالة للبحث عن راكب برقم الهاتف (للأدمن)
CREATE OR REPLACE FUNCTION public.find_rider_by_phone(p_phone TEXT)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  phone text,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_clean TEXT;
  v_phone_with_zero TEXT;
  v_phone_without_zero TEXT;
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
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.phone,
    p.email,
    p.created_at
  FROM public.profiles p
  WHERE p.phone = p_phone  -- الرقم كما هو
     OR p.phone = v_phone_with_zero  -- مع صفر
     OR p.phone = v_phone_without_zero  -- بدون صفر
     OR p.phone = '964' || v_phone_without_zero  -- مع 964
     OR p.phone LIKE '%' || v_phone_without_zero;  -- ينتهي بالرقم
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ensure_all_users_have_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_rider_by_phone(TEXT) TO authenticated;

-- تعليقات
COMMENT ON FUNCTION public.ensure_all_users_have_profiles IS 'إنشاء ملفات شخصية للمستخدمين الذين ليس لديهم';
COMMENT ON FUNCTION public.sync_profile_with_auth IS 'مزامنة بيانات المستخدم مع الملف الشخصي عند التسجيل';
COMMENT ON FUNCTION public.find_rider_by_phone IS 'البحث عن راكب برقم الهاتف (للأدمن)';
