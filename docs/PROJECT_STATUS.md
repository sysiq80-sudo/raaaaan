# RAAN — حالة المشروع وتقرير فحص الكود

> آخر تحديث: 26 مايو 2026 | مبني حصرياً على فحص الكود المصدري والـ git log الفعلي

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
| 6 | `WebView.setWebContentsDebuggingEnabled(true)` دائماً مفعّل — يكشف كل الـ traffic لأي شخص يملك كابل USB حتى في الإنتاج | **عالية قبل Play Store** | `android/app/src/main/java/com/raan/rider/MainActivity.java` |
| 7 | `minifyEnabled false` في buildType release — APK الإنتاج غير مضغوط وغير مشفر الأسماء، سهل العكس | متوسطة | `android/app/build.gradle` |
| 8 | لا يوجد `signingConfigs` في build.gradle — APK release يُوقَّع بـ debug keystore، لا يمكن رفعه على Play Store | **لازمة للنشر** | `android/app/build.gradle` |

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

## 📈 خطة السعة والتوسع التشغيلي

> آخر مراجعة: 26 مايو 2026  
> الهدف: تحويل تقدير الموارد إلى خطة تشغيل فعلية للـ Pilot ثم الإطلاق المحلي، بدون افتراض أن عدد الحسابات المسجلة يساوي عدد المستخدمين المتصلين لحظياً.

### حدود Supabase Realtime المرجعية

حسب وثائق Supabase الحالية:

| الخطة | الاتصالات المتزامنة | الرسائل/الثانية | ملاحظات |
|------|---------------------|-----------------|---------|
| Free | 200 اتصال | 100 رسالة/ثانية | مناسب لفحص داخلي وPilot صغير |
| Pro | 500 اتصال | 500 رسالة/ثانية | مناسب لإطلاق منطقة/مدينة بحجم مضبوط |
| Pro بدون Spend Cap | حتى 10,000 اتصال | 2,500 رسالة/ثانية | يحتاج مراقبة تكلفة وضبط رسائل Realtime |

