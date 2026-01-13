# 🔧 إصلاح مشكلة RLS في نظام المعالم

## 🚨 المشكلة

- خطأ 401: `new row violates row-level security policy for table "landmarks"`
- خطأ 400: فشل في تحميل البيانات من `governorates`

## ✅ الحل

### الخطوة 1: تشغيل السكربت في Supabase

1. افتح **Supabase Dashboard**
2. اذهب إلى **SQL Editor**
3. انسخ محتوى ملف `COMPLETE_LANDMARKS_FIX.sql`
4. اضغط **Run**

### الخطوة 2: التحقق من النتيجة

يجب أن تظهر النتائج التالية:

```
✅ المحافظات: 18 محافظة
✅ المعالم: X معلم
✅ السياسات: Y سياسة RLS
✅ تم إصلاح نظام المعالم بنجاح
```

### الخطوة 3: إعادة تحميل التطبيق

1. أعد تحميل صفحة Admin في المتصفح (F5)
2. جرب رفع ملف CSV للمعالم
3. يجب أن يعمل بدون أخطاء

## 📋 ما الذي تم إصلاحه؟

### 1. جدول المحافظات

- ✅ إنشاء جدول `governorates`
- ✅ إضافة 18 محافظة عراقية
- ✅ تفعيل RLS مع سياسات مناسبة

### 2. ربط المعالم بالمحافظات

- ✅ إضافة عمود `governorate_id`
- ✅ إنشاء Foreign Key للربط
- ✅ تحديث الـ SELECT query

### 3. سياسات RLS للمعالم

- ✅ `landmarks_select_active`: الجميع يقرأ المعالم النشطة
- ✅ `landmarks_select_admin`: Admin يقرأ كل شيء
- ✅ `landmarks_insert_admin`: Admin فقط يمكنه الإدراج
- ✅ `landmarks_update_admin`: Admin فقط يمكنه التحديث
- ✅ `landmarks_delete_admin`: Admin فقط يمكنه الحذف

### 4. سياسات RLS للمحافظات

- ✅ `governorates_read_all`: الجميع يقرأ المحافظات
- ✅ `governorates_admin_all`: Admin فقط يدير المحافظات

## 🔍 الملفات المعدلة

1. **COMPLETE_LANDMARKS_FIX.sql** - السكربت الشامل (الموصى به)
2. **FIX_LANDMARKS_RLS.sql** - إصلاح RLS فقط
3. **QUICK_FIX.sql** - إصلاح سريع للمحافظات
4. **DELETE_ALL_LANDMARKS.sql** - حذف جميع المعالم القديمة

## ⚠️ ملاحظات مهمة

1. **يجب تشغيل `COMPLETE_LANDMARKS_FIX.sql` أولاً**
2. السكربت آمن - لا يحذف بيانات موجودة
3. إذا كانت المحافظات موجودة مسبقاً، لن يتم تكرارها
4. جميع السياسات القديمة ستُحذف وتُستبدل بأخرى جديدة

## 🆘 إذا استمرت المشكلة

1. تأكد من أنك مسجل دخول كـ **Admin**
2. تحقق من جدول `user_roles`:
   ```sql
   SELECT * FROM user_roles WHERE user_id = auth.uid();
   ```
3. يجب أن يكون `role = 'admin'`

## 📞 ملاحظة للمطور

- تم تحديث `fetchLandmarks()` لتضمين معالجة أخطاء أفضل
- تم تحديث `fetchGovernorates()` لإزالة شرط `is_active` (لأن العمود لم يكن موجوداً)
- تم تصحيح الـ JOIN في Supabase query: `governorate:governorates!governorate_id(name_ar)`

---

**تم الحمد لله رب العالمين** 🤲
