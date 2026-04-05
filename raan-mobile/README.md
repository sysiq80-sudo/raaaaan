# ران RAAN - تطبيق تاكسي عراقي ذكي (React Native)

<div align="center">

**ران** — تطبيق حجز تاكسي عراقي متكامل مبني بـ React Native (Expo)

</div>

---

## 📋 نظرة عامة

تطبيق ران هو نظام تاكسي ذكي يخدم السوق العراقي، يوفر تجربة سلسة للركاب والسائقين مع دعم كامل للغة العربية واتجاه RTL.

### المستخدمون
- **🚶 راكب (Rider)**: حجز الرحلات، تتبع مباشر، أماكن محفوظة
- **🚗 سائق (Driver)**: استلام الطلبات، إدارة الرحلات، لوحة أرباح
- **🔧 مدير (Admin)**: إدارة النظام (عبر لوحة الويب)

---

## 🛠️ التقنيات

| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| Expo SDK | 54 | إطار العمل الأساسي |
| React Native | 0.81.5 | واجهة المستخدم |
| React | 19.1.0 | المكتبة الأساسية |
| TypeScript | ~5.9.2 | نظام الأنواع |
| expo-router | 55 | التوجيه والملاحة |
| Supabase | - | قاعدة البيانات + المصادقة + Realtime |
| react-native-maps | - | الخرائط (Google Maps) |
| Zustand | 5.0 | إدارة الحالة |
| React Query | - | إدارة البيانات |

---

## 📁 هيكل المشروع

```
raan-mobile/
├── app/                          # شاشات التطبيق (expo-router)
│   ├── _layout.tsx               # Root layout (ErrorBoundary + Providers)
│   ├── index.tsx                 # توجيه حسب الدور
│   ├── (auth)/
│   │   ├── login.tsx             # تسجيل الدخول + تسجيل راكب
│   │   └── register-driver.tsx   # تسجيل سائق جديد
│   ├── (driver)/
│   │   ├── _layout.tsx           # Stack layout
│   │   ├── profile.tsx           # الملف الشخصي
│   │   └── (tabs)/
│   │       ├── _layout.tsx       # Bottom tabs
│   │       ├── home.tsx          # الخريطة + طلبات الرحلات
│   │       ├── rides.tsx         # سجل الرحلات
│   │       ├── earnings.tsx      # الأرباح والمحفظة
│   │       └── settings.tsx      # الإعدادات
│   └── (rider)/
│       ├── _layout.tsx           # Stack layout
│       ├── track.tsx             # تتبع الرحلة المباشر
│       ├── saved-places.tsx      # الأماكن المحفوظة
│       ├── profile.tsx           # الملف الشخصي
│       └── (tabs)/
│           ├── _layout.tsx       # Bottom tabs
│           ├── home.tsx          # الحجز + الخريطة
│           ├── rides.tsx         # سجل الرحلات + إعادة حجز
│           └── settings.tsx      # الإعدادات
├── src/
│   ├── lib/
│   │   ├── supabase.ts           # عميل Supabase + SecureStore
│   │   └── constants.ts          # الثوابت + حساب الأسعار
│   ├── types/
│   │   └── index.ts              # أنواع TypeScript
│   ├── stores/
│   │   ├── driverStore.ts        # حالة السائق (Zustand)
│   │   └── riderStore.ts         # حالة الراكب (Zustand)
│   ├── hooks/
│   │   └── useAuth.tsx           # مزود المصادقة
│   ├── services/
│   │   └── notifications.ts      # إشعارات FCM/Expo
│   └── components/
│       ├── driver/
│       │   ├── RideRequestCard.tsx   # بطاقة طلب رحلة (30 ثانية)
│       │   └── ActiveRideCard.tsx    # بطاقة الرحلة النشطة
│       └── shared/
│           ├── index.tsx             # مكونات UI مشتركة
│           └── ErrorBoundary.tsx     # التقاط الأخطاء
├── assets/                       # أيقونات وصور
├── app.json                      # إعدادات Expo
├── eas.json                      # إعدادات EAS Build
└── .env                          # مفاتيح البيئة
```

---

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+
- npm أو yarn
- Android Studio (للمحاكي) أو جهاز Android حقيقي
- حساب Expo (للبناء عبر EAS)

### التثبيت

```bash
# الانتقال لمجلد المشروع
cd raan-mobile

# تثبيت الحزم
npm install --legacy-peer-deps

# نسخ ملف البيئة (يحتوي على مفاتيح Supabase)
cp .env.example .env
# عدّل .env وأضف قيم EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### التشغيل

```bash
# تشغيل Expo (وضع التطوير)
npx expo start

