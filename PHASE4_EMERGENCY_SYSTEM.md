# 🚨 نظام الطوارئ والشكاوى - تحديث Phase 4

## ما الجديد؟

تم إضافة نظام شامل للكشف التلقائي عن الرحلات المتوقفة، إدارة الطوارئ، ونظام الشكاوى المتقدم.

---

## 🎯 الميزات الرئيسية

### 1. الكشف التلقائي عن الرحلات المتوقفة
- **مراقبة مستمرة** للرحلات النشطة كل 3 دقائق
- **كشف ذكي** عندما يتوقف السائق والراكب معاً لأكثر من 5 دقائق
- **حساب دقيق للمسافة** باستخدام معادلة Haversine
- **مستويان من التنبيهات:**
  - ⚠️ تحذير: بعد 5 دقائق توقف
  - 🚨 حرج: بعد 10 دقائق توقف
- **إشعارات فورية** للطرفين والمدير

### 2. نظام الشكاوى الشامل
- **8 أنواع شكاوى** مصنفة حسب الأولوية
- **رفع أدلة** (صور/فيديوهات) مع معاينة
- **قرارات مالية** بـ 4 خيارات:
  - إعادة كاملة للراكب
  - إعادة للسائق
  - تقسيم 50/50
  - عدم إعادة
- **تتبع كامل** لكل شكوى مع سجل القرارات

### 3. لوحة تحكم الطوارئ (Admin)
- **صفحة الرحلات المتوقفة**: عرض فوري للحالات الحرجة
- **صفحة الشكاوى**: إدارة شاملة مع القرارات المالية
- **صفحة الإعدادات**: تخصيص الحدود والمعايير
- **تحديثات فورية** عبر Realtime

### 4. الحماية من إساءة الاستخدام
- حد أسبوعي: 3 استخدامات لزر الطوارئ
- تتبع تلقائي وإشعارات
- منع مؤقت عند التجاوز
- سجل كامل لجميع الاستخدامات

---

## 📁 الملفات الجديدة

### قاعدة البيانات
```
supabase/migrations/
├── 20260129200001_emergency_system_tables.sql (220 سطر)
└── 20260129200002_complaints_system.sql (280 سطر)
```

### Edge Functions
```
supabase/functions/
└── detect-dual-stop/index.ts (230 سطر)
```

### React Components
```
src/
├── components/common/
│   └── ComplaintDialog.tsx (330 سطر)
└── pages/admin/
    ├── AdminComplaints.tsx (530 سطر)
    ├── AdminStoppedRides.tsx (370 سطر)
    └── AdminEmergencySettings.tsx (340 سطر)
```

---

## 🚀 التثبيت السريع

### 1. تطبيق Migrations
```bash
# في Supabase Dashboard → SQL Editor
# نفذ المحتوى من:
# - supabase/migrations/20260129200001_emergency_system_tables.sql
# - supabase/migrations/20260129200002_complaints_system.sql
```

### 2. إنشاء Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('complaint-evidence', 'complaint-evidence', false);
```

### 3. نشر Edge Function
```bash
supabase functions deploy detect-dual-stop
# اضبط Cron: */3 * * * * (كل 3 دقائق)
```

### 4. تحديث Types
```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## 📊 الإحصائيات

- **7 جداول جديدة**
- **4 وظائف SQL**
- **1 عرض (View)**
- **1 Trigger**
- **5 إعدادات نظام**
- **~3,170 سطر كود جديد**

---

## 🔗 الروابط السريعة

- [دليل التنفيذ الكامل](EMERGENCY_SYSTEM_IMPLEMENTATION.md)
- [سكريبت التحقق](supabase/VERIFY_INSTALLATION.sql)
- [تعليمات Copilot](.github/copilot-instructions.md)

---

## 🎯 ما بعد التثبيت

1. ✅ افتح لوحة المدير → "رحلات متوقفة"
2. ✅ افتح لوحة المدير → "الشكاوى"
3. ✅ افتح لوحة المدير → "إعدادات الطوارئ"
4. ✅ اختبر تقديم شكوى من تطبيق الراكب
5. ✅ راجع Logs في Edge Function

---

## ⚠️ ملاحظات مهمة

- يتطلب Supabase Pro لـ Edge Functions Cron
- تأكد من تفعيل Realtime و Storage
- راجع سياسات RLS قبل النشر للإنتاج
- احتفظ بنسخة احتياطية من قاعدة البيانات

---

## 📞 الدعم

للمشاكل أو الاستفسارات، راجع:
- [استكشاف الأخطاء](EMERGENCY_SYSTEM_IMPLEMENTATION.md#-استكشاف-الأخطاء)
- Supabase Logs: `supabase functions logs detect-dual-stop`

---

**تم الحمد لله رب العالمين** ✅

التحديث: Phase 4 - نظام الطوارئ والشكاوى  
التاريخ: 29 يناير 2026  
الإصدار: 1.0.0
