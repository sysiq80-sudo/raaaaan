---
description: كيفية تشغيل وتطوير تطبيق ران محلياً
---

# تشغيل تطبيق ران محلياً

## المتطلبات
- Node.js 18+
- npm أو bun

## تثبيت المكتبات
```bash
npm install
```

## تشغيل التطبيقات (كل تطبيق على بورت منفصل)

### الراكب (Rider)
```bash
npm run dev:rider
# http://localhost:8080
```

### السائق (Driver)
```bash
npm run dev:driver
# http://localhost:8081
```

### الأدمن (Admin)
```bash
npm run dev:admin
# http://localhost:8082
```

### سيارة مدمجة (Car Mode)
```bash
npm run dev:car
# http://localhost:8083
```

### تشغيل الكل دفعة واحدة (via bat)
```bash
.\run-apps.bat
```

## البناء للإنتاج

```bash
# بناء تطبيق واحد
npm run build:rider
npm run build:driver
npm run build:admin

# بناء الكل
npm run build:web:all
```

## بناء APK (Android)

```bash
# APK الراكب
npm run apk:rider

# APK السائق
npm run apk:driver

# APK السيارة
npm run apk:car
```

## الاختبارات
```bash
npm run test          # unit tests
npm run test:watch    # وضع المراقبة
npm run test:coverage # تغطية الكود
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

```
src/
├── apps/           ← نقاط الدخول (rider/driver/admin/car)
├── pages/          ← الصفحات (admin: 55، driver: 14، rider: 10)
├── components/     ← المكوّنات (rider: 83، driver: 38، admin: 25)
├── hooks/          ← 69 Custom Hook
├── contexts/       ← Auth, Theme, Map, Supabase
├── stores/         ← Zustand (driver, rider, editor, favorites)
├── services/       ← Location, Notifications, Background
├── lib/
│   ├── adapters/   ← محوّلات الخرائط/Routing/Geocoding
│   ├── notificationRouter/ ← محرك الإشعارات الذكي
│   └── eventDeduplication/ ← Lamport clocks
├── types/          ← TypeScript types
├── utils/          ← Service Worker, Sounds
└── workers/        ← Web Worker للموقع
supabase/
├── functions/      ← 54 Edge Function
└── migrations/     ← 191 Migration
```

## ملاحظات مهمة
- التطبيق يستخدم HashRouter على الجوال (Capacitor) و BrowserRouter على الويب
- مفتاح Google Maps API يُحمَّل من Supabase (settings table)
- الإشعارات تعمل بنظام هجين: FCM + Web Push + Telegram/SMS
