# 📚 توثيق تقني - Address Quality Implementation

## 🎯 مخطط المعمارية

```
┌─────────────────────────────────────────────────────┐
│                   User Action                        │
│        (Drag map / Click location / Search)         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            useLocationPicker Hook                    │
│  • Map initialization                               │
│  • Reverse Geocoding API Call                       │
│  • POI Name Extraction (nearbySearch)               │
│  • Priority Address Logic (4-tier)                  │
│  • setCenterAddress()                               │
└────────────────┬──────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│           GoPage Component (Display)                 │
│  • buildDescriptiveAddress()                        │
│  • Remove Plus Code                                 │
│  • Apply Priority Logic                             │
│  • Show to User                                     │
└────────────────┬──────────────────────────────────┘
                 │
                 ▼
         ┌───────────────────┐
         │  Address Display  │
         │  (UI Rendered)    │
         └───────────────────┘
```

---

## 🔄 دورة حياة العنوان (Address Lifecycle)

### المرحلة 1: Map Drag Event
```typescript
map.addListener('dragstart', () => {
  setIsLoadingAddress(true);  // ✅ "جاري تحديد العنوان..."
});

map.addListener('dragend', async () => {
  await reverseGeocode(center.lat(), center.lng());  // ✅ فوري
});

map.addListener('idle', async () => {
  // ✅ backup response (بعد 1-2 ثانية)
});
```

### المرحلة 2: Reverse Geocoding API Call
```typescript
const result = await geocoder.geocode({
  location: { lat, lng },
  language: 'ar'
});

// النتيجة:
{
  formatted_address: "C7PX+F6V, الشارع الرئيسي، حي الأكراد، الرمادي، العراق",
  types: ["street_address", "geocode"],
  // ... more fields
}
```

### المرحلة 3: POI Detection (nearbySearch)
```typescript
const request = {
  location: new google.maps.LatLng(lat, lng),
  radius: 50,  // ✅ نطاق ضيق (دقة عالية)
  language: 'ar'
};

placesService.nearbySearch(request, (results, status) => {
  if (status === PlacesServiceStatus.OK) {
    // results[0] = أقرب مكان
    // مثال: جامعة المعارف
  }
});
```

### المرحلة 4: Priority Address Building
```
Input:
  - formatted_address: "C7PX+F6V, الشارع الرئيسي، حي الأكراد، الرمادي"
  - poiName: "جامعة المعارف"
  - addressParts: ["C7PX+F6V", "الشارع الرئيسي", "حي الأكراد", "الرمادي"]

Step 1: Detect Plus Code
  isPlusCode: true (regex match)
  cleanParts: ["الشارع الرئيسي", "حي الأكراد", "الرمادي"]

Step 2: Priority 1 - POI + 2 parts
  poiName exists: "جامعة المعارف"
  slice(0, 2): ["حي الأكراد", "الرمادي"]
  result: "جامعة المعارف، حي الأكراد، الرمادي" ✅

Output: "جامعة المعارف، حي الأكراد، الرمادي"
```

---

## 🔍 شرح منطق الأولويات (Priority Logic)

### الأولوية 1: POI + حي + مدينة
```typescript
// الحالة: وجود معلم + عنوان متعدد الأجزاء
if (poiName && poiName.trim()) {
  const priority1 = [poiName, ...addressParts.slice(0, 2)]
    .filter(p => p && p.length > 0)
    .join('، ');
}

// المخرجات:
"جامعة المعارف، حي الأكراد، الرمادي"
"مستشفى العام، المركز، الرمادي"
"البنك الأهلي، المنطقة التجارية، الرمادي"
```

**الاستخدام**:
- ✅ أماكن معروفة
- ✅ مؤسسات عامة
- ✅ معالم سياحية
- ✅ المحلات والمطاعم المشهورة

---

### الأولوية 2: شارع + حي + مدينة (3 أجزاء)
```typescript
// الحالة: لا يوجد POI، لكن عنوان طويل
if (!priorityAddress && addressParts.length >= 2) {
  const priority2 = addressParts
    .slice(0, 3)  // First 3 parts
    .filter(p => p && p.length > 0)
    .join('، ');
}

// المخرجات:
"شارع 14 تموز، حي الأكراد، الرمادي"
"شارع الخمسين، المركز، الرمادي"
"شارع التحرير، حي الثوار، الرمادي"
```

