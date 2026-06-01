# التدقيق الأمني
> تاريخ التدقيق: 2026-05-31 (الجلسة الثالثة — إضافة fare manipulation protection)
> مصدر الحقيقة: الكود الفعلي
> ⚠️ هذا فحص مبني على قراءة الكود وليس اختبار اختراق حقيقي

## ملخص

| البند | النتيجة |
|---|---|
| درجة الأمان | **67**/100 (كانت 65 في 2026-05-31 صباح) |
| مشاكل حرجة | 3 (لم تُحل — موثّقة) |
| مشاكل مهمة | 4 |
| مشاكل ثانوية | 3 |
| **محلولة منذ 2026-05-31 صباح** | 1 مشكلة (fare manipulation protection) |

## المشاكل المكتشفة

| # | المشكلة | الخطورة | الملف | التفاصيل | التوصية |
|---|---|---|---|---|---|
| 1 | **مفاتيح API مكشوفة في Git** | 🔴 حرجة | 📁 `.env.production` | Supabase Anon Key + Google Maps API Key + Sentry DSN مرفوعة في Git | أضف `.env.production` لـ `.gitignore` + أعد توليد المفاتيح (rotate) |
| 2 | **`.env` موجود في Git** | 🔴 حرجة | 📁 `.env` | يحتوي نفس المفاتيح الإنتاجية — `.gitignore` يمنع `.env` لكن الملف مرفوع مسبقاً | احذف الملف من Git history (`git rm --cached .env`) + أعد توليد المفاتيح |
| 3 | **RLS غير مُتحقق منه لكل الجداول** | 🔴 حرجة | 📁 `supabase/migrations/` | ~91 جدول — فُحص RLS على ~15 فقط — الباقي ⚠️ غير مؤكد | فحص شامل لكل جدول + إضافة RLS policies |
| 4 | **GoPage.tsx = 109KB** | 🟡 مهمة | 📁 `src/pages/rider/GoPage.tsx` | ملف ضخم يصعب مراجعته أمنياً — يحتاج تقسيم | تقسيم إلى مكونات أصغر |
| 5 | **App.tsx = 46KB** | 🟡 مهمة | 📁 `src/App.tsx` | كل routes في ملف واحد — يصعب مراجعة الحماية | تقسيم routes إلى ملفات منفصلة |
| 6 | **Role caching في localStorage** | 🟡 مهمة | 📁 `src/contexts/AuthContext.tsx:229` | الدور يُقرأ من localStorage أولاً (قابل للتعديل من console المتصفح) — يُصحح في الخلفية لكن هناك نافذة زمنية | ⚠️ مقبول لأن RLS يحمي على مستوى DB — لكن يُفضل عدم الاعتماد عليه لقرارات UI حساسة |
| 7 | **Supabase URL مكشوف في الكود** | 🟡 مهمة | 📁 `capacitor.config.ts:31` | URL الإنتاجي hardcoded في `allowNavigation` | نقله لمتغير بيئة |
| 8 | **تغطية اختبارات ~5-8%** | 🟡 مهمة | 📁 `src/` | 12 ملف اختبار فقط من 538 ملف — لا يوجد اختبارات للـ auth flow أو payment | إضافة اختبارات E2E لـ auth + payment + ride booking |
| 9 | **delayAlert TODO** | 🟢 ثانوية | 📁 `src/lib/delayAlert.ts:211,232` | دالتان معطلتان بسبب TODO — migration موجودة لكن الكود لم يُفعّل | مراجعة وتفعيل أو حذف |
| 10 | **Google Analytics ID غير مضبوط** | 🟢 ثانوية | 📁 `src/lib/googleAnalytics.ts:5` | تعليق: "استبدل G-XXXXXXXXXX" — قد يكون غير مضبوط | ضبط أو حذف |
| 11 | **CORS غير مُقيّد في بعض Edge Functions** | 🟢 ثانوية | 📁 `supabase/functions/_shared/` | ⚠️ غير مؤكد — يحتاج فحص `_shared/cors.ts` | مراجعة CORS configuration |
| 12 | **console.log في AuthContext** | 🟢 ثانوية | 📁 `src/contexts/AuthContext.tsx` | عدة console.log — تُحذف في production بسبب terser | ⚠️ آمن في production — لكن يكشف معلومات في development |

