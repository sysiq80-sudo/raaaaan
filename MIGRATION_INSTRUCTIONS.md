# تعليمات تطبيق Migration إعادة التوجيه التلقائي
**Migration File**: `20260130000000_reassign_on_driver_cancel.sql`

---

## 🎯 ما يفعله هذا Migration

عند إلغاء السائق لرحلة مقبولة:
- ✅ الرحلة تعود تلقائياً لحالة `pending`
- ✅ يتم البحث عن سائق بديل
- ✅ الراكب يحصل على إشعار
- ✅ حد أقصى 3 محاولات قبل الإلغاء النهائي

---

## 📋 خطوات التطبيق

### الطريقة 1: Supabase Dashboard (موصى بها)

1. **افتح Supabase Dashboard**:
   ```
   https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt
   ```

2. **اذهب إلى SQL Editor**:
   - من القائمة الجانبية → `SQL Editor`
   - انقر على `New Query`

3. **انسخ محتوى الملف**:
   ```bash
   # في VS Code، افتح الملف:
   supabase/migrations/20260130000000_reassign_on_driver_cancel.sql
   
   # انسخ كل المحتوى (Ctrl+A → Ctrl+C)
   ```

4. **الصق في SQL Editor وشغّل**:
   - الصق الكود في Supabase SQL Editor
   - انقر على `Run` أو اضغط `Ctrl+Enter`

5. **تحقق من النجاح**:
   يجب أن ترى:
   ```
   ✓ ALTER TABLE rides successful
   ✓ CREATE FUNCTION handle_driver_cancellation successful
   ✓ CREATE TRIGGER trigger_handle_driver_cancellation successful
   ✓ CREATE INDEX idx_rides_reassignment_count successful
   ```

---

### الطريقة 2: Supabase CLI (للمطورين)

```bash
# 1. تأكد من تثبيت Supabase CLI
npx supabase --version

# 2. Login إلى Supabase
npx supabase login

# 3. Link المشروع
npx supabase link --project-ref wgolkcztdrwdphwjvqxt

# 4. تطبيق Migration
npx supabase db push

# أو تطبيق ملف محدد
npx supabase db push --file supabase/migrations/20260130000000_reassign_on_driver_cancel.sql
```

---

### الطريقة 3: SQL مباشر (سريع)

```bash
# في PowerShell:
$env:DATABASE_URL = "postgresql://postgres:[PASSWORD]@db.wgolkcztdrwdphwjvqxt.supabase.co:5432/postgres"

# تشغيل Migration
psql $env:DATABASE_URL -f supabase/migrations/20260130000000_reassign_on_driver_cancel.sql
```

⚠️ **استبدل `[PASSWORD]` بكلمة المرور الفعلية من Supabase Dashboard**

---

## ✅ التحقق من التطبيق

### 1. تحقق من العمود الجديد:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rides' AND column_name = 'reassignment_count';
```

**النتيجة المتوقعة**:
```
column_name         | data_type | column_default
--------------------+-----------+---------------
reassignment_count  | integer   | 0
```

---

### 2. تحقق من الـ Function:
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'handle_driver_cancellation';
```

**النتيجة المتوقعة**:
```
routine_name                | routine_type
---------------------------+-------------
handle_driver_cancellation | FUNCTION
```

---

### 3. تحقق من الـ Trigger:
```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_handle_driver_cancellation';
```

**النتيجة المتوقعة**:
```
trigger_name                        | event_manipulation | event_object_table
------------------------------------+-------------------+-------------------
trigger_handle_driver_cancellation | UPDATE            | rides
```

---

### 4. تحقق من الـ Index:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'idx_rides_reassignment_count';
```

**النتيجة المتوقعة**:
```
indexname                    | indexdef
-----------------------------+------------------------------------------
idx_rides_reassignment_count | CREATE INDEX ... WHERE status = 'pending'
```

---

## 🧪 اختبار الوظيفة

### اختبار بسيط:

```sql
-- 1. إنشاء رحلة تجريبية
INSERT INTO rides (
  rider_id, 
  driver_id, 
  status, 
  pickup_location, 
  dropoff_location,
  pickup_address,
  dropoff_address,
  estimated_fare
) VALUES (
  '[RIDER_ID]',
  '[DRIVER_ID]',
  'accepted',
  ST_MakePoint(44.0, 36.0),
  ST_MakePoint(44.1, 36.1),
  'Test Pickup',
  'Test Dropoff',
  5000
) RETURNING id;

-- 2. تخزين الـ ID الذي ظهر في النتيجة
-- مثال: 123e4567-e89b-12d3-a456-426614174000

-- 3. السائق يلغي الرحلة
UPDATE rides 
SET 
  status = 'cancelled',
  cancelled_by = 'driver',
  cancellation_reason = 'اختبار'