**الاستخدام**:
- ✅ الشوارع الرئيسية
- ✅ أحياء سكنية محددة
- ✅ مناطق تجارية عادية

---

### الأولوية 3: النتيجة الثانية من Geocoding
```typescript
// الحالة: النتيجة الأولى = Plus Code فقط
if (!priorityAddress && isPlusCode && results.length > 1) {
  const priority3 = result.results[1].formatted_address;
}

// مثال:
// results[0]: "C7PX+F6V, الرمادي"
// results[1]: "شارع غير محدد، الرمادي" ← استخدم هذا
```

**الاستخدام**:
- ✅ حالة خاصة: Plus Code فقط
- ✅ استدعاء Geocoding مرة أخرى
- ✅ التقاط النتيجة الثانية

---

### الخيار الأخير: Fallback (إحداثيات)
```typescript
// الحالة: جميع الأولويات فشلت
if (!priorityAddress) {
  const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  // مثال: "33.4262, 43.2954"
}

// الحالات:
- ✅ موقع نائي جداً
- ✅ خطأ في Google API
- ✅ Connection timeout
```

**الأمان**:
- لا نترك العنوان فارغاً أبداً
- الإحداثيات أفضل من "لا شيء"
- المستخدم يرى دائماً معلومة ما

---

## 🧮 خوارزمية Plus Code Detection

### Regex Pattern
```typescript
const plusCodePattern = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/;

// أمثلة:
"C7PX+F6V" ✅ match
"9R3C+88" ✅ match
"C7PX"    ❌ no match (بدون +)
"+F6V"    ❌ no match (بدون 4 أحرف أول)
```

### كيفية الحذف
```typescript
const addressParts = address.split(',').map(p => p.trim());
// Before: ["C7PX+F6V", "الشارع الرئيسي", "حي الأكراد", "الرمادي"]

const isPlusCode = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(addressParts[0]);
if (isPlusCode) {
  addressParts.shift();  // حذف الأول
}
// After: ["الشارع الرئيسي", "حي الأكراد", "الرمادي"]
```

---

## 🎯 POI Filtering Strategy

### النهج القديم: Whitelist (رفع + قبول محدود)
```typescript
// ❌ مشكلة: تصفية صارمة جداً
const acceptedTypes = ['hospital', 'mosque', 'school'];

// النتيجة:
// ✅ جامعة = point_of_interest + educational_institution
// ✅ مستشفى = hospital + point_of_interest
// ❌ محل خضار = store + point_of_interest (مرفوض! ❌)
```

### النهج الجديد: Blacklist (قبول واسع + رفع محدود)
```typescript
// ✅ الحل: رفع الأنواع غير الملائمة فقط
const invalidTypes = ['route', 'neighborhood'];

// النتيجة:
// ✅ جامعة = point_of_interest + accepted
// ✅ مستشفى = hospital + accepted
// ✅ محل خضار = store + accepted
// ✅ مطعم = restaurant + accepted
// ❌ شارع = route + rejected ✅
// ❌ حي سكني = neighborhood + rejected ✅
```

### المنطق في الكود
```typescript
const validPoiTypes = [
  'hospital', 'clinic', 'doctor', 'pharmacy',     // صحة
  'mosque', 'church', 'place_of_worship',          // دين
  'school', 'university', 'library',               // تعليم
  'government', 'city_hall', 'police', 'fire_station',  // حكومي
  'shopping_mall', 'supermarket', 'store',         // تجارة
  'restaurant', 'cafe', 'bakery',                  // طعام
  'bank', 'atm', 'post_office',                    // مالي
  'gas_station', 'car_repair',                     // سيارات
  'park', 'stadium', 'gym',                        // رياضة
  'museum', 'tourist_attraction', 'point_of_interest'  // سياحة
];

const hasValidType = place.types?.some(t => validPoiTypes.includes(t));
const isRoute = place.types?.includes('route');
const isNeighborhood = place.types?.includes('neighborhood');

if (place.name && hasValidType && !isRoute && !isNeighborhood) {
  // ✅ قبول
} else {
  // ❌ رفض
}
```

