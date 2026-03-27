-- Migration: إضافة أعمدة مفقودة لجدول bot_customers لدعم sms-webhook
-- 2026-02-27

-- إضافة session_data إذا غير موجود
ALTER TABLE public.bot_customers ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}'::jsonb;

-- إضافة display_name إذا غير موجود
ALTER TABLE public.bot_customers ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT NULL;

-- تعليقات
COMMENT ON COLUMN public.bot_customers.session_data IS 'بيانات جلسة المستخدم (حالة، معرف الرحلة، العناوين) — يُستخدم من sms-webhook و sms-booking';
COMMENT ON COLUMN public.bot_customers.display_name IS 'اسم العرض للمستخدم — "ضيف SMS" أو الاسم المستلم من المنصة';
