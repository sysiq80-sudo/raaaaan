# 🚧 ميزات مؤجلة للمرحلة الثانية (Future Features)

هذا الملف يوثق الميزات التي تم تطويرها ولكنها معطّلة مؤقتاً، وسيتم تفعيلها بعد استيفاء شروط محددة.

---

## 0. 🔴 Known Technical Debt — بوابات الدفع الخارجية (ZainCash / NASS)

### الوضع
**مُعطَّل بقصد** ❌ — `ENABLE_EXTERNAL_PAYMENT_GATEWAYS=false`

### المشكلة (Financial DR Audit — 2026-05-30)

| الكود | الثغرة | المخاطرة |
|---|---|---|
| **DR-05** | ZainCash Callback Race Condition | إرسال callback مزدوج أو متزامن يُضيف رصيداً مرتَين (double-credit) |
| **DR-07** | NASS Callback Race Condition | نفس المشكلة — لا يوجد idempotency check كافٍ على `reference_id` |

### التفاصيل التقنية
- كلا الـ callbacks لا يستخدمان `FOR UPDATE` lock عند تحديث رصيد المحفظة
- `reference_id` غير مُفهرَس بـ UNIQUE constraint → يمكن إدخال نفس المعاملة مرتَين
- الدالة `credit_wallet_safely` لا تتحقق من وجود معاملة سابقة بنفس الـ reference قبل الإضافة

### شرط التفعيل (غير قابل للتجاوز)
يجب إصلاح **DR-05 و DR-07 معاً** قبل تفعيل أي بوابة دفع خارجية:

1. إضافة `UNIQUE(reference_id)` على `rider_wallet_transactions`
2. تطبيق `SELECT ... FOR UPDATE` في callback handler قبل أي UPDATE
3. إعادة Financial DR Audit كاملاً → يجب أن ينتهي بـ `FAIL: 0`
4. اختبار double-callback simulation على staging قبل الإنتاج

### الملفات المتأثرة
- `supabase/functions/zaincash-callback/` — callback handler رئيسي
- `supabase/functions/zaincash-init/` — بدء عملية الدفع
- `supabase/functions/nass-payment-callback/` — callback NASS
- `supabase/functions/nass-init-payment/` — بدء عملية NASS
- `supabase/functions/nass-check-status/` — فحص الحالة

### قاعدة صارمة
> **لا تُفعِّل `ENABLE_EXTERNAL_PAYMENT_GATEWAYS=true` أبداً قبل إصلاح DR-05/DR-07 وإعادة Financial DR Audit.**
> الخسارة المحتملة من double-credit على بوابات إنتاجية = خسارة مالية حقيقية غير قابلة للاسترداد التلقائي.

---

## 1. 🎙️ ميزة الذكاء الاصطناعي الصوتي (AI Voice Booking)

### الوصف
ميزة تسمح للركاب بحجز الرحلات عبر الصوت باستخدام الذكاء الاصطناعي. يقول الراكب وجهته بصوته، والنظام يفهم ويحجز الرحلة تلقائياً.

### الحالة
**معطّل مؤقتاً** ❌

### السبب
- تتطلب API دائماً للذكاء الاصطناعي (OpenAI Whisper للتعرف على الصوت + GPT للمعالجة)
- تكلفة مستمرة على كل استخدام
- نريد إطلاق التطبيق بشكل مبدئي بدون تكاليف تشغيل عالية

### الملفات المتأثرة
- `src/components/rider/AIVoiceHome.tsx` - المكون الرئيسي (يحتوي على Feature Flag)
- `src/hooks/useVoiceRecording.ts` - Hook للتسجيل الصوتي
- `supabase/functions/voice-booking-ai/` - Edge Function للمعالجة

### كيفية التفعيل لاحقاً

#### الخطوة 1: تفعيل Feature Flag
في ملف `src/components/rider/AIVoiceHome.tsx`:
```typescript
// ابحث عن هذا السطر (حوالي السطر 40):
const ENABLE_VOICE_MODE = false;

// غيّره إلى:
const ENABLE_VOICE_MODE = true;
```

