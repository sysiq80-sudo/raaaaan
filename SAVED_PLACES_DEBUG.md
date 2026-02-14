# 🔍 استكشاف أخطاء الأماكن المحفوظة

## المشكلة المُبلغ عنها

"لا توجد أماكن محفوظة" - الحفظ لا يعمل

---

## 🧪 خطوات التشخيص

### 1. افتح Console في المتصفح (F12)

افتح **Developer Tools** → **Console** وابحث عن:

#### عند تحميل الصفحة:

```
LocationSearchInput - userId: <user-id-here>
fetchSavedPlaces: Fetching for userId: <user-id>
fetchSavedPlaces: Success, found X places
```

**إذا ظهر**:

- ✅ `userId: "..."` (UUID صحيح) → المستخدم مسجل دخول
- ❌ `userId: null` → **مشكلة**: المستخدم غير مسجل دخول
- ❌ `No userId provided` → userId لا يتم تمريره من GoPage

#### عند الضغط على زر النجمة ⭐:

```
===== toggleSavePlace START =====
userId: <user-id>
result: { name: "...", lat: X, lng: Y, ... }
Set savingPlaceId to: ...
Checking if place already exists...
Check existing result: null (أو object إذا موجود)
Inserting new place...
Place data: { user_id: "...", name: "...", ... }
Insert successful: [{ id: "...", ... }]
Refreshing saved places...
===== toggleSavePlace END (SUCCESS) =====
```

---

## 🚨 الأخطاء الشائعة وحلولها

### خطأ 1: `userId: null`

**السبب**: المستخدم غير مسجل دخول أو session منتهية

**الحل**:

1. سجل خروج ثم دخول مرة أخرى
2. تحقق من أن `useRiderData()` hook يعيد userId صحيح
3. افحص Supabase Auth في Application → Local Storage

---

### خطأ 2: RLS Policy Error

```
{
  code: "42501",
  message: "new row violates row-level security policy"
}
```

**السبب**: المستخدم لا يملك صلاحيات Insert/Select

**الحل**: شغّل الـ SQL التالي في Supabase SQL Editor:

```sql
-- Check current user
SELECT auth.uid() as my_user_id;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'saved_places';

-- Test insert manually
INSERT INTO saved_places (user_id, name, label, address, lat, lng, icon)
VALUES (
  auth.uid(),
  'تجربة',
  'favorite',
  'موقع تجريبي',
  33.3152,
  44.3661,
  '📍'
);

-- If successful, check result
SELECT * FROM saved_places WHERE user_id = auth.uid();
```

---

### خطأ 3: `PGRST116` - No rows found

**ليس خطأ!** هذا يعني المكان غير محفوظ مسبقاً (سيتم إضافته)

---

### خطأ 4: `Insert error: { ... }`

**الأسباب المحتملة**:

1. حقل `label` غير صحيح (يجب: home, work, favorite, other)
2. `lat` أو `lng` ليس رقم صحيح
3. `user_id` لا يشير لمستخدم موجود

**الحل**: تحقق من بيانات `placeToInsert` في Console

---

## ✅ اختبار يدوي في Supabase

### 1. افتح Supabase Dashboard

- اذهب إلى **SQL Editor**

### 2. شغّل الاختبار:

```sql
-- Use the SQL file created: test_saved_places.sql
-- Or run these commands:

-- 1. Check your user_id
SELECT auth.uid();

-- 2. Insert test place
INSERT INTO saved_places (user_id, name, label, address, lat, lng, icon)
VALUES (
  auth.uid(),
  'منزلي',
  'home',
  'شارع الكندي، بغداد',
  33.3152,
  44.3661,
  '🏠'
);

-- 3. Verify it was added
SELECT * FROM saved_places WHERE user_id = auth.uid();

-- 4. Delete test data
DELETE FROM saved_places WHERE user_id = auth.uid() AND name = 'منزلي';
```

### 3. النتيجة المتوقعة:

- ✅ يجب أن يتم الـ Insert بنجاح
- ✅ يجب أن تظهر البيانات في SELECT
- ❌ إذا فشل → مشكلة في RLS أو Auth

---

## 🔧 فحص RLS Policies

```sql
-- Check all policies for saved_places
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'saved_places';
```

**يجب أن تظهر 4 policies**:

1. `Users can view their own saved places` (SELECT)
2. `Users can insert their own saved places` (INSERT)
3. `Users can update their own saved places` (UPDATE)
4. `Users can delete their own saved places` (DELETE)

كل policy يجب أن تحتوي على:

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)  -- للـ INSERT/UPDATE
```

---

## 📱 اختبار في التطبيق

### الخطوات:

1. سجل دخول كراكب
2. اذهب إلى `/rider`
3. اضغط على حقل "موقع الانطلاق"
4. ابحث عن أي موقع (مثلاً: "الكرادة")
5. مرر الماوس على النتيجة → يجب أن تظهر النجمة ⭐
6. اضغط النجمة
7. انتظر Toast: "تم الحفظ ✨"
8. أغلق الـ overlay وافتح مرة أخرى
9. يجب أن تظهر في قسم "أماكني المحفوظة"

---

## 🐛 إذا استمرت المشكلة

### أرسل لي:

1. Screenshot من Console (F12)
2. نتيجة هذا الـ SQL:

```sql
SELECT auth.uid() as my_user_id;
SELECT COUNT(*) FROM saved_places WHERE user_id = auth.uid();
```

3. أي رسائل خطأ في Console

---

## 📝 ملاحظات مهمة

- **userId يجب أن يكون UUID صحيح** (مثل: `f47ac10b-58cc-4372-a567-0e02b2c3d479`)
- **RLS policies يجب أن تكون مفعلة** على جدول `saved_places`
- **المستخدم يجب أن يكون مسجل دخول** في Supabase Auth
- **كل الـ logs تبدأ بـ** `fetchSavedPlaces:` أو `toggleSavePlace`

---

**الحمد لله رب العالمين** 🤲