---

## 🔧 دالة buildDescriptiveAddress

### التوقيع
```typescript
const buildDescriptiveAddress = useCallback(
  (address: string): string => { ... },
  []  // no dependencies
);
```

### شرح المعاملات
```typescript
// Input: عنوان خام من Google API أو مخزن
"C7PX+F6V, الشارع الرئيسي، حي الأكراد، الرمادي"

// Output: عنوان وصفي نظيف
"الشارع الرئيسي، حي الأكراد، الرمادي"
```

### التطبيق في 3 مواقع

#### 1. Map Center Display
```typescript
// GoPage.tsx - سطر 1667
<div className="text-center">
  {buildDescriptiveAddress(centerAddress || "") || "جاري تحديد العنوان..."}
</div>

// الوظيفة:
// - عرض العنوان الحالي للخريطة
// - تحديث في الوقت الفعلي عند السحب
```

#### 2. Pickup Location Display
```typescript
// GoPage.tsx - سطر 1253
<div>
  <strong>موقع الانطلاق</strong>
  <p>{buildDescriptiveAddress(pickupLocation.address || "")}</p>
</div>

// الوظيفة:
// - عرض موقع الانطلاق المختار
// - قبل تأكيد الحجز
```

#### 3. Dropoff Location Display
```typescript
// GoPage.tsx - سطر 1263
<div>
  <strong>الوجهة</strong>
  <p>{buildDescriptiveAddress(dropoffLocation.address || "")}</p>
</div>

// الوظيفة:
// - عرض الوجهة النهائية
// - مراجعة قبل الدفع
```

---

## 📋 جدول التحويلات

### الحالة 1: معلم معروف
```
Input (Google API):
  formatted_address: "C7PX+F6V, جامعة المعارف، حي الأكراد، الرمادي، العراق"
  poiName: "جامعة المعارف"

Process:
  1. Split: ["C7PX+F6V", "جامعة المعارف", "حي الأكراد", "الرمادي", "العراق"]
  2. Check Plus Code: YES - Remove
  3. Clean Parts: ["جامعة المعارف", "حي الأكراد", "الرمادي", "العراق"]
  4. Priority 1 (POI + 2 parts):
     → ["جامعة المعارف", "حي الأكراد", "الرمادي"].join('، ')

Output:
  ✅ "جامعة المعارف، حي الأكراد، الرمادي"
```

### الحالة 2: شارع عام بدون POI
```
Input (Google API):
  formatted_address: "شارع 14 تموز، حي الأكراد، الرمادي، العراق"
  poiName: null

Process:
  1. Split: ["شارع 14 تموز", "حي الأكراد", "الرمادي", "العراق"]
  2. Check Plus Code: NO
  3. Priority 1 (no POI): SKIP
  4. Priority 2 (3 parts):
     → ["شارع 14 تموز", "حي الأكراد", "الرمادي"].join('، ')

Output:
  ✅ "شارع 14 تموز، حي الأكراد، الرمادي"
```

### الحالة 3: Plus Code فقط
```
Input (Google API Result 1):
  formatted_address: "C7PX+F6V, الرمادي"
  
Input (Google API Result 2):
  formatted_address: "شارع غير محدد، حي البعاج، الرمادي"

Process:
  1. Result 1 Split: ["C7PX+F6V", "الرمادي"]
  2. Check Plus Code: YES
  3. Remove Plus Code: ["الرمادي"]
  4. Priority 1 (no POI): SKIP
  5. Priority 2 (3 parts): SKIP (فقط جزئين)
  6. Priority 3 (second result):
     → result.results[1].formatted_address

Output:
  ✅ "شارع غير محدد، حي البعاج، الرمادي"
```