## فحوصات مكتملة

| الفحص | النتيجة | الدليل |
|---|---|---|
| أسرار مكشوفة في الكود | ❌ يوجد مشكلة | `.env` + `.env.production` في Git — **لم تُحل بعد** |
| حماية `.env` من Git | ⚠️ جزئي | `.gitignore` يحظر `.env` لكن الملف مرفوع مسبقاً قبل إضافته للـ .gitignore |
| حماية APIs (Edge Functions) | ✅ آمن | JWT verification في معظم الدوال عبر `_shared/` |
| صلاحيات قاعدة البيانات (RLS) | ⚠️ جزئي | مُفعّل على الجداول الأساسية — لم يُفحص على الكل |
| التحقق من المدخلات | ✅ آمن | Zod validation — 📁 `src/lib/validations.ts` + `src/lib/sanitization.ts` |
| تخزين الملفات | ⚠️ غير مؤكد | Supabase Storage — لم تُفحص صلاحيات Buckets |
| XSS Protection | ✅ آمن | React DOM escaping + لا يوجد `dangerouslySetInnerHTML` مكشوف |
| SQL Injection | ✅ آمن | Supabase Client parameterized queries + Edge Functions |
| IDOR | ⚠️ جزئي | RLS يمنع — لكن بعض الجداول قد لا تملك RLS |
| عزل المستأجرين | ✅ آمن | تطبيق لشركة واحدة — عزل المستخدمين عبر RLS |
| CORS | ⚠️ غير مؤكد | يحتاج فحص `supabase/functions/_shared/` |
| Rate Limiting | ✅ آمن | عميل: 📁 `src/hooks/useRateLimiting.ts` + خادم: جدول `rate_limit_entries` |
| CSRF | ✅ آمن | SPA + JWT (لا cookies = لا CSRF) |
| Security Headers | ✅ آمن | Vercel: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy` — 📁 `vercel.json` |
| Content Security Policy (CSP) | ❌ غير موجود | لا يوجد CSP header في `vercel.json` |
| Console drops in production | ✅ آمن | `terser.compress.drop_console: mode === "production"` — 📁 `vite.config.ts:27` |
| Audit Logging | ✅ آمن | جدول `audit_logs` + سجلات شاملة — 📁 migration `20260411000000` |
| سلامة المعاملات المالية | ✅ **مُثبَّت** | Financial Watchdog E2E: PASS=11 FAIL=0 (2026-05-31) — W01-W05 جميعها pass |
| التعويض المزدوج (double compensation) | ✅ **محمي** | `trigger_driver_compensation_90s` مُعطَّل — `trigger_rider_cancellation_penalty` + `captain_compensation_shield` بديل |
| التلاعب بأجرة الرحلة (fare manipulation) | ✅ **محمي** | Server-side sanity bounds: `speed = dist/(dur/60) ∈ [5,100] km/h` — `supabase/functions/calculate-fare/index.ts` — يرفض `duration_minutes` التلاعبي |

## توصيات أولوية

### 🔴 عاجل (يجب إصلاحه فوراً)
1. **حذف `.env` و `.env.production` من Git history** + إعادة توليد المفاتيح المكشوفة
   ```bash
   git rm --cached .env .env.production
   git commit -m "fix: remove env files from git tracking"
   # ثم rotate: Supabase Anon Key + Google Maps Key + Sentry DSN
   ```
2. **فحص RLS لكل الجداول** (~76 جدول لم يُفحص)

### 🟡 مهم (قبل الإطلاق)
3. **إضافة CSP header** في `vercel.json`
4. **تقسيم GoPage.tsx وApp.tsx** لتسهيل المراجعة الأمنية
5. **إضافة اختبارات E2E** للمصادقة والحجز

### 🟢 تحسينات
6. نقل Supabase URL من `capacitor.config.ts` لمتغير بيئة
7. ضبط Google Analytics أو حذفه
8. مراجعة CORS في Edge Functions

## أسئلة معلقة
- ❌ **لم تُحل**: هل تم عمل rotate للمفاتيح المكشوفة في Git؟ (Supabase Anon Key + Google Maps Key + Sentry DSN)
- ⚠️ هل Supabase Storage buckets لديها صلاحيات مضبوطة؟
