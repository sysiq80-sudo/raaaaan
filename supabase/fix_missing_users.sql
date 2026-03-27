-- ======================================
-- ران - إصلاح سريع للمستخدمين المفقودين
-- شغّل هذا الملف في Supabase SQL Editor
-- ======================================

-- 1. أولاً: عرض المستخدمين الذين ليس لديهم profiles
SELECT 
  u.id as user_id,
  u.email,
  u.phone,
  u.created_at,
  u.raw_user_meta_data->>'full_name' as full_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- 2. إصلاح: إنشاء profiles للمستخدمين المفقودين (مع التعامل مع تكرار الأرقام)
DO $$
DECLARE
  v_user RECORD;
  v_phone TEXT;
  v_email TEXT;
  v_phone_exists BOOLEAN;
BEGIN
  FOR v_user IN 
    SELECT 
      u.id,
      u.email,
      u.raw_user_meta_data->>'full_name' as full_name,
      u.phone as auth_phone
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- استخراج الهاتف من البريد
    IF v_user.email ~ '^[0-9]+@' THEN
      v_phone := substring(v_user.email from '^([0-9]+)@');
      v_email := NULL;
    ELSE
      v_phone := v_user.auth_phone;
      v_email := v_user.email;
    END IF;
    
    -- التحقق من تكرار الرقم
    SELECT EXISTS(SELECT 1 FROM profiles WHERE phone = v_phone) INTO v_phone_exists;
    
    -- إنشاء الـ profile
    IF v_phone_exists THEN
      -- الرقم موجود، أنشئ بدون رقم
      INSERT INTO public.profiles (user_id, full_name, phone, email)
      VALUES (v_user.id, COALESCE(v_user.full_name, 'مستخدم'), NULL, v_email)
      ON CONFLICT (user_id) DO NOTHING;
      RAISE NOTICE 'Created profile for % without phone (duplicate)', v_user.id;
    ELSE
      -- الرقم فريد
      INSERT INTO public.profiles (user_id, full_name, phone, email)
      VALUES (v_user.id, COALESCE(v_user.full_name, 'مستخدم'), v_phone, v_email)
      ON CONFLICT (user_id) DO NOTHING;
      RAISE NOTICE 'Created profile for % with phone %', v_user.id, v_phone;
    END IF;
  END LOOP;
END $$;

-- 3. التحقق من النتيجة
SELECT 
  'إجمالي المستخدمين' as label,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'إجمالي الـ Profiles' as label,
  COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
  'مستخدمين بدون profile' as label,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- 4. البحث عن الراكب المحدد برقم 07766963915
SELECT 
  p.*,
  u.email as auth_email,
  u.created_at as auth_created_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.phone LIKE '%7766963915%'
   OR u.email LIKE '%7766963915%';

-- 5. البحث عن السائق برقم 07844446633
SELECT 
  d.*,
  u.email as auth_email
FROM public.drivers d
LEFT JOIN auth.users u ON u.id = d.user_id
WHERE d.phone LIKE '%7844446633%'
   OR u.email LIKE '%7844446633%';
