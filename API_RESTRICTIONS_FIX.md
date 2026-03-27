# دليل حل مشكلة API Restrictions - خطوة بخطوة 🔧

## 🚨 المشكلة الحالية

رغم تفعيل جميع APIs (Geocoding, Places, Directions)، التطبيق يظهر:
- ❌ "لا توجد نتائج" عند البحث
- ❌ إحداثيات رقمية (43.26959, 33.41997) بدلاً من اسم المكان
- ❌ Console Errors: `REQUEST_DENIED`

**السبب**: API Key مقيد ولا يسمح بالوصول من localhost أو domain التطبيق

---

## ✅ الحل: تعديل API Restrictions

### الخطوة 1: الذهاب إلى Credentials

1. افتح: **https://console.cloud.google.com/**
2. اختر مشروع **RAAN Taxi**
3. اذهب إلى: **APIs & Services → Credentials**
4. ابحث عن API Key: **"Maps Platform API Key"**
5. اضغط على اسم المفتاح (ليس "Show key")

---

### الخطوة 2: تعديل API Restrictions

في صفحة تعديل API Key، انتقل إلى قسم **"API restrictions"**:

#### الخيار 1: للتطوير (موصى به حالياً) ⚡
```
✅ اختر: "Don't restrict key"
```

**المميزات**:
- يعمل من أي domain
- مناسب للتطوير المحلي
- لا حاجة لإضافة domains يدوياً

**العيوب**:
- أقل أماناً
- يمكن استخدامه من أي موقع

---

#### الخيار 2: للإنتاج (بعد الإطلاق) 🔒
```
✅ اختر: "Restrict key"
✅ اختر جميع APIs التالية:
   - Maps JavaScript API
   - Geocoding API
   - Places API (New)
   - Directions API
   - Distance Matrix API (اختياري)
   - Geolocation API (اختياري)
```

**مهم**: يجب اختيار **Places API (New)** وليس Places API القديمة!

---

### الخطوة 3: تعديل Application Restrictions

في نفس الصفحة، قسم **"Application restrictions"**:

#### للتطوير المحلي:

```
✅ اختر: "HTTP referrers (web sites)"
✅ أضف الـ Referrers التالية:

http://localhost:*/*
http://localhost:8081/*
http://localhost:5173/*
http://127.0.0.1:*/*
```

#### للإنتاج:

```
✅ أضف domain موقعك:

https://raan-taxi.com/*
https://*.raan-taxi.com/*
https://your-domain.com/*
```

#### إذا كنت تستخدم Netlify/Vercel:

```
https://*.netlify.app/*
https://*.vercel.app/*
```

---

### الخطوة 4: حفظ التغييرات

1. اضغط **"Save"** في أسفل الصفحة
2. **انتظر 5 دقائق** (التغييرات تأخذ وقت للتفعيل)
3. امسح Cache المتصفح أو افتح Incognito Mode
4. أعد تحميل التطبيق

---

## 🧪 اختبار بعد التعديل

### اختبار 1: Geocoding API ✅

افتح DevTools Console، يجب أن ترى:
```
✅ Map loaded successfully
✅ Reverse geocoding successful
```

وليس:
```
❌ Geocoding API: REQUEST_DENIED
```

في الخريطة، يجب أن ترى:
```
✅ "شارع الملك غازي، الرمادي، العراق"
❌ 43.26959, 33.41997
```

---

### اختبار 2: Places API ✅

اضغط على حقل البحث واكتب "مسجد":

يجب أن ترى:
```
✅ قائمة بالمساجد القريبة
✅ أيقونات الأماكن
```

وليس:
```
❌ "لا توجد نتائج"
```

---

### اختبار 3: Console Logs ✅

افتح DevTools Console:

**✅ يجب أن ترى**:
```javascript
✅ Google Maps API script loaded
✅ Map loaded successfully
✅ Places service initialized
```

**❌ يجب ألا ترى**:
```javascript
❌ REQUEST_DENIED
❌ API key not authorized
❌ The webpage is not allowed to use the geocoder
```

---

## 🔍 استكشاف الأخطاء المتقدم

### المشكلة 1: لا يزال REQUEST_DENIED بعد التعديل

**الحل**:
1. انتظر 5-10 دقائق
2. امسح Cache المتصفح: `Ctrl + Shift + Delete`
3. أعد تشغيل الخادم: `npm run dev`
4. جرّب Incognito Mode
5. تأكد من حفظ التعديلات في Google Cloud Console

