# دليل إعداد Sentry خطوة بخطوة

## 📋 الخطوات المطلوبة الآن:

### 1. اختيار المنصة (Platform)
- **اختر**: `React` (لأن تطبيق ران مبني على React/Vite)
- **لا تختار**: React Native أو Next.js أو غيرها

### 2. إعداد التنبيهات (Alerts)
- **اتركه كما هو**: "Alert me on high priority issues"
- **الإعدادات الافتراضية جيدة**:
  - أكثر من 10 occurrences
  - في دقيقة واحدة
  - إشعار بالبريد الإلكتروني

### 3. تسمية المشروع (Project Details)
- **Project name**: `raan-web` أو `raan-production`
- **Project slug**: `raan-web` (سيتم إنشاؤه تلقائياً)
- **Team**: `#raan` (أو أي فريق موجود)

### 4. إنشاء المشروع
- اضغط **"Create Project"**

### 5. الحصول على DSN
بعد إنشاء المشروع:
1. اذهب إلى **Settings** → **Client Keys (DSN)**
2. انسخ **DSN** (يبدأ بـ `https://`)
3. شغّل الأمر: `update-sentry-dsn.bat`
4. ألصق DSN الحقيقي

### 6. اختبار الإعداد
1. أعد تشغيل التطبيق: `npm run dev`
2. اذهب إلى لوحة Admin → التكاملات
3. اضغط "اختبار Sentry"
4. تحقق من https://raan-nf.sentry.io/issues/

---

**ملاحظة**: تأكد من اختيار **React** وليس React Native لأن التطبيق يعمل في المتصفح والأجهزة المحمولة عبر Capacitor.