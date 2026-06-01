# الاختبارات والجودة
> تاريخ التوثيق: 2026-05-31 (الجلسة الثالثة — إضافة fareCalculation 26 اختبار)
> مصدر الحقيقة: الكود الفعلي

## ملخص

| البند | القيمة |
|---|---|
| اختبارات موجودة | ✅ |
| إطار الاختبار | Vitest (Unit) + Playwright (E2E) |
| عدد ملفات الاختبار (Unit) | 12 🟢 مؤكد |
| تغطية `fareCalculation.ts` | ✅ **26/26 اختبار** — مُؤكَّد (الجلسة الثالثة) |
| تغطية تقديرية (إجمالي) | ~5-8% ⚠️ غير مؤكد — لم تُقاس فعلياً |

## أنواع الاختبارات الموجودة

| النوع | موجود؟ | عدد الملفات | الأداة |
|---|---|---|---|
| Unit Tests | ✅ | 12 | Vitest + Testing Library |
| Integration Tests | ❌ | 0 | — |
| E2E Tests | ✅ (بنية فقط) | مجلد `e2e/` موجود | Playwright |
| Component Tests | ❌ | 0 | — |

## ملفات الاختبار (Unit)

| الملف | النوع | ماذا يختبر | الحالة |
|---|---|---|---|
| 📁 `src/lib/fareCalculation.test.ts` | Unit | حساب الأجرة | ✅ (10KB) |
| 📁 `src/lib/fareEstimation.test.ts` | Unit | تقدير الأجرة | ✅ (5KB) |
| 📁 `src/lib/mapUtils.test.ts` | Unit | أدوات الخريطة | ✅ |
| 📁 `src/lib/addressFormatting.test.ts` | Unit | تنسيق العناوين | ✅ |
| 📁 `src/lib/riderBooking.test.ts` | Unit | حجز الراكب | ✅ |
| 📁 `src/lib/adapters/OSRMRoutingAdapter.test.ts` | Unit | محول OSRM | ✅ |
| 📁 `src/lib/adapters/NominatimGeocodingAdapter.test.ts` | Unit | محول Nominatim | ✅ |
| 📁 `src/lib/adapters/HaversineRoutingAdapter.test.ts` | Unit | حساب المسافة (Haversine) | ✅ |
| 📁 `src/lib/adapters/AdapterFactory.test.ts` | Unit | مصنع المحولات | ✅ |
| 📁 `src/lib/notificationRouter/NotificationRouter.test.ts` | Unit | موجه الإشعارات | ✅ |
| 📁 `src/lib/eventDeduplication/EventDeduplicator.test.ts` | Unit | إزالة تكرار الأحداث | ✅ |
| 📁 `src/hooks/useAdaptiveRouting.test.ts` | Unit | التوجيه التكيفي | ✅ |

## المناطق غير المغطاة بالاختبارات

| المنطقة | الأهمية | ملاحظة |
|---|---|---|
| تدفق المصادقة (Auth Flow) | 🔴 حرجة | لا يوجد اختبار لـ AuthContext أو OTP أو role detection |
| تدفق الحجز الكامل (Booking Flow) | 🔴 حرجة | لا يوجد E2E لحجز رحلة كاملة |
| Edge Functions | 🔴 حرجة | 55 دالة بدون أي اختبارات |
| الدفع (ZainCash/NASS) | 🔴 حرجة | لا يوجد اختبار لـ callback أو verification |
| ProtectedRoute | 🟡 مهمة | لا يوجد اختبار لحماية المسارات |
| مكونات الأدمن | 🟡 مهمة | 58 صفحة بدون اختبارات |
| مكونات السائق | 🟡 مهمة | 14 صفحة بدون اختبارات |
| RLS Policies | 🟡 مهمة | لا يوجد اختبارات تتحقق من عدم تسرب البيانات |
| GPS خلفية | 🟢 ثانوية | يحتاج اختبار فعلي على APK |

## أوامر الفحص والتشغيل

