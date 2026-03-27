# نظام المحافظات للمعالم الجغرافية

## 📋 ملخص التحديثات

تم إضافة نظام المحافظات العراقية الكامل لتطبيق ران RAAN لتمكين ربط المعالم الجغرافية بالمحافظات الـ 18.

## 🗄️ التحديثات على قاعدة البيانات

### Migration الجديد

📁 `supabase/migrations/20260113_add_governorates.sql`

**التغييرات:**

1. ✅ إنشاء جدول `governorates` مع 18 محافظة عراقية
2. ✅ إضافة عمود `governorate_id` إلى جدول `landmarks`
3. ✅ RLS policies للأمان
4. ✅ Indexes للأداء
5. ✅ بيانات المحافظات (الأسماء بالعربي/إنجليزي/كردي، الإحداثيات، المساحة، عدد السكان)

**المحافظات المدرجة:**

- بغداد، البصرة، نينوى، الأنبار، أربيل، صلاح الدين، ديالى، ذي قار
- واسط، كركوك، بابل، كربلاء، ميسان، القادسية، النجف، المثنى، دهوك، السليمانية

### خطوات التطبيق

```bash
# شغّل الـ migration في Supabase SQL Editor:
1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. انسخ محتوى supabase/migrations/20260113_add_governorates.sql
4. شغّله
```

## 📊 ملف CSV المحدث

📁 `data/landmarks_simple.csv`

**التحديثات:**

- ✅ إضافة عمود `governorate`
- ✅ 14 معلم في أربيل مرتبطة بمحافظة أربيل
- ✅ 17 معلم في الأنبار (الرمادي، الفلوجة، القائم)
- ✅ إحداثيات صحيحة ومدققة

**الأعمدة:**

```
name_ar, name_en, name_ku, category, lat, lng, address_ar, phone_numbers, governorate
```

## 🎨 تحديثات واجهة المستخدم

### 1. صفحة إدارة المعالم `AdminLandmarks.tsx`

**التحديثات:**

- ✅ إضافة state `governorates` و `governorateFilter`
- ✅ دالة `fetchGovernorates()` لجلب المحافظات
- ✅ فلتر جديد "المحافظة" بجانب فلتر المناطق
- ✅ تحديث `filteredLandmarks` ليشمل الفلترة حسب المحافظة
- ✅ عرض اسم المحافظة في بطاقات المعالم (Card view)
- ✅ عرض المحافظة في الجدول (Table view)

### 2. نافذة إضافة معلم `AddLandmarkDialog.tsx`

**التحديثات:**

- ✅ إضافة prop `governorates`
- ✅ حقل جديد `governorate_id` في formData
- ✅ Select dropdown لاختيار المحافظة
- ✅ دعم الحفظ مع governorate_id

### 3. نافذة تعديل معلم `EditLandmarkDialog.tsx`

**التحديثات:**

- ✅ إضافة prop `governorates`
- ✅ حقل `governorate_id` في formData
- ✅ Select dropdown لتعديل المحافظة
- ✅ تحديث useEffect لتحميل governorate_id عند فتح المعلم

### 4. نافذة استيراد المعالم `ImportLandmarksDialog.tsx`

**التحديثات:**

- ✅ إضافة prop `governorates`
- ✅ حقل `governorate` في ParsedLandmark interface
- ✅ قراءة عمود `governorate` من CSV
- ✅ مطابقة اسم المحافظة مع ID عند الاستيراد
- ✅ تحديث النموذج المُنزّل ليشمل عمود المحافظة

## 🔄 استخدام النظام

### الفلترة حسب المحافظة

1. افتح صفحة "إدارة المعالم" من لوحة الإدارة
2. ستجد dropdown جديد "المحافظة"
3. اختر محافظة لعرض معالمها فقط
4. يمكن الجمع مع فلاتر أخرى (التصنيف، المنطقة، الحالة)

### إضافة معلم جديد

1. اضغط "إضافة معلم جديد"
2. املأ البيانات
3. اختر المحافظة من القائمة المنسدلة
4. احفظ

### استيراد المعالم

1. اضغط "استيراد من ملف"
2. حمّل ملف `data/landmarks_simple.csv`
3. سيتم ربط كل معلم بمحافظته تلقائياً
4. راجع النتائج واضغط استيراد

## 📝 مثال على الاستخدام

```typescript
// في AdminLandmarks.tsx
const filteredLandmarks = landmarks.filter((landmark) => {
  const matchesGovernorate =
    governorateFilter === "all" ||
    landmark.governorate_id === governorateFilter;
  // ...
});
```

## ⚙️ Schema النهائي

```sql
-- جدول المحافظات
CREATE TABLE governorates (
  id UUID PRIMARY KEY,
  name_ar TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL UNIQUE,
  name_ku TEXT,
  code TEXT UNIQUE NOT NULL,
  capital_city TEXT,
  population INTEGER,
  area_km2 INTEGER,
  coordinates JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- تحديث جدول landmarks
ALTER TABLE landmarks ADD COLUMN governorate_id UUID REFERENCES governorates(id);
CREATE INDEX idx_landmarks_governorate_id ON landmarks(governorate_id);
```

## ✅ قائمة المهام المكتملة

- [x] إنشاء migration للمحافظات
- [x] إضافة governorate_id إلى landmarks
- [x] تحديث CSV بعمود المحافظة
- [x] إضافة فلتر المحافظات في AdminLandmarks
- [x] تحديث AddLandmarkDialog
- [x] تحديث EditLandmarkDialog
- [x] تحديث ImportLandmarksDialog
- [x] تحديث TypeScript interfaces

## 🎯 الخطوات التالية

1. شغّل الـ migration في Supabase
2. استورد ملف `landmarks_simple.csv`
3. جرّب الفلترة حسب المحافظة
4. أضف معالم جديدة مع ربطها بالمحافظات

**تم الحمد لله رب العالمين** 🤲
