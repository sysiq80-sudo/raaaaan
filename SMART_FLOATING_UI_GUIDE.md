# دليل نظام "الأيقونة العائمة الذكية" (Smart Floating UI) 🎯

## 📋 نظرة عامة

تم تطوير نظام جديد لواجهة السائق أثناء الرحلات النشطة، يوفر:
- ✅ **Floating Trip Bubble**: أيقونة دائرية عائمة قابلة للسحب
- ✅ **Smart Notifications**: نظام إشعارات مع Badge
- ✅ **External Navigation**: اختيار بين الملاحة الداخلية والخارجية
- ✅ **Full Map View**: تحرير مساحة الخريطة الكاملة

---

## 🎨 المكونات الجديدة

### 1. FloatingTripBubble Component
**المسار**: `src/components/driver/FloatingTripBubble.tsx`

#### المميزات:
- **الأيقونة العائمة**:
  - شكل دائري بتدرج لوني (emerald-500 إلى emerald-600)
  - شعار التطبيق في الوسط
  - قابلة للسحب في أي مكان على الشاشة
  - حركة دالة (animation pulse) تدل على إمكانية التوسيع

- **نظام الإشعارات**:
  - Badge حمراء تعرض عدد الإشعارات (1-9+)
  - تحديث فوري عند وصول رسائل جديدة
  - موضع مميز في أعلى الأيقونة

- **الأزرار السريعة** (عند التصغير):
  - 🔵 **زر الاتصال**: اتصال هاتفي بالراكب
  - 🟣 **زر الدردشة**: فتح محادثة الرايدر
  - 🔴 **زر الإلغاء**: إلغاء الرحلة

- **الوضع الموسّع**:
  - بطاقة كاملة في الأسفل مع gradient
  - معلومات الراكب (الاسم، التقييم)
  - محتوى الرحلة الكامل
  - زر تصغير للعودة للأيقونة

#### الاستخدام:
```tsx
<FloatingTripBubble
  isMinimized={isMinimized}
  onToggleMinimize={() => setIsMinimized(false)}
  notificationCount={notificationCount}
  onCallClick={handleCall}
  onChatClick={handleChat}
  onCancelClick={handleCancel}
  passengerName={riderName}
  passengerRating={riderRating}
>
  {/* محتوى البطاقة الموسّعة */}
</FloatingTripBubble>
```

#### Props:
```typescript
interface FloatingTripBubbleProps {
  isMinimized: boolean;                    // حالة التصغير
  onToggleMinimize: () => void;           // عند الضغط للتوسيع
  notificationCount: number;               // عدد الإشعارات
  onCallClick: () => void;                // عند الضغط على زر الاتصال
  onChatClick: () => void;                // عند الضغط على زر الدردشة
  onCancelClick: () => void;              // عند الضغط على زر الإلغاء
  children: React.ReactNode;               // محتوى البطاقة الموسّعة
  passengerName: string;                   // اسم الراكب
  passengerRating?: number;                // تقييم الراكب
}
```

---

### 2. ExternalNavigationModal Component
**المسار**: `src/components/driver/ExternalNavigationModal.tsx`

#### المميزات:
- **تبويبان رئيسيان**:
  1. **الملاحة الداخلية**: توسيع الخريطة داخل التطبيق
  2. **الملاحة الخارجية**: اختيار تطبيق خارجي

- **خيارات الملاحة الخارجية**:
  - 🗺️ **Google Maps**: الملاحة الدقيقة والموثوقة
  - 🚗 **Waze**: التنقل الذكي مع تحديثات المرور
  - 🍎 **Apple Maps**: (للأجهزة Apple فقط)

- **التصميم**:
  - واجهة داكنة (Dark Theme)
  - وصف واضح لكل خيار
  - زر إغلاق شامل

#### الاستخدام:
```tsx
<ExternalNavigationModal
  isOpen={showNavigationModal}
  onClose={() => setShowNavigationModal(false)}
  lat={navigationDestination?.lat || 0}
  lng={navigationDestination?.lng || 0}
  onInternalNavigation={() => handleInternalNav()}
  destinationLabel="الوجهة"
/>
```

