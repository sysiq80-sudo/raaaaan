# توثيق المعمارية
> تاريخ التوثيق: 2026-05-31 (تحديث — الفحص الأصلي 2026-05-29)
> المشروع: ران (RAAN) — تطبيق النقل الذكي
> مصدر الحقيقة: الكود الفعلي

## نظرة عامة على النظام

**ران** هو نظام نقل ذكي عراقي متكامل يشمل 4 تطبيقات (راكب، سائق، سيارة، إدارة) مبنية من codebase واحد باستخدام نظام Multi-Flavor. يعمل كـ SPA على الويب وكتطبيق Android أصلي عبر Capacitor.

## نوع المشروع

| البند | القيمة |
|---|---|
| النوع | Full Stack SaaS + Mobile (Multi-Flavor Monorepo) |
| النمط المعماري | Layered (Client → Edge Functions → Database) — بدون خادم تقليدي |
| الاتصال | REST (Edge Functions) + Realtime (Supabase Channels) + RPC (Database Functions) |

## طبقات النظام

### طبقة العرض (UI/Frontend)
- **التقنية:** React 18 + TypeScript + Vite 5 (SPA)
- **التوجيه:** React Router DOM 6 — كل Routes في 📁 `src/App.tsx` (1231 سطر)
- **التنقل:**
  - **الويب:** `BrowserRouter` 🟢 مؤكد
  - **الجوال (Capacitor):** `HashRouter` 🟢 مؤكد
- **إدارة الحالة:**
  - `zustand` — 4 stores: 📁 `src/stores/driverStore.ts`, `riderStore.ts`, `editorStore.ts`, `useFavoritesStore.ts`
  - `@tanstack/react-query` — cache + server state
  - `React Context` — 5 contexts: 📁 `src/contexts/` (Auth, Map, Theme, Locale, SupabaseConfig)
- **التصميم:** TailwindCSS 3 + shadcn/ui (Radix UI) + Framer Motion
- **الترجمة:** i18next (عربي + إنجليزي) — 📁 `src/locales/`
- **الملفات الرئيسية:**
  - 📁 `src/App.tsx` — نقطة الدخول + كل Routes
  - 📁 `src/main.tsx` — تهيئة React + Sentry
  - 📁 `src/index.css` — 56KB من الأنماط

### طبقة المنطق (Business Logic)
- **التقنية:** Supabase Edge Functions (Deno) + Database RPC Functions (PL/pgSQL)
- **عدد Edge Functions:** 57 دالة 🟢 مؤكد (تحديث 2026-05-31)
- **عدد Database RPCs:** 50+ دالة 🟡 محتمل (مبني على عد migrations)
- **الملفات الرئيسية:**
  - 📁 `supabase/functions/` — كل دالة في مجلد منفصل
  - 📁 `supabase/functions/_shared/` — كود مشترك (CORS, auth helpers)
  - 📁 `supabase/functions/financial-watchdog/` — **جديد 2026-05** — مراقبة مالية تلقائية
  - 📁 `supabase/functions/migrate-secrets-to-db/` — **جديد 2026-05** — نقل الأسرار
- **أنماط التصميم:**
  - Adapter Pattern — 📁 `src/lib/adapters/` (OSRM, Nominatim, Haversine)
  - Event Queue — 📁 `src/hooks/useRideEventQueue.ts`
  - Rate Limiting — 📁 `src/hooks/useRateLimiting.ts`

### طبقة البيانات (Database / Storage)
- **التقنية:** PostgreSQL (Supabase Hosted) + PostGIS (spatial)
- **العميل:** `@supabase/supabase-js@^2.87.1`
- **عدد الجداول:** ~91 🟡 محتمل (مبني على تحليل migrations)
- **عدد Migrations:** 236 🟢 مؤكد
- **RLS:** مفعّل على الجداول الأساسية — **لم يُفحص على كل الجداول** ⚠️
- **Realtime:** مفعّل لجداول الرحلات والمواقع
- **الملفات الرئيسية:**
  - 📁 `supabase/migrations/` — 236 ملف SQL
  - 📁 `supabase/seed.sql` — بيانات أولية
  - 📁 `src/integrations/supabase/` — عميل + أنواع TypeScript

### طبقة الخدمات الخارجية (External Services)

