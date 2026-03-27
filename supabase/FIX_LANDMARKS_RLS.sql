-- ===================================
-- إصلاح سياسات RLS لجدول landmarks
-- ===================================

-- 1. حذف السياسات القديمة
DROP POLICY IF EXISTS "Anyone can view active landmarks" ON landmarks;
DROP POLICY IF EXISTS "Admins can manage landmarks" ON landmarks;
DROP POLICY IF EXISTS "landmarks_admin_all" ON landmarks;
DROP POLICY IF EXISTS "landmarks_read_active" ON landmarks;

-- 2. إنشاء سياسات جديدة واضحة

-- أ. القراءة: الجميع يمكنهم قراءة المعالم النشطة
CREATE POLICY "landmarks_select_active" 
ON landmarks FOR SELECT 
USING (is_active = true);

-- ب. القراءة: Admin يمكنه قراءة كل شيء
CREATE POLICY "landmarks_select_admin" 
ON landmarks FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- ج. الإدراج: Admin فقط
CREATE POLICY "landmarks_insert_admin" 
ON landmarks FOR INSERT 
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- د. التحديث: Admin فقط
CREATE POLICY "landmarks_update_admin" 
ON landmarks FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- هـ. الحذف: Admin فقط
CREATE POLICY "landmarks_delete_admin" 
ON landmarks FOR DELETE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3. التحقق من السياسات
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'landmarks'
ORDER BY policyname;

-- ✅ تم
SELECT 'تم إصلاح سياسات RLS لجدول landmarks بنجاح' AS result;
