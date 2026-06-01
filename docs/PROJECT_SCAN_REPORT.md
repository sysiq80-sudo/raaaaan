# تقرير فحص المشروع
> تاريخ الفحص: 2026-05-31 (تحديث شامل)
> المشروع: ران (RAAN) — تطبيق النقل الذكي
> المسار: `d:\projects\taksi-iraqi\RAAN\raan`

## معلومات عامة

| البند | القيمة |
|---|---|
| نوع المشروع | Full Stack + Mobile (SaaS — Multi-Flavor) |
| اللغات الرئيسية | TypeScript 5.8, SQL |
| إطار العمل | React 18 + Vite 5 (SPA — Multi-Entry) |
| قاعدة البيانات | PostgreSQL عبر Supabase (Hosted) |
| منصة النشر | Vercel (Web) + Capacitor 8 (Android APK) |
| عدد الملفات المصدرية (TS/TSX) | 540 🟢 مؤكد |
| عدد ملفات Migration | 241 🟢 مؤكد |
| عدد Edge Functions | 57 🟢 مؤكد |
| آخر تعديل | 2026-05-31 🟢 مؤكد |

## التقنيات المكتشفة (Auto-Detected Profiles)

| التقنية | مكتشفة؟ | الدليل |
|---|---|---|
| React (standalone — بدون Next.js) | ✅ | `react@^18.3.1` في `package.json` + `@vitejs/plugin-react-swc` |
| Vite | ✅ | `vite.config.ts` + 4 ملفات config إضافية (rider/driver/admin/car) |
| Supabase | ✅ | `@supabase/supabase-js@^2.87.1` + مجلد `supabase/` + `VITE_SUPABASE_URL` في `.env` |
| Capacitor | ✅ | `@capacitor/core@8.3.0` + `capacitor.config.ts` + 3 ملفات config إضافية + مجلد `android/` |
| TailwindCSS | ✅ | `tailwindcss@^3.4.17` + `tailwind.config.ts` |
| TypeScript | ✅ | `tsconfig.json` + `typescript@^5.8.3` — `strict: true` مفعّل |
| Vercel | ✅ | `vercel.json` |
| Sentry | ✅ | `@sentry/react@^10.47.0` |
| Vitest | ✅ | `vitest.config.ts` + `vitest@^4.1.2` |
| Playwright | ✅ | `playwright.config.ts` + `@playwright/test@^1.58.2` + مجلد `e2e/` |
| ESLint | ✅ | `eslint.config.js` |
| Google Maps | ✅ | `@react-google-maps/api@^2.19.3` + `VITE_GOOGLE_MAPS_API_KEY` |
| Mapbox | ✅ | `mapbox-gl@^2.15.0` (للأدمن فقط) |
| Framer Motion | ✅ | `framer-motion@^12.23.26` |
| i18next | ✅ | `i18next@^26.0.4` + `react-i18next@^17.0.2` (عربي + إنجليزي) |
| Zustand | ✅ | `zustand@^5.0.9` — 4 stores |
| TanStack Query | ✅ | `@tanstack/react-query@^5.83.0` |
| shadcn/ui + Radix UI | ✅ | `components.json` + 26 Radix حزمة |
| Next.js | ❌ | غير موجود |
| Firebase | ❌ | غير موجود |
| Docker | ❌ | غير موجود |
| Prisma | ❌ | غير موجود |

## الحزم والمكتبات الرئيسية

### Dependencies (الرئيسية — 88 حزمة)

| الحزمة | الإصدار | الوظيفة |
|---|---|---|
| `react` / `react-dom` | ^18.3.1 | واجهة المستخدم الأساسية |
| `react-router-dom` | ^6.30.1 | التوجيه (SPA routing) |
| `@supabase/supabase-js` | ^2.87.1 | العميل الرئيسي لـ Supabase |
| `@tanstack/react-query` | ^5.83.0 | إدارة طلبات API + cache |
| `zustand` | ^5.0.9 | إدارة الحالة العامة (State Management) |
| `@capacitor/core` + CLI | 8.3.0 | جسر التطبيق الأصلي (Android) |
| `@transistorsoft/capacitor-background-geolocation` | ^9.1.0 | GPS خلفية للسائقين |
| `@react-google-maps/api` | ^2.19.3 | خرائط Google |
| `@turf/turf` | ^7.3.1 | حسابات جغرافية (geofencing, distance) |
| `framer-motion` | ^12.23.26 | الرسوم المتحركة (animations) |
| `i18next` + `react-i18next` | ^26.0.4 / ^17.0.2 | تعدد اللغات (عربي + إنجليزي) |
| `zod` | ^3.25.76 | التحقق من المدخلات (validation) |
| `@sentry/react` | ^10.47.0 | مراقبة الأخطاء |
| `recharts` | ^2.15.4 | الرسوم البيانية (لوحة الأدمن) |
| `sonner` | ^1.7.4 | إشعارات Toast |
| `react-hook-form` + `@hookform/resolvers` | ^7.61.1 | إدارة النماذج |
| `@xyflow/react` | ^12.10.1 | مخططات تدفق مرئية (Visual Workflows) |
| `@capacitor-community/text-to-speech` | ^8.0.0 | نطق حالة الرحلة صوتياً |
| `@capacitor-community/speech-recognition` | ^7.0.1 | التعرف على الصوت (حجز صوتي) |
| `canvas-confetti` | ^1.9.4 | تأثيرات بصرية احتفالية |

