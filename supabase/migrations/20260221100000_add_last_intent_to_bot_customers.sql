-- إضافة عمود last_intent لجدول bot_customers لتتبع نية المستخدم (مثل awaiting_schedule)
ALTER TABLE public.bot_customers ADD COLUMN IF NOT EXISTS last_intent TEXT DEFAULT NULL;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.bot_customers.last_intent IS 'آخر نية للمستخدم (مثل awaiting_schedule) — يُستخدم لتتبع التدفق بين الرسائل';