#### الخطوة 2: التأكد من إعدادات Supabase Edge Function
تأكد من أن Edge Function `voice-booking-ai` تعمل بشكل صحيح:
```bash
# اختبار محلياً
supabase functions serve voice-booking-ai

# نشر على الإنتاج
supabase functions deploy voice-booking-ai
```

#### الخطوة 3: إعداد OpenAI API Key
تأكد من إضافة OpenAI API Key في Supabase Secrets:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

#### الخطوة 4: اختبار الميزة
1. افتح تطبيق الراكب
2. اضغط مطولاً على زر المايكروفون 🎤
3. قل وجهتك (مثال: "جامعة الأنبار")
4. تحقق من أن النظام فهم وحجز الرحلة بشكل صحيح

### التكاليف المتوقعة (بعد التفعيل)
- **Whisper API**: ~$0.006 لكل دقيقة صوت
- **GPT-4 API**: ~$0.03-0.06 لكل طلب
- **التقدير**: ~$0.10 لكل حجز صوتي

### البدائل المتاحة حالياً
- ✅ **وضع الكتابة**: يمكن للراكب كتابة وجهته والنظام يفهمها بالذكاء الاصطناعي
- ✅ **الأماكن المحفوظة**: يمكن للراكب حفظ أماكنه المفضلة واختيارها بنقرة واحدة
- ✅ **الاقتراحات السريعة**: معالم وأحياء الرمادي جاهزة للاختيار السريع

---

## 2. ⏱️ عداد وقت الانتظار المرئي (Waiting Timer Display)

### الوصف
عداد يعرض للراكب الوقت المنقضي أثناء البحث عن سائق، مع شريط تقدم ووقت الوصول المتوقع.

### الحالة
**معطّل مؤقتاً** ❌

### السبب
- قد يزيد من قلق وتوتر الزبون عند رؤية الوقت يزيد، خاصة في أوقات الذروة
- يشعر الزبون بالاستعجال والضغط النفسي
- قد يؤدي إلى إلغاءات غير ضرورية من الزبائن القلقين
- تجربة أفضل بدون العداد مع رسائل تشجيعية فقط

### الملفات المتأثرة
- `src/components/rider/RideWaitingScreen.tsx` - المكون الرئيسي (يحتوي على Feature Flag)

### كيفية التفعيل لاحقاً

#### الخطوة 1: تفعيل Feature Flag
في ملف `src/components/rider/RideWaitingScreen.tsx`:
```typescript
// ابحث عن هذا السطر (حوالي السطر 32):
const SHOW_WAITING_TIMER = false;

// غيّره إلى:
const SHOW_WAITING_TIMER = true;
```

### البدائل المتاحة حالياً
- ✅ **رسائل تشجيعية متناوبة**: رسائل إيجابية تظهر للزبون أثناء الانتظار
- ✅ **عداد السائقين القريبين**: عرض عدد السائقين المتاحين في المنطقة
- ✅ **أذكار تفاعلية**: تسبيح واستغفار لتشغيل وقت الانتظار بشكل إيجابي
- ✅ **معلومات الرحلة**: عرض نقاط الانطلاق والوجهة بشكل واضح
- ✅ **تأكيد بصري**: أيقونات وألوان مريحة بدون ضغط الوقت

### ملاحظات إضافية
- العداد لا يزال يعمل في الخلفية للنظام (للإلغاء التلقائي بعد انتهاء المدة)
- فقط الواجهة المرئية للعداد تم إخفاؤها
- يمكن إعادة التفعيل في المستقبل إذا طلب العملاء ذلك

---

## 3. 📅 جدولة الرحلات مسبقاً (Ride Scheduling)

### الوصف
ميزة تسمح للراكب بجدولة رحلة لوقت لاحق (ساعات أو أيام) بدلاً من الطلب الفوري. يختار الراكب التاريخ والوقت ويتم تذكيره قبل الموعد.

### الحالة
**معطّلة مؤقتاً** ❌

### السبب
- الميزة تحتاج لنظام إشعارات وتذكير خلفي (cron jobs) غير مُعد بعد
- تحتاج لنظام مطابقة سائقين متقدم لضمان توفر سائق في الوقت المحدد
- أولوية الإطلاق المبدئي هي الطلب الفوري فقط

