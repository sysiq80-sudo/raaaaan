# خطة تطوير تطبيق الجوال - ران RAAN

> **التاريخ**: يناير 2026  
> **الإصدار**: 1.0 - Debug APKs  
> **القرار**: Capacitor فقط (بدون React Native حالياً)

---

## ملخص تنفيذي

تم بناء 3 تطبيقات أندرويد (Rider, Driver, Car) باستخدام Capacitor 8.x مع إصلاح مشاكل حرجة (HashRouter للراكب)، تحديث الأيقونات من شعارات RAAN-ICON، وبناء Debug APKs.

### النتائج
| التطبيق | Package ID | الحجم | الملف |
|---------|-----------|-------|-------|
| ران (راكب) | com.raan.rider | 9.7 MB | `local-builds/raan-rider-debug.apk` |
| ران كابتن (سائق) | com.raan.captain | 9.8 MB | `local-builds/raan-captain-debug.apk` |
| ران سيارة | com.raan.car | 9.8 MB | `local-builds/raan-car-debug.apk` |

---

## المرحلة 1: إصلاحات حرجة ✅

### 1. إصلاح RiderApp — HashRouter على native
- **المشكلة**: RiderApp كان يستخدم BrowserRouter الذي لا يعمل مع Capacitor (بروتوكول `file://`)
- **الحل**: إضافة نفس نمط DriverApp — `HashRouter` على native و `BrowserRouter` على web
- **الملف**: `src/apps/rider/RiderApp.tsx`
- **المرجع**: `src/apps/driver/DriverApp.tsx` (النمط الصحيح)

### 2. إصلاح RiderApp — فرض الدور
- **المشكلة**: بدون فرض الدور، قد يتم توجيه المستخدم لصفحة السائق
- **الحل**: إضافة `capacitorStorageSync.setItem("raan_current_role", "rider")` في RiderRoutes
- **الملف**: `src/apps/rider/RiderApp.tsx`

### 3. التحقق من الإشعارات (FCM)
- **النتيجة**: FCM مُعدّ بشكل صحيح ويعمل في الخلفية
- التفاصيل:
  - Capacitor يسجل `FirebaseMessagingService` تلقائياً
  - FCM يرسل بـ `priority: 'high'` و `notification_priority: 'PRIORITY_MAX'`
  - قناة `raan-rides` بأهمية قصوى (importance=5)
  - يعمل حتى عند إغلاق التطبيق وإطفاء الشاشة

---

## المرحلة 2: الأيقونات والعلامة التجارية ✅