المصدر: [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/rate-limits) و[Supabase Realtime pricing](https://supabase.com/docs/guides/realtime/pricing).

### تقدير تشغيل RAAN على الموارد الحالية

| المرحلة | السائقون المتصلون فعلياً | الركاب النشطون فعلياً | الحسابات المسجلة المتوقعة | القرار |
|--------|--------------------------|------------------------|----------------------------|--------|
| Pilot صغير | 20-50 | 50-100 | 200-500 راكب | مناسب على Free/Pro مع مراقبة |
| إطلاق أول منطقة | 100-200 | 150-300 | 2,000-5,000 راكب | يفضّل Pro |
| إطلاق مدينة كاملة | 300-700 | 500-1,000 | 10,000-30,000 راكب | Pro بدون Spend Cap + ضبط Realtime |
| توسع أكبر | 1,000+ | 1,000+ | 50,000+ راكب | فصل خدمات الموقع/التوجيه ومراجعة بنية Realtime |

### قواعد تشغيل إلزامية قبل التوسع

1. تحديث موقع السائق كل 5-10 ثوانٍ فقط، أو عند حركة فعلية أكبر من 10-20 متر.
2. منع إرسال GPS كل ثانية في الإنتاج إلا أثناء رحلة نشطة وبحدود ضيقة.
3. الركاب يشتركون فقط في رحلة واحدة نشطة، وليس في كل حركة الأسطول.
4. لوحة الأدمن لا تعرض كل السائقين مباشرة عند الأعداد الكبيرة؛ تستخدم تجميع/فلترة حسب المنطقة.
5. مراقبة Supabase Realtime: Peak Connections, Messages/sec, Channel errors.
6. تفعيل Sentry وSupabase logs أثناء الـ Pilot، ومراجعة الأخطاء يومياً.
7. عدم الانتقال من Pilot إلى إطلاق عام قبل اختبار 14-30 يوم على أجهزة سائقين حقيقية.

### مؤشرات الانتقال للمرحلة التالية

| المؤشر | الحد المقبول |
|-------|--------------|
| فشل Realtime أو CHANNEL_ERROR | أقل من 1% من الجلسات النشطة |
| تأخر ظهور طلب الرحلة للسائق | أقل من 3 ثوانٍ في أغلب الحالات |
| تأخر تحديث موقع السائق للراكب | 5-10 ثوانٍ مقبول |
| فشل complete-ride | صفر حالات غير معالجة مالياً |
| استهلاك البطارية للسائق | مقبول ميدانياً خلال دوام 6-8 ساعات |

### قرارات تقنية مؤجلة حسب النمو

| متى؟ | القرار |
|------|--------|
| أقل من 200 سائق متصل | Supabase Realtime الحالي كافٍ |
| 300-700 سائق متصل | تحسين قنوات Realtime وتقليل payloads ومراقبة التكلفة |
| 1,000+ سائق متصل | دراسة خدمة مواقع مستقلة أو طبقة WebSocket مخصصة للسائقين |
| 5,000+ سائق متصل | بنية Dispatch/Location منفصلة عن قاعدة البيانات العامة |

---

## 🏃 الخطوات التالية (حسب الأولوية)

### جاهز للتنفيذ
1. **معالجة تعارض SupabaseConfigContext** — توحيد عميل Supabase
2. **توحيد schemas كلمة المرور** بين validations.ts و sanitization.ts
3. **دمج طبقة المحوّلات بالكامل مع GoPage** (بديل مجاني لـ Google)
4. **تثبيت خطة الـ Pilot التشغيلية** — 20-50 سائق حقيقي، 14-30 يوم، مراقبة Realtime وGPS وcomplete-ride

### مطلوب قبل نشر Play Store (Android)
1. **إصلاح WebView Debugging** — تغيير `setWebContentsDebuggingEnabled(true)` إلى `BuildConfig.DEBUG` في `MainActivity.java`
2. **تفعيل minifyEnabled** — تغيير `minifyEnabled false` إلى `true` في buildType release في `build.gradle`
3. **إضافة signingConfigs** — إنشاء keystore إنتاج وإضافة `signingConfigs` block في `build.gradle` وربطه بـ buildType release

### تحسين هيكلي (غير عاجل)
1. تقسيم App.tsx إلى route files منفصلة
2. حذف `sanitizeForDatabase` من sanitization.ts
3. إزالة مكتبات الخرائط غير المستخدمة (leaflet, mapbox-gl) من package.json
4. تجهيز مسار التوسع إلى Pro/Pro بدون Spend Cap عند تجاوز حدود Pilot

---

## 📋 سجل التغييرات — 28 مايو 2026

### تصليب الأمان (Security Hardening) — Edge Functions
**الملفات الرئيسية:**
- `supabase/functions/detect-fraud-patterns/index.ts` — تأمين بـ `requireInternalSecret` (كان مكشوفاً للعموم)
- `supabase/functions/admin-telegram-webhook/index.ts` — تعطيل عمل الإنتاج بعلامة `ADMIN_TELEGRAM_WEBHOOK_DISABLED = true`
- `supabase/config.toml` — إضافة إدخالات صحيحة مع تعليقات توضيحية لكل function
- `supabase/migrations/20270528001000_captain_guardian_internal_secret_callers.sql` — تحديث DB triggers لاستخدام Vault secret
- `docs/EDGE_FUNCTION_SECURITY.md` — توثيق شامل لوضع أمان كل Edge Function

**الوضع الأمني بعد الجلسة:**
- ✅ 7 Edge Functions داخلية محمية بـ `requireInternalSecret`
- ✅ admin-telegram-webhook معطّل (لا side effects)
- ⚠️ `AdminFraudAlerts.tsx` يستدعي `detect-fraud-patterns` من المتصفح → سيرجع 403 حتى يتم الإصلاح
- ⚠️ `INFOBIP_WEBHOOK_SECRET` لم يُضبط بعد في Supabase Secrets

**فحص TypeScript:** ✅ 0 أخطاء

---

## 📋 سجل التغييرات — 26 مايو 2026 (الجلسة الثانية)

### تحسينات الواجهة النهائية للإطلاق
**الملفات الرئيسية:** 
- `src/pages/rider/GoPage.tsx` — زر إغلاق، تقليل padding، توحيد خط، حذف شريط المحفوظة
- `src/components/rider/DynamicSearchResults.tsx` — إصلاح تكرار إنجليزي، نص بحث أسود
- `src/components/rider/BookingConfirmationView.tsx` — تعطيل جدولة الرحلات
- `src/components/rider/AIVoiceHome.tsx` — إضافة 11 موقع لجامعات الرمادي
- `src/components/rider/RiderSideMenu.tsx` — جلب اسم ديناميكي، زر خروج أحمر
- `src/pages/rider/WalletTopupPage.tsx` — أيقونة دائرية خضراء مشعة
- `docs/FUTURE_FEATURES.md` — توثيق ميزة الجدولة المعطلة
- **67 ملف** — توحيد `.toLocaleString('en-US')`

**فحص TypeScript:** ✅ 0 أخطاء

---

## 📋 سجل التغييرات — 26 مايو 2026 (الجلسة الأولى)

### `b352883` ui: تطبيق ثيم الفخامة الداكن، تنظيف العناوين العربية، وإصلاح رسم المسار وزر المفضلة
**الملفات:** 
- `src/components/rider/LiveRideTracker.tsx`
- `src/components/rider/RideWaitingScreen.tsx`
- `src/pages/rider/GoPage.tsx`
- `src/components/rider/DynamicSearchResults.tsx`
- `src/hooks/useBookingFlow.ts`
- `src/components/driver/ActiveRideCard.tsx`
- `src/components/driver/RideRequestCard.tsx`

**التفاصيل:**
- **ثيم الفخامة الداكن (Dark Luxury):** تطبيق الثيم بالكامل على بطاقة تتبع حالة الرحلة (قَبِل/وصل/بالطريق/وصلنا) والقائمة السفلية (Bottom Sheet) والرسائل السياقية السريعة في واجهة تتبع الرحلة `LiveRideTracker.tsx`؛ وكذلك على بطاقة معلومات السائق ومسار الرحلة في واجهة الانتظار `RideWaitingScreen.tsx`. تم استبدال جميع درجات اللون الأبيض والرمادي الفاتح (`#E4E7EC`, `#101828`) بألوان لوحة السائل الداكنة المعتمدة (`bg-[#1a2333]`, `bg-[#0d1321]`, `border-slate-800/40`, `text-slate-100`, `text-slate-200`).
- **تنظيف العناوين بالكامل (Arabic Address Only):** تصفية كل من عنوان الانطلاق والوصول المعروضين في واجهات السائق (`ActiveRideCard` و `RideRequestCard`) باستخدام دالة `cleanArabicAddress()` لإرجاع نصوص عربية نقية خالية من التشوهات أو العناوين الإنجليزية المكررة التي ترجعها Google Maps API.
- **تعديل زر حفظ المفضلة (Heart Location Icon):** نقل زر المفضلة ليكون عائماً فوق زر تحديد الموقع الجغرافي مباشرة في `GoPage.tsx` وتثبيت شرط ظهوره بناءً على توافر إحداثيات خطوط الطول والعرض فقط (`centerLat && centerLng`) بدون اشتراط العنوان النصي لتسريع عملية حفظ الأماكن المفضلة.
- **إلغاء التكرار في نتائج البحث:** حذف أزرار حفظ المفضلة وتحديد الموقع الجغرافي المكررة من مكون `DynamicSearchHeader` بداخل `DynamicSearchResults.tsx` لمنع تداخل أزرار التحكم.
- **تجاوز مشاكل خرائط جوجل غير المفوترة (Billing Workaround):** إصلاح تعطل رسم المسار عند الضغط على "احجز الآن" (`useBookingFlow.ts`) عبر استدعاء دالة جلب المسار والرسم `fetchRouteAndDraw` مباشرة عند توفر المواقع بدلاً من تعليق الاستدعاء على حدث `idle` الخاص بالخريطة، مما يضمن عمل مسار الحجز حتى وإن كان هناك خطأ في تفعيل فوترة الخريطة (`BillingNotEnabledMapError`).

---

## 📋 سجل التغييرات — 25 مايو 2026

### `83f16ed` style: استبدال شعار التطبيق بالكامل بشعار ران الأخضر الدائري الجديد
**الملفات:** 
- `src/assets/logo.png`
- `public/logo.png`

**التفاصيل:**
- استبدال الشعار القديم بشعار ران الأخضر الدائري الفاخر المعتمد (`500.png`) في جميع شاشات التطبيق، ويشمل ذلك شاشات البداية (Splash Screens)، الإشعارات المباشرة (FCM / Web Push)، شريط التنقل، القوائم الجانبية، ومثبت الـ PWA.

---

### `ceee205` feat: حذف زر "الطوارئ والدعم" من خريطة السائق
**الملفات:** 
- `src/components/driver/DriverMap.tsx`

**التفاصيل:**
- إزالة زر الطوارئ والدعم الأحمر (`button.w-12.h-12`) بالكامل من لوحة التحكم الجانبية لخريطة السائق لتنظيف الواجهة.
- إزالة استيراد الأيقونة غير المستخدمة `ShieldAlert` من مكتبة `lucide-react`.

---

### `ae5e246` style: تكبير حجم مؤشر سيارة السائق إلى 80x80 بكسل على كافة الخرائط
**الملفات:** 
- `src/components/driver/DriverMap.tsx`
- `src/components/Map.tsx`
- `src/components/rider/LiveRideTracker.tsx`

**التفاصيل:**
- تكبير مقاس مؤشر مركبة السائق من `48x48` (و`64x64`) إلى **`80x80` بكسل** لضمان وضوح بصري عالٍ وحضور ممتاز على الخريطة.
- إعادة حساب إحداثيات الدوران والمركز لتصبح عند `(40, 40)`، وتعديل حجم صورة السيارة (`66.6x38.8`) والظل (`ellipse cx="40" cy="41.6" rx="30" ry="15"`) وموقع انبعاث الأضواء الأمامية بما يتوافق مع الحجم الجديد.

---

### `775f8e1` feat: جذب دبوس الخريطة (Snap Pin) لأقرب عنوان/شارع فعلي وتثبيت أسماء المعالم
**الملفات:** 
- `src/hooks/useLocationPicker.ts`

**التفاصيل:**
- **جذب الدبوس (Geocoding Snap)**: عند إفلات الخريطة وتحديد موقع، يتم استخراج إحداثيات العنوان الفعلي (`geometry.location`) المرجوع من Google Geocoding API، وإذا كانت المسافة بين الموقع المختار والعنوان الفعلي بين 2 متر و 120 متر، ينجذب الدبوس وتتحرك الخريطة تلقائياً لأقرب شارع/رصيف.
- **منع التكرار (Loop Prevention)**: تفعيل العلم `skipNextReverseGeocodeRef.current = true` لتخطي حدث الـ `idle` التالي عند حركة الخريطة برمجياً وتجنب الدوران اللانهائي.
- **تثبيت أسماء المعالم (POI Click)**: تفعيل نفس العلم عند الضغط على معالم الخريطة (POI) لمنع حدث الـ `idle` من إعادة الاستعلام وتخريب اسم المعلم الجميل المحدد (مثل مسجد، مستشفى) بترميز عام.

---

## 📋 سجل التغييرات — 24 مايو 2026

### `2a51b6d` feat(rider): توسيع نطاق البحث تدريجياً عند إعادة المطابقة
**الملف:** `src/components/rider/RideWaitingScreen.tsx`

**المشكلة التي كانت موجودة:**
- دالة `triggerReMatch()` كانت تستدعي Edge Function `match-ride` بـ `re_match: true` فقط
- لم يكن يتم تحديث `ride.metadata.radius_bonus_km` قبل الاستدعاء
- الـ Edge Function تقرأ `radiusBonus = (ride.metadata as any)?.radius_bonus_km || 0` مباشرة — لذا كان النطاق يبقى صفراً
- النص في الواجهة كان "توسيع نطاق البحث..." لكن لا توسيع فعلي يحدث

**ما تم تنفيذه:**
- في `triggerReMatch()`: جلب `status, metadata` معاً بدلاً من `status` فقط
- حساب `newBonus = Math.min(prevBonus + 3, 12)` وكتابته في `ride.metadata.radius_bonus_km` عبر Supabase قبل استدعاء `match-ride`
- إضافة state جديد `currentRadiusBonus` لعرض القيمة الفعلية في الواجهة
- تحديث نص الواجهة: `توسيع نطاق البحث +${currentRadiusBonus}كم...`

**جدول التوسيع الفعلي:**
| الجولة | التوقيت من بدء الانتظار | radius_bonus_km |
|--------|------------------------|-----------------|
| 1 | بعد 45 ثانية | +3 كم |
| 2 | بعد 105 ثانية | +6 كم |
| 3 | بعد 165 ثانية | +9 كم |
| 4 | بعد 225 ثانية | +12 كم (حد أقصى) |

الـ Edge Function `match-ride` بدون أي تعديل عليها — كانت تدعم `radius_bonus_km` من قبل.

---

### `4969f37` style(driver): إزالة الحدود الزرقاء وتوحيد تصميم واجهة السائق
**الملف:** `src/index.css` (+90 سطر، -10 أسطر)

**المشكلة التي كانت موجودة:**
- متغيرات CSS داخل `.driver-luxury` كانت تستخدم هيو 228°–230° (النطاق الأزرق)
- `--background: 228 32% 6%` → `--ring-offset` في shadcn يملأ الفجوة بلون الخلفية الأزرق الداكن فيبدو كحلقة زرقاء على الـ input/select
- `--border: 230 24% 24%` → حدود زرقاء على Card و Select و Input
- `--input: 230 23% 14%` → حدود زرقاء على حقول الإدخال
- `--driver-geo-line: 230 34% 30%` → حدود زرقاء على `.driver-geometric-card`
- shadcn components تستخدم `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` → حلقات مرئية عند focus

**ما تم تغييره بالضبط (من الكود):**

| المتغير | القيمة القديمة | القيمة الجديدة | السبب |
|---------|--------------|--------------|-------|
| `--background` | `228 32% 6%` | `220 22% 5%` | تحييد الهيو |
| `--card` | `228 26% 10%` | `220 20% 10%` | تحييد الهيو |
| `--popover` | `228 26% 10%` | `220 20% 10%` | تحييد الهيو |
| `--secondary` | `228 20% 14%` | `218 16% 14%` | تحييد الهيو |
| `--muted` | `228 16% 18%` | `218 14% 18%` | تحييد الهيو |
| `--border` | `230 24% 24%` | `215 12% 20%` | إزالة الأزرق، تشبع أقل |
| `--input` | `230 23% 14%` | `215 10% 13%` | إزالة الأزرق |
| `--ring` | `41 92% 56%` (عنبري) | `156 96% 45%` (أخضر) | توحيد مع اللون الرئيسي |
| `--driver-geo-line` | `230 34% 30%` | `215 10% 20%` | إزالة الأزرق |
| `--driver-geo-surface` | `229 22% 12%` | `218 14% 11%` | تحييد الهيو |

**ما تمت إضافته (CSS جديد في نهاية الملف):**

1. **إزالة focus rings كاملة** للعناصر التفاعلية داخل `.driver-luxury`:
   - `input`, `textarea`, `button`, `[role="combobox"]`, `[role="switch"]`, `[role="slider"]`, `[tabindex]`
   - يُلغي `outline` و `box-shadow` بـ `!important`

2. **توحيد أحجام الخطوط** داخل `.driver-page-shell`:
   - `h1` → `font-size: 20px; font-weight: 900`
   - `h2, h3` → `font-size: 16px; font-weight: 700`
   - `.text-lg` → `16px !important`
   - `.text-base` → `14px !important`
   - `text-xs` لم يتغير (يبقى 12px)

3. **توحيد مظهر الكاردات:**
   - `.driver-luxury .driver-geometric-card` → خلفية محايدة + حدود `rgba(255,255,255,0.06)` بدلاً من الأزرق
   - `.driver-luxury input, textarea, [role="combobox"]` → حدود بيضاء 10% + أخضر عند focus

**استثناء DriverHome:** شاشة الخريطة (`.driver-map-screen`) مستثناة من التوحيد لأنها تصميم خاص.

---

### `e34d009` chore: إزالة محرك المحاكاة
**الملف:** `src/components/rider/AIVoiceHome.tsx` (+4 أسطر، -3 أسطر)  
إزالة كود المحاكاة غير المستخدم (simulation engine) من المكون.

---

## 📋 سجل التغييرات — 27 مايو 2026 (خطة الأمان والأداء)

> **حالة البناء:** ✅ TypeScript — 0 أخطاء  
> **Edge Functions:** ✅ match-ride + cron-dispatch deployed  
> **Migrations:** ✅ system_events مطبّق على Supabase

### الملفات المعدّلة الرئيسية

| الملف | التغيير |
|-------|---------|
| `src/hooks/useDriverNotifications.ts` | Phase 3C: حذف postgres_changes INSERT+UPDATE، إضافة قناة broadcast شخصية |
| `src/hooks/useDriverLocationSync.ts` | Phase 5B: SYNC_INTERVAL_MS 5000 → 10000 |
| `src/components/rider/LiveRideTracker.tsx` | Phase 5B: fallback poll 5000 → 30000 ms |
| `src/hooks/useActiveRide.ts` | Phase 5A: polling interval 2000 → 5000 ms |
| `src/hooks/useRideBookingSubmission.ts` | Phase 6C: Sentry.captureException عند فشل match-ride retry |
| `supabase/functions/match-ride/index.ts` | Phase 3B + 3C + 6B: PostGIS + broadcast + log_system_event |
| `supabase/functions/cron-dispatch/index.ts` | Phase 6B: log_system_event للأحداث الحرجة |
| `supabase/migrations/20260527400000_drivers_postgis_spatial.sql` | Phase 3B: get_nearby_drivers RPC |
| `supabase/migrations/20260527500000_system_events.sql` | Phase 6A: system_events table + RPC + pg_cron |

### ملخص المراحل

| المرحلة | الوصف | الحالة |
|---------|-------|--------|
| Phase 1 | Security Hardening — RLS audit، Edge Functions secrets | ✅ |
| Phase 2 | CI Gate — tsc check قبل deploy | ✅ |
| Phase 3A | cron-dispatch + match-ride stateless | ✅ |
| Phase 3B | PostGIS spatial filter — `get_nearby_drivers` RPC | ✅ deployed |
| Phase 3C | Targeted ride notifications — broadcast للمرشحين فقط | ✅ deployed |
| Phase 4 | google-maps-proxy Edge Function | ✅ |
| Phase 5A | useActiveRide polling: 2s → 5s | ✅ |
| Phase 5B | GPS sync: 5s → 10s / LiveRideTracker fallback: 5s → 30s | ✅ |
| Phase 6A | system_events migration + pg_cron | ✅ applied |
| Phase 6B | Sentry/logging في cron-dispatch + match-ride | ✅ deployed |
| Phase 6C | Sentry في useRideBookingSubmission | ✅ |

### تأثير الأداء

| المقياس | قبل | بعد |
|---------|-----|-----|
| سائقون يستقبلون pending ride عبر Realtime | كل N متصل | المرشحون فقط (3-5) |
| GPS writes/min أثناء رحلة | 12 | 6 |
| DB reads/min للراكب (useActiveRide) | 30 | 12 |
| DB reads/min للراكب (LiveRideTracker fallback) | 12 | 2 |
| جلب السائقين في match-ride | full-table-scan | PostGIS ST_DWithin |

### Hardening لاحق (خارج هذه الخطة)

| البند | الأولوية |
|-------|----------|
| Realtime Authorization لـ `driver-notif-{id}` | متوسطة |
| Supabase Advisor: Security Definer View | منخفضة |
| تقييد Google Maps API Key من Cloud Console | عالية |
| مراجعة RLS على `app_settings` | متوسطة |
| مراقبة 24 ساعة post-deploy (DB requests، Edge invocations، Realtime) | فورية |

---
