# 🚗 ران RAAN — تطبيق النقل الذكي

> منصة تاكسي عراقية ذكية تعمل بـ React + Supabase + Capacitor

---

## 📋 نظرة عامة

**ران** (RAAN Captain) هو نظام نقل ذكي متكامل يشمل:
- **تطبيق الراكب** — حجز رحلات بالصوت أو الخريطة
- **تطبيق السائق** — استقبال وإدارة الطلبات
- **لوحة التحكم** — إدارة شاملة للنظام
- **نظام السيارة** — وضع مدمج داخل السيارة

## 🛠️ التقنيات

| الطبقة | التقنية |
|--------|---------|
| Frontend | React 18 + TypeScript 5 + Vite 5 |
| Styling | TailwindCSS 3 + shadcn/ui + Radix UI |
| State | Zustand 5 + TanStack Query 5 |
| Routing | React Router DOM 6 |
| Backend | Supabase (PostgreSQL + Realtime + Auth + Edge Functions) |
| Mobile | Capacitor 8 (Android) |
| Maps | Google Maps |
| Payments | ZainCash + NASS |
| Monitoring | Sentry |
| i18n | i18next (عربي + إنجليزي) |

## 📦 التطبيقات الأربعة (Multi-Flavor)

| التطبيق | الأمر | المنفذ |
|---------|-------|--------|
| الراكب (Rider) | `npm run dev:rider` | 5173 |
| السائق (Driver) | `npm run dev:driver` | 5174 |
| الإدارة (Admin) | `npm run dev:admin` | 5175 |
| السيارة (Car) | `npm run dev:car` | 5176 |
| **الكل معاً** | `npm run dev` | 5173 |

## 🚀 التشغيل المحلي

### المتطلبات
- Node.js >= 18
- npm أو bun

### الخطوات
```bash
# 1. نسخ متغيرات البيئة
cp .env.example .env
# عدّل .env بقيمك الخاصة

# 2. تثبيت الحزم
npm install

# 3. تشغيل التطوير
npm run dev
```

### بناء APK (Android)
```bash
# بناء تطبيق الراكب
npm run apk:rider

# بناء تطبيق السائق
npm run apk:driver

# بناء الكل
npm run apk:all
```

## 📁 هيكل المشروع

```
raan/
├── src/
│   ├── App.tsx              ← Router الرئيسي
│   ├── apps/                ← Entry points لكل تطبيق
│   ├── pages/               ← صفحات (admin/ driver/ rider/ marketing/)
│   ├── components/          ← مكوّنات (180+)
│   ├── hooks/               ← 73 hook مخصص
│   ├── contexts/            ← 5 React Contexts
│   ├── stores/              ← 4 Zustand Stores
│   ├── services/            ← 8 خدمات
│   ├── lib/                 ← أدوات مساعدة + adapters
│   ├── integrations/        ← Supabase client + types
│   └── locales/             ← ترجمات i18n
├── supabase/
│   ├── migrations/          ← 191 migration
│   ├── functions/           ← 54 Edge Function
│   └── audit/               ← توثيق تقني
├── docs/                    ← التوثيق التفصيلي
│   ├── ARCHITECTURE.md      ← المعمارية التقنية
│   ├── PROJECT_STATUS.md    ← حالة المشروع
│   └── DISPATCH_V2.md       ← نظام التوزيع الذكي
└── android/                 ← مشروع Capacitor Android
```

## 📖 التوثيق التفصيلي

| المستند | الوصف |
|---------|-------|
| [المعمارية التقنية](docs/ARCHITECTURE.md) | Stack، أنماط التصميم، الخرائط، الإشعارات |
| [حالة المشروع](docs/PROJECT_STATUS.md) | الحالة الراهنة، الاختبارات، المهام |
| [نظام التوزيع v2](docs/DISPATCH_V2.md) | ETA ذكي، تقييم السائقين، Feature Flags |

## 🔒 الأمان

- ✅ Row Level Security (RLS) على كل الجداول
- ✅ Zod validation للمدخلات
- ✅ DOMPurify للـ HTML
- ✅ Rate Limiting (server + client)
- ✅ Sentry لمراقبة الأخطاء
- ✅ Audit Logs للعمليات الحساسة

## 🧪 الاختبارات

```bash
# تشغيل كل الاختبارات
npm test

# مع التغطية
npm run test:coverage

# E2E
npm run test:e2e
```

**نتائج الاختبارات**: 62/62 ✅

## 📊 إحصائيات

- **300+** ملف مصدري
- **180+** مكوّن React
- **73** hook مخصص
- **54** Edge Function
- **191** migration
- **62** اختبار وحدة

---

> **ران** — "سافر بذكاء" 🚗