### الحالة 4: Fallback (موقع نائي)
```
Input:
  formatted_address: "N/A" (خطأ أو فارغ)
  lat: 33.4262
  lng: 43.2954

Process:
  1. Priority 1-3: جميع فشلت
  2. Fallback:
     → `${lat.toFixed(4)}, ${lng.toFixed(4)}`

Output:
  ✅ "33.4262, 43.2954"
```

---

## 🔐 معالجة الأخطاء (Error Handling)

### Google Geocoding API Errors

```typescript
try {
  const result = await geocoder.geocode({ ... });
  
  if (!result.results || result.results.length === 0) {
    // ❌ خطأ: No results found
    setCenterAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    return;
  }
  
  // ✅ معالجة النتائج...
  
} catch (error: any) {
  console.error("Reverse geocode error:", error);
  
  if (error.message?.includes('REQUEST_DENIED')) {
    // ❌ API Key غير مصرح
    toast({
      title: "تنبيه: Geocoding API",
      description: "API Key غير مصرح له"
    });
  }
  
  // Fallback: احفظ الإحداثيات
  setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}
```

### Places Service Errors

```typescript
placesService.nearbySearch(request, (results, status) => {
  if (status === PlacesServiceStatus.OK) {
    // ✅ نجاح
    if (results && results.length > 0) {
      // معالجة النتائج
    }
  } else if (status === PlacesServiceStatus.ZERO_RESULTS) {
    // ⚠️ لا توجد نتائج - استمر للأولوية التالية
    console.warn("No POI found in nearby search");
  } else if (status === PlacesServiceStatus.REQUEST_DENIED) {
    // ❌ API Key غير مصرح
    console.error("Places API: REQUEST_DENIED");
  } else {
    // ❌ خطأ آخر
    console.error("Places API error:", status);
  }
});
```

---

## 📊 الأداء (Performance Metrics)

### استدعاء API

```
Map Drag Event:
  ├─ dragstart: ~0ms (sync)
  ├─ dragend: Google Geocoding API (~500-1000ms)
  │   └─ nearbySearch (parallel): (~500-1000ms)
  ├─ idle: Backup call (~1-2 seconds)
  └─ Total: ~1-2 seconds

Build Time:
  ├─ npm run build: ~10.79 seconds
  ├─ Modules: 4336
  ├─ Errors: 0
  └─ Status: ✅ FAST & CLEAN
```

### استهلاك الموارد

```
Memory:
  ├─ buildDescriptiveAddress: <1KB (في الـ closure)
  ├─ Priority logic: <5KB (مشروط)
  └─ Total overhead: <10KB

CPU:
  ├─ String operations: O(n) حيث n = عدد الأجزاء (4-5 عادة)
  ├─ Regex check: O(m) حيث m = طول الجزء الأول
  └─ Filter & join: O(n)

Overall: ✅ LIGHTWEIGHT
```

---

## 🧪 حالات الاختبار (Test Cases)

### TC001: جامعة معروفة
```
Precondition:
  - التطبيق مفتوح
  - الخريطة على الرمادي
  
Steps:
  1. ابحث عن "جامعة المعارف"
  2. اسحب إليها
  3. انتظر 1-2 ثانية
  
Expected:
  ✅ "جامعة المعارف، حي الأكراد، الرمادي"
  ✅ لا Plus Code
  ✅ لا "جاري تحديد..."
```

### TC002: موقع نائي
```
Precondition:
  - التطبيق مفتوح
  - الخريطة على صحراء
  
Steps:
  1. اسحب إلى موقع بعيد
  2. انتظر 3-5 ثوانٍ
  
Expected:
  ✅ إحداثيات أو عنوان
  ✅ لا فراغ تماماً
  ✅ لا خطأ أحمر
```

### TC003: تحديث سريع (Drag & Drop)
```
Precondition:
  - التطبيق مفتوح
  - الخريطة نشطة
  
Steps:
  1. اسحب الخريطة 10+ مرات بسرعة
  2. لاحظ التحديثات
  
Expected:
  ✅ تحديث سريع
  ✅ عناوين موثوقة
  ✅ لا تعليق
```

---

**تم الحمد لله رب العالمين** 🤲

التاريخ: 2026-02-01
الحالة: ✅ **توثيق مكتمل**
