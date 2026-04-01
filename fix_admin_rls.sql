-- ====================================================
-- Fix Admin RLS Policies — نظام ران
-- التاريخ: 1 أبريل 2026م | 3 شوال 1447هـ
-- يُنفَّذ مرة واحدة في Supabase SQL Editor
-- ====================================================

-- 1. السماح للأدمن بقراءة كل المستخدمين (profiles)
-- هذا يُصلح صفحة "إدارة المستخدمين" التي تعرض 0 بيانات
DROP POLICY IF EXISTS "admins_can_read_all_profiles" ON profiles;
CREATE POLICY "admins_can_read_all_profiles" ON profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. السماح للأدمن بقراءة كل الأدوار (user_roles)
DROP POLICY IF EXISTS "admins_can_read_all_roles" ON user_roles;
CREATE POLICY "admins_can_read_all_roles" ON user_roles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = auth.uid() AND ur2.role = 'admin'
  )
);

-- 3. السماح للأدمن بإضافة وحذف الأدوار
DROP POLICY IF EXISTS "admins_can_manage_roles" ON user_roles;
CREATE POLICY "admins_can_manage_roles" ON user_roles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = auth.uid() AND ur2.role = 'admin'
  )
);

-- 4. السماح للأدمن بقراءة كل السائقين
DROP POLICY IF EXISTS "admins_can_read_all_drivers" ON drivers;
CREATE POLICY "admins_can_read_all_drivers" ON drivers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 5. السماح للأدمن بتعديل بيانات السائقين
DROP POLICY IF EXISTS "admins_can_update_drivers" ON drivers;
CREATE POLICY "admins_can_update_drivers" ON drivers
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 6. السماح للأدمن بقراءة كل الرحلات
DROP POLICY IF EXISTS "admins_can_read_all_rides" ON rides;
CREATE POLICY "admins_can_read_all_rides" ON rides
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- للتحقق: اطبع عدد policies بعد التنفيذ
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
  AND policyname LIKE 'admins_%'
ORDER BY tablename, policyname;
