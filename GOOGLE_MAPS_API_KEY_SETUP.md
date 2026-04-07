# 🔑 إعداد Google Maps API Key

## المفتاح المستخدم

```
YOUR_GOOGLE_MAPS_API_KEY
```

---

## ✅ الخطوات لإضافة المفتاح

```bash
# الاتصال بـ Supabase
supabase db push

# أو تنفيذ الملف مباشرة
psql -h db.wgolkcztdrwdphwjvqxt.supabase.co -U postgres -d postgres -f supabase/INSERT_GOOGLE_MAPS_KEY.sql
```

---

## ✅ الخطوات لإضافة المفتاح

### 1. عبر Supabase Dashboard

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروع `wgolkcztdrwdphwjvqxt`
3. اذهب إلى **SQL Editor**
4. انسخ والصق هذا الكود:

```sql
-- Add Google Maps API Key
DELETE FROM app_settings WHERE key = 'google_maps_api_key';

INSERT INTO app_settings (key, value, description)
VALUES (
  'google_maps_api_key',
  '{"api_key": "YOUR_GOOGLE_MAPS_API_KEY"}'::jsonb,
  'Google Maps API Key - Maps JavaScript API, Directions API, Geocoding API, Static Maps API'
);

-- Verify
SELECT * FROM app_settings WHERE key = 'google_maps_api_key';
```

5. اضغط **Run**

## 🔒 تأمين المفتاح (مهم!)

### في Google Cloud Console

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. اختر المشروع
3. **APIs & Services** → **Credentials**
4. اختر المفتاح `YOUR_GOOGLE_MAPS_API_KEY`
5. أضف القيود التالية:

#### Application Restrictions
```
HTTP referrers (websites)
```

#### Website Restrictions (أضف النطاقات)
```
localhost:5173/*
localhost:*/*
*.vercel.app/*
*.netlify.app/*
YOUR_PRODUCTION_DOMAIN/*
```

#### API Restrictions
اختر **Restrict key** وفعّل فقط:
- ✅ Maps JavaScript API
- ✅ Directions API
- ✅ Geocoding API
- ✅ Maps Static API

---

## ✅ التحقق من عمل المفتاح

### اختبار من المتصفح

افتح Console في DevTools وجرّب:

```javascript
// اختبار تحميل Google Maps
const script = document.createElement('script');
script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places';
script.onload = () => console.log('✅ Google Maps loaded successfully');
script.onerror = () => console.error('❌ Failed to load Google Maps');
document.head.appendChild(script);
```

### اختبار من التطبيق

```bash
npm run dev
```

ثم:
1. افتح التطبيق
2. اذهب لصفحة الراكب
3. افتح DevTools Console (F12)
4. ابحث عن:
   - ✅ `Google Maps loaded`
   - ✅ لا أخطاء متعلقة بـ API Key

---

## 📊 حدود الاستخدام المجانية

Google Maps Platform تقدم **$200 شهرياً مجاناً**:

| API | السعر لكل 1000 طلب | الاستخدام المجاني الشهري |
|-----|-------------------|--------------------------|
| Maps JavaScript API | $7 | ~28,500 تحميل |
| Directions API | $5 | ~40,000 طلب |
| Geocoding API | $5 | ~40,000 طلب |
| Static Maps API | $2 | ~100,000 صورة |

**ملاحظة**: هذه الحدود كافية للتطوير والتجربة. للإنتاج، قد تحتاج تفعيل Billing.

---

## ⚠️ مشاكل شائعة

### المشكلة: `This API key is not authorized`

**الحل**:
1. تأكد من تفعيل الـ APIs في Google Cloud Console
2. تحقق من Domain Restrictions
3. انتظر 5 دقائق بعد أي تغيير (propagation time)

### المشكلة: `RefererNotAllowedMapError`

**الحل**:
1. أضف `localhost:5173` إلى Website Restrictions
2. تأكد من استخدام `http://` وليس `https://` في localhost

### المشكلة: `This page can't load Google Maps correctly`

**الحل**:
1. تفعيل Billing في Google Cloud (حتى لو كنت تستخدم Free Tier)
2. التحقق من عدم تجاوز الحدود اليومية

---

## 📝 ملاحظات مهمة

1. **لا تشارك المفتاح** في منصات عامة
2. **راقب الاستخدام** من Google Cloud Console Dashboard
3. **فعّل Alerts** عند اقتراب الحد الأقصى
4. **استخدم Environment Variables** في Production (لا تحفظه في الكود)

---

## ✅ الحالة الحالية

- ✅ المفتاح جاهز للاستخدام
- ✅ تم إنشاء سكريبت SQL للإضافة
- ⏳ يحتاج تنفيذ السكريبت في Supabase
- ⏳ يحتاج تأمين في Google Cloud Console

---

**التاريخ**: 2026-02-01  
**الحالة**: جاهز للتطبيق

**تم الحمد لله رب العالمين** 🤲
