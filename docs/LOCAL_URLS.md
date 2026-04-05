# روابط ومسارات محلية — RAAN

**ملاحظة:** لا يمكن توليد روابط إنترنت عامة من بيئة التطوير؛ الجدول التالي لـ **localhost** و**مسارات الملفات** على جهازك بعد البناء.

## وضع التطوير (Hot reload)

| التطبيق | الرابط | الأمر |
|---------|--------|--------|
| راكب | http://localhost:8081 | `npm run dev:rider` |
| كابتن (سائق) | http://localhost:8082 | `npm run dev:driver` |
| لوحة إدارة | http://localhost:8083 | `npm run dev:admin` |
| سيارة | http://localhost:8084 | `npm run dev:car` |

تشغيل الأربعة دفعة واحدة: **`start-local-dev.bat`** في جذر المشروع.

## معاينة نسخة الإنتاج المبنية (بعد `npm run build:web:all`)

| التطبيق | الرابط | الأمر |
|---------|--------|--------|
| راكب | http://localhost:4173 | `npm run preview:rider` |
| كابتن | http://localhost:4174 | `npm run preview:driver` |
| سيارة | http://localhost:4175 | `npm run preview:car` |
| أدمن | http://localhost:4176 | `npm run preview:admin` |

تشغيل المعاينات الأربع دفعة واحدة: **`start-local-preview-web.bat`**

## مجلدات البناء (ويب)

| المنتج | المجلد |
|--------|--------|
| راكب | `dist-rider/` |
| سائق | `dist-driver/` |
| سيارة | `dist-car/` |
| أدمن | `dist-admin/` |

## Android — ملف APK (Debug)

بعد `gradlew :app:assembleDebug` (أو جزء من `npm run apk:rider`):

| الوصف | المسار الكامل (مثال) |
|--------|----------------------|
| APK الحالي | `android\app\build\outputs\apk\debug\app-debug.apk` |

نسخة مكررة باسم ثابت للتسليم السريع (إن شغّلت السكربت): **`local-builds\raan-android-debug-latest.apk`**

**تطبيقات منفصلة على المتجر:** كل من `npm run apk:rider` و `apk:driver` و `apk:car` يبني **نفس مسار Gradle** لكن بعد تبديل `applicationId` عبر `patch-android.bat` — شغّل النوع المطلوب ثم انسخ الـ APK أو أعد تسميته (مثل `raan-rider-debug.apk`).

## نشر ويب عام (HTTPS)

راجع [WEB_DEPLOYMENT.md](WEB_DEPLOYMENT.md) — يتطلب رفع `dist-*` إلى Netlify / Cloudflare / خادمك.
