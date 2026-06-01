# Supabase Migrations — ملاحظات مهمة

## ترقيم الملفات

تواريخ ملفات الـ migrations هي **ترتيب تسلسلي**، وليست تواريخ تنفيذ فعلية.

مثال:
- `20260610000000_captain_guardian_system.sql` — لا يعني أنه طُبِّق في 10 يونيو 2026
- `20270527001000_fix_company_earnings_on_conflict.sql` — لا يعني أنه طُبِّق في 2027

Supabase يرتب الملفات بالترتيب الأبجدي (timestamp → اسم).
التواريخ المستقبلية تضمن أن migration جديد ينفذ بعد كل السابقين.

## الملفات المُطبقة

لمعرفة ما هو مُطبق فعلاً على قاعدة بيانات معينة:

```sql
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

## قواعد إضافة migrations جديدة

1. استخدم timestamp أكبر من آخر ملف موجود
2. لا تعدّل ملف migration موجود ومُطبق على الإنتاج
3. كل migration يجب أن يكون idempotent حيثما أمكن (`CREATE OR REPLACE`, `IF NOT EXISTS`)
4. RPCs بـ `SECURITY DEFINER` يجب أن تتضمن:
   - `SET search_path = public`
   - `REVOKE EXECUTE FROM PUBLIC, anon`
   - `GRANT EXECUTE TO` المطلوب فقط