| الخدمة | الوظيفة | طريقة الاتصال | الملف |
|---|---|---|---|
| Google Maps | خرائط + directions + geocoding + places | REST API (عبر Edge Function proxy) | 📁 `supabase/functions/google-maps-proxy/` + `src/lib/googleMapService.ts` |
| OSRM | حساب مسارات (fallback مجاني) | REST API | 📁 `src/lib/adapters/OSRMRoutingAdapter.test.ts` |
| Nominatim | geocoding مجاني (fallback) | REST API | 📁 `src/lib/adapters/NominatimGeocodingAdapter.test.ts` |
| ZainCash | دفع إلكتروني — **معطّل (DR-05)** | REST API (Edge Function) | 📁 `supabase/functions/zaincash-init/` + `zaincash-callback/` |
| NASS | دفع إلكتروني — **معطّل (DR-07)** | REST API (Edge Function) | 📁 `supabase/functions/nass-*` |
| Sentry | مراقبة أخطاء | SDK | 📁 `src/lib/sentry.ts` |
| Telegram | بوت حجز | Webhook (Edge Function) | 📁 `supabase/functions/admin-telegram-webhook/` + `telegram-*` |
| WhatsApp | إشعارات رحلات | Webhook (Edge Function) | 📁 `supabase/functions/whatsapp-*` |
| SMS Provider | OTP + إشعارات | REST API (Edge Function) | 📁 `supabase/functions/send-sms/` + `send-otp/` |
| Mapbox | خرائط إدارية | SDK + REST (عبر proxy) | 📁 `supabase/functions/mapbox-proxy/` |
| pg_cron | مهام دورية تلقائية | PostgreSQL Extension | watchdog (كل ساعة) + cleanup + dispatch |

## تدفق البيانات (Data Flow)

### تدفق حجز رحلة (أساسي)
```
الراكب (GoPage/AIVoiceHome)
    ↓ [يختار الوجهة]
src/hooks/useBookingFlow.ts → src/hooks/useRideBookingSubmission.ts
    ↓ [إنشاء طلب]
Supabase DB: rides (status = 'pending')
    ↓ [Realtime subscription]
supabase/functions/cron-dispatch/ → match-ride/
    ↓ [توزيع على أقرب سائق]
Supabase DB: rides (status = 'assigned', driver_id = X)
    ↓ [Realtime → Push Notification]
السائق (DriverHome) → useDriverNotifications.ts
    ↓ [قبول/رفض]
Supabase DB: rides (status = 'accepted'/'rejected')
    ↓ [Realtime]
الراكب (LiveRideTracker) — تتبع مباشر
```

### تدفق المصادقة
```
المستخدم → Auth.tsx / DriverAuth.tsx
    ↓ [إدخال الهاتف]
supabase/functions/send-otp/ → SMS Provider
    ↓ [إدخال OTP]
Supabase Auth (signInWithOtp)
    ↓ [onAuthStateChange]
AuthContext.tsx → detectUserRole()
    ↓ [فحص user_roles + drivers]
Supabase DB: user_roles, drivers
    ↓ [تحديد الدور]
حفظ الدور → توجيه (rider/driver/admin)
```

### تدفق الدفع
```
الراكب/السائق → صفحة الشحن
    ↓ [اختيار طريقة الدفع]
supabase/functions/zaincash-init/ أو nass-init-payment/
    ↓ [إنشاء عملية دفع]
بوابة الدفع الخارجية
    ↓ [callback]
supabase/functions/zaincash-callback/ أو nass-payment-callback/
    ↓ [تحديث المحفظة]
Supabase DB: wallet_transactions
```

## نظام Multi-Flavor

المشروع يستخدم نظام **Multi-Flavor** ذكي لبناء 4 تطبيقات من codebase واحد:

| الآلية | الشرح |
|---|---|
| Vite Config مخصص لكل flavor | كل تطبيق له `vite.[flavor].config.ts` مع `__APP_MODE__` define |
| HTML Entry مخصص | كل تطبيق له ملف HTML خاص (`rider.html`, `driver.html`, إلخ) |
| Capacitor Config مخصص | كل APK له `capacitor.[flavor].config.ts` مع `appId` مختلف |
| Route Protection | `ProtectedRoute` + `__APP_MODE__` يمنع الوصول غير المصرح |
| Conditional Loading | `lazy()` لتحميل صفحات كل تطبيق حسب الحاجة |

### IDs التطبيقات (Capacitor)
- **الراكب:** `com.raan.rider` 🟢 مؤكد
- **السائق:** يُحدد في `capacitor.driver.config.ts` 🟡 محتمل `com.raan.captain`
- **السيارة:** يُحدد في `capacitor.car.config.ts`

## تكامل Capacitor (Android)

