# إصلاح مشكلة الخريطة السوداء عند تسجيل الدخول

## 🐛 المشكلة

عند تسجيل الدخول لأول مرة، تظهر الخريطة سوداء ولا تُحمّل إلا بعد إعادة تحميل الصفحة (F5).

## 🔍 السبب

**Race Condition** بين:

1. تحميل Mapbox Token من API
2. تهيئة الخريطة في `useLocationPicker`
3. جاهزية DOM container
4. **تحديث موقع المستخدم** يسبب إعادة تهيئة غير ضرورية

الخريطة كانت تحاول التهيئة قبل أن يكون الـ token جاهزاً، **وكانت تعيد التهيئة** عند تحديث `userLocation`.

## ✅ الإصلاحات المطبقة

### 1. **إضافة Retry Logic** في `useRiderData.ts`

```typescript
// إعادة المحاولة 3 مرات عند فشل تحميل الـ token
retryCount < maxRetries;
setTimeout(() => fetchToken(), 1000 * retryCount);
```

### 2. **تأخير تهيئة الخريطة** في `useLocationPicker.ts`

```typescript
// تأخير 100ms لضمان جاهزية الـ token
const initTimer = setTimeout(() => {
  map.current = new mapboxgl.Map({...});
}, 100);
```

### 3. **منع التهيئة المتكررة** ⭐ **جديد - حل نهائي**

```typescript
// إزالة userLocation من dependencies للتهيئة
useEffect(() => {
  // تهيئة الخريطة مرة واحدة فقط
  if (!map.current && mapToken) {
    map.current = new mapboxgl.Map({...});
  }
}, [mapToken]); // ✅ فقط mapToken - لا إعادة تهيئة!

// effect منفصل لتحديث مركز الخريطة
useEffect(() => {
  if (map.current && userLocation) {
    map.current.flyTo({
      center: [userLocation.lng, userLocation.lat]
    });
  }
}, [userLocation]); // ✅ فقط flyTo بدون إعادة تهيئة
```

### 4. **نقل Controls والـ Events داخل الـ setTimeout**

```typescript
// كل الـ controls والـ events الآن داخل try-catch block
try {
  map.current = new mapboxgl.Map({...});
  map.current.addControl(...);
  map.current.on("load", ...);
} catch (error) {
  console.error("Map initialization error:", error);
}
```

### 5. **فصل الـ Cleanup Effect**

```typescript
// Cleanup منفصل لتجنب race conditions
useEffect(() => {
  return () => {
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
  };
}, []);
```

### 6. **Loading Placeholder** في `GoPage.tsx`

```tsx
{
  (!mapToken || isLoading) && (
    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white text-lg">جاري تحميل الخريطة...</p>
      </div>
    </div>
  );
}
```

## 🧪 الاختبار

1. ✅ سجّل خروج من التطبيق
2. ✅ سجّل دخول مرة أخرى
3. ✅ الخريطة يجب أن تظهر مباشرة بدون شاشة سوداء
4. ✅ **لا ظهور رسالة "Map already initialized" في Console**
5. ✅ لا حاجة لإعادة تحميل الصفحة

## 📊 التحسينات

- ⚡ تحميل أسرع بفضل الـ cache
- 🔄 إعادة محاولة تلقائية عند فشل الـ API
- 🎨 شاشة تحميل احترافية
- 🛡️ حماية من race conditions
- 🧹 تنظيف موارد أفضل
- ✨ **منع التهيئة المتكررة** - خريطة واحدة فقط!
- 🚀 تحديث الموقع بـ `flyTo()` بدون إعادة التهيئة

## 🔧 الملفات المعدلة

1. `src/hooks/useRiderData.ts` - إضافة retry logic وcache
2. `src/hooks/useLocationPicker.ts` - تأخير التهيئة وفصل cleanup
3. `src/pages/rider/GoPage.tsx` - إضافة loading placeholder

---

**تاريخ الإصلاح**: 2026-01-15
**المطور**: GitHub Copilot
**الحالة**: ✅ تم الحمد لله رب العالمين
