
## ⚠️ إذا ظهر خطأ "syntax error" - اتبع هذه الطريقة

بدلاً من تشغيل سكربت واحد كبير، سنشغل 6 خطوات صغيرة.

---

## 📝 الخطوات (نفذها بالترتيب!)

### 1️⃣ إنشاء جدول المحافظات

```sql
CREATE TABLE IF NOT EXISTS governorates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) # 🔧 تعليمات الإصلاح خطوة بخطوة
NOT NULL UNIQUE,
  name_en VARCHAR(100),
  code VARCHAR(10) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

✅ شغل هذا في SQL Editor → يجب أن يظهر "Success. No rows returned"

---

### 2️⃣ إدراج المحافظات الـ 18

```sql
INSERT INTO governorates (name_ar, name_en, code) VALUES
  ('بغداد', 'Baghdad', 'BGW'),
  ('البصرة', 'Basra', 'BSR'),
  ('نينوى', 'Nineveh', 'NIN'),
  ('الأنبار', 'Anbar', 'ANB'),
  ('أربيل', 'Erbil', 'EBL'),
  ('النجف', 'Najaf', 'NJF'),
  ('كربلاء', 'Karbala', 'KRB'),
  ('ديالى', 'Diyala', 'DIY'),
  ('كركوك', 'Kirkuk', 'KRK'),
  ('صلاح الدين', 'Saladin', 'SLD'),
  ('بابل', 'Babylon', 'BBL'),
  ('واسط', 'Wasit', 'WST'),
  ('ذي قار', 'Dhi Qar', 'DHQ'),
  ('ميسان', 'Maysan', 'MYS'),
  ('المثنى', 'Muthanna', 'MTH'),
  ('القادسية', 'Qadisiyah', 'QDS'),
  ('دهوك', 'Duhok', 'DHK'),
  ('السليمانية', 'Sulaymaniyah', 'SLM')
ON CONFLICT (name_ar) DO NOTHING;
```

✅ يجب أن يظهر "18 rows" أو "0 rows" (إذا كانت موجودة مسبقاً)

---

### 3️⃣ إضافة عمود المحافظة للمعالم

```sql
ALTER TABLE landmarks ADD COLUMN IF NOT EXISTS governorate_id UUID;
```

✅ يجب أن يظهر "Success"

---

### 4️⃣ تفعيل RLS على المحافظات

```sql
ALTER TABLE governorates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governorates_read_all" ON governorates;
CREATE POLICY "governorates_read_all" ON governorates FOR SELECT USING (true);

DROP POLICY IF EXISTS "governorates_admin_all" ON governorates;
CREATE POLICY "governorates_admin_all" ON governorates FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));
```

✅ يجب أن يظهر "Success"

---

### 5️⃣ إصلاح RLS للمعالم (الأهم!)

```sql
-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Anyone can view active landmarks" ON landmarks;
DROP POLICY IF EXISTS "Admins can manage landmarks" ON landmarks;
DROP POLICY IF EXISTS "landmarks_admin_all" ON landmarks;
DROP POLICY IF EXISTS "landmarks_read_active" ON landmarks;
DROP POLICY IF EXISTS "landmarks_select_active" ON landmarks;
DROP POLICY IF EXISTS "landmarks_select_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_insert_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_update_admin" ON landmarks;
DROP POLICY IF EXISTS "landmarks_delete_admin" ON landmarks;

-- إنشاء سياسات جديدة
CREATE POLICY "landmarks_select_active" ON landmarks
FOR SELECT USING (is_active = true);

CREATE POLICY "landmarks_select_admin" ON landmarks
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_insert_admin" ON landmarks
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_update_admin" ON landmarks
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "landmarks_delete_admin" ON landmarks
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));
```

✅ يجب أن يظهر "Success"

---

### 6️⃣ إضافة Foreign Key

```sql
ALTER TABLE landmarks DROP CONSTRAINT IF EXISTS landmarks_governorate_id_fkey;
ALTER TABLE landmarks ADD CONSTRAINT landmarks_governorate_id_fkey
FOREIGN KEY (governorate_id) REFERENCES governorates(id) ON DELETE SET NULL;
```

✅ يجب أن يظهر "Success"

---

## 🎉 تم الانتهاء!

الآن:

1. ✅ أعد تحميل التطبيق (F5)
2. ✅ جرب رفع ملف CSV
3. ✅ يجب أن يعمل بدون أخطاء!

---

## 📁 أو استخدم الملفات الجاهزة

يمكنك أيضاً تشغيل الملفات التالية بالترتيب:

1. `step1_create_table.sql`
2. `step2_insert_data.sql`
3. `step3_add_column.sql`
4. `step4_governorates_rls.sql`
5. `step5_landmarks_rls.sql`
6. `step6_add_foreign_key.sql`

---

## ❓ إذا استمرت المشكلة

تأكد من:

1. أنك مسجل دخول كـ **Admin**
2. جدول `user_roles` يحتوي على سجل لك بـ `role = 'admin'`
3. دالة `has_role()` موجودة في قاعدة البيانات

---

**تم الحمد لله رب العالمين** 🤲