WHERE id = '[RIDE_ID]';

-- 4. تحقق من النتيجة
SELECT 
  id, 
  status, 
  driver_id, 
  reassignment_count,
  cancelled_by
FROM rides 
WHERE id = '[RIDE_ID]';
```

**النتيجة المتوقعة**:
```
status   | driver_id | reassignment_count | cancelled_by
---------+-----------+-------------------+-------------
pending  | NULL      | 1                 | NULL
```

✅ **إذا رأيت هذا = الـ Trigger يعمل!**

---

### اختبار الحد الأقصى (3 محاولات):

```sql
-- كرر العملية 3 مرات على نفس الرحلة
-- المرة الثالثة يجب أن تبقى cancelled

-- محاولة 1
UPDATE rides SET driver_id = '[DRIVER_ID]', status = 'accepted' WHERE id = '[RIDE_ID]';
UPDATE rides SET status = 'cancelled', cancelled_by = 'driver' WHERE id = '[RIDE_ID]';
-- النتيجة: status = 'pending', reassignment_count = 1

-- محاولة 2
UPDATE rides SET driver_id = '[DRIVER_ID]', status = 'accepted' WHERE id = '[RIDE_ID]';
UPDATE rides SET status = 'cancelled', cancelled_by = 'driver' WHERE id = '[RIDE_ID]';
-- النتيجة: status = 'pending', reassignment_count = 2

-- محاولة 3
UPDATE rides SET driver_id = '[DRIVER_ID]', status = 'accepted' WHERE id = '[RIDE_ID]';
UPDATE rides SET status = 'cancelled', cancelled_by = 'driver' WHERE id = '[RIDE_ID]';
-- النتيجة: status = 'pending', reassignment_count = 3

-- محاولة 4 (يجب أن تفشل)
UPDATE rides SET driver_id = '[DRIVER_ID]', status = 'accepted' WHERE id = '[RIDE_ID]';
UPDATE rides SET status = 'cancelled', cancelled_by = 'driver' WHERE id = '[RIDE_ID]';
-- النتيجة: status = 'cancelled' (إلغاء نهائي)
```

---

## 🔧 حل المشاكل

### المشكلة: "permission denied for table rides"
**الحل**: تأكد من أنك تستخدم user بصلاحيات admin أو postgres role

```sql
-- تحقق من الصلاحيات
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='rides';
```

---

### المشكلة: "column reassignment_count already exists"
**الحل**: العمود موجود مسبقاً، يمكنك تخطي هذا الخطأ

```sql
-- حذف العمود إذا أردت إعادة التطبيق
ALTER TABLE rides DROP COLUMN IF EXISTS reassignment_count;
```

---

### المشكلة: "trigger already exists"
**الحل**: احذف الـ trigger القديم أولاً

```sql
DROP TRIGGER IF EXISTS trigger_handle_driver_cancellation ON rides;
DROP FUNCTION IF EXISTS handle_driver_cancellation();
```

---

## 🔄 Rollback (التراجع)

إذا أردت التراجع عن Migration:

```sql
-- 1. حذف Trigger
DROP TRIGGER IF EXISTS trigger_handle_driver_cancellation ON rides;

-- 2. حذف Function
DROP FUNCTION IF EXISTS handle_driver_cancellation();

-- 3. حذف Index
DROP INDEX IF EXISTS idx_rides_reassignment_count;

-- 4. حذف العمود
ALTER TABLE rides DROP COLUMN IF EXISTS reassignment_count;
```

⚠️ **ملاحظة**: لا تحذف العمود إذا كان هناك rides مع `reassignment_count > 0`

---

## 📊 مراقبة الأداء

### رؤية الإحصائيات:

```sql
-- عدد الرحلات التي تم إعادة تعيينها
SELECT 
  reassignment_count,
  COUNT(*) as ride_count
FROM rides
WHERE reassignment_count > 0
GROUP BY reassignment_count
ORDER BY reassignment_count;
```

### رؤية الرحلات النشطة المُعاد تعيينها:

```sql
SELECT 
  id,
  rider_id,
  status,
  reassignment_count,
  created_at,
  updated_at
FROM rides
WHERE reassignment_count > 0 AND status = 'pending'
ORDER BY updated_at DESC
LIMIT 20;
```

---

## ✅ Checklist

- [ ] تطبيق Migration على قاعدة البيانات
- [ ] تحقق من العمود الجديد (`reassignment_count`)
- [ ] تحقق من الـ Function
- [ ] تحقق من الـ Trigger
- [ ] تحقق من الـ Index
- [ ] اختبار مع رحلة تجريبية
- [ ] اختبار الحد الأقصى (3 محاولات)
- [ ] مراقبة logs لأول ساعة
- [ ] إعلام الفريق بالتحديث

---

**تم الحمد لله رب العالمين** ✅
