# إعداد متغيرات البيئة في Lovable.dev

## المشكلة
في بيئة lovable.dev، قد تواجه خطأ:
```
Uncaught Error: VITE_SUPABASE_URL environment variable is required
```

## الحل

### 1. في لوحة تحكم Lovable.dev:
1. اذهب إلى **Project Settings** > **Environment Variables**
2. أضف المتغيرات التالية:

```
VITE_SUPABASE_URL=https://wgolkcztdrwdphwjvqxt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAYunRwU6ZASnx640BIVymHqtUEnh0aPKk
```

### 2. إعادة نشر المشروع:
بعد إضافة المتغيرات، أعد نشر المشروع من لوحة التحكم.

### 3. التحقق:
تأكد من أن التطبيق يعمل بدون أخطاء متعلقة بمتغيرات البيئة.

## ملاحظات مهمة:
- المتغيرات يجب أن تبدأ بـ `VITE_` لتكون متاحة في الكود
- في حالة عدم وجود المتغيرات، سيستخدم الكود قيم افتراضية
- تأكد من أن مفاتيح API صحيحة ونشطة