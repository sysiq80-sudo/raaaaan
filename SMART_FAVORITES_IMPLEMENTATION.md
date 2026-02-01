# 💚 نظام الأماكن المفضلة (Smart Favorites System)

## 📋 نظرة عامة

تم تنفيذ نظام شامل للأماكن المفضلة يسمح للمستخدمين (الركاب) بحفظ الأماكن المهمة وسهولة الوصول إليها وعرضها على الخريطة.

## ✨ الميزات المنفذة

### 1. **حفظ الأماكن المفضلة** ❤️
- إضافة أيقونة قلب في حقول الموقع (موقع الانطلاق والوجهة)
- عند الضغط على القلب الفارغ:
  - يظهر القلب بلون أخضر ممتلئ
  - يتم فتح Modal لتسمية وتصنيف المكان
  - يتم حفظ المكان تلقائياً في `localStorage`

### 2. **Modal لتسمية الأماكن** 🏷️
- اختيار فئة للمكان (Home, Work, Cafe, Gym, Diwaniya, Car Wash)
- إدخال اسم مخصص للمكان (مثال: "بيتي", "عملي بالشارع الفلاني")
- عرض معاينة للمكان قبل الحفظ
- أيقونة emoji مختلفة لكل فئة

### 3. **عرض الأماكن المحفوظة على الخريطة** 🗺️
- Markers خضراء خاصة بالأماكن المفضلة
- عند الضغط على marker يظهر:
  - اسم المكان
  - الفئة (emoji)
  - العنوان الكامل
- عند الضغط على marker يتم تحديد المكان كموقع للبحث

### 4. **شريط الوصول السريع** 🚀
- Chips أفقية قابلة للتمرير تحت حقول الموقع
- تعرض جميع الأماكن المفضلة بترتيب الحفظ
- لون أخضر مميز مع أيقونة قلب
- عند الضغط على chip يتم:
  - تحديد الموقع على الخريطة
  - تكبير الخريطة (zoom 16)
  - تحديد المكان تلقائياً كموقع

## 📁 الملفات المنشأة

### 1. **Store - `src/stores/useFavoritesStore.ts`**
```typescript
// Zustand store مع persistence في localStorage
- addFavorite(location): إضافة مكان جديد
- removeFavorite(id): حذف مكان
- updateFavorite(id, location): تحديث مكان
- isFavorite(lat, lng): التحقق من وجود مكان
- getFavoritesByIcon(icon): الحصول على الأماكن بفئة معينة
```

### 2. **Modal - `src/components/rider/SaveLocationModal.tsx`**
- Dialog component لتسمية وتصنيف الأماكن
- شبكة اختيار الفئات (6 خيارات)
- حقل إدخال اسم مخصص
- معاينة المكان قبل الحفظ

### 3. **Input Field - `src/components/rider/LocationInputField.tsx`**
- حقل الموقع محسّن بأيقونة قلب
- تبديل بين قلب فارغ/ممتلئ
- زر مسح الموقع
- معالجة فتح Modal عند الحفظ الأول

### 4. **Chips Component - `src/components/rider/QuickAccessChips.tsx`**
- شريط أفقي قابل للتمرير
- عرض الأماكن المحفوضة كـ chips
- لون أخضر مميز
- رموز emoji لكل فئة

### 5. **Markers Layer - `src/components/rider/FavoriteMarkersLayer.tsx`**
- مكون عرض الـ markers على الخريطة
- markers خضراء بـ emoji لكل مكان
- InfoWindow مخصص عند النقر
- معالجة إضافة/حذف markers ديناميكياً

## 🎨 ألوان وتصميم

- **Primary Green**: `#22c55e` (green-600)
- **Light Green**: `#bbf7d0` (green-200)
- **Icon Color**: رموز emoji مختلفة لكل فئة
- **RTL**: جميع المكونات تدعم RTL (اتجاه يمين لليسار)

## 🔄 آلية العمل

### دورة حفظ مكان جديد:

```
1. المستخدم يختار موقع على الخريطة
2. يظهر حقل الموقع مع:
   - عنوان الموقع
   - أيقونة قلب فارغة
3. عند الضغط على القلب:
   - يتحول لأخضر ممتلئ
   - يظهر Modal للتسمية
4. المستخدم يختار فئة (مثل: منزل، عمل، مقهى)
5. المستخدم يدخل اسماً مخصصاً (اختياري)
6. عند الحفظ:
   - يتم حفظ في localStorage
   - يظهر marker أخضر على الخريطة
   - يضاف chip للشريط السريع
```

