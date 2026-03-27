# 🔧 إصلاح الخطأ الثالث - جدول Admins المفقود

## ❌ المشكلة الجديدة
```
ERROR: 42P01: relation "public.admins" does not exist
```

## ✅ الحل المطبق

تم حذف جميع الرجوعات إلى جدول `admins` من الـ migration لأنه غير موجود في قاعدة البيانات.

### التعديلات:

```sql
قبل (❌ خطأ):
create policy "riders_view_own_ratings" on public.ride_ratings
  for select using (
    rider_id = auth.uid() or auth.uid() in (
      select user_id from public.admins where role = 'super_admin'
    )
  );

بعد (✅ صحيح):
create policy "riders_view_own_ratings" on public.ride_ratings
  for select using (
    rider_id = auth.uid()
  );
```

### الـ Policies المصححة:

✅ **riders_view_own_ratings** - الراكب يرى تقييماته فقط
✅ **riders_insert_ratings** - الراكب يُدرج تقييماته
✅ **riders_update_own_ratings** - الراكب يعدّل تقييماته خلال 24 ساعة
✅ **drivers_view_own_ratings** - السائق يرى تقييماته فقط

---

## 🚀 الخطوة التالية

### الآن:

```bash
# اذهب: Supabase SQL Editor
# اضغط: New Query
# انسخ: محتوى الملف المصحح
# اشغّل: Query

# يجب أن تُرى: "Success"
```

**المدة**: 2 دقيقة  
**النتيجة**: جدول ride_ratings مكتمل وآمن ✅

---

## ✨ النتيجة المتوقعة

```
✅ SQL Migration: سيعمل بدون أخطاء
✅ جدول ride_ratings: سينشأ بنجاح
✅ RLS Policies: ستحمي البيانات
✅ Trigger: سيحدث Driver Rating تلقائياً
```

---

**الحالة الآن**: 🟢 **جاهز للتطبيق**
