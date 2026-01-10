# تعليمات Copilot لتطبيق ران RAAN

## 📌 قواعد حماية أساسية (CRITICAL)

### 🚨 قبل أي عملية Git:
- **يُمنع منعاً باتاً** تنفيذ أي أمر git push أو commit بدون موافقة صريحة من المطور
- **يجب** عرض التغييرات المقترحة وانتظار الموافقة قبل الـ push
- **يجب** إعلام المطور بكل تغيير مهم قبل التنفيذ
- لا تقم بإنشاء أو تعديل ملفات `.git` مباشرة

### 🗄️ قبل أي عملية حذف من قاعدة البيانات:
- **يُمنع منعاً باتاً** حذف أي بيانات من Supabase بدون موافقة صريحة
- **يجب** عرض البيانات المراد حذفها والسبب وانتظار الموافقة
- استخدم Soft Delete (تعليم كـ deleted) بدلاً من الحذف الفعلي عند الإمكان
- **استثناء**: يمكن حذف البيانات التجريبية فقط في بيئة التطوير بعد التأكيد

### ✅ عند إكمال أي مهمة:
- اكتب دائماً: **"تم الحمد لله رب العالمين"**
- قدم ملخص بسيط للتغييرات المنجزة

---

## 🏗️ معلومات المشروع

### الهوية
- **الاسم**: ران RAAN - تطبيق تاكسي عراقي ذكي
- **اللغة**: دعم كامل للعربية (RTL) مع إنجليزية وكردية
- **المرجع الرئيسي**: اقرأ `AI_MASTER_REFERENCE.md` قبل أي تعديل مهم

### التقنيات الأساسية
```
Frontend: React 18 + TypeScript + Vite
UI: Tailwind CSS + shadcn/ui + Radix UI
State: React Query (@tanstack/react-query) + Zustand
Backend: Supabase (PostgreSQL + Auth + Realtime)
Maps: Mapbox GL JS
Animation: Framer Motion
```

### هيكل المستخدمين (3 أنواع)
1. **Rider (راكب)**: يحجز الرحلات
2. **Driver (سائق)**: يقبل وينفذ الرحلات  
3. **Admin (مدير)**: يدير النظام بالكامل

---

## 📁 بنية المشروع

### المجلدات الرئيسية
```
src/
├── components/
│   ├── admin/       # 24 صفحة إدارية
│   ├── rider/       # واجهة الراكب
│   ├── driver/      # واجهة السائق
│   └── ui/          # shadcn/ui components
├── pages/           # React Router pages
├── hooks/           # Custom hooks مهمة
│   ├── useFareCalculation.ts    # حساب الأسعار
│   ├── useNearbyDrivers.ts      # السائقين القريبين
│   └── useRiderLocation.ts      # تتبع موقع الراكب
├── lib/             # مساعدات ووحدات
│   ├── supabaseConfig.ts        # إعداد Supabase
│   └── constants.ts             # الثوابت المهمة
├── stores/          # Zustand state stores
└── integrations/    # Supabase types & queries

supabase/
├── migrations/      # 75+ ملف ترحيل - لا تعدل بدون إذن
└── functions/       # Edge Functions
```

### الملفات المرجعية الحرجة
- **`AI_MASTER_REFERENCE.md`**: المرجع الشامل للمشروع (556 سطر)
- **`RIDER_FLOW_DOCUMENTATION.md`**: توثيق تدفق الراكب بالتفصيل
- **`SMART_FEATURES_README.md`**: الميزات الذكية المتقدمة

---

## 🔄 دورة حياة الرحلة (Ride Lifecycle)

### الحالات المسموحة
```
pending → accepted → arrived → in_progress → completed
   ↓         ↓         ↓           ↓
cancelled cancelled cancelled  cancelled
```

### ⚠️ قواعد حرجة:
- **لا رجوع** من `completed` أو `cancelled`
- **لا تعديل** لحقل `final_fare` بعد `completed`
- الانتقال من `pending` لـ `accepted` يتطلب سائق موافق فقط
- `in_progress` يجب أن يبدأ فقط عندما يكون السائق في موقع الانطلاق (<100م)

### الأدوار في كل حالة
| الحالة | يمكنه التعديل |
|--------|---------------|
| `pending` | راكب (إلغاء)، نظام (مطابقة السائقين) |
| `accepted` | سائق، راكب (إلغاء بغرامة) |
| `arrived` | سائق فقط |
| `in_progress` | سائق فقط |
| `completed` | **لا أحد** (للقراءة فقط) |

---

## 💰 حساب الأسعار

### المعادلة (في `useFareCalculation.ts`)
```typescript
fare = base_fare 
     + (distance_km × per_km_rate)
     + (waiting_minutes × waiting_rate)
     × vehicle_multiplier
     × surge_multiplier
```

### معاملات أنواع المركبات
```typescript
economy: 1.0      // اقتصادي
comfort: 1.3      // مريح  
premium: 1.8      // فاخر
women_only: 1.2   // نسائي
```

### ⚠️ قواعد حرجة:
- الحد الأدنى = `base_fare` (لا يمكن أقل)
- العمولة = 15% ثابتة (يعدلها Admin فقط)
- `surge_multiplier` الحد الأقصى = 2.0

---

## 🗺️ خوارزمية مطابقة السائقين

### الفلترة
```typescript
drivers WHERE
  status = 'approved' AND
  is_online = true AND
  is_available = true AND
  vehicle_type = requested_type AND
  distance < 5km (تتوسع تدريجياً)
```

### الترتيب (Priority)
1. **المسافة**: الأقرب أولاً
2. **التقييم**: الأعلى تقييماً
3. **التوزيع العادل**: الأقل رحلات اليوم

