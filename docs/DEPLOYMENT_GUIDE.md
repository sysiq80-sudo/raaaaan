# دليل النشر
> تاريخ التحديث: 2026-05-29
> منصة النشر: Vercel (Web) + Capacitor (Android APK)

## البناء (Build)

### أمر البناء (الويب العام)
```bash
npm run build
```

### أوامر بناء التطبيقات
```bash
npm run build:rider    # → dist-rider/
npm run build:driver   # → dist-driver/
npm run build:admin    # → dist-admin/
npm run build:car      # → dist-car/
npm run build:web:all  # → كل التطبيقات + نسخ index.html
```

### مخرجات البناء
- المجلد الأساسي: `dist/`
- تطبيقات فرعية: `dist-rider/`, `dist-driver/`, `dist-admin/`, `dist-car/`
- Manual chunks: react, supabase, radix, maps, charts, sentry, mapbox
- Console drops: ✅ في production

## النشر — الويب (Vercel)

### الإعداد
1. ربط المشروع بـ Vercel عبر GitHub
2. ضبط Framework: **Vite**
3. ضبط Build Command: `npm run build`
4. ضبط Output Directory: `dist`

### متغيرات البيئة في Vercel
| المتغير | ملاحظة |
|---|---|
| `VITE_SUPABASE_URL` | رابط Supabase الإنتاجي |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | مفتاح Anon العام |
| `VITE_GOOGLE_MAPS_API_KEY` | مفتاح Google Maps |
| `VITE_SENTRY_DSN` | رابط Sentry |
| `VITE_APP_VERSION` | إصدار التطبيق |

### Security Headers (مُعدّة في `vercel.json`)
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ Cache: `immutable` للـ assets, `no-cache` للـ SW

## النشر — Android APK

### بناء APK
```bash
npm run apk:rider     # → builds/rider.apk
npm run apk:driver    # → builds/driver.apk
npm run apk:car       # → builds/car.apk
npm run apk:all       # → الكل
```

### متطلبات البناء
- Android Studio مع SDK
- Java JDK 17
- `ANDROID_HOME` مضبوط

### توقيع APK للإنتاج
⚠️ غير مؤكد — لم يُعثر على إعدادات signing في الكود. يجب:
1. إنشاء keystore: `keytool -genkey -v -keystore raan-release.keystore -alias raan -keyalg RSA -keysize 2048`
2. إعداد `keystore.properties` (محظور في `.gitignore` ✅)
3. تعديل `android/app/build.gradle` لاستخدام signing config

## Supabase Edge Functions

### نشر Edge Functions
```bash
# نشر دالة محددة
npx supabase functions deploy <function-name>

# نشر كل الدوال
npx supabase functions deploy
```

### ضبط أسرار Edge Functions
```bash
npx supabase secrets set KEY=VALUE
```

## CI/CD

| الأداة | موجودة | الملف |
|---|---|---|
| GitHub Actions | ✅ | 📁 `.github/` (يحتاج فحص المحتوى) |
| Vercel Auto-deploy | ✅ (مُفترض) | ربط GitHub → Vercel |
| Pre-push hooks | ❌ | لا يوجد Husky |

## استعادة النظام (Recovery)

### خطوات استعادة النظام
1. استنسخ المشروع من Git
2. `npm install`
3. ضبط متغيرات البيئة
4. تطبيق migrations: `npx supabase db push`
5. نشر Edge Functions: `npx supabase functions deploy`
6. نشر الويب: Vercel auto-deploy أو `vercel --prod`

### نقل المشروع لفريق آخر
1. نقل ملكية GitHub repository
2. نقل ملكية Vercel project
3. نقل ملكية Supabase project (أو إعطاء access)
4. مشاركة كل أسرار البيئة (⚠️ بطريقة آمنة — ليس عبر Git)
5. مشاركة keystores لتوقيع APK
6. نقل ملكية النطاقات

## أسئلة معلقة
- هل يوجد نطاق إنتاجي (domain) مضبوط لـ Vercel؟
- هل تم إعداد signing config للـ APK الإنتاجي؟
- ما هي GitHub Actions الموجودة في `.github/`؟
