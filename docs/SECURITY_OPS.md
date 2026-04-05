# إجراءات أمنية تشغيلية (Supabase)

## 1. Leaked Password Protection (كلمات مرور مسرّبة)

لا يُفعّل من الكود؛ من لوحة Supabase:

1. [Project Settings → Authentication](https://supabase.com/dashboard/project/_/settings/auth) (استبدل `_` بمرجع المشروع).
2. تفعيل **Leaked password protection** (أو المسمى المماثل في واجهة Auth).

يقلل من تسجيل المستخدمين بكلمات مرور معروفة من تسريبات سابقة.

## 2. مفاتيح `system_configs` بعد إزالة القيم الافتراضية من الـ migrations

دوال `notify_whatsapp_ride_status_change` و `notify_sms_ride_status_change` تتطلب:

| المفتاح | الوصف |
|---------|--------|
| `SUPABASE_URL` | رابط المشروع، مثل `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | مفتاح **anon** العام (من إعدادات API) |

إذا كانت القيم فارغة، يُسجَّل في السجلات تخطي الإرسال ولن يُستدعَ Edge Function. اضبط القيم من لوحة الإدارة أو SQL آمن.

## 3. توكن تليجرام الإداري

إذا وُجد سابقاً توكن في migration قديم، **أعد إصداره** من BotFather بعد النشر وخزّنه في `system_configs` فقط في البيئة.

## 4. مراجع

- [docs/SYSTEM_INSPECTION_REPORT.md](SYSTEM_INSPECTION_REPORT.md) — سجل عيوب سابقة.
- [supabase/migrations/20260301000000_production_fixes_sms.sql](../supabase/migrations/20260301000000_production_fixes_sms.sql)
