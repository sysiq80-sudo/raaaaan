-- Fix: إضافة WITH CHECK صريح لسياسة RLS لجدول messenger_accounts
-- بدون WITH CHECK، INSERT قد لا يعمل بشكل صحيح

DROP POLICY IF EXISTS "admin_full_access_messenger_accounts" ON public.messenger_accounts;

CREATE POLICY "admin_full_access_messenger_accounts"
  ON public.messenger_accounts
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