| الأمر | الوظيفة | موجود في `package.json`؟ |
|---|---|---|
| `npm test` | تشغيل الاختبارات (Vitest) | ✅ — `vitest run` |
| `npm run test:watch` | اختبارات مستمرة | ✅ — `vitest` |
| `npm run test:coverage` | مع التغطية | ✅ — `vitest run --coverage` |
| `npm run test:e2e` | اختبارات E2E | ✅ — `playwright test` |
| `npm run lint` | فحص الكود | ✅ — `eslint .` |
| `npm run build` | بناء المشروع | ✅ — `vite build` |
| `npm run dev` | تشغيل محلي | ✅ — `vite` (port 8080) |
| `npm run check:migrations` | فحص تعديلات migrations | ✅ |
| `npm run check:deletes` | فحص عمليات الحذف | ✅ |
| `npm run safety-check` | تذكير بقراءة التعليمات | ✅ |

## أدوات الجودة

| الأداة | مفعّلة | الإعداد | ملاحظة |
|---|---|---|---|
| ESLint | ✅ | 📁 `eslint.config.js` | flat config |
| TypeScript strict | ✅ | 📁 `tsconfig.json` | `strict: true`, `noUnusedLocals`, `noUnusedParameters` |
| Vitest | ✅ | 📁 `vitest.config.ts` | |
| Playwright | ✅ (بنية فقط) | 📁 `playwright.config.ts` | |
| Prettier | ❌ | غير موجود | |
| Husky / lint-staged | ❌ | غير موجود | |

## خطة اختبار مقترحة

### أولوية 1 — 🔴 حرجة
1. **E2E: تسجيل دخول راكب** — Auth → OTP → redirect لـ /rider
2. **E2E: حجز رحلة كاملة** — اختيار وجهة → إنشاء طلب → تحقق من DB
3. **Unit: Edge Functions** — اختبار `calculate-fare`, `complete-ride`, `match-ride`
4. **Integration: RLS** — تحقق أن المستخدم لا يرى بيانات مستخدمين آخرين

### أولوية 2 — 🟡 مهمة
5. **E2E: تسجيل سائق** — Register → Upload docs → Application status
6. **Unit: AuthContext** — detectUserRole, role caching, multi-device
7. **E2E: لوحة الأدمن** — Login → Dashboard → إدارة السائقين

### أولوية 3 — 🟢 تحسينات
8. **Component: ProtectedRoute** — اختبار redirect حسب الدور
9. **Unit: sanitization** — اختبار `src/lib/sanitization.ts`
10. **Performance: Lighthouse** — قياس أداء الصفحات الرئيسية

## أسئلة معلقة
- ✅ تم التحقق: مجلد `e2e/` يحتوي هيكل فقط (auth.spec.ts, navigation.spec.ts, smoke.spec.ts) — لا اختبارات حقيقية
- ⚠️ `npm run test:coverage` لم يُشغَّل رسمياً — التقدير 5-8% قائم

## التحقق المالي (نوع جديد من الاختبارات — 2026-05-31)

### Financial Watchdog E2E — `supabase/verification/run-watchdog-full.ts`

| الفحص | النتيجة | الوصف |
|---|---|---|
| W01 — Orphan Wallet Transactions | ✅ PASS | لا معاملات محفظة مرتبطة برحلات مفقودة |
| W02 — Double Credit | ✅ PASS | لا رصيد مضاعف — `create_wallet_transaction()` يمنع التكرار |
| W03 — Voucher Double Redeem | ✅ PASS | لا قسيمة مستردة مرتين |
| W04 — Balance Mismatch | ✅ PASS | رصيد الراكب والسائق متطابق مع سجل المعاملات |
| W05 — Negative Balance Leak | ✅ PASS | لا رصيد سالب في أي محفظة |
| **المجموع** | **PASS=11 FAIL=0** | تم 2026-05-31 — النظام المالي سليم للـ Pilot |

> ⚠️ الأمر يتطلب: `$env:RAAN_ADMIN_CONFIRM='yes'` + `$env:RAAN_ENV='production'`
