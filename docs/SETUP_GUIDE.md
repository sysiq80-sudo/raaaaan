# دليل التشغيل المحلي
> تاريخ التحديث: 2026-05-29
> المشروع: ران (RAAN)

## المتطلبات الأساسية

| المتطلب | الإصدار المطلوب | أمر التحقق |
|---|---|---|
| Node.js | ≥18 (مُوصى: 20+) | `node --version` |
| npm | ≥9 | `npm --version` |
| Git | أي إصدار حديث | `git --version` |
| Android Studio | لبناء APK فقط | — |
| Java JDK | 17 (لبناء APK فقط) | `java --version` |

## خطوات التشغيل

### 1. استنساخ المشروع
```bash
git clone <repository-url>
cd raan
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. إعداد متغيرات البيئة
```bash
cp .env.example .env
```

### 4. متغيرات البيئة المطلوبة

| المتغير | الوصف | مطلوب | القيمة الافتراضية | مثال | كيفية الحصول عليه |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | رابط مشروع Supabase | ✅ | — | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | مفتاح Anon العام | ✅ | — | `eyJhbG...` | Supabase Dashboard → Settings → API |
| `VITE_GOOGLE_MAPS_API_KEY` | مفتاح Google Maps | ✅ | — | `AIzaSy...` | Google Cloud Console → APIs & Services |
| `VITE_SENTRY_DSN` | رابط Sentry لمراقبة الأخطاء | ❌ | — | `https://xxx@sentry.io/xxx` | Sentry Dashboard → Project Settings |
| `VITE_APP_VERSION` | إصدار التطبيق | ❌ | `1.0.0` | `1.0.0` | تُحدث يدوياً |
| `DEV_SERVER_IP` | عنوان IP للتطوير (Capacitor) | ❌ | — | `192.168.1.100` | عنوان IP لجهازك على الشبكة المحلية |

### 5. تشغيل المشروع

#### تشغيل كل التطبيقات (الوضع العام)
```bash
npm run dev
# يفتح على http://localhost:8080
```

#### تشغيل تطبيق محدد
```bash
npm run dev:rider    # الراكب → http://localhost:5173
npm run dev:driver   # السائق → http://localhost:5174
npm run dev:admin    # الأدمن → http://localhost:5175
npm run dev:car      # السيارة → http://localhost:5176
```

### 6. بناء APK (Android)
```bash
# الخطوة 1: بناء الويب
npm run build:rider

# الخطوة 2: مزامنة مع Android
npm run cap:sync:rider

# الخطوة 3: بناء APK
npm run apk:rider     # → builds/rider.apk
npm run apk:driver    # → builds/driver.apk
npm run apk:car       # → builds/car.apk
npm run apk:all       # → كل الـ APKs
```

### 7. تشغيل الاختبارات
```bash
npm test              # Unit tests
npm run test:watch    # مستمر
npm run test:coverage # مع التغطية
npm run test:e2e      # E2E (Playwright)
npm run lint          # فحص الكود
```

## الخدمات الخارجية المطلوبة

| الخدمة | مطلوبة للتشغيل المحلي؟ | كيفية الإعداد |
|---|---|---|
| Supabase | ✅ (إلزامي) | أنشئ مشروع على supabase.com + طبّق migrations |
| Google Maps | ✅ (للخرائط) | فعّل Maps JavaScript API + Directions API + Places API |
| Sentry | ❌ (اختياري) | أنشئ مشروع على sentry.io |
| ZainCash/NASS | ❌ (اختياري) | Edge Functions — تحتاج مفاتيح API خاصة |

## تشغيل Supabase محلياً (اختياري)
```bash
# تأكد من تثبيت Supabase CLI
npx supabase start

# تطبيق كل migrations
npx supabase db push

# تشغيل البيانات الأولية
npx supabase db seed
```

## مشاكل شائعة عند التشغيل

| المشكلة | السبب | الحل |
|---|---|---|
| `VITE_SUPABASE_URL is required` | متغيرات البيئة غير مضبوطة | تأكد من نسخ `.env.example` إلى `.env` |
| خطأ في Google Maps | مفتاح API غير صحيح أو APIs غير مفعّلة | فعّل Maps + Directions + Places APIs |
| `ERR_OSSL_EVP_UNSUPPORTED` | Node.js version قديم | استخدم Node.js 18+ |
| APK لا يتصل بالسيرفر | `DEV_SERVER_IP` غير مضبوط | اضبط IP جهازك في `.env` |
| `gradlew` لا يعمل | JDK غير مثبت | ثبّت Java JDK 17 |

## أسئلة معلقة
- هل يجب تشغيل `supabase/seed.sql` لبدء العمل أم البيانات ستُنشأ تلقائياً؟