### الملفات المتأثرة
- `src/components/rider/BookingConfirmationView.tsx` — زر التبديل بين "الآن" و"جدولة" (مُعلَّق بتعليق)
- `src/components/rider/ScheduleRideDialog.tsx` — نافذة اختيار التاريخ والوقت
- `src/components/rider/ScheduledRidesList.tsx` — قائمة الرحلات المجدولة
- `src/components/rider/BookingConfirmationScreen.tsx` — مرجع الجدولة (scheduleDialogRef)
- `src/pages/rider/GoPage.tsx` — معالجة حدث الجدولة

### كيفية التفعيل لاحقاً

#### الخطوة 1: إزالة التعليق من زر التبديل
في ملف `src/components/rider/BookingConfirmationView.tsx`:
```typescript
// ابحث عن هذا التعليق:
{/* ── الجدولة معطلة مؤقتاً — سيتم تفعيلها في إصدار مستقبلي ── */}
{/*
<div className="shrink-0 flex ...">
  ...
</div>
*/}

// أزل التعليق ليصبح:
<div className="shrink-0 flex ...">
  ...
</div>
```

#### الخطوة 2: إعداد نظام التذكيرات
- إعداد Supabase Edge Function أو cron job لإرسال تذكيرات قبل موعد الرحلة
- ربط Push Notifications بالتذكيرات

#### الخطوة 3: نظام مطابقة السائقين
- تطوير آلية لحجز سائق مسبقاً أو البحث التلقائي عند اقتراب الموعد

### البدائل المتاحة حالياً
- ✅ **الطلب الفوري**: الراكب يطلب الرحلة وقت ما يحتاجها
- ✅ **الأماكن المحفوظة**: حفظ الوجهات المتكررة للوصول السريع

---

## خطة التفعيل المستقبلية

### المرحلة 1 (الحالية) - الإطلاق المبدئي ✅
- [x] وضع الكتابة فقط
- [x] الأماكن المحفوظة
- [x] الاقتراحات السريعة
- [x] رسائل تشجيعية بدون عداد زمني (تجربة مريحة)
- [ ] ميزة الصوت (معطّلة)
- [ ] عداد وقت الانتظار المرئي (معطّل)
- [ ] جدولة الرحلات مسبقاً (معطّلة)

### المرحلة 2 - بعد 3-6 أشهر من الإطلاق 🔜
- [ ] مراقبة الاستخدام والعائدات
- [ ] تقييم الجدوى المالية
- [ ] جمع آراء المستخدمين حول تفضيلاتهم (هل يريدون رؤية العداد؟)
- [ ] تفعيل ميزة الصوت تدريجياً
- [ ] تفعيل جدولة الرحلات مع نظام تذكيرات
- [ ] إضافة خيار اشتراك مدفوع للميزات المتقدمة (voice included)
- [ ] إعادة تقييم عداد الانتظار بناءً على طلب المستخدمين

### المرحلة 3 - التحسين المستمر 🚀
- [ ] تحسين دقة التعرف على الصوت
- [ ] دعم اللهجات العراقية المختلفة
- [ ] إضافة ردود صوتية من النظام (Text-to-Speech)

---

## 4. 📱 جاهزية Android للإنتاج (Play Store Production)

### الوصف
ثلاثة تغييرات تقنية مطلوبة قبل رفع أي APK على Google Play Store. الوضع الحالي مقبول تماماً لأغراض الاختبار الداخلي (debug APK)، لكن لا يمكن النشر العام بدونها.

### الحالة
**مطلوب قبل Play Store** ⚠️ — debug APK للاختبار جاهز الآن

---

### الإصلاح الأول: WebView Debugging

**المشكلة:** في `android/app/src/main/java/com/raan/rider/MainActivity.java`:
```java
// حالياً — خطر أمني في الإنتاج: يسمح لأي شخص بـ USB بفحص كل traffic
WebView.setWebContentsDebuggingEnabled(true);
```

