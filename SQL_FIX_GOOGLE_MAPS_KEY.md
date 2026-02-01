# ✅ إصلاح SQL Script - Google Maps API Key

## 🔧 المشكلة

الخطأ الأصلي:
```
ERROR: 42703: column "name" does not exist
```

**السبب**: جدول `app_settings` يستخدم العمود `key` وليس `name`، والقيمة تُخزن كـ JSONB وليس TEXT مباشر.

---

## ✅ الحل الصحيح

### SQL Script الصحيح

انسخ هذا الكود **بالضبط**:

```sql
DELETE FROM app_settings WHERE key = 'google_maps_api_key';

INSERT INTO app_settings (key, value, description)
VALUES (
  'google_maps_api_key',
  '{"api_key": "AIzaSyAYunRwU6ZASnx640BIVymHqtUEnh0aPKk"}'::jsonb,
  'Google Maps API Key - Maps JavaScript API, Directions API, Geocoding API, Static Maps API'
);

SELECT * FROM app_settings WHERE key = 'google_maps_api_key';
```

### الخطوات:

1. **افتح Supabase Dashboard**: https://wgolkcztdrwdphwjvqxt.supabase.co
2. **SQL Editor**
3. **انسخ الكود أعلاه** (Ctrl+C)
4. **الصقه** (Ctrl+V)
5. **Run** (زر التشغيل الأزرق)

---

## 📊 شرح التغييرات

| المشكلة | الحل |
|--------|------|
| `WHERE name =` | `WHERE key =` ✅ |
| `'google_maps_api_key'` | `'google_maps_api_key'` ✅ |
| `(name, value)` | `(key, value)` ✅ |
| مباشر string | `'{"api_key": "..."}'::jsonb` ✅ |

---

## 🧪 التحقق من النجاح

بعد تشغيل الكود، يجب أن ترى:

```
key                    | value                                          | description
-----------------------|------------------------------------------------|----------
google_maps_api_key    | {"api_key": "AIzaSyAYunRwU6ZASnx..."}         | Google Maps API Key...
```

---

## 📝 الملفات المحدّثة

تم تصحيح جميع الملفات:
- ✅ `supabase/INSERT_GOOGLE_MAPS_KEY.sql`
- ✅ `setup-google-maps-key.ps1`
- ✅ `GOOGLE_MAPS_API_KEY_SETUP.md`
- ✅ `FINAL_COMPLETION_REPORT_GOOGLE_MAPS.md`

---

## ✅ بعد النجاح

```bash
npm run dev
```

اختبر التطبيق والخريطة ستعمل بشكل صحيح!

---

**تم الحمد لله رب العالمين** 🤲
