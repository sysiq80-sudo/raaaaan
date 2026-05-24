-- إضافة صلاحية الأدمن للمستخدم klidmorre@gmail.com (المعرف الجديد)
INSERT INTO public.user_roles (user_id, role)
VALUES ('2f1468f2-3e2e-4c52-9054-d4a130f8c905', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;