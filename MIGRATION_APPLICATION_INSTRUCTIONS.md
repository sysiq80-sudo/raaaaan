# تطبيق Migration متقدم الحجوزات 🚀
## Step-by-Step Instructions

لأن npm و Docker Desktop لا يعملان حالياً، سنطبق Migration يدوياً عبر Supabase Cloud Dashboard

---

## 📋 الخطوات:

### 1️⃣ الدخول إلى Supabase Dashboard
```
https://supabase.com/dashboard/projects
```
- اختر المشروع: **wgolkcztdrwdphwjvqxt**

### 2️⃣ اذهب إلى SQL Editor
- من القائمة اليسرى: **SQL Editor** (أو **Database** → **SQL**)

### 3️⃣ إنشاء Query جديدة
- اضغط **+ New Query** أو **+ New SQL Query**
- أو اختر **New** → **SQL snippet**

### 4️⃣ انسخ الملف بالكامل
افتح الملف:
```
supabase/APPLY_MIGRATION_MANUALLY.sql
```

انسخ **كل المحتوى** (الكل بالمتمة)

### 5️⃣ الصق في SQL Editor
```
Ctrl+A → Delete existing content
Ctrl+V → Paste the migration SQL
```

### 6️⃣ شغّل الـ Query
اضغط الزر الأزرق **▶️ Run** في الأسفل اليمين

---

## ✅ التحقق من النجاح

بعد تشغيل الـ Query بنجاح:

### Check 1: تحقق من الأعمدة الجديدة
```sql
-- انسخ هذا في SQL Editor جديدة
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rides' 
AND column_name IN ('scheduled_at', 'stops', 'prefer_women_driver', 'trip_type')
ORDER BY column_name;
```

### Check 2: تحقق من scheduled_rides
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'scheduled_rides' 
AND column_name IN ('trip_type', 'return_at', 'stops', 'driver_id', 'group_id')
ORDER BY column_name;
```

### Check 3: تحقق من الدوال
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'accept_scheduled_ride%'
   OR routine_name LIKE 'confirm_scheduled_ride%'
   OR routine_name LIKE 'cancel_scheduled_ride%';
```

### Check 4: تحقق من الـ Indexes
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('scheduled_rides', 'rides')
AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

---

## 🚨 في حال حدوث خطأ:

### خطأ: "column already exists"
```
لا مشكلة! هذا يعني أن الأعمدة موجودة بالفعل
استمر بالـ Query التالية
```

### خطأ: "function already exists"
```
طبيعي! الدوال تُستبدل تلقائياً
لا توقف الـ Query
```

### خطأ: "Constraint violation"
```
تأكد من أن جداول drivers و scheduled_rides موجودة
اطلب المساعدة إن استمرت المشكلة
```

---

## 📊 بعد النجاح:

### 1. استنساخ التغييرات محلياً
بعد تطبيق Migration في السحابة، استنسخ التغييرات محلياً:

```bash
npm run generate:types
# أو
supabase gen types typescript --project-id wgolkcztdrwdphwjvqxt > types_new.ts
```

### 2. تحديث ملفات TypeScript
```bash
# استبدل types في supabase/types.ts
# أو supabase/generated_types.ts
```

### 3. اختبر الواجهة
- افتح `/go` (صفحة الراكب)
- جرّب حجز رحلة متقدمة:
  - trip_type: Round trip
  - return_at: اختر موعد العودة
  - stops: أضف محطات وسيطة
  - prefer_women_driver: فعّل الخيار

---

## 🔗 الملفات المرتبطة:

- **UI Component**: `src/components/rider/ScheduleRideDialog.tsx` (جاهزة)
- **Service**: `src/hooks/useScheduledRides.ts` (جاهزة)
- **Types**: `src/types/scheduled-rides.ts` (جاهزة)

---

## 🎯 المرحلة التالية (بعد تطبيق Migration):

- [ ] 1. تطبيق Migration ✅ (أنت الآن هنا)
- [ ] 2. بناء Driver Scheduled Rides Board
- [ ] 3. بناء Driver Confirmation Screens
- [ ] 4. Integration Testing
- [ ] 5. End-to-End Testing

---

**الحالة**: ⏳ في انتظار تطبيق Migration  
**Project ID**: wgolkcztdrwdphwjvqxt  
**Region**: الشرق الأوسط 🇮🇶

بعد الانتهاء، أرسل لي "✅ تم تطبيق Migration" لنستمر للخطوة التالية!
