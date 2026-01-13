-- خطوة 4: تفعيل RLS على المحافظات
-- شغل هذا بعد نجاح الخطوة 3

ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governorates_read_all" ON governorates;
CREATE POLICY "governorates_read_all" ON governorates FOR SELECT USING (true);

DROP POLICY IF EXISTS "governorates_admin_all" ON governorates;
CREATE POLICY "governorates_admin_all" ON governorates FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
