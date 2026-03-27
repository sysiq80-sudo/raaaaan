# ⚠️ قواعد حماية مستودع ران RAAN

## 🛡️ قواعد GitHub Branch Protection

### حماية الـ main branch:

يجب تفعيل القواعد التالية على GitHub:

#### Settings → Branches → Branch protection rules → Add rule

```yaml
Branch name pattern: main

✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale pull request approvals when new commits are pushed

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Status checks:
     - check-migrations
     - check-deletions
     - check-sensitive-files
     - check-credentials

✅ Require conversation resolution before merging

✅ Do not allow bypassing the above settings
```

---

## 🚨 قواعد الـ AI Agents

### قبل أي Push:
```
1. عرض جميع التغييرات المقترحة
2. انتظار موافقة صريحة من المطور
3. عدم تنفيذ git push أو git commit بدون إذن
```

### قبل أي Delete من قاعدة البيانات:
```
1. عرض البيانات المراد حذفها
2. شرح السبب والتأثير
3. اقتراح Soft Delete كبديل
4. انتظار الموافقة الصريحة
```

### الاستثناءات المسموحة:
```
✅ حذف بيانات تجريبية في بيئة Development فقط
✅ Soft Delete (تعليم كـ deleted=true)
✅ إضافة بيانات جديدة
✅ تحديث بيانات موجودة
```

---

## 📋 قائمة التحقق (Checklist)

### قبل كل commit:
- [ ] قراءة `AI_MASTER_REFERENCE.md` للتأكد من الفهم
- [ ] التأكد من عدم تعديل `supabase/migrations/` بدون إذن
- [ ] التأكد من عدم وجود credentials في الكود
- [ ] التأكد من عدم تعطيل RLS
- [ ] اختبار التغييرات محلياً
- [ ] **طلب الموافقة من المطور**

### قبل كل delete operation:
- [ ] توضيح البيانات المراد حذفها
- [ ] شرح السبب والحاجة للحذف
- [ ] التحقق من عدم وجود dependencies
- [ ] اقتراح Soft Delete كبديل
- [ ] **انتظار الموافقة الصريحة**

---

## 🔧 كيفية تفعيل الحماية

### 1. تفعيل GitHub Actions:
```bash
# الملفات موجودة في:
.github/
├── copilot-instructions.md
├── workflows/
│   └── protection.yml
└── PROTECTION_RULES.md
```

### 2. تفعيل Branch Protection في GitHub:
1. اذهب إلى Repository → Settings → Branches
2. Add rule → اكتب `main` في Branch name pattern
3. فعّل جميع الخيارات المذكورة أعلاه
4. Save changes

### 3. إعداد CODEOWNERS (اختياري):
أنشئ ملف `.github/CODEOWNERS`:
```
# الملفات الحساسة تحتاج موافقة المطور الرئيسي
supabase/migrations/* @engkhalidmaster
src/lib/supabaseConfig.ts @engkhalidmaster
AI_MASTER_REFERENCE.md @engkhalidmaster
```

---

## 🎯 أمثلة على السيناريوهات

### ✅ مسموح:
```typescript
// إضافة رحلة جديدة
const { data } = await supabase.from('rides').insert({ ... });

// تحديث حالة رحلة
const { data } = await supabase.from('rides')
  .update({ status: 'completed' })
  .eq('id', rideId);

// Soft Delete
const { data } = await supabase.from('rides')
  .update({ deleted: true, deleted_at: new Date() })
  .eq('id', rideId);
```

### ⚠️ يحتاج موافقة:
```typescript
// حذف فعلي من قاعدة البيانات
const { data } = await supabase.from('rides')
  .delete()
  .eq('id', rideId);
// ❌ يجب طلب الموافقة أولاً!

// تعديل migration
// ❌ يجب طلب الموافقة أولاً!

// push لـ main branch
// ❌ يجب طلب الموافقة أولاً!
```

### ❌ ممنوع تماماً:
```typescript
// تعطيل RLS
// ❌ ممنوع منعاً باتاً!

// نشر credentials
const apiKey = "sk_live_xxxxx"; // ❌ ممنوع!

// حذف جماعي بدون موافقة
await supabase.from('rides').delete().gt('created_at', date);
// ❌ ممنوع بدون موافقة صريحة!
```

---

## 🤝 التواصل مع المطور

### عند الحاجة للموافقة:
```
📢 التنسيق المطلوب:

[نوع العملية] - [التفاصيل]

مثال:
🗑️ DELETE - حذف 5 رحلات تجريبية من جدول rides

التفاصيل:
- IDs: [uuid1, uuid2, uuid3, uuid4, uuid5]
- السبب: بيانات اختبار لم تعد مطلوبة
- التأثير: لا يوجد - رحلات تجريبية فقط
- البديل: يمكن Soft Delete بدلاً منه

هل توافق على الحذف؟
```

---

## 📚 مراجع مهمة

- `AI_MASTER_REFERENCE.md` - المرجع الشامل
- `RIDER_FLOW_DOCUMENTATION.md` - توثيق التدفق
- `.github/copilot-instructions.md` - تعليمات Copilot

---

**آخر تحديث**: 2026-01-10  
**الإصدار**: 1.0.0

**والحمد لله رب العالمين** 🤲