**الحل:**
```java
// الصحيح: تفعيل فقط في builds التطوير
WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
```

**الخطورة:** عالية قبل Play Store — أي شخص يصل لجهاز المستخدم بكابل USB يمكنه قراءة كل الـ requests/responses بما فيها tokens المصادقة.

---

### الإصلاح الثاني: تفعيل minifyEnabled للـ Release

**المشكلة:** في `android/app/build.gradle`:
```gradle
buildTypes {
    release {
        minifyEnabled false   // ← APK غير مضغوط وغير مشفر الأسماء
        proguardFiles ...
    }
}
```

**الحل:**
```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

**الفائدة:** تصغير حجم APK بنسبة 30-50%، وصعوبة عكس هندسة الكود (reverse engineering).

---

### الإصلاح الثالث: إضافة signingConfigs

**المشكلة:** لا يوجد `signingConfigs` في `build.gradle` — الـ release APK يُوقَّع تلقائياً بـ debug keystore الذي لا يقبله Play Store.

**الحل (الخطوات):**
```bash
# الخطوة 1: توليد keystore الإنتاج (مرة واحدة فقط، احتفظ بالملف بأمان)
keytool -genkey -v -keystore raan-release.keystore \
  -alias raan -keyalg RSA -keysize 2048 -validity 10000