#### Props:
```typescript
interface ExternalNavigationModalProps {
  isOpen: boolean;                        // عرض/إخفاء Modal
  onClose: () => void;                   // عند الإغلاق
  lat: number;                           // خط العرض
  lng: number;                           // خط الطول
  onInternalNavigation?: () => void;    // عند اختيار الملاحة الداخلية
  destinationLabel?: string;             // تسمية الوجهة
}
```

---

### 3. تحديثات ActiveRideCard Component
**المسار**: `src/components/driver/ActiveRideCard.tsx`

#### الإضافات الجديدة:
- **زر التصغير** في الـ header:
  - أيقونة ناقص (−) لتصغير البطاقة
  - يحول الرحلة إلى Floating Bubble

- **دعم الملاحة الخارجية**:
  ```tsx
  onNavigationClick={(lat, lng, label) => {
    setNavigationDestination({ lat, lng });
    setShowNavigationModal(true);
  }}
  ```

#### Props المحدثة:
```typescript
interface ActiveRideCardProps {
  driverId: string;
  driverLocation?: { lat: number; lng: number } | null;
  onMinimize?: () => void;               // عند الضغط على زر التصغير
  onNavigationClick?: (lat, lng, label) => void;  // عند الملاحة
}
```

---

### 4. تحديثات NavigationButton Component
**المسار**: `src/components/driver/NavigationButton.tsx`

#### الإضافات:
- **دعم Modal الملاحة**:
  - تمرير `onOpenModal` callback
  - عند توفير callback، يتم فتح Modal بدلاً من الملاحة المباشرة
  - الزر الثاني (Dropdown) يختفي عند وجود Modal

#### Props الجديدة:
```typescript
interface NavigationButtonProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
  size?: "default" | "compact";
  onOpenModal?: (lat: number, lng: number) => void;  // جديد
}
```

---

## 🔄 تدفق العمل

### الحالة 1: عرض الرحلة النشطة (Normal View)
```
1. السائق يرى بطاقة الرحلة الكاملة في الأسفل
2. الخريطة تحتل معظم الشاشة
3. شريط الحالة يبقى في الأعلى (Always Available)
```

### الحالة 2: تصغير البطاقة (Minimized View)
```
1. السائق يضغط على زر التصغير (−)
2. البطاقة تحول إلى أيقونة دائرية عائمة
3. الخريطة تأخذ مساحة 100% من الشاشة
4. الأيقونة قابلة للسحب في أي مكان
```

### الحالة 3: فتح Modal الملاحة
```
1. السائق يضغط على زر الملاحة
2. يظهر Modal بخيارين:
   - الملاحة الداخلية (توسيع الخريطة)
   - الملاحة الخارجية (اختيار التطبيق)
3. عند الاختيار، ينغلق Modal ويتم التنفيذ
```

---

## 🎯 حالات الاستخدام

### ✅ للسائق - الرؤية الأفضل:
- تصغير البطاقة للحصول على رؤية 100% للخريطة
- القيادة بأمان مع بيانات الراكب المتاحة بسرعة
- الوصول السريع للاتصال والدردشة من الأيقونة

### ✅ للسائق - الملاحة المرنة:
- اختيار الملاحة الداخلية للبقاء في التطبيق
- اختيار الملاحة الخارجية لدقة أفضل من تطبيق متخصص
- حفظ التطبيق المفضل تلقائياً

### ✅ للنظام - المرونة:
- شريط الحالة يبقى متاحاً دائماً
- إمكانية إيقاف استقبال الطلبات حتى أثناء الرحلة
- الإشعارات تصل مباشرة على الأيقونة

---

## 📱 الحالات المختلفة

### 1. رحلة في حالة "accepted"
- البطاقة: عنوان الانطلاق + زر "وصلت"
- الأيقونة: تصغير متاح ✅
- الملاحة: ملاحة للعميل

### 2. رحلة في حالة "arrived"
- البطاقة: انتظار العميل + رسائل سريعة
- الأيقونة: تصغير متاح ✅
- الملاحة: ملاحة للعميل

### 3. رحلة في حالة "in_progress"
- البطاقة: الوجهة + توقيت الرحلة
- الأيقونة: تصغير متاح ✅
- الملاحة: ملاحة للوجهة