### Native Plugins المستخدمة
| Plugin | الوظيفة | ملف الإعداد |
|---|---|---|
| `@capacitor/geolocation` | موقع المستخدم | 📁 `capacitor.config.ts` |
| `@transistorsoft/capacitor-background-geolocation` | GPS خلفية مستمرة (للسائق) | 📁 `src/hooks/useDriverBackgroundGeolocation.ts` |
| `@capacitor/push-notifications` | إشعارات Push | 📁 `src/components/PushNotificationSetup.tsx` |
| `@capacitor/local-notifications` | إشعارات محلية | 📁 `capacitor.config.ts` |
| `@capacitor-community/text-to-speech` | نطق حالة الرحلة | 📁 `capacitor.config.ts` |
| `@capacitor-community/speech-recognition` | التعرف على الصوت | 📁 `capacitor.config.ts` |
| `@capacitor-community/keep-awake` | منع إطفاء الشاشة | 📁 `src/hooks/useWakeLock.ts` |
| `@capacitor/haptics` | اهتزاز | |
| `@capacitor/keyboard` | التحكم بالكيبورد | |
| `@capacitor/network` | حالة الاتصال | 📁 `src/hooks/useNetworkStatus.ts` |
| `@capacitor/preferences` | تخزين محلي | 📁 `src/lib/capacitorStorage.ts` |
| `@capacitor/screen-orientation` | اتجاه الشاشة | |
| `@capacitor/splash-screen` | شاشة البداية | |
| `@capacitor/status-bar` | شريط الحالة | |
| `@capacitor/device` | معلومات الجهاز | |
| `@capacitor/browser` | فتح روابط خارجية | |
| `@capacitor/share` | مشاركة | |
| `@capacitor/toast` | رسائل سريعة | |
| `@capacitor/app` | أحداث التطبيق | 📁 `src/hooks/useAndroidBackButton.ts` |

### Platform Builds
- **Android:** ✅ مدعوم بالكامل — `android/` موجود مع Gradle + product flavors
- **iOS:** ❌ غير مدعوم حالياً

## تحسينات الأداء (Performance Optimizations)

| التحسين | التقنية | الملف |
|---|---|---|
| Code Splitting | `React.lazy()` لكل الصفحات | 📁 `src/App.tsx` |
| Manual Chunks | Vite `manualChunks` (react, supabase, radix, maps, charts) | 📁 `vite.config.ts` |
| Drop Console | `terser` — حذف console.log في الإنتاج | 📁 `vite.config.ts` |
| Query Cache | `staleTime: 30s`, `gcTime: 5min` | 📁 `src/App.tsx` |
| Prefetch | تحميل مسبق لأهم الصفحات بعد 3 ثوانٍ | 📁 `src/App.tsx` |
| Service Worker | `vite-sw-plugin.ts` | 📁 `vite-sw-plugin.ts` |
| Asset Caching | Vercel — `Cache-Control: immutable` للـ assets | 📁 `vercel.json` |
| Memoization | مكتبة مخصصة | 📁 `src/lib/memoization.ts` |
| Event Deduplication | منع تكرار الأحداث | 📁 `src/lib/eventDeduplication/` |

## نظام الخرائط والتوجيه (Maps & Routing)

### استراتيجية الخرائط (Adaptive Map)
| الطبقة | الحالة | الملف | الوصف |
|---|---|---|---|
| Google Maps (الأساسي) | ✅ نشط | 📁 `src/lib/googleMapService.ts` + `src/hooks/useGoogleMapsApiKey.ts` | API key من Supabase settings — timeout 5s |
| Leaflet/OSM (fallback) | ✅ نشط | 📁 `src/components/LeafletMap.tsx` + `src/components/LazyMap.tsx` | يُفعَّل تلقائياً عند `mapLoadFailed = true` |
| Mapbox (للأدمن فقط) | ✅ نشط | 📁 `supabase/functions/mapbox-proxy/` | admin map فقط |

### استراتيجية التوجيه والـ ETA (Adaptive Routing)
| المزوّد | الحالة | الاستخدام |
|---|---|---|
| OSRM `router.project-osrm.org` | ✅ الأساسي | ETA وحساب مسار — throttle 30s/300m |
| Haversine (محلي) | ✅ fallback | عند فشل OSRM — تقدير خطي |

**التدفق في LiveRideTracker:**
```
getAdaptiveRoute (OSRM) → duration (دقائق حقيقية)
    ↓ throttle: 30s OR 300m تغيير
    ↓ lastETAFetchRef (يُحدَّث عند النجاح والفشل)
useFareCalculation ← routeDuration (end-to-end)
    ↓ calculate-fare Edge Function ← duration_minutes
    ↓ sanity check: speed = distKm / (dur/60) ∈ [5, 100] km/h
```

## أسئلة معلقة
- هل PostGIS مفعّل فعلياً على Supabase المستضاف؟ (يوجد migration `20260527400000_drivers_postgis_spatial.sql`)
- ما هو عدد الجداول الفعلي الحالي بعد 236 migration؟ (بعض migrations تحذف جداول)
