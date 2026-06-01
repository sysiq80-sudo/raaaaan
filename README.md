# 🚗 ران RAAN — تطبيق النقل الذكي

> منصة تاكسي عراقية ذكية تعمل بـ React + Supabase + Capacitor

---

## ⚠️ حالة النظام

| البند | الحالة |
|---|---|
| درجة الجاهزية | **74**/100 |
| التوصية | ✅ **جاهز للـ Pilot** (Cash + Voucher فقط) — ❌ غير جاهز لـ Production الكامل |
| وضع الدفع | نقد (Cash) + قسائم RAAN — ZainCash/NASS مُعطَّلان (DR-05/DR-07) |
| آخر تدقيق | 2026-05-31 |
| Financial Watchdog | ✅ PASS=11 FAIL=0 (E2E مُثبَّت) |

> **⚠️ تحذير:** `.env` و `.env.production` في Git يحتويان مفاتيح حقيقية — اقرأ [تقرير التسليم النهائي](docs/FINAL_HANDOFF_REPORT.md) أولاً

## 📋 نظرة عامة

**ران** (RAAN) هو نظام نقل ذكي متكامل يشمل:
- **تطبيق الراكب** — حجز رحلات بالصوت أو الخريطة
- **تطبيق السائق** — استقبال وإدارة الطلبات + GPS خلفية مستمر
- **لوحة التحكم** — 58 صفحة إدارية شاملة
- **نظام السيارة** — وضع مدمج داخل السيارة

## 🛠️ التقنيات المستخدمة

| التقنية | الوظيفة |
|---|---|
| React 18 + TypeScript 5 + Vite 5 | الواجهة الأمامية |
| TailwindCSS 3 + shadcn/ui + Radix UI | التصميم |
| Zustand 5 + TanStack Query 5 | إدارة الحالة |
| React Router DOM 6 | التوجيه |
| Supabase (PostgreSQL + Realtime + Auth + Edge Functions) | الخلفية |
| Capacitor 8 (Android) + Transistorsoft GPS | الجوال |
| Google Maps + OSRM + Nominatim (fallback) | الخرائط |
| ZainCash + NASS | الدفع — **مُعطَّل (DR-05/DR-07)** |
| Sentry | مراقبة الأخطاء |
| i18next | تعدد اللغات (عربي + إنجليزي) |

## 📦 التطبيقات الأربعة (Multi-Flavor)

| التطبيق | الأمر | المنفذ |
|---|---|---|
| الراكب (Rider) | `npm run dev:rider` | 5173 |
| السائق (Driver) | `npm run dev:driver` | 5174 |
| الإدارة (Admin) | `npm run dev:admin` | 5175 |
| السيارة (Car) | `npm run dev:car` | 5176 |
| **الكل معاً** | `npm run dev` | 8080 |

## 🚀 التشغيل السريع

```bash
# 1. تثبيت المكتبات
npm install

# 2. إعداد البيئة
cp .env.example .env
# عدّل .env بقيمك الخاصة (راجع docs/SETUP_GUIDE.md)

# 3. تشغيل المشروع
npm run dev
```

### بناء APK (Android)
```bash
npm run apk:rider     # → builds/rider.apk
npm run apk:driver    # → builds/driver.apk
npm run apk:all       # → الكل
```

## 📖 التوثيق

| الملف | الوصف |
|---|---|
| [فحص المشروع](docs/PROJECT_SCAN_REPORT.md) | فحص شامل للتقنيات والهيكل |
| [فهرس التوثيق](docs/DOCUMENTATION_INDEX.md) | فهرس كل الملفات التوثيقية |
| [حالة النظام الفعلية](docs/ACTUAL_SYSTEM_STATUS.md) | حالة كل ميزة مبنية على الكود |
| [المعمارية التقنية](docs/ARCHITECTURE.md) | بنية النظام + طبقات + تدفق البيانات |
| [قاعدة البيانات](docs/DATABASE.md) | ~91 جدول + 236 migration + 50+ RPC |
| [المصادقة والصلاحيات](docs/AUTH_AND_PERMISSIONS.md) | Auth + Roles + RLS |
| [مرجع APIs](docs/API_REFERENCE.md) | 55 Edge Function + RPCs |
| [خريطة الواجهات](docs/UI_UX_MAP.md) | كل الصفحات والمكونات |
| [التدقيق الأمني](docs/SECURITY_AUDIT.md) | تدقيق أمني — 58/100 |
| [الاختبارات والجودة](docs/TESTING_AND_QA.md) | 12 اختبار + خطة مقترحة |
| [دليل التشغيل](docs/SETUP_GUIDE.md) | خطوات التشغيل المحلي بالتفصيل |
| [دليل النشر](docs/DEPLOYMENT_GUIDE.md) | Vercel + Supabase + APK |
| [نظام التوزيع v2](docs/DISPATCH_V2.md) | ETA ذكي + تقييم السائقين |
| [قائمة فحص التسليم](docs/HANDOFF_CHECKLIST.md) | 7.5/10 بنود مستوفاة |
| [**تقرير التسليم النهائي**](docs/FINAL_HANDOFF_REPORT.md) | **الحكم النهائي + درجة الجاهزية** |

## 📊 إحصائيات (29 مايو 2026)

| البند | العدد |
|---|---|
| ملفات مصدرية (TypeScript/TSX) | 538 |
| صفحات | 92 (admin:58 + driver:14 + rider:10 + عامة:10) |
| مكونات React | 180+ |
| Hooks مخصصة | 75 |
| Edge Functions | 55 |
| جداول قاعدة البيانات | ~91 |
| Migrations | 236 |
| ملفات اختبار | 12 (unit) |

## ⚠️ تحذيرات مهمة للفريق الجديد

1. 🔴 **مفاتيح API مكشوفة في Git** — يجب حذف `.env` و `.env.production` من Git + rotate المفاتيح فوراً
2. 🔴 **تغطية الاختبارات ~5-8%** — أضف E2E قبل أي تغيير كبير
3. 🔴 **RLS لم يُفحص على كل الجداول** — فحص شامل مطلوب
4. 🟠 **`GoPage.tsx` = 109KB** — أكبر ملف بالمشروع — يحتاج تقسيم
5. 🟠 **241 migration** — لا تعدّل migration قديم — أنشئ migration جديد دائماً
6. 🟠 **GPS خلفية** — يحتاج اختبار على APK فعلي (Transistorsoft v9)
7. 🔴 **الدفع (ZainCash/NASS)** — **مُعطَّل عمداً** — DR-05/DR-07 race conditions — لا تُفعِّلهما قبل إصلاح الثغرات

## 🔒 الأمان

- ✅ Row Level Security (RLS) على الجداول الأساسية
- ✅ Zod validation + sanitization
- ✅ Rate Limiting (server + client)
- ✅ Sentry لمراقبة الأخطاء
- ✅ Audit Logs للعمليات الحساسة
- ✅ Security headers (Vercel)
- ⚠️ RLS لم يُفحص على كل الـ ~91 جدول
- ❌ لا يوجد Content-Security-Policy (CSP)

## 🧪 الاختبارات

```bash
npm test              # Unit tests (Vitest)
npm run test:coverage # مع التغطية
npm run test:e2e      # E2E (Playwright)
npm run lint          # ESLint
```

## 📈 درجة الجاهزية

**62/100** — غير جاهز للتسليم الكامل، لكنه **قابل للتسليم المشروط** بعد إصلاح 3 مشاكل حرجة.
اقرأ [تقرير التسليم النهائي](docs/FINAL_HANDOFF_REPORT.md) للتفاصيل.

---

> **ران** — "سافر بذكاء" 🚗