---

### المشكلة 2: يعمل في localhost لكن لا يعمل في Production

**السبب**: نسيت إضافة production domain في Application Restrictions

**الحل**:
```
1. اذهب إلى API Key Settings
2. Application restrictions → HTTP referrers
3. أضف:
   https://your-domain.com/*
   https://*.your-domain.com/*
```

---

### المشكلة 3: Geocoding يعمل لكن Places لا يعمل

**السبب**: قد تكون اخترت "Places API" القديمة بدلاً من "Places API (New)"

**الحل**:
1. اذهب إلى APIs & Services → Library
2. ابحث عن: "Places API (New)"
3. اضغط **Enable**
4. في API Restrictions، اختر "Places API (New)"

---

### المشكلة 4: تظهر أخطاء Billing

**السبب**: المشروع غير مربوط بحساب فوترة

**الحل**:
1. اذهب إلى: **Billing → Link a billing account**
2. اختر حساب **CARRINN** (الموجود في الصورة)
3. تأكد من ربط المشروع الصحيح
4. حتى لو كانت التكلفة $0.00، يجب ربط حساب الفوترة!

---

## 📋 Checklist نهائي

قبل المتابعة، تأكد من:

- [ ] ✅ تفعيل Geocoding API من Library
- [ ] ✅ تفعيل Places API (New) من Library
- [ ] ✅ تفعيل Directions API من Library
- [ ] ✅ API Restrictions = "Don't restrict key" (للتطوير)
- [ ] ✅ Application restrictions = "HTTP referrers"
- [ ] ✅ إضافة `http://localhost:*/*` في Referrers
- [ ] ✅ ربط حساب Billing بالمشروع
- [ ] ✅ الانتظار 5 دقائق بعد الحفظ
- [ ] ✅ مسح Cache المتصفح
- [ ] ✅ إعادة تشغيل التطبيق

---

## 🎯 الإعدادات الموصى بها

### للتطوير (حالياً):

```yaml
API Restrictions: Don't restrict key
Application Restrictions: HTTP referrers
Allowed Referrers:
  - http://localhost:*/*
  - http://127.0.0.1:*/*
```

### للإنتاج (قبل الإطلاق):

```yaml
API Restrictions: Restrict key
Allowed APIs:
  - Maps JavaScript API
  - Geocoding API
  - Places API (New)
  - Directions API
  
Application Restrictions: HTTP referrers
Allowed Referrers:
  - https://raan-taxi.com/*
  - https://*.raan-taxi.com/*
  - http://localhost:*/* (فقط للتطوير)
```

---

## 💰 التكلفة المتوقعة

مع الإعدادات الحالية والحصة المجانية:

| الاستخدام اليومي | التكلفة الشهرية |
|------------------|------------------|
| 100 مستخدم/يوم | **$0** (ضمن الحصة المجانية) |
| 500 مستخدم/يوم | **$5-10** |
| 1000 مستخدم/يوم | **$20-30** |

**ملاحظة**: الحصة المجانية ($200/شهر) كافية لـ ~70,000 طلب Places Autocomplete

---

## 🔔 إعداد تنبيهات

لتجنب المفاجآت في الفواتير:

1. اذهب إلى: **Billing → Budgets & alerts**
2. اضغط **Create Budget**
3. اختر:
   - **Budget amount**: $50
   - **Alert thresholds**: 50%, 80%, 100%
4. أضف بريدك الإلكتروني للتنبيهات

---

## 📞 مصادر إضافية

- **API Restrictions Guide**: https://developers.google.com/maps/api-security-best-practices
- **HTTP Referrer Restrictions**: https://developers.google.com/maps/documentation/javascript/get-api-key#restrict_key
- **Troubleshooting**: https://developers.google.com/maps/documentation/javascript/error-messages

---

## ✅ ملخص سريع (TL;DR)

```bash
1. اذهب إلى: console.cloud.google.com
2. Credentials → "Maps Platform API Key"
3. API restrictions → "Don't restrict key" (للتطوير)
4. Application restrictions → "HTTP referrers"
5. أضف: http://localhost:*/*
6. Save
7. انتظر 5 دقائق
8. امسح Cache
9. اختبر التطبيق
```

---

**تم الحمد لله رب العالمين** 🤲

آخر تحديث: 2026-02-01
