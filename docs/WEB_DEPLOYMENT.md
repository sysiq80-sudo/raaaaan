# نشر تطبيقات الويب المنفصلة — راكب، كابتن، سيارة

كل من الراكب والسائق (الكابتن) والسيارة هو **تطبيق ويب مستقل** (React + Vite) يُبنى إلى مجلد `dist-*` خاص. لوحة التحكم (الأدمن) تبقى بناءً منفصلاً (`build:admin` → `dist-admin/`).

## البناء المحلي

| المنتج | أمر البناء + تجهيز `index.html` للاستضافة |
|--------|------------------------------------------|
| راكب | `npm run build:web:rider` → `dist-rider/` |
| كابتن (سائق) | `npm run build:web:driver` → `dist-driver/` |
| سيارة | `npm run build:web:car` → `dist-car/` |
| الكل (يشمل الأدمن) | `npm run build:web:all` |

السكربت [scripts/copy-web-index.mjs](../scripts/copy-web-index.mjs) ينسخ `rider.html` / `driver.html` / `car.html` إلى `index.html` داخل نفس المجلد حتى تخدم المنصات الجذر تلقائياً.

**متطلبات:** ملف `.env` يحتوي `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` (انظر [.env.example](../.env.example)).

## معاينة البناء (بعد `build:web:*`)

| التطبيق | الأمر | المنفذ الافتراضي |
|---------|--------|------------------|
| راكب | `npm run preview:rider` | 4173 |
| كابتن | `npm run preview:driver` | 4174 |
| سيارة | `npm run preview:car` | 4175 |
| أدمن | `npm run preview:admin` | 4176 |

## النشر كـ «رابط ويب» (مواقع ثابتة)

النمط الموصى به: **ثلاثة نشرات منفصلة** (ثلاثة نطاقات فرعية أو ثلاثة مشاريع استضافة):

| المجلد | مثال نطاق | ملاحظة |
|--------|-----------|--------|
| `dist-rider/` | `https://rider.example.com` | PWA / راكب |
| `dist-driver/` | `https://driver.example.com` أو `https://captain.example.com` | تطبيق السائق |
| `dist-car/` | `https://car.example.com` | وضع السيارة |

- ارفع **محتويات** المجلد (وليس المجلد نفسه كاسم واحد) كجذر الموقع.
- ملف [public/_redirects](../public/_redirects) يُنسخ إلى كل `dist-*` لدعم SPA على Netlify (`/*` → `index.html`).
- على **Cloudflare Pages / Vercel / S3+CloudFront**: اضبط إعادة توجيه SPA لجميع المسارات غير الملفات إلى `index.html` (مثل إعدادات «Single Page App» في واجهة المنصة).

### نشر تحت مسار فرعي (مثل `example.com/rider/`)

يتطلب ضبط `base` في إعداد Vite ذي الصلة (مثلاً `base: '/rider/'`) ثم إعادة البناء — الحالة الافتراضية الحالية هي **`base: '/'`** المناسبة للنطاق الفرعي أو النطاق الجذر.

## تطبيقات الجوال المنفصلة (Android)

لا تزال تُبنى عبر Capacitor من نفس المخرجات تقريباً؛ راجع [BUILD_MATRIX.md](BUILD_MATRIX.md):

- `npm run cap:sync:rider` / `cap:sync:driver` / `cap:sync:car`
- `npm run apk:rider` / `apk:driver` / `apk:car`

## لوحة التحكم (Admin)

```bash
npm run build:admin
```

الناتج: `dist-admin/` — انشره كموقع ويب مستقل (لا يخلط مع مجلدات الراكب/السائق).

## سكربتات مساعدة (ويندوز)

- [build-web-all.bat](../build-web-all.bat) — يشغّل `npm run build:web:all`
- [run-all.bat](../run-all.bat) — تشغيل وضع التطوير لجميع الواجهات في نوافذ منفصلة