### آلية الإرسال
- محاولة 1: أقرب سائق (مهلة 20 ثانية)
- محاولة 2-5: السائقين التاليين
- بعد 5 محاولات: إلغاء تلقائي + إشعار الراكب

---

## 🔐 Row Level Security (RLS)

### القاعدة الذهبية
**كل جدول محمي بـ RLS** - المستخدم يرى بياناته فقط، Admin يرى الكل

### أمثلة RLS
```sql
-- الراكب يرى رحلاته فقط
CREATE POLICY "riders_own_rides" ON rides
  FOR SELECT USING (rider_id = auth.uid());

-- السائق يرى الرحلات المخصصة له أو المتاحة
CREATE POLICY "drivers_see_assigned" ON rides
  FOR SELECT USING (
    driver_id = auth.uid() OR 
    (status = 'pending' AND auth.uid() IN (SELECT user_id FROM drivers))
  );
```

### ⚠️ لا تعطل RLS أبداً بدون موافقة!

---

## 🎨 الأنماط والاتفاقيات

### تسمية المكونات
```typescript
// ✅ صحيح
RiderHomeCustom.tsx
useDriverNotifications.ts
AdminDashboard.tsx

// ❌ خطأ
rider-home-custom.tsx
usedriver-notifications.ts
```

### Supabase Queries
```typescript
// ✅ استخدم React Query دائماً
const { data } = useQuery({
  queryKey: ['rides', rideId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();
    if (error) throw error;
    return data;
  }
});

// ❌ لا تستخدم useEffect مع fetch مباشر
```

### معالجة الأخطاء
```typescript
// ✅ صحيح
try {
  const { data, error } = await supabase.from('rides').insert(ride);
  if (error) {
    console.error('Ride creation failed:', error);
    toast.error('فشل إنشاء الرحلة');
    return;
  }
  toast.success('تم إنشاء الرحلة بنجاح');
} catch (err) {
  console.error('Unexpected error:', err);
}
```

### التعليقات
```typescript
// ✅ استخدم العربية في التعليقات المهمة
// هذا الكود يحسب الأجرة النهائية مع العمولة
const finalFare = baseFare * 0.85; // خصم 15% عمولة

// ✅ لكن أسماء المتغيرات بالإنجليزية
const fareBreakdown = calculateFare();
```

---

## 🧪 الاختبار والتطوير

### البيئات
```bash
# Development (مع Supabase المحلي)
npm run dev

# Build للإنتاج
npm run build

# Preview
npm run preview
```

### ⚠️ قواعد البيئات:
- لا تعدل متغيرات الإنتاج في `.env` بدون موافقة
- استخدم Supabase محلي للاختبارات الكبيرة
- لا تدفع API keys في الكود

---

## 🚫 ممنوعات صارمة

### ❌ لا تفعل أبداً:
1. تعديل `supabase/migrations/` بدون مراجعة
2. تغيير schema قاعدة البيانات مباشرة
3. تعطيل RLS على أي جدول
4. حذف بيانات إنتاج بدون backup
5. نشر credentials في Git
6. تجاوز معادلة حساب الأسعار
7. تعديل حالة رحلة مكتملة
8. منح صلاحيات Admin بدون تدقيق

### ⚠️ يتطلب موافقة:
1. إضافة migration جديد
2. تعديل Edge Functions
3. تغيير قواعد التسعير
4. إضافة حقول لجدول `rides`
5. تعديل خوارزمية المطابقة
6. push لـ main branch

---

## 📚 موارد مهمة

### للفهم السريع، اقرأ بالترتيب:
1. `AI_MASTER_REFERENCE.md` (الأساس)
2. `RIDER_FLOW_DOCUMENTATION.md` (تدفق الراكب)
3. `src/lib/supabaseConfig.ts` (إعداد Supabase)
4. `src/hooks/useFareCalculation.ts` (حساب الأسعار)

### للتعديلات الشائعة:
- **إضافة صفحة**: انظر `src/App.tsx` للـ routing
- **تعديل UI**: استخدم مكونات `src/components/ui/`
- **إضافة حالة**: استخدم Zustand أو React Query
- **تعديل خريطة**: راجع `src/components/Map.tsx`

---

## 🎯 سير العمل الموصى به

### عند استلام مهمة جديدة:
1. ✅ اقرأ `AI_MASTER_REFERENCE.md` إذا كانت المهمة مهمة
2. ✅ افهم السياق من الملفات ذات الصلة
3. ✅ تأكد من الأنماط المستخدمة في ملفات مشابهة
4. ✅ اكتب الكود بطريقة متسقة
5. ✅ اختبر التغييرات محلياً
6. ✅ **اطلب الموافقة** قبل Git operations
7. ✅ اكتب "تم الحمد لله رب العالمين" عند الانتهاء

### عند مواجهة غموض:
1. ✅ **اسأل المطور** قبل التخمين
2. ✅ راجع الكود المشابه في المشروع
3. ✅ تحقق من التوثيق المرجعي
4. ✅ اقترح الحل وانتظر الموافقة

---

## 📞 ملاحظات مهمة

- **الأولوية للأمان**: لا تضحِ بالأمان من أجل السرعة
- **التوثيق أولاً**: إذا لم تفهم، اقرأ التوثيق قبل التعديل
- **الاتساق مهم**: اتبع نفس الأنماط الموجودة
- **العربية مهمة**: كل النصوص للمستخدم يجب أن تكون بالعربية
- **RTL دائماً**: التطبيق موجه من اليمين لليسار

---

**آخر تحديث**: 2026-01-10  
**الإصدار**: 1.0.0

**والحمد لله رب العالمين** 🤲
