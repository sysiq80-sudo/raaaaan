---
description: كيفية تشغيل وتطوير تطبيق ران محلياً
---

# تشغيل تطبيق ران محلياً

## المتطلبات
- Node.js 18+
- npm أو bun

## الخطوات

// turbo-all
1. تثبيت المكتبات (إذا لم يتم من قبل):
```bash
npm install
```

2. تشغيل التطبيق في وضع التطوير:
```bash
npm run dev
```

3. فتح التطبيق في المتصفح:
- http://localhost:8080

## بناء التطبيق للإنتاج
```bash
npm run build
```

## فحص الكود
```bash
npm run lint
```

## الحسابات التجريبية
- راكب: rider@test.com / 123456
- سائق: driver@test.com / 123456
- مدير: admin@test.com / 123456

## هيكل المشروع
- `/src/pages` - صفحات التطبيق
- `/src/components` - المكونات
- `/src/hooks` - Custom Hooks
- `/src/lib` - الأدوات والثوابت
- `/supabase` - قاعدة البيانات و Edge Functions
