-- المرحلة 1: تفعيل RLS على جدول profiles وإضافة السياسات الصحيحة

-- تفعيل RLS على profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة: المستخدم يقرأ ملفه الشخصي فقط
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- سياسة التحديث: المستخدم يحدث ملفه فقط
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- سياسة الإنشاء: إنشاء ملف عند التسجيل
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- الأدمن يدير جميع الملفات الشخصية
CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- السائقين يمكنهم رؤية معلومات الراكب الأساسية أثناء الرحلة النشطة
CREATE POLICY "Drivers can view rider basic info during active ride"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    JOIN public.drivers d ON r.driver_id = d.id
    WHERE r.rider_id = profiles.user_id
      AND d.user_id = auth.uid()
      AND r.status IN ('accepted', 'arrived', 'in_progress')
  )
);