# Google Maps API Migration - مهمة مستقبلية

## 📌 الحالة الحالية
التطبيق يعمل بشكل جيد لكن يستخدم Google Maps APIs قديمة سيتم إيقافها بعد 12+ شهر.

## ⚠️ APIs التي تحتاج Migration

### 1. AutocompleteService → AutocompleteSuggestion
**الملف**: `src/hooks/useDynamicPlacesSearch.ts`
- **السطر**: ~112
- **الاستخدام**: البحث عن الأماكن أثناء الكتابة
- **الأولوية**: متوسطة

### 2. PlacesService → Place
**الملفات**:
- `src/hooks/useDynamicPlacesSearch.ts` (السطر ~137)
- `src/hooks/useLocationPicker.ts` (السطر ~133)
- **الاستخدام**: جلب تفاصيل الأماكن والمعالم (POI)
- **الأولوية**: متوسطة

## 📚 موارد Migration
- **دليل Google الرسمي**: https://developers.google.com/maps/documentation/javascript/places-migration-overview
- **Legacy APIs Notice**: https://developers.google.com/maps/legacy

## ⏰ الجدول الزمني
- **الإشعار**: مارس 2025
- **الوقت المتبقي**: 12+ شهر قبل الإيقاف
- **التوصية**: التخطيط للـ migration في Q3 2026

## 🔧 التعديلات المطلوبة

### AutocompleteSuggestion (بدلاً من AutocompleteService)
```typescript
// القديم (حالياً)
autocompleteServiceRef.current = new google.maps.places.AutocompleteService();

// الجديد (مطلوب)
// استخدام google.maps.places.AutocompleteSuggestion
// راجع التوثيق: https://developers.google.com/maps/documentation/javascript/place-autocomplete
```

### Place (بدلاً من PlacesService)
```typescript
// القديم (حالياً)
const placesService = new google.maps.places.PlacesService(map);
placesService.nearbySearch(request, callback);

// الجديد (مطلوب)
// استخدام google.maps.places.Place
// راجع التوثيق: https://developers.google.com/maps/documentation/javascript/place-details
```

## ✅ ملاحظات
- التطبيق يعمل بشكل طبيعي حالياً
- التحذيرات في Console لا تؤثر على الأداء
- Google تعد بدعم لمدة 12 شهر على الأقل
- يجب اختبار Migration بشكل شامل قبل التطبيق

## 🚨 تذكير
**لا تقم بالـ migration الآن** - انتظر حتى:
1. Google تصدر توثيق أكثر وضوحاً
2. تتوفر أمثلة عملية أكثر
3. يقترب موعد الإيقاف الفعلي

---
**آخر تحديث**: 2026-02-01
**الحالة**: موثق ومؤجل لوقت لاحق
