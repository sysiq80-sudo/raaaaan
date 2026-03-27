# إعداد Google Maps API - خطوات مهمة ⚠️

## المشاكل التي تم حلها في الكود:

### ✅ 1. إصلاح استخدام الإحداثيات
**المشكلة**: كان يتم إرسال `function()` بدلاً من القيم الفعلية للإحداثيات
```typescript
// ❌ قبل
checkServiceArea(center.lat, center.lng) // يرسل functions!

// ✅ بعد
const actualLat = typeof center.lat === 'function' ? center.lat() : center.lat;
const actualLng = typeof center.lng === 'function' ? center.lng() : center.lng;
checkServiceArea(actualLat, actualLng)
```

### ✅ 2. إزالة Mapbox من Geofencing
**المشكلة**: كان يحاول استخدام Mapbox API رغم التحويل لـ Google Maps
```typescript
// ❌ قبل
fetch(`https://api.mapbox.com/geocoding/...&access_token=${mapToken}`)

// ✅ بعد
const geocoder = new google.maps.Geocoder();
const result = await geocoder.geocode({ location: { lat, lng } });
```

### ✅ 3. إصلاح Reverse Geocoding
**المشكلة**: كان يستخدم Mapbox Edge Function
```typescript
// ❌ قبل
fetch(`https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy`)

// ✅ بعد
const geocoder = new google.maps.Geocoder();
const result = await geocoder.geocode({ location: { lat, lng }, language: 'ar' });
```

---

## ⚠️ خطوات إضافية مطلوبة في Google Cloud Console

### المشكلة الباقية:
```
Geocoding Service: This API key is not authorized to use this service or API
```

### الحل:
يجب تفعيل **Geocoding API** على مفتاح API الخاص بك:

#### خطوات التفعيل:

1. **اذهب إلى Google Cloud Console**:
   - https://console.cloud.google.com/

2. **افتح مشروعك (RAAN Taxi)**

3. **اذهب إلى "APIs & Services" → "Library"**

4. **ابحث عن "Geocoding API"**

5. **اضغط "ENABLE"**

6. **تأكد من تفعيل APIs التالية** (للوظائف الكاملة):
   - ✅ Maps JavaScript API (مفعّل)
   - ⚠️ **Geocoding API** (يجب تفعيله)
   - ⚠️ **Places API** (يجب تفعيله)
   - ⚠️ **Directions API** (يجب تفعيله)
   - ⚠️ **Distance Matrix API** (اختياري - لتحسين الأداء)

7. **تحقق من API Restrictions**:
   - اذهب إلى "APIs & Services" → "Credentials"
   - اختر API Key الخاص بك
   - في "API restrictions":
     - إما اختر "Don't restrict key" (للتطوير)
     - أو أضف جميع APIs المذكورة أعلاه

---

## 🧪 اختبار بعد التفعيل

بعد تفعيل Geocoding API، اختبر:

### 1. Reverse Geocoding (عند تحريك الخريطة)
- يجب أن يعرض اسم الموقع بالعربية
- لا أخطاء في Console

### 2. Geofencing (عند اختيار موقع)
- يجب أن يكتشف إذا كان الموقع في العراق أم لا
- رسالة "الموقع داخل العراق ✅" تظهر

### 3. Places Search (عند البحث)
- نتائج البحث تظهر مع الأيقونات
- التفاصيل تُحمّل عند الاختيار

---

## 📊 متابعة الاستخدام

**مهم**: Google Maps APIs لها حصة مجانية شهرية:
- Geocoding API: 40,000 طلب/شهر مجاناً
- Places API: $200 رصيد مجاني = ~17,000 طلب
- Directions API: $200 رصيد مجاني = ~10,000 طلب

**راقب الاستخدام من**:
https://console.cloud.google.com/apis/dashboard

---

## ✅ الملفات المعدّلة

1. **src/pages/rider/GoPage.tsx**
   - إصلاح استخدام `.lat()` و `.lng()`
   - استبدال Mapbox Reverse Geocoding بـ Google

2. **src/lib/geofencing.ts**
   - إزالة Mapbox API كاملاً
   - استخدام Google Geocoding API فقط
   - إصلاح استخراج كود الدولة

3. **src/hooks/useLocationPicker.ts**
   - (تم مسبقاً) استخدام Google Maps API

---

## 🔍 كيف تتحقق من نجاح الإصلاح؟

افتح DevTools Console وابحث عن:

### ❌ قبل الإصلاح:
```
GET ...?lat=function(){return%20e}&lng=function(){return%20f} 400
Geocoding Service: This API key is not authorized
INVALID_REQUEST: Invalid latitude and longitude
```

### ✅ بعد الإصلاح (بعد تفعيل Geocoding API):
```
✅ User location received: 33.41854 43.26897
✅ Google Maps API script loaded
🗺️ Creating Google Maps instance...
```

---

**تم الحمد لله رب العالمين** 🤲
