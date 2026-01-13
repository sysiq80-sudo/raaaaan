-- خطوة 5: إصلاح RLS للمعالم (الجزء الأهم!)
-- شغل هذا بعد نجاح الخطوة 4

-- حذف جميع السياسات القديمة
DROP POLICY IF EXISTS "Anyone can view active landmarks" ON landmarks;
DROP POLICY IF EXISTS "Admins can manage landmarks" ON landmarks;
DROP POLICY IF EXISTS "landmarks_admin_all" ON landmarks;
DROP POLICY IF EXISTS "landmarks_read_active" ON landmarks;
DROP POLICY IF EXISTS "landmarks_select_active" ON landmarks;
DROP POLICY IF EXISTS "landmarks_select_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_insert_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_update_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_delete_admin" ON landmarks;

-- إنشاء سياسات جديدة صحيحة
CREATE POLICY "landmarks_select_active" ON landmarks 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "landmarks_select_admin" ON landmarks 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_insert_admin" ON landmarks 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_update_admin" ON landmarks 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'::app_role)) 
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_delete_admin" ON landmarks 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));
