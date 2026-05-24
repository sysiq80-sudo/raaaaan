# RAAN — حالة المشروع وتقرير فحص الكود

> آخر فحص شامل: 21 مايو 2026 | مبني حصرياً على فحص الكود المصدري

---

## 🏗️ البنية العامة

- **الاسم:** RAAN Captain (تطبيق النقل الذكي)
- **النوع:** React + TypeScript + Capacitor (Android)
- **الإطار:** Vite 5 + React 18 + TailwindCSS + shadcn/ui
- **قاعدة البيانات:** Supabase (PostgreSQL + Realtime + Edge Functions)
- **الخرائط:** Google Maps (`@react-google-maps/api`)
- **الإشعارات:** FCM + Web Push (Hybrid)
- **المدفوعات:** ZainCash + NASS + محفظة داخلية

---

## 📦 التطبيقات الأربعة (Multi-Flavor)

| التطبيق | Entry Point | Vite Config | Capacitor Config |
|---------|------------|------------|-----------------|
| **Rider** | `src/apps/rider/main.tsx` | `vite.rider.config.ts` | `capacitor.rider.config.ts` |
| **Driver** | `src/apps/driver/main.tsx` | `vite.driver.config.ts` | `capacitor.driver.config.ts` |
| **Admin** | `src/apps/admin/main.tsx` | `vite.admin.config.ts` | — |
| **Car** | `src/apps/car/main.tsx` | `vite.car.config.ts` | `capacitor.car.config.ts` |

> `App.tsx` الرئيسي يجمع كل التطبيقات في Monolith واحد مع routing ذكي حسب دور المستخدم.

---

## 📊 إحصائيات الكود (مايو 2026)

| المقياس | القيمة |
|---------|-------|
| ملفات المصدر (src/) | 300+ ملف |
| Hooks مخصصة | 73 hook |
| Components | 180+ component |
| Pages | 80+ صفحة |
| Zustand Stores | 4 stores |
| React Contexts | 5 contexts |
| Services | 8 خدمات |
| Edge Functions | 54 function |
| DB Migrations | 191 migration |
| Unit Tests | 62 test |
| Dependencies | 85 dependency |
| Dev Dependencies | 29 dependency |

---

## 🔀 نظام التوجيه

```
/            → Redirect حسب الدور (mobile: /auth, desktop: Landing)
/auth        → صفحة تسجيل الدخول الموحدة
/rider       → AIVoiceHome (الشاشة الصوتية الرئيسية)
/rider/go    → GoPage (خريطة الحجز التقليدية)
/rider/schedule → GoPage (وضع الجدولة)
/driver      → DriverHome
/admin       → AdminDashboard
```

---

## ✅ نتائج فحص الكود — مايو 2026

### نقاط القوة المؤكدة

| # | القوة | الدليل |
|---|------|--------|
| 1 | TypeScript صارم في كل مكان | `.ts`/`.tsx` فقط + types مُولَّدة (6,012 سطر) |
| 2 | Supabase client مُعد بشكل ممتاز | reconnect + heartbeat 15s + lock bypass |
| 3 | AuthContext قوي ومتين | instant role load + safety timeout 4s + stale closure fix |
| 4 | Zustand stores مصممة جيداً | `partialize` ذكي + selectors منفصلة |
| 5 | Lazy loading شامل | كل الصفحات + prefetch بعد 3 ثوانٍ |
| 6 | ErrorBoundary على كل route | Sentry + custom ErrorBoundary |
| 7 | Capacitor Bridge شامل (15 إضافة) | GPS, FCM, Haptics, TTS, Speech Recognition, Wake Lock |
| 8 | نظام أمان متعدد الطبقات | DOMPurify + Zod + sanitization |
| 9 | حساب الأسعار Pure Functions | قابل للاختبار، surge محدود بـ 2.0x |
| 10 | 191 migration | RLS, surge, fraud, wallet, emergency, audit |
| 11 | 54 Edge Function | matching, payment, notifications, bots, AI |
| 12 | 62 unit test ناجح | adapters, booking, formatting, routing |

### مشاكل مكتشفة (تحتاج معالجة)

| # | المشكلة | الخطورة | الملف |
|---|--------|---------|-------|
| 1 | SupabaseConfigContext يُنشئ عميل ثانٍ مختلف عن الرئيسي | متوسطة | `src/contexts/SupabaseConfigContext.tsx` |
| 2 | تعارض schemas كلمة المرور (validations vs sanitization) | متوسطة | `src/lib/validations.ts` vs `sanitization.ts` |
| 3 | App.tsx = 1,198 سطر (كل routes في ملف واحد) | منخفضة | `src/App.tsx` |
| 4 | sanitizeForDatabase غير ضرورية مع Supabase | منخفضة | `src/lib/sanitization.ts` |
| 5 | 3 مكتبات خرائط مثبتة (Google + Leaflet + Mapbox) لكن واحدة مستخدمة | منخفضة | `package.json` |

---

## 🧪 حالة الاختبارات

| الملف | النتيجة |
|-------|---------| 
| `EventDeduplicator.test.ts` | ✅ 11/11 |
| `HaversineRoutingAdapter.test.ts` | ✅ 8/8 |
| `NotificationRouter.test.ts` | ✅ 6/6 |
| `AdapterFactory.test.ts` | ✅ 10/10 |
| `NominatimGeocodingAdapter.test.ts` | ✅ 6/6 |
| `OSRMRoutingAdapter.test.ts` | ✅ 6/6 |
| `useAdaptiveRouting.test.ts` | ✅ 6/6 |
| `addressFormatting.test.ts` | ✅ 3/3 |
| `riderBooking.test.ts` | ✅ 6/6 |
| **الإجمالي** | **✅ 62/62** |

---

## 🏃 الخطوات التالية (حسب الأولوية)

### جاهز للتنفيذ
1. **معالجة تعارض SupabaseConfigContext** — توحيد عميل Supabase
2. **توحيد schemas كلمة المرور** بين validations.ts و sanitization.ts
3. **دمج طبقة المحوّلات بالكامل مع GoPage** (بديل مجاني لـ Google)

### تحسين هيكلي (غير عاجل)
1. تقسيم App.tsx إلى route files منفصلة
2. حذف `sanitizeForDatabase` من sanitization.ts
3. إزالة مكتبات الخرائط غير المستخدمة (leaflet, mapbox-gl) من package.json
