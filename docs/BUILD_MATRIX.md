# مصفوفة البناء — RAAN (Vite + Capacitor + Android)

هذا المستند يوضح **تسلسل الأوامر** من الكود المصدر إلى APK، لتقليل أخطاء تبديل `applicationId` أو `capacitor.config.ts`.

## ملخص المنتجات

| المنتج | أمر التطوير | أمر البناء | مجلد المخرجات | إعداد Capacitor | patch-android | package.json script جاهز |
|--------|-------------|------------|----------------|-----------------|---------------|---------------------------|
| راكب | `npm run dev:rider` | `npm run build:rider` | `dist-rider/` | `capacitor.rider.config.ts` | `rider` | `cap:sync:rider`, `apk:rider` |
| سائق | `npm run dev:driver` | `npm run build:driver` | `dist-driver/` | `capacitor.driver.config.ts` | `driver` | `cap:sync:driver`, `apk:driver` |
| أدمن | `npm run dev:admin` | `npm run build:admin` | `dist-admin/` | (ويب / استضافة ثابتة) | — | — |
| سيارة (Car) | `npm run dev:car` | `npm run build:car` | `dist-car/` | `capacitor.car.config.ts` | `car` | `cap:sync:car`, `apk:car` |
| افتراضي (monolith) | `npm run dev` | `npm run build` | `dist/` | `capacitor.config.ts` | حسب آخر patch | `cap:sync` |

### ويب منفصل (رابط / PWA — بدون أندرويد)

| المنتج | أمر | المخرجات + `index.html` |
|--------|-----|---------------------------|
| راكب | `npm run build:web:rider` | `dist-rider/` |
| كابتن | `npm run build:web:driver` | `dist-driver/` |
| سيارة | `npm run build:web:car` | `dist-car/` |
| أدمن (ويب) | `npm run build:web:admin` | `dist-admin/` |
| الكل | `npm run build:web:all` | الراكب + الكابتن + السيارة + الأدمن |

**معاينة بعد البناء:** `npm run preview:rider` (منفذ 4173)، `preview:driver` (4174)، `preview:car` (4175).

التفاصيل والنشر على Netlify/Vercel/إلخ: [WEB_DEPLOYMENT.md](WEB_DEPLOYMENT.md).

## تسلسل مقترح لبناء راكب أو سائق (يدوياً)

1. **بناء الويب:** `npm run build:rider` أو `npm run build:driver`.
2. **نسخ نقطة HTML:** السكربتات في [package.json](../package.json) تنسخ `rider.html` / `driver.html` إلى `index.html` داخل مجلد الـ dist المناسب.
3. **تفعيل إعداد Capacitor:** نسخ `capacitor.rider.config.ts` أو `capacitor.driver.config.ts` إلى جذر المشروع كـ `capacitor.config.ts` (تفعله أوامر `cap:sync:*`).
4. **تعديل هوية Android:** `scripts\patch-android.bat rider` أو `driver` أو `car` — يحدّث `applicationId`، `namespace`، `strings.xml`، و`google-services.json`.
5. **مزامنة:** `npx cap sync android` (مدمج في `cap:sync:rider` وغيره).
6. **بناء APK:** من مجلد `android` عبر Gradle (`gradlew assembleDebug` أو ما يعادله في `apk:*`).

## مخاطر تشغيلية

- **مشروع `android/` واحد:** آخر `patch-android` و`capacitor.config.ts` المنسوخ يحدّدان هوية التطبيق التالية. بعد `apk:driver` قد يُعاد نسخ إعداد الراكب — راجع السكربت في [package.json](../package.json) قبل البناء التالي.
- **البناء الافتراضي `npm run build`** بدون `--config` ينتج `dist/` وقد لا يطابق حزمة المتجر للراكب/السائق؛ للإصدار استخدم دائماً `build:rider` أو `build:driver`.

## متغيرات البيئة

- التطبيقات تتطلب `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` في `.env` (انظر [.env.example](../.env.example)).
- **Supabase CLI** (اختياري): `SUPABASE_ACCESS_TOKEN` للربط والدفع — لا تُعرَّض للمتصفح (لا تستخدم بادئة `VITE_`).

## مراجع

- [scripts/patch-android.bat](../scripts/patch-android.bat)
- [تطوير الجوال.md](../تطوير%20الجوال.md) — القرار المعماري والملحقات
- [SECURITY_OPS.md](SECURITY_OPS.md) — إعدادات Supabase Auth و`system_configs` للوظائف الحساسة
