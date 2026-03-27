-- 🔐 سياسات Storage للـ complaint-evidence
-- نفذ هذا بعد إنشاء الـ bucket

-- ========================================
-- 1️⃣ سياسة الرفع (جميع المستخدمين المصادقين)
-- ========================================
CREATE POLICY "authenticated_users_upload_evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'complaint-evidence' 
  AND auth.role() = 'authenticated'
);

-- ========================================
-- 2️⃣ سياسة القراءة (المدراء + صاحب الملف)
-- ========================================
CREATE POLICY "admins_and_owners_read_evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'complaint-evidence' 
  AND (
    -- المدراء
    public.has_role(auth.uid(), 'admin')
    OR
    -- صاحب الملف
    owner = auth.uid()
  )
);

-- ========================================
-- 3️⃣ سياسة الحذف (المدراء فقط)
-- ========================================
CREATE POLICY "admins_delete_evidence"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'complaint-evidence' 
  AND public.has_role(auth.uid(), 'admin')
);

-- ========================================
-- ✅ التحقق من السياسات
-- ========================================
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN '📤 رفع'
    WHEN cmd = 'SELECT' THEN '👁️ قراءة'
    WHEN cmd = 'DELETE' THEN '🗑️ حذف'
  END as operation
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%evidence%'
ORDER BY cmd;

-- يجب أن ترى 3 سياسات (INSERT, SELECT, DELETE)