### 4. توليد الأيقونات
- **السكريبت**: `scripts/generate-icons.mjs` (يستخدم مكتبة sharp)
- **المصادر**:
  - Rider: `RAAN-ICON/android/play_store_512.png` (خلفية خضراء #2dd4a8)
  - Driver: `Captin Logo.png` (خلفية كحلي داكنة #1a2234)
  - Car: `RAAN-ICON/android/play_store_512.png` (خلفية خضراء #2dd4a8)
- **المخرجات**: 6 كثافات (ldpi → xxxhdpi) لكل تطبيق + Play Store 512x512
- **المجلدات**: `scripts/icons-rider/`, `scripts/icons-driver/`, `scripts/icons-car/`

### 5. تحديث patch-android.bat
- إضافة subroutine `:COPY_ICONS` لنسخ الأيقونات المناسبة لكل variant
- نسخ: `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`, `ic_launcher_background.png`

### 6. إلغاء Splash Screen (مؤقتاً)
- **capacitor configs**: `launchShowDuration: 0` في الثلاث configs
- **styles.xml**: تغيير الثيم من `Theme.SplashScreen` إلى خلفية داكنة `#0a0f14`

---

## المرحلة 3: البناء ✅

### 7. بناء Web Bundles
```bash
npm run build:driver    # → dist-driver/
npm run build:rider     # → dist-rider/
npm run build:car       # → dist-car/
```

### 8. بناء APKs
لكل variant، العملية:
1. نسخ `{variant}.html` → `index.html` في مجلد dist
2. تعيين `capacitor.{variant}.config.ts` → `capacitor.config.ts`
3. تشغيل `scripts/patch-android.bat {variant}`
4. تشغيل `npx cap sync android`
5. تشغيل `gradlew.bat assembleDebug`
6. نسخ APK → `local-builds/raan-{name}-debug.apk`

---

## التقنيات المستخدمة

| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| Capacitor | 8.1.0 | إطار التطبيق الهجين |
| React | 18.x | واجهة المستخدم |
| TypeScript | 5.x | لغة البرمجة |
| Vite | 5.4.19 | أداة البناء |
| Gradle | 8.13+ | بناء Android |
| Android SDK | 36 | الحد الأقصى |
| minSdk | 24 | الحد الأدنى (Android 7.0) |
| Firebase BOM | 34.11.0 | الإشعارات (FCM) |
| Supabase | - | Backend + Auth + Realtime |
| Mapbox GL JS | - | الخرائط |

### إضافات Capacitor (10 إضافات)
- @capacitor/app, browser, geolocation, haptics
- @capacitor/local-notifications, network, preferences
- @capacitor/push-notifications, splash-screen, status-bar

---

## هيكل الملفات المهمة

```
├── capacitor.rider.config.ts      # إعدادات تطبيق الراكب
├── capacitor.driver.config.ts     # إعدادات تطبيق السائق
├── capacitor.car.config.ts        # إعدادات تطبيق السيارة
├── vite.rider.config.ts           # بناء Vite للراكب
├── vite.driver.config.ts          # بناء Vite للسائق
├── vite.car.config.ts             # بناء Vite للسيارة
├── scripts/
│   ├── patch-android.bat          # تعديل Android لكل variant
│   ├── generate-icons.mjs         # توليد الأيقونات بـ sharp
│   ├── icons-rider/               # أيقونات الراكب
│   ├── icons-driver/              # أيقونات السائق
│   └── icons-car/                 # أيقونات السيارة
├── local-builds/
│   ├── raan-rider-debug.apk       # APK الراكب
│   ├── raan-captain-debug.apk     # APK السائق
│   └── raan-car-debug.apk         # APK السيارة
├── src/apps/
│   ├── rider/RiderApp.tsx         # تطبيق الراكب (مُصلح)
│   ├── driver/DriverApp.tsx       # تطبيق السائق
│   └── car/CarApp.tsx             # تطبيق السيارة
└── android/                       # مشروع Android (Capacitor)
```

---

## ملاحظات مهمة

### الإشعارات (FCM)
- تعمل على تطبيق الراكب والسائق
- تطبيق السيارة **لا يدعم FCM** (لا يوجد google-services.json)
- لإضافة إشعارات للسيارة: يجب إنشاء مشروع Firebase خاص أو استخدام نفس المشروع

### بدون Splash Screen حالياً
- تم إلغاء الـ splash مؤقتاً بناءً على طلب المطور
- يمكن إعادته لاحقاً بإعادة `launchShowDuration` وتعديل styles.xml

### نقاط للتطوير المستقبلي
1. **إضافة Splash Screen** مخصص لكل تطبيق
2. **بناء Release APKs** بتوقيع رسمي للنشر على Google Play
3. **إضافة FCM لتطبيق السيارة** إذا لزم الأمر
4. **دراسة React Native (Expo)** للميزات المتقدمة مستقبلاً
5. **إضافة تحديث تلقائي** (OTA Updates) عبر Capacitor
6. **تحسين حجم APK** باستخدام App Bundles (AAB) وProGuard

---

## أوامر البناء السريعة

```bash
# بناء جميع Web bundles
npm run build:driver && npm run build:rider && npm run build:car

# بناء APK واحد (مثال: الراكب)
copy dist-rider\rider.html dist-rider\index.html
copy capacitor.rider.config.ts capacitor.config.ts
scripts\patch-android.bat rider
npx cap sync android
cd android && gradlew.bat assembleDebug

# بناء الكل (سكريبت)
build-all-apks.bat

# توليد أيقونات جديدة
node scripts/generate-icons.mjs
```

---

**والحمد لله رب العالمين** 🤲
