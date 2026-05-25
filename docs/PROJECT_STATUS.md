# RAAN — حالة المشروع وتقرير فحص الكود

> آخر تحديث: 24 مايو 2026 | مبني حصرياً على فحص الكود المصدري والـ git log الفعلي

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