### DevDependencies (الرئيسية)

| الحزمة | الإصدار | الوظيفة |
|---|---|---|
| `@vitejs/plugin-react-swc` | ^3.11.0 | ترجمة React سريعة |
| `vitest` | ^4.1.2 | اختبارات الوحدات |
| `@playwright/test` | ^1.58.2 | اختبارات E2E |
| `@testing-library/react` | ^16.3.2 | اختبار المكونات |
| `tailwindcss` | ^3.4.17 | أدوات CSS |
| `terser` | ^5.46.0 | ضغط JavaScript |
| `supabase` (CLI) | ^2.101.0 | إدارة Supabase محلياً |
| `sharp` | ^0.34.5 | معالجة الصور |

## ملفات الإعداد المهمة

| الملف | الوجود | ملاحظات |
|---|---|---|
| `.env.example` | ✅ | 6 متغيرات — واضح ومنظم |
| `.env` | ✅ | ⚠️ **موجود في Git ويحتوي مفاتيح حقيقية** — خطر أمني |
| `.env.production` | ✅ | ⚠️ **موجود في Git ويحتوي Supabase Anon Key + Google Maps Key + Sentry DSN** |
| `capacitor.config.ts` | ✅ | إعداد Rider — `com.raan.rider` |
| `capacitor.rider.config.ts` | ✅ | |
| `capacitor.driver.config.ts` | ✅ | إعداد Driver/Captain |
| `capacitor.car.config.ts` | ✅ | إعداد Car (وضع داخل السيارة) |
| `vite.config.ts` | ✅ | إعداد الويب الأساسي (port 8080) |
| `vite.rider.config.ts` | ✅ | إعداد الراكب (port 5173) |
| `vite.driver.config.ts` | ✅ | إعداد السائق (port 5174) |
| `vite.admin.config.ts` | ✅ | إعداد الأدمن (port 5175) |
| `vite.car.config.ts` | ✅ | إعداد السيارة (port 5176) |
| `tsconfig.json` | ✅ | strict: true + path aliases `@/*` |
| `vercel.json` | ✅ | SPA rewrites + security headers + cache |
| `tailwind.config.ts` | ✅ | إعداد TailwindCSS مخصص |
| `components.json` | ✅ | إعداد shadcn/ui |
| `.gitignore` | ✅ | يتضمن `.env` لكن `.env.production` **ليس محظوراً** ⚠️ |
| `playwright.config.ts` | ✅ | إعداد E2E |
| `vitest.config.ts` | ✅ | إعداد اختبارات الوحدات |

## الخدمات الخارجية

| الخدمة | الاستخدام | ملف الإعداد |
|---|---|---|
| Supabase | قاعدة بيانات + Auth + Realtime + Storage + Edge Functions | 📁 `.env`, `supabase/config.toml` |
| Google Maps | خرائط + geocoding + directions | 📁 `.env` — `VITE_GOOGLE_MAPS_API_KEY` |
| Mapbox | خرائط بديلة (لوحة الأدمن فقط) | 📁 migration `20260106154928_add_mapbox_token_setting.sql` |
| OSRM | حساب مسارات (fallback مجاني) | 📁 `src/lib/adapters/` |
| Nominatim | geocoding مجاني (fallback) | 📁 `src/lib/adapters/` |
| Sentry | مراقبة أخطاء | 📁 `.env` — `VITE_SENTRY_DSN` |
| ZainCash | دفع إلكتروني عراقي | 📁 `supabase/functions/zaincash-*` |
| NASS | دفع إلكتروني | 📁 `supabase/functions/nass-*` |
| Vercel | استضافة الويب + CDN | 📁 `vercel.json` |
| Telegram | بوت حجز + إشعارات | 📁 `supabase/functions/telegram-*` |
| WhatsApp | إشعارات رحلات | 📁 `supabase/functions/whatsapp-*` |
| SMS | OTP + إشعارات | 📁 `supabase/functions/send-sms`, `sms-*` |
| Google Analytics | تحليلات | 📁 `src/lib/googleAnalytics.ts` |

