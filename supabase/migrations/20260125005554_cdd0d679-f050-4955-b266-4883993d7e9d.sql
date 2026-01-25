-- إضافة صلاحية الأدمن للمستخدم klidmorre@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('5ad7d18a-984d-4b38-b5c0-0a5899550943', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;