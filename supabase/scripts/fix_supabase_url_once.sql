-- تصحيح SUPABASE_URL فقط (يجب أن يكون رابط الـ API وليس رابط الداشبورد)
-- نفّذ هذا الاستعلام مرة واحدة في SQL Editor

UPDATE system_configs 
SET key_value = 'https://wgolkcztdrwdphwjvqxt.supabase.co' 
WHERE key_name = 'SUPABASE_URL';