# تشغيل على Android مباشرة
npx expo run:android

# تشغيل على محاكي
npx expo start --android
```

### البناء (EAS)

```bash
# تثبيت EAS CLI
npm install -g eas-cli

# تسجيل الدخول
eas login

# بناء APK للاختبار
eas build --platform android --profile preview

# بناء APK تطوير (مع DevClient)
eas build --platform android --profile development

# بناء AAB للإنتاج (Google Play)
eas build --platform android --profile production
```

---

## 💰 نظام التسعير

```
الأجرة = (سعر_أساسي + المسافة × سعر_الكيلومتر) × معامل_المركبة

سعر أساسي: 2,000 د.ع
سعر الكيلومتر: 1,000 د.ع
التقريب: أقرب 250 د.ع
```

### معاملات المركبات
| النوع | المعامل |
|-------|---------|
| اقتصادي | 1.0x |
| مريح | 1.3x |
| فاخر | 1.8x |
| نسائي | 1.2x |

---

## 🔐 المصادقة

- المصادقة عبر البريد الإلكتروني المشتق من رقم الهاتف العراقي
- تنسيق: `07xx xxx xxxx` → `+9647xxxxxxxxx` → `9647xxxxxxxxx@raan.app`
- التوكنات محفوظة بأمان عبر `expo-secure-store`
- يدعم تسجيل الدخول، تسجيل راكب، وتسجيل سائق

---

## 🗺️ الخرائط

- مزود: Google Maps (Maps SDK for Android)
- المفتاح: يُعيَّن في `app.json` → `android.config.googleMaps.apiKey`
- الميزات: عرض موقع المستخدم، تتبع السائقين، اختيار نقاط الرحلة

---

## 📱 الشاشات الرئيسية

### السائق
1. **الرئيسية**: خريطة + بطاقة طلب الرحلة (عد تنازلي 30 ثانية) + الرحلة النشطة
2. **رحلاتي**: سجل الرحلات مع فلاتر + تفاصيل
3. **الأرباح**: رصيد المحفظة + إحصائيات (يومي/أسبوعي/شهري) + المعاملات
4. **الإعدادات**: صوت/اهتزاز/قبول تلقائي + الملف الشخصي

### الراكب
1. **الرئيسية**: خريطة + حجز رحلة + اختيار نوع المركبة + تقدير السعر
2. **تتبع**: تتبع مباشر للسائق عبر Realtime + broadcast
3. **رحلاتي**: سجل الرحلات + إعادة حجز
4. **الإعدادات**: الملف الشخصي + الأماكن المحفوظة

---

## 📡 Realtime

- **تتبع السائق**: `postgres_changes` على جدول `rides` + `broadcast` لموقع GPS
- **طلبات الرحلات**: `postgres_changes` INSERT على `rides` + polling كاحتياطي
- **تحديث الحالة**: اشتراك في تغييرات حالة الرحلة

---

## 🎨 التصميم

- **ثيم**: داكن (`#0f172a` خلفية، `#00d9a5` لون رئيسي)
- **RTL**: مفعّل إجبارياً عبر `I18nManager.forceRTL(true)`
- **الخطوط**: خطوط النظام الافتراضية
- **التنقل**: Bottom Tabs + Stack للشاشات الفرعية

---

## 📦 الحزم الرئيسية

```json
{
  "expo": "~54.0.33",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "expo-router": "~4.1.10",
  "@supabase/supabase-js": "^2.49.4",
  "react-native-maps": "1.20.1",
  "@tanstack/react-query": "^5.74.4",
  "zustand": "^5.0.12",
  "expo-location": "~18.1.5",
  "expo-notifications": "~0.31.2",
  "expo-secure-store": "~14.2.3",
  "@react-native-async-storage/async-storage": "^3.0.2"
}
```

---

## ⚠️ ملاحظات مهمة

1. مفتاح Google Maps في `app.json` يجب أن يكون مفعلاً لـ Maps SDK for Android
2. `.env` يجب ألا يُرفع لـ Git (مضاف في `.gitignore`)
3. التطبيق يتطلب Supabase backend مع الجداول والوظائف المعدّة مسبقاً
4. الأيقونات منسوخة من مشروع Capacitor الأصلي — يمكن تحديثها بأيقونات مخصصة

---

**والحمد لله رب العالمين** 🤲