# الخطوة 2: إضافة في build.gradle
android {
    signingConfigs {
        release {
            storeFile file("raan-release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "raan"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            ...
        }
    }
}
```

> ⚠️ **مهم:** لا تضع كلمات المرور مباشرة في build.gradle. استخدم متغيرات البيئة أو ملف `local.properties` غير المُضمَّن في git.

---

### خلاصة الجاهزية

| الهدف | الجاهزية الحالية |
|-------|-----------------|
| اختبار داخلي / QA — debug APK | ✅ جاهز الآن |
| Firebase App Distribution | ✅ جاهز (بعد إضافة signingConfigs) |
| Google Play Store — internal testing | يحتاج الإصلاح الثالث فقط |
| Google Play Store — public release | يحتاج الإصلاحات الثلاثة كاملة |

---

## ملاحظات للمطورين

### عند إضافة ميزات جديدة قابلة للتعطيل:
1. استخدم Feature Flags واضحة (مثل `ENABLE_FEATURE_NAME`)
2. أضف تعليقات توضيحية شاملة
3. وثّق الميزة في هذا الملف
4. اختبر الميزة معطّلة ومفعّلة

### عند تعديل الكود:
- ⚠️ لا تحذف كود الميزات المعطّلة - احتفظ بها للتفعيل المستقبلي
- ✅ استخدم التعليقات الواضحة لتمييز الأقسام المعطّلة
- ✅ اجعل التفعيل/التعطيل سهل بمجرد تغيير متغير واحد

---

## تواصل
للأسئلة أو الاستفسارات حول الميزات المؤجلة، راجع:
- الوثائق الفنية: `docs/ARCHITECTURE.md`
- حالة المشروع: `docs/PROJECT_STATUS.md`

---

## 5. 🗺️ خطة توسيع محرك البحث الجغرافي (Geocoding Scaling Plan)

### الوضع الحالي

منذ **2026-05-29** يستخدم حقل البحث الحي في `AIVoiceHome` محرك **Nominatim (OpenStreetMap)**:

```
src/components/rider/AIVoiceHome.tsx
  └── nominatimAdapter.searchPlaces()    ← Live Search (كل حرف يُكتب)

src/hooks/useDynamicPlacesSearch.ts
  └── NominatimGeocodingAdapter          ← GoPage Search (مع كاش LRU)
```

### لماذا Nominatim؟

| الميزة | التفصيل |
|--------|---------|
| **السعر** | مجاني تماماً |
| **CORS** | يعمل في المتصفح والجهاز بدون مشاكل |
| **الدقة للعراق** | جيدة جداً — OpenStreetMap يغطي العراق بشكل ممتاز |
| **الإحداثيات** | تُرجع مع كل نتيجة مباشرة (لا حاجة لطلب ثانٍ) |

### قيود الاستخدام العادل (Fair Use)

- **الحد الأقصى:** طلب واحد في الثانية لكل IP
- **Caching:** إلزامي — لا تكرر نفس الطلب
- **User-Agent:** يجب تحديد اسم التطبيق في header الطلب
- **الاستخدام التجاري الكبير:** يُنصح باستضافة نسخة خاصة

> ⚠️ **ملاحظة:** `AIVoiceHome` يستخدم singleton منفصل بدون كاش مشترك مع `GoPage`.
> إذا ارتفع الاستخدام يُنصح بتوحيد الـ singleton وإضافة LRU Cache.

---

### مراحل التوسيع حسب حجم المستخدمين

#### 🟢 المرحلة الحالية — حتى ~5,000 مستخدم يومي
**الحل:** Nominatim العام (الحالي) ✅

```
لا حاجة لأي تغيير.
التكلفة: $0
```

---

#### 🟡 المرحلة 2 — 5,000 إلى 50,000 مستخدم يومي
**الحل:** نسخة Nominatim Self-Hosted (Docker)

```bash
# تشغيل Nominatim على سيرفرك الخاص
docker run -it --rm \
  -e PBF_URL=https://download.geofabrik.de/asia/iraq-latest.osm.pbf \
  -e REPLICATION_URL=https://planet.osm.org/replication/hour/ \
  -p 8080:8080 \
  --name nominatim mediagis/nominatim:4.3
```

```
التكلفة: سعر السيرفر فقط (~$20-50/شهر على DigitalOcean/Hetzner)
حجم البيانات للعراق: ~2 GB
```

**التعديل المطلوب في الكود:**
```typescript
// في NominatimGeocodingAdapter.ts — غيّر الـ base URL:
const NOMINATIM_BASE = "https://your-server.com/nominatim";
// بدلاً من:
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
```

---

#### 🔴 المرحلة 3 — +50,000 مستخدم يومي أو دقة أعلى
**الحل:** أحد البدائل التجارية أو المجانية المتقدمة:

| الخيار | السعر | المميزات |
|--------|-------|---------|
| **Geoapify** | 3,000 طلب/يوم مجاناً، ثم $49/شهر | سريع، دقة عالية، CORS |
| **MapTiler Geocoding** | 100,000 طلب/شهر مجاناً | خرائط + geocoding |
| **Pelias (Self-hosted)** | مجاني، docker | يستخدم OSM + Who's on First |
| **HERE Geocoding** | 250,000 طلب/شهر مجاناً | دقة عالية للشرق الأوسط |
| **Google Places** | $17/1000 طلب | الأدق لكن الأغلى |

**التوصية للمرحلة 3:** ابدأ بـ **Geoapify** أو **MapTiler** قبل الرجوع لـ Google Places.

---

### كيفية تطبيق البديل

عند الحاجة للتغيير، المطلوب فقط:

1. **إنشاء Adapter جديد** يطبق نفس interface:
```typescript
// src/lib/adapters/GeoapifyGeocodingAdapter.ts
export class GeoapifyGeocodingAdapter implements IGeocodingAdapter {
  async searchPlaces(query: string, center?: LatLng): Promise<PlacePrediction[]> {
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${query}&apiKey=${this.apiKey}`;
    // ...
  }
}
```

2. **تبديل السطر الواحد** في `AIVoiceHome.tsx` و `useDynamicPlacesSearch.ts`:
```typescript
// قبل:
const nominatimAdapter = new NominatimGeocodingAdapter();
// بعد:
const nominatimAdapter = new GeoapifyGeocodingAdapter(apiKey);
```

---

### خلاصة قرار التوسيع

```
المستخدمون الحاليون → Nominatim مجاني ✅
نمو متوسط (5K-50K) → Nominatim Self-Hosted (~$20-50/شهر)
نمو كبير (+50K)    → Geoapify أو MapTiler ($49+/شهر)
دقة قصوى مدفوعة   → Google Places API (بحث محدود فقط)
```

> 📌 **قرار:** راجع هذا القسم عند وصول التطبيق لـ **5,000 رحلة/يوم** كمؤشر للانتقال للمرحلة التالية.
