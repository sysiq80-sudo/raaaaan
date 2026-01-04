-- Add admin role for klidmorre@gmail.com
INSERT INTO public.user_roles (user_id, role) 
VALUES ('6d8eb7e2-8f96-402f-a791-8328541e9a00', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;