---

## 🔧 التكامل مع DriverHome

### الحالات الجديدة في DriverHome:
```typescript
const [isMinimized, setIsMinimized] = useState(false);
const [showNavigationModal, setShowNavigationModal] = useState(false);
const [navigationDestination, setNavigationDestination] = useState<{ lat: number; lng: number } | null>(null);
const [notificationCount, setNotificationCount] = useState(0);
```

### الـ Layout الجديد:
```
┌─────────────────────────────────────┐
│  Header (Always Visible)             │ ← شريط الحالة
├─────────────────────────────────────┤
│                                      │
│    Full Map View (100%)              │ ← الخريطة كاملة
│                                      │
├─────────────────────────────────────┤
│  Bottom Card (OR Floating Bubble)    │ ← بطاقة أو أيقونة
└─────────────────────────────────────┘
```

---

## 🎨 الألوان والأيقونات

### FloatingTripBubble:
- **الأيقونة الرئيسية**: Emerald (Emerald-500 إلى Emerald-600)
- **Badge الإشعارات**: Red
- **زر الاتصال**: Blue
- **زر الدردشة**: Purple
- **زر الإلغاء**: Red

### ExternalNavigationModal:
- **الخلفية**: Dark (Slate-900)
- **النصوص**: White/Gray
- **الأزرار**: Slate-800 مع Hover

---

## 📊 الأداء

### التحسينات:
- ✅ تقليل حجم DOM عند التصغير
- ✅ رسومات محدودة على الأيقونة العائمة
- ✅ تحميل Modal عند الحاجة فقط
- ✅ عدم إعادة تحميل الخريطة عند التصغير

### الحد الأدنى للموارد:
- Floating Bubble: ~5KB CSS
- Modal: ~3KB CSS
- JavaScript: Framer Motion animations

---

## 🧪 الاختبار

### نقاط الاختبار الرئيسية:
1. ✅ زر التصغير يعمل بسلاسة
2. ✅ الأيقونة قابلة للسحب بسهولة
3. ✅ الإشعارات تظهر بشكل صحيح
4. ✅ Modal الملاحة يعمل على جميع الأجهزة
5. ✅ اختيار التطبيق الخارجي يتم حفظه
6. ✅ الخريطة تأخذ 100% المساحة عند التصغير
7. ✅ شريط الحالة يبقى متاحاً دائماً

---

## 🚀 الاستخدام في الإنتاج

### التفعيل:
```typescript
// في DriverHome.tsx
<ActiveRideCard
  driverId={driverId}
  driverLocation={currentLocation}
  onMinimize={() => setIsMinimized(true)}
  onNavigationClick={(lat, lng, label) => {
    setNavigationDestination({ lat, lng });
    setShowNavigationModal(true);
  }}
/>
```

### التحكم في الإشعارات:
```typescript
// عند استقبال رسالة من الراكب
setNotificationCount(prev => prev + 1);

// عند فتح الدردشة/الاتصال
setNotificationCount(0);
```

---

## 📝 الملاحظات المهمة

⚠️ **يجب الانتباه**:
1. الأيقونة العائمة تبقى قابلة للسحب حتى داخل صفحات أخرى
2. الإشعارات لا تُحذف تلقائياً (يجب حذفها يدوياً)
3. تطبيقات الملاحة الخارجية قد لا تعود للتطبيق تلقائياً
4. يجب حفظ موقع الأيقونة في localStorage للجلسات اللاحقة

---

## ✅ الحالة الحالية

- ✅ FloatingTripBubble: مكتمل وفعال
- ✅ ExternalNavigationModal: مكتمل وفعال
- ✅ NavigationButton: محدثة وتدعم Modal
- ✅ ActiveRideCard: تم إضافة زر التصغير والملاحة
- ✅ DriverHome: تم دمج جميع المكونات
- ✅ البناء: نجح بدون أخطاء

---

## تم الحمد لله رب العالمين 🤲

تم تطوير نظام "الأيقونة العائمة الذكية" بنجاح! 🎉

**التاريخ**: فبراير 1، 2026
**الإصدار**: 1.0.0
