-- إزالة قيد الـ foreign key من user_id للسماح بإضافة سائقين من لوحة التحكم
-- السائقين المضافين من الأدمن لا يحتاجون حساب مستخدم

-- أولاً نحذف القيد الموجود
ALTER TABLE public.drivers 
DROP CONSTRAINT IF EXISTS drivers_user_id_fkey;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.drivers.user_id IS 'معرف المستخدم - قد يكون UUID عشوائي للسائقين المضافين من الأدمن أو معرف مستخدم حقيقي للسائقين المسجلين ذاتياً';