# 🚀 دليل النشر على Google Play — ران كابتن RAAN

## 1. إنشاء Keystore (مرة واحدة فقط)

```bash
keytool -genkey -v -keystore raan-release.keystore -alias raan -keyalg RSA -keysize 2048 -validity 10000
```

عند السؤال:
- **كلمة المرور**: اختر كلمة قوية واحفظها في مكان آمن
- **الاسم**: RAAN
- **المنظمة**: RAAN Iraq
- **المدينة**: Baghdad
- **البلد**: IQ

⚠️ **احفظ الـ keystore وكلمة المرور بأمان — لا يمكن استعادتها!**

## 2. إعداد ملف keystore.properties

أنشئ ملف `android/keystore.properties`:

```properties
storeFile=../raan-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=raan
keyPassword=YOUR_KEY_PASSWORD
```

⚠️ هذا الملف مضاف للـ `.gitignore` — لا تدفعه لـ Git أبداً!

## 3. بناء APK/AAB للإصدار

```bash
# بناء الويب + مزامنة Capacitor
npm run build
npx cap sync android

# بناء AAB (مطلوب لـ Google Play)
cd android
./gradlew bundleRelease

# أو APK للاختبار المباشر
./gradlew assembleRelease
```

الملفات الناتجة:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

## 4. إعداد Google Play Console

### أ. إنشاء التطبيق
1. ادخل [Google Play Console](https://play.google.com/console)
2. **إنشاء تطبيق** > اللغة الافتراضية: العربية
3. اسم التطبيق: **ران كابتن**

### ب. بيانات التطبيق (Store Listing)

| الحقل | القيمة |
|-------|--------|
| الاسم | ران كابتن |
| الوصف المختصر | ران — تطبيق تاكسي عراقي ذكي للكباتن |
| الفئة | خرائط وتنقل |
| عنوان البريد | support@raan.iq |
| سياسة الخصوصية | (يجب إضافة رابط) |

### ج. الوصف الكامل

```
ران كابتن — تطبيق السائقين من ران 🚕

أنت كابتن في ران؟ هذا تطبيقك! أستلم رحلات، تابع أرباحك، وأدر شغلك بسهولة.

✅ المميزات:
• استلام طلبات الرحلات فوراً
• خريطة ذكية مع GPS عالي الدقة
• حساب الأجرة تلقائياً (بالدقيقة + المسافة)
• محفظة إلكترونية لتتبع الأرباح
• إشعارات فورية للرحلات الجديدة
• دعم فني على مدار الساعة عبر تليجرام
• واجهة عربية بالكامل 🇮🇶

ران — أسرع وأوفر تاكسي في العراق!
```

### د. لقطات الشاشة (مطلوبة)

تحتاج على الأقل:
- **2 لقطات للهاتف** (1080x1920 أو أكبر)
- **أيقونة التطبيق** (512x512 PNG)
- **صورة غلاف** (Feature Graphic: 1024x500)

## 5. الاختبار المغلق (Closed Testing)

1. في Play Console > **الاختبار** > **الاختبار المغلق**
2. أنشئ مسار جديد
3. ارفع ملف AAB
4. أضف البريد الإلكتروني للمختبرين
5. انشر المسار

## 6. قائمة التحقق قبل النشر

- [ ] Keystore محفوظ بأمان (ليس في Git)
- [ ] `google-services.json` موجود (للإشعارات)
- [ ] `versionCode` يُزاد مع كل إصدار
- [ ] متغيرات البيئة الإنتاجية مضبوطة
- [ ] سياسة الخصوصية جاهزة
- [ ] لقطات الشاشة محدّثة
- [ ] اختبار على جهاز حقيقي (ليس فقط محاكي)

## 7. زيادة الإصدار

عند إصدار تحديث:

1. حدّث `versionCode` في `android/app/build.gradle` (يجب أن يزيد)
2. حدّث `versionName` في `android/app/build.gradle`
3. حدّث `version` في `package.json`
4. أعد البناء والرفع

## 8. ملاحظات مهمة

- Google Play يتطلب **AAB** (ليس APK) للنشر
- أول مراجعة قد تأخذ 3-7 أيام
- التطبيق يحتاج **سياسة خصوصية** (إلزامي)
- يحتاج إذن **الموقع في الخلفية** — يتطلب نموذج إضافي من Google
