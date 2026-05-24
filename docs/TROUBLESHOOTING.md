# دليل حل المشاكل (Troubleshooting Guide)

هذا الملف يحتوي على حلول للمشاكل الشائعة في تطبيق ران.

---

## 🚫 مشكلة: زر "إلغاء الطلب" لا يعمل

### الأعراض
- الضغط على زر "إلغاء الطلب" لا يلغي الرحلة
- قد تظهر رسالة خطأ في console
- الـ dialog يفتح لكن بعد اختيار السبب لا يحدث شيء

### الأسباب المحتملة

#### 1. الـ RPC Function غير موجودة في قاعدة البيانات

**التحقق:**
افتح Supabase Dashboard أو قم بتشغيل:
```sql
SELECT * FROM pg_proc WHERE proname = 'cancel_ride_by_rider';
```

**الحل:**
تأكد من تطبيق migration:
```bash
# محلياً
supabase db reset

# أو تطبيق migrations محددة
supabase migration up

# على الإنتاج
supabase db push
```

الملف المطلوب: `supabase/migrations/20260904000000_atomic_rider_cancellation_rpc.sql`

#### 2. مشكلة في الـ Permissions

**التحقق:**
```sql
SELECT * FROM information_schema.routine_privileges 
WHERE routine_name = 'cancel_ride_by_rider';
```

**الحل:**
تأكد من أن الـ RPC function لديها الصلاحيات الصحيحة:
```sql
GRANT EXECUTE ON FUNCTION public.cancel_ride_by_rider(UUID, UUID, TEXT) TO authenticated;
```

#### 3. المستخدم غير مسجل دخول

**التحقق:**
افتح Developer Tools > Console وابحث عن:
```
[RideWaiting] 👤 Current user: undefined
```

**الحل:**
- تأكد من تسجيل الدخول
- تحقق من صلاحية الـ session token
- جرب تسجيل الخروج وإعادة الدخول

#### 4. حالة الرحلة لا تسمح بالإلغاء

**التحقق:**
في console ابحث عن:
```
[RideWaiting] ❌ Cancellation failed: لا يمكن إلغاء رحلة بحالة: ...
```

**الحل:**
الحالات القابلة للإلغاء فقط:
- `pending` - في انتظار سائق
- `accepted` - السائق قبل الرحلة
- `arrived` - السائق وصل

لا يمكن الإلغاء في:
- `ongoing` - الرحلة جارية
- `completed` - الرحلة مكتملة
- `cancelled` - ملغاة بالفعل

### خطوات التشخيص

1. **افتح Developer Console** (F12)
2. **اضغط على زر إلغاء الطلب**
3. **راقب console logs**:
   - `[RideWaiting] ❌ Cancel button clicked`
   - `[RideWaiting] 👤 Current user: ...`
   - `[RideWaiting] 📞 Calling cancel_ride_by_rider RPC...`
   - `[RideWaiting] 📥 RPC Response: ...`

4. **إذا رأيت خطأ**:
   ```
   error: {message: "function cancel_ride_by_rider(uuid, uuid, text) does not exist"}
   ```
   → الـ migration لم يتم تطبيقها

5. **إذا رأيت**:
   ```
   result: {success: false, error: "لا يمكن إلغاء رحلة بحالة: ongoing"}
   ```
   → الرحلة بدأت ولا يمكن إلغاؤها

### الحل السريع

إذا كنت في بيئة التطوير:
```bash
# 1. إعادة ضبط قاعدة البيانات
supabase db reset

# 2. إعادة تشغيل التطبيق
npm run dev:rider

# 3. جرب الإلغاء مرة أخرى
```

---

## 🗄️ مشكلة: Migrations غير مطبقة

### الأعراض
- RPC functions لا تعمل
- جداول أو أعمدة مفقودة
- أخطاء في استعلامات SQL

### الحل

#### محلياً:
```bash
# عرض حالة migrations
supabase migration list

# تطبيق جميع migrations
supabase db reset

# أو تطبيق migration محددة
supabase migration up --version <version>
```

#### على الإنتاج:
```bash
# دفع جميع migrations الجديدة
supabase db push

# أو استخدام Dashboard
# Supabase Dashboard > SQL Editor > Run Migration
```

---

## 🔐 مشكلة: Permissions مفقودة

### الأعراض
- "permission denied" errors
- "insufficient_privilege" errors
- RPC functions لا تعمل للمستخدمين

### الحل

تأكد من أن جميع RPC functions لديها الصلاحيات الصحيحة:

```sql
-- للراكب
GRANT EXECUTE ON FUNCTION public.cancel_ride_by_rider TO authenticated;

-- للسائق  
GRANT EXECUTE ON FUNCTION public.accept_ride_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_ride_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ride_atomic TO authenticated;

-- تحقق من الصلاحيات الحالية
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

---

## 🔍 أدوات التشخيص المفيدة

### 1. فحص RPC Functions المتاحة
```sql
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    prosecdef as is_security_definer
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
    AND proname LIKE '%ride%'
ORDER BY proname;
```

### 2. فحص حالة الرحلة الحالية
```sql
SELECT 
    id,
    status,
    rider_id,
    driver_id,
    created_at,
    updated_at
FROM rides 
WHERE id = '<ride_id>'
LIMIT 1;
```

### 3. فحص Realtime Subscriptions
```javascript
// في console
console.log(supabase.getChannels());
```

---

## 📞 الحصول على المساعدة

إذا استمرت المشكلة:

1. **جمع المعلومات**:
   - لقطة شاشة من console errors
   - الخطوات لإعادة إنتاج المشكلة
   - بيئة التشغيل (development/production)
   - رقم الرحلة (ride ID)

2. **راجع الوثائق**:
   - [docs/ARCHITECTURE.md](ARCHITECTURE.md)
   - [docs/PROJECT_STATUS.md](PROJECT_STATUS.md)

3. **تواصل مع الفريق**:
   - افتح Issue في GitHub
   - أرفق معلومات التشخيص