### دورة استخدام مكان مفضل:

```
Option A: عن طريق الـ Chips
1. المستخدم يرى الأماكس المفضلة كـ chips
2. يضغط على chip المطلوب
3. يتم تحديث الخريطة وتحديد الموقع

Option B: عن طريق الـ Markers على الخريطة
1. المستخدم يضغط على marker أخضر
2. يظهر معلومات المكان
3. يضغط على infowindow أو marker
4. يتم تحديد الموقع
```

## 💾 البيانات المخزنة

```typescript
interface FavoriteLocation {
  id: string;                    // معرّف فريد
  name: string;                  // اسم مخصص
  address: string;               // العنوان الكامل
  lat: number;                   // خط العرض
  lng: number;                   // خط الطول
  icon: 'home' | 'work' | 'cafe' | 'gym' | 'diwaniya' | 'carwash' | 'other';
  createdAt: number;             // الطابع الزمني
  color?: string;                // اللون (اختياري)
}
```

## 🔒 التخزين

- **Storage**: `localStorage` مع مفتاح `'favorites-storage'`
- **Persistence**: التخزين يتم تلقائياً وينقل بين الجلسات
- **Sync**: كل تحديث يحفظ تلقائياً في localStorage

## 📱 التكامل مع GoPage

### Imports:
```typescript
import LocationInputField from "@/components/rider/LocationInputField";
import QuickAccessChips from "@/components/rider/QuickAccessChips";
import FavoriteMarkersLayer from "@/components/rider/FavoriteMarkersLayer";
```

### الاستخدام في JSX:
```tsx
{/* Location Input Field */}
<LocationInputField
  label={isPickup ? "موقع الانطلاق" : "الوجهة"}
  value={buildDescriptiveAddress(centerAddress || "") || ""}
  address={buildDescriptiveAddress(centerAddress || "") || ""}
  lat={userLocation?.lat}
  lng={userLocation?.lng}
  onClear={() => setCenterAddress(null)}
  isPickup={isPickup}
/>

{/* Quick Access Chips */}
{isPickup && (
  <QuickAccessChips
    onSelectLocation={(lat, lng, address) => {
      // تحديث الخريطة والموقع
    }}
  />
)}

{/* Favorite Markers on Map */}
{map && !isPickup && (
  <FavoriteMarkersLayer
    map={map}
    onMarkerClick={(id, lat, lng, address) => {
      // معالجة النقر على marker
    }}
  />
)}
```

## ⚙️ المعالجات الآلية

### حذف المكان المفضل:
- عند الضغط على القلب الممتلئ مرة أخرى يتم حذف المكان
- يختفي من localStorage والخريطة والـ chips تلقائياً

### تحديث الـ Markers:
- كل تغيير في `useFavoritesStore` يحدّث الـ markers تلقائياً
- حذف marker عند حذف المكان
- إضافة marker عند إضافة مكان جديد

## 📊 الحالات الخاصة

### عندما لا توجد أماكن مفضلة:
- لا يظهر شريط الـ chips
- لا توجد markers على الخريطة
- الواجهة تعمل بشكل طبيعي

### عندما يكون هناك مكان واحد:
- يظهر chip واحد فقط
- marker واحد على الخريطة

### RTL Support:
- جميع المكونات تدعم الاتجاه من اليمين لليسار
- أيقونات القلب على اليسار (للمحاذاة مع RTL)
- النصوص تُعرض بالعربية

## 🚀 الأداء

- **localStorage**: تخزين فعّال بدون طلبات API
- **Markers Layer**: تحديثات ديناميكية بكفاءة عالية
- **Chips**: rendering محسّن مع useMemo
- **Memory**: تنظيف تلقائي عند الـ unmount

## 🔮 ميزات مستقبلية محتملة

- 📊 إحصائيات استخدام الأماكن (الأكثر استخداماً)
- 🏙️ تجميع الأماكن حسب المدينة
- 🔄 مزامنة مع Supabase (بدلاً من localStorage فقط)
- 📍 تنبيهات عند القرب من مكان محفوظ
- 🏷️ تصنيفات مخصصة إضافية

## ✅ الحالة الحالية

✅ **مكتمل**: جميع الميزات الأساسية جاهزة للاستخدام
- Store + Persistence: ✅ نشط
- UI Components: ✅ مدمج
- Map Integration: ✅ فعّال
- RTL Support: ✅ مفعّل

---

**آخر تحديث**: 2025-01-20
**الحالة**: Production Ready ✅
