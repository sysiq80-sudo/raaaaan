# سكربتات الترحيل والإعداد

## تعيين system_configs بعد تطبيق الـ migration

بعد تشغيل الـ migration `20260301000000_production_fixes_sms.sql` يتم إدراج `SUPABASE_URL` و `SUPABASE_ANON_KEY` بقيم فارغة. يجب تعيين القيم الفعلية مرة واحدة.

### الطريقة 1: SQL من Supabase Dashboard

1. افتح مشروعك في [Supabase Dashboard](https://app.supabase.com) → SQL Editor.
2. افتح الملف `set_system_configs_after_migration.sql`.
3. استبدل في الملف:
   - `REPLACE_SUPABASE_URL` ← عنوان مشروعك (مثل `https://xxxx.supabase.co`)
   - `REPLACE_SUPABASE_ANON_KEY` ← المفتاح العام (anon key) من Project Settings → API.
4. نفّذ الاستعلام.

### الطريقة 2: سكربت Node من متغيرات البيئة

من جذر المشروع:

```bash
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/update-system-configs.mjs
```

أو باستخدام ملف `.env` (لا ترفع الملف إلى المستودع):

```bash
# .env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

```bash
node -r dotenv/config scripts/update-system-configs.mjs
```

(يتطلب تثبيت `dotenv`: `npm i -D dotenv`)

---

بعد التعيين، الـ triggers التي تقرأ `get_supabase_config('SUPABASE_URL')` و `SUPABASE_ANON_KEY` ستستدعي Edge Functions بشكل صحيح.
