# 📍 نظام Geofencing - منع الحجز خارج العراق

## 🎯 الهدف
منع المستخدمين من حجز رحلات من أو إلى مواقع خارج العراق، مع عرض رسائل طريفة بلهجة عراقية حسب الموقع.

## ✅ ما تم تنفيذه

### 1️⃣ ملف `src/lib/geofencing.ts`
- **دالة `quickGeofenceCheck()`**: فحص سريع للحدود بدون API
  - حدود العراق: خطوط العرض (29°-37.4°) وخطوط الطول (38.8°-48.8°)
  
- **دالة `checkDestinationGeofence()`**: الفحص الرئيسي باستخدام Mapbox API
  - يفحص الموقع بسرعة أولاً
  - إذا خارج الحدود، يستدعي Mapbox Reverse Geocoding لتحديد الدولة
  - يرجع نتيجة `GeofenceResult` مع رسالة مناسبة

### 2️⃣ تعديلات على `src/pages/rider/GoPage.tsx`

#### Import الجديد:
```typescript
import { checkDestinationGeofence, type GeofenceResult } from "@/lib/geofencing";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

#### State الجديد:
```typescript
const [geofenceResult, setGeofenceResult] = useState<GeofenceResult | null>(null);
const [showGeofenceAlert, setShowGeofenceAlert] = useState(false);
```

#### نقاط الفحص (3 مواضع):

**أ) في `handleConfirm()` - عند تأكيد الموقع من الخريطة:**
```typescript
if (currentMode === "pickup") {
  const geofenceCheck = await checkDestinationGeofence(center.lat, center.lng);
  if (!geofenceCheck.allowed) {
    setGeofenceResult(geofenceCheck);
    setShowGeofenceAlert(true);
    return; // إيقاف العملية
  }
  setPickupLocation(location);
}

if (currentMode === "dropoff") {
  const geofenceCheck = await checkDestinationGeofence(center.lat, center.lng);
  if (!geofenceCheck.allowed) {
    setGeofenceResult(geofenceCheck);
    setShowGeofenceAlert(true);
    return; // إيقاف العملية
  }
  setDropoffLocation(location);
}
```

**ب) في `LocationSearchInput.onLocationSelect` - عند البحث واختيار موقع:**
```typescript
onLocationSelect={async (location) => {
  // فحص Geofencing لكل من pickup و dropoff
  const geofenceCheck = await checkDestinationGeofence(location.lat, location.lng);
  if (!geofenceCheck.allowed) {
    setGeofenceResult(geofenceCheck);
    setShowGeofenceAlert(true);
    return;
  }
  // ... باقي الكود
}}
```

**ج) في `savedPlaces.onClick` - عند اختيار مكان محفوظ:**
```typescript
onClick={async () => {
  const location = handleSavedPlaceSelect(place);
  const geofenceCheck = await checkDestinationGeofence(location.lat, location.lng);
  if (!geofenceCheck.allowed) {
    setGeofenceResult(geofenceCheck);
    setShowGeofenceAlert(true);
    return;
  }
  // ... باقي الكود
}}
```

#### Dialog UI:
```typescript
<AnimatePresence>
  {showGeofenceAlert && geofenceResult && (
    <Dialog open={showGeofenceAlert} onOpenChange={setShowGeofenceAlert}>
      <DialogContent>
        <DialogTitle>{geofenceResult.isIran ? "🙏" : geofenceResult.isIsland ? "✈️🚢" : geofenceResult.isFar ? "✈️" : "🚗✨"}</DialogTitle>
        <DialogDescription>{geofenceResult.message}</DialogDescription>
        <Button onClick={() => setShowGeofenceAlert(false)}>فهمت 👌</Button>
      </DialogContent>
    </Dialog>
  )}
</AnimatePresence>
```

## 🗺️ السيناريوهات المدعومة

### 1. داخل العراق ✅
```
allowed: true
message: "الموقع داخل العراق ✅"
```

### 2. الدول المجاورة 🚗✨
**تركيا، السعودية، الكويت، سوريا، الأردن**
```
allowed: false
message: "لحد هسة ما عبرنا الحدود العراقية، إن شاء الله قريباً تلكانة بـ [الدولة] 🚗✨"
```

### 3. إيران 🙏
```
allowed: false
message: "نعتذر، لا نعمل في هذا المكان حالياً 🙏"
```

### 4. دول بعيدة ✈️
**مثل: أمريكا، أوروبا، إلخ**
```
allowed: false
message: "يابة إلى الآن ما امتلكنا طيارة، إن شاء الله قريباً نأخذك لـ [الدولة] ✈️"
```

### 5. الجزر ✈️🚢
**قبرص، البحرين، المالديف، بالي، تايلاند، إلخ**
```
allowed: false
message: "عيني هاي يحتاجلهة طيارة وسفن، واحنة بس عدنا سيارة، خليك بالعراق هسة ✈️🚢"
```

## 🎨 واجهة المستخدم

### Dialog مخصص
- **AnimatePresence** مع motion.div لأنيميشن سلسة
- **Emoji ديناميكية** حسب نوع الموقع
- **رسالة واضحة** بلهجة عراقية طريفة
- **زر "فهمت 👌"** لإغلاق Dialog

## 🔧 التقنيات المستخدمة

1. **Mapbox Geocoding API**: للحصول على الدولة من الإحداثيات
2. **React State**: لإدارة حالة Alert
3. **Framer Motion**: لأنيميشن Dialog
4. **shadcn/ui Dialog**: للتصميم الجميل
5. **TypeScript**: للـ type safety

## 📊 الأداء

- **فحص سريع أولاً**: يتجنب API calls غير الضرورية داخل العراق
- **التعامل مع الأخطاء**: إذا فشل API، يسمح بالحجز (تجربة مستخدم أفضل)
- **Async/Await**: غير محجوب - لا يعطل UI

## 🧪 الاختبار

### سيناريوهات الاختبار المقترحة:
1. ✅ حجز داخل بغداد
2. ✅ حجز في أربيل
3. ❌ حاول الحجز في اسطنبول (تركيا)
4. ❌ حاول الحجز في دبي (الإمارات)
5. ❌ حاول الحجز في قبرص
6. ❌ حاول الحجز في طهران (إيران)

## 📝 ملاحظات مهمة

1. **يعمل قبل حساب الأجرة**: يمنع عرض أسعار خيالية مثل 1M دينار لقبرص
2. **رسائل محلية**: تعزز هوية التطبيق العراقية
3. **تجربة مستخدم ممتعة**: الرسائل طريفة وليست جافة
4. **قابل للتوسع**: سهل إضافة دول أو رسائل جديدة

## 🎉 النتيجة

الآن المستخدمون:
- ✅ لن يروا أسعار خيالية للوجهات الدولية
- ✅ سيفهمون بطريقة طريفة أن الخدمة في العراق فقط
- ✅ سيحصلون على تجربة محلية أصيلة
- ✅ سيعرفون أن التطبيق سيتوسع مستقبلاً

---

**تاريخ التنفيذ**: 2026-01-29  
**الإصدار**: 1.0.0

**تم الحمد لله رب العالمين** 🤲