## هيكل المجلدات الرئيسي

```
raan/
├── src/                          # 538 ملف TypeScript/TSX
│   ├── App.tsx                   # (46KB — 1231 سطر) نقطة الدخول + كل Routes
│   ├── main.tsx                  # نقطة الدخول الأولى
│   ├── index.css                 # (56KB) أنماط CSS شاملة
│   ├── pages/                    # صفحات التطبيق
│   │   ├── admin/                # 58 صفحة إدارية
│   │   ├── driver/               # 14 صفحة للسائق
│   │   ├── rider/                # 10 صفحات للراكب
│   │   ├── marketing/            # صفحات تسويقية
│   │   ├── payment/              # صفحات الدفع
│   │   └── *.tsx                 # صفحات عامة (Auth, Index, Terms, إلخ)
│   ├── components/               # مكونات React
│   │   ├── admin/                # مكونات الأدمن
│   │   ├── driver/               # مكونات السائق
│   │   ├── rider/                # مكونات الراكب
│   │   ├── common/               # مكونات مشتركة
│   │   ├── ui/                   # shadcn/ui (Radix-based)
│   │   └── *.tsx                 # مكونات عامة
│   ├── hooks/                    # 75 hook مخصص
│   ├── stores/                   # 4 Zustand stores
│   ├── contexts/                 # 5 React Contexts
│   ├── lib/                      # مكتبات مساعدة (42 ملف)
│   ├── services/                 # خدمات (driver notifications, location)
│   ├── integrations/supabase/    # عميل Supabase + أنواع
│   ├── locales/                  # ملفات الترجمة (عربي + إنجليزي)
│   ├── types/                    # أنواع TypeScript
│   ├── utils/                    # أدوات مساعدة
│   ├── workers/                  # Web Workers
│   ├── styles/                   # أنماط إضافية
│   ├── assets/                   # أصول ثابتة
│   └── apps/                     # إعدادات التطبيقات المتعددة
├── supabase/
│   ├── functions/                # 55 Edge Function
│   │   ├── _shared/              # كود مشترك بين الدوال
│   │   └── */index.ts            # كل دالة في مجلد منفصل
│   ├── migrations/               # 236 migration SQL
│   ├── scripts/                  # سكريبتات مساعدة
│   ├── config.toml               # إعداد Supabase المحلي
│   └── seed.sql                  # بيانات أولية
├── android/                      # مشروع Android (Capacitor)
├── public/                       # ملفات ثابتة
├── docs/                         # التوثيق
├── e2e/                          # اختبارات E2E (Playwright)
├── raan-mobile/                  # ⚠️ مجلد فرعي — غير واضح حالته
└── [ملفات جذر]                   # إعدادات + سكريبتات بناء
```

## التطبيقات الأربعة (Multi-Flavor)

| التطبيق | Entry HTML | Vite Config | Capacitor Config | Output Dir | الوصف |
|---|---|---|---|---|---|
| الراكب (Rider) | `rider.html` | `vite.rider.config.ts` | `capacitor.rider.config.ts` | `dist-rider/` | تطبيق حجز الرحلات |
| السائق (Driver) | `driver.html` | `vite.driver.config.ts` | `capacitor.driver.config.ts` | `dist-driver/` | تطبيق استقبال وإدارة الطلبات |
| السيارة (Car) | `car.html` | `vite.car.config.ts` | `capacitor.car.config.ts` | `dist-car/` | وضع مدمج داخل السيارة |
| الإدارة (Admin) | `admin.html` | `vite.admin.config.ts` | — | `dist-admin/` | لوحة تحكم إدارية |
| الويب العام | `index.html` | `vite.config.ts` | — | `dist/` | الموقع التسويقي + كل التطبيقات |

## أسئلة معلقة
- ما هو الغرض الحالي من مجلد `raan-mobile/`؟ هل هو مشروع مستقل أم مرتبط بالمشروع الأساسي؟
- هل ملفات `.env` و `.env.production` الموجودة في Git تحتوي مفاتيح إنتاجية حقيقية أم مفاتيح تطوير؟
- ما هو مصدر Google Analytics ID (`G-XXXXXXXXXX`) — هل تم إعداده فعلاً؟
