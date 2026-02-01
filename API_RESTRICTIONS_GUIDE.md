# إعدادات Google Cloud Console و API Restrictions

## المشاكل المحلولة ✅

### 1. ✅ البحث عن الأماكن (Search)
- **المشكلة**: عدم ظهور نتائج عند البحث عن "مستشفى الرازي"
- **الحل**: 
  - إضافة `types: ['establishment', 'geocode']` للبحث عن جميع أنواع الأماكن
  - توسيع النطاق من 3km إلى 5km مع استخدام `locationBias` بدلاً من `locationRestriction`
  - تحسين رسائل الأخطاء لتوضيح مشكلة API Key

### 2. ✅ تدفق الحجز (Booking Flow)
- **المشكلة**: زر "احجز الآن" يدخل في حالة "جاري الحجز..." مع إشعارات مزعجة
- **الحل**:
  - إزالة `setIsBooking(true)` بالكامل
  - إزالة `disabled={isBooking}` من الزر
  - إزالة toast "تم إرسال طلبك" و "جاري البحث عن سائق"
  - الانتقال الفوري لشاشة البحث عن سائق بمجرد الضغط

### 3. ✅ عرض الأسماء (Reverse Geocoding)
- **تم حله في المهمة السابقة**: خوارزمية متقدمة لعرض أسماء الأماكن بدلاً من Plus Codes

---

## تحقق من إعدادات Google Cloud Console

### الخطوات المطلوبة:

#### 1️⃣ التأكد من تفعيل APIs المطلوبة

افتح [Google Cloud Console - APIs](https://console.cloud.google.com/apis/dashboard)

تأكد من تفعيل الخدمات التالية:
- ✅ **Maps JavaScript API**
- ✅ **Places API** (ضروري للبحث)
- ✅ **Geocoding API** (ضروري للعناوين)
- ✅ **Directions API** (للمسارات)
- ✅ **Distance Matrix API** (حساب المسافات)

#### 2️⃣ فحص API Key Restrictions

افتح [Credentials](https://console.cloud.google.com/apis/credentials)

اختر API Key الخاص بالمشروع وتحقق من:

**Application restrictions**:
```
✅ HTTP referrers (websites)
   أو
✅ Android apps (تأكد من SHA-1 و Package Name)
```

**API restrictions**:
```
✅ Restrict key
   ثم اختر:
   ☑ Maps JavaScript API
   ☑ Places API          ⚠️ مهم جداً
   ☑ Geocoding API       ⚠️ مهم جداً
   ☑ Directions API
   ☑ Distance Matrix API
   ☑ Geolocation API
```

#### 3️⃣ للتطبيق Android/iOS

**Android**:
```
Package name: com.raantaxi.app (مثال)
SHA-1: احصل عليه من:
  keytool -list -v -keystore ~/.android/debug.keystore
```

**iOS**:
```
Bundle ID: com.raantaxi.app (مثال)
```

---

## اختبار API Key

### طريقة 1: من Console المتصفح

```javascript
// افتح Console في المتصفح (F12)
// جرّب:

fetch('https://maps.googleapis.com/maps/api/place/autocomplete/json?input=مستشفى&key=YOUR_API_KEY&language=ar&components=country:iq')
  .then(r => r.json())
  .then(d => console.log(d));

// إذا كانت النتيجة:
// ✅ { "predictions": [...] } => API يعمل
// ❌ { "error_message": "..." } => مشكلة في API Key
```

### طريقة 2: من التطبيق

افتح Console في المتصفح أثناء تشغيل التطبيق:

```javascript
// ابحث عن:
console.log("📤 Autocomplete request sent:", request);
console.log("📥 Autocomplete response:", response);

// إذا رأيت:
// ✅ response: { predictions: [...] } => يعمل
// ❌ error: REQUEST_DENIED => مشكلة في API restrictions
```

---

## رسائل الأخطاء الشائعة

### ❌ REQUEST_DENIED
```
⚠️ Places API: REQUEST_DENIED - Check API Restrictions
   Required APIs: Places API, Maps JavaScript API
   Check: https://console.cloud.google.com/apis/credentials
```

**الحل**:
1. افتح Google Cloud Console
2. اذهب لـ Credentials
3. اختر API Key
4. تأكد من تفعيل **Places API** في API restrictions

---

### ❌ OVER_QUERY_LIMIT
```
⚠️ Places API: OVER_QUERY_LIMIT
```

**الحل**:
1. تحقق من Billing Account مفعّل
2. تحقق من Quotas في [Google Cloud Console](https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas)

---

### ❌ ZERO_RESULTS
```
ℹ️ No results found for query: مستشفى الرازي
```

**ليست مشكلة** - فقط لا توجد نتائج في النطاق المحدد (5km)

---

## Billing Account

### تحقق من الفوترة

1. افتح [Billing](https://console.cloud.google.com/billing)
2. تأكد من:
   - ✅ Billing account مفعّل
   - ✅ Payment method مضاف
   - ✅ لا توجد تنبيهات

### الحدود المجانية الشهرية

Google Maps Platform تقدم:
- **$200 شهرياً مجاناً**

| API | Cost per request | Free tier |
|-----|------------------|-----------|
| Places Autocomplete | $2.83 per 1000 | 70,000 |
| Places Details | $17 per 1000 | 11,700 |
| Geocoding | $5 per 1000 | 40,000 |
| Directions | $5 per 1000 | 40,000 |

**مثال حساب**:
- 1000 بحث Places Autocomplete = $2.83
- 200 Place Details = $3.40
- 500 Geocoding = $2.50
- **المجموع شهرياً**: ~$20 (ضمن المجاني)

---

## التحقق النهائي

### Checklist ✅

قبل الاتصال بالدعم، تأكد من:

- [ ] ✅ Maps JavaScript API مفعّل
- [ ] ✅ **Places API مفعّل** (الأهم)
- [ ] ✅ Geocoding API مفعّل
- [ ] ✅ API Key لديه restrictions صحيحة
- [ ] ✅ Billing Account مفعّل
- [ ] ✅ لا توجد تنبيهات في Console
- [ ] ✅ SHA-1 و Package Name صحيحين (للـ Android)

---

## ملاحظات مهمة

### للتطوير (Development)

يمكنك مؤقتاً:
```
⚠️ لا تستخدم في الإنتاج:
- إزالة API restrictions مؤقتاً للاختبار
- استخدام HTTP referrers: localhost:*
```

### للإنتاج (Production)

**يجب**:
```
✅ تفعيل API restrictions (Security)
✅ تحديد Referrers/Package Names بدقة
✅ مراقبة Usage في Dashboard
```

---

## روابط مفيدة

- [Google Cloud Console](https://console.cloud.google.com/)
- [APIs Dashboard](https://console.cloud.google.com/apis/dashboard)
- [Credentials](https://console.cloud.google.com/apis/credentials)
- [Billing](https://console.cloud.google.com/billing)
- [Places API Docs](https://developers.google.com/maps/documentation/places/web-service/overview)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)

---

## الدعم

إذا استمرت المشكلة بعد التحقق من جميع النقاط أعلاه:

1. التقط screenshot من:
   - APIs Dashboard (الخدمات المفعّلة)
   - API Key restrictions
   - Console errors (F12)

2. تواصل مع Google Cloud Support

---

**آخر تحديث**: 2026-02-01  
**الحالة**: ✅ جميع المشاكل محلولة من جانب الكود

**تم الحمد لله رب العالمين** 🤲
