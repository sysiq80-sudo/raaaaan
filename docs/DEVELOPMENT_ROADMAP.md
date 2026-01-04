# 🚕 خطة تطوير تطبيق رعان (Raan) للتاكسي

> آخر تحديث: ديسمبر 2025
> الإصدار: 1.0.0

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [الحالة الحالية](#الحالة-الحالية)
3. [المرحلة 1: إصلاحات عاجلة](#المرحلة-1-إصلاحات-عاجلة-)
4. [المرحلة 2: تحسينات الأداء](#المرحلة-2-تحسينات-الأداء-)
5. [المرحلة 3: ميزات أساسية جديدة](#المرحلة-3-ميزات-أساسية-جديدة-)
6. [المرحلة 4: ميزات متقدمة](#المرحلة-4-ميزات-متقدمة-)
7. [المرحلة 5: تحسينات تجربة المستخدم](#المرحلة-5-تحسينات-تجربة-المستخدم-)
8. [سجل التغييرات](#سجل-التغييرات)

---

## نظرة عامة

تطبيق **رعان** هو منصة متكاملة لحجز سيارات الأجرة تستهدف السوق العراقي. يتضمن التطبيق:
- واجهة للركاب (Rider App)
- واجهة للسائقين (Driver App)
- لوحة تحكم للإدارة (Admin Dashboard)

### التقنيات المستخدمة
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **Maps**: Mapbox GL
- **Notifications**: Web Push API, OTPIQ (WhatsApp/SMS)

---

## الحالة الحالية

### ✅ الميزات المكتملة

| الميزة | الحالة | ملاحظات |
|--------|--------|---------|
| تسجيل/تسجيل دخول الركاب | ✅ مكتمل | Email + Phone/WhatsApp OTP |
| تسجيل/تسجيل دخول السائقين | ✅ مكتمل | Email + Phone/WhatsApp OTP |
| استعادة كلمة المرور | ✅ مكتمل | Email + Phone OTP |
| اختيار نقاط الانطلاق والوصول | ✅ مكتمل | Map picker + Search |
| حساب التكلفة التقديرية | ✅ مكتمل | Based on distance + region |
| أنواع المركبات | ✅ مكتمل | Economy, Comfort, Premium, Women Only |
| مطابقة الرحلات (Ride Matching) | ✅ مكتمل | Proximity-based matching |
| تتبع الرحلة في الوقت الحقيقي | ✅ مكتمل | Supabase Realtime |
| إشعارات السائقين | ✅ مكتمل | Web Push + Sound |
| تقييم الرحلات | ✅ مكتمل | 5-star rating |
| لوحة إدارة السائقين | ✅ مكتمل | CRUD operations |
| إدارة المناطق والتسعير | ✅ مكتمل | Region-based pricing |
| الأماكن المحفوظة | ✅ مكتمل | Home, Work, Custom |
| الأماكن المميزة (Landmarks) | ✅ مكتمل | Quick location selection |

### ⚠️ مشاكل معروفة

| المشكلة | الخطورة | الحالة |
|---------|---------|--------|
| Leaked Password Protection معطل | 🟡 متوسط | يتطلب تفعيل يدوي |

---

## المرحلة 1: إصلاحات عاجلة 🔴

**الجدول الزمني**: أسبوع 1
**الأولوية**: حرجة

### 1.1 ✅ إصلاح أمان بيانات السائقين
- [x] إنشاء `available_drivers_safe` VIEW لإخفاء البيانات الحساسة
- [x] تطبيق SECURITY INVOKER على الـ VIEW
- [x] تحديث الكود لاستخدام الـ VIEW الآمن

### 1.2 ✅ إصلاح أمان بيانات الراكب
- [x] إنشاء `rider_profile_safe` VIEW
- [x] إنشاء `driver_has_active_ride_with_rider()` function
- [x] سياسة RLS محدودة للسائقين

### 1.3 ✅ التحقق من تحولات حالة الرحلة
- [x] إنشاء `validate_ride_status_transition()` trigger
- [x] منع التحولات غير المنطقية (مثل: completed → pending)

### 1.4 ✅ فهارس قاعدة البيانات
- [x] إضافة فهرس على `rides.status`
- [x] إضافة فهرس على `drivers.is_online`
- [x] إضافة فهرس على `drivers.is_available`

### 1.5 ⏳ تفعيل حماية كلمات المرور المسربة
- [ ] تفعيل Leaked Password Protection من إعدادات Supabase Auth
- **الرابط**: [Supabase Auth Settings](https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/auth/providers)

---

## المرحلة 2: تحسينات الأداء 🟡

**الجدول الزمني**: أسبوع 2-3
**الأولوية**: متوسطة

### 2.1 ✅ إلغاء تلقائي للرحلات المعلقة
- [x] Edge Function `cleanup-stale-rides`
- [x] إلغاء الرحلات بعد 10 دقائق من عدم الاستجابة

### 2.2 ✅ تحسين Race Condition في قبول الرحلات
- [x] استخدام `SELECT FOR UPDATE SKIP LOCKED`
- [x] دالة `accept_ride_safely()` للقبول الآمن

---

## المرحلة 3: ميزات أساسية جديدة 🟢

**الجدول الزمني**: أسبوع 4-6
**الأولوية**: عالية

### 3.1 ✅ زر طوارئ SOS
- [x] مكون `EmergencyButton.tsx`
- [x] جدول `emergency_contacts`
- [x] جدول `emergency_alerts`
- [x] إرسال موقع عبر WhatsApp
- [x] اتصال مباشر بالشرطة/الإسعاف

### 3.2 ✅ مشاركة موقع الرحلة
- [x] مكون `RideShareButton.tsx`
- [x] صفحة `TrackRide.tsx` للتتبع العام
- [x] جدول `ride_share_links`
- [x] روابط صالحة 24 ساعة
- [x] مشاركة عبر WhatsApp

### 3.3 ✅ محادثة داخلية بسيطة
- [x] مكون `RideChat.tsx`
- [x] جدول `ride_messages`
- [x] Realtime messaging
- [x] رسائل سريعة جاهزة

---

## المرحلة 4: ميزات متقدمة 🔵

**الجدول الزمني**: أسبوع 7-10
**الأولوية**: عادية

### 4.1 ✅ جدولة الرحلات المستقبلية
**الوصف**: حجز رحلة في وقت محدد مستقبلاً

- [x] جدول `scheduled_rides` مع RLS
- [x] مكون `ScheduleRideDialog.tsx`
- [x] مكون `ScheduledRidesList.tsx`
- [x] Edge Function `process-scheduled-rides`
- [x] تذكير قبل 15 دقيقة من الموعد

### 4.2 نظام المكافآت والولاء
**الوصف**: نقاط لكل رحلة مع مستويات ومكافآت

```sql
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  points INTEGER DEFAULT 0,
  level TEXT DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  ride_id UUID REFERENCES rides,
  points INTEGER NOT NULL,
  type TEXT CHECK (type IN ('earn', 'redeem')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**المستويات**:
| المستوى | النقاط المطلوبة | الخصم |
|---------|-----------------|-------|
| Bronze | 0 | 0% |
| Silver | 500 | 3% |
| Gold | 2000 | 5% |
| Platinum | 5000 | 10% |

### 4.3 ✅ لوحة إحصائيات متقدمة للسائق
**الوصف**: رسوم بيانية وتحليلات للسائق

**الميزات**:
- [x] الأرباح اليومية/الأسبوعية/الشهرية (Recharts)
- [x] توزيع الرحلات حسب ساعات اليوم
- [x] توزيع طرق الدفع (Pie Chart)
- [x] متوسط وقت الرحلة والمسافة
- [x] نسبة إكمال الرحلات
- [x] أفضل يوم وأفضل ساعة

---

## المرحلة 5: تحسينات تجربة المستخدم 🟣

**الجدول الزمني**: مستمر
**الأولوية**: متوسطة

### 5.1 تحسينات الواجهة
- [ ] وضع داكن/فاتح قابل للتبديل
- [ ] تحسين الأنيميشن (Framer Motion)
- [ ] Skeleton loading للبيانات
- [ ] Pull-to-refresh للقوائم

### 5.2 دعم اللغات
- [ ] اللغة الكردية (ku)
- [ ] تحسين RTL للعربية
- [ ] اكتشاف لغة الجهاز تلقائياً

### 5.3 تحسين الأداء
- [ ] Lazy loading للمكونات الكبيرة
- [ ] تقليل حجم Bundle
- [ ] تحسين أداء الخرائط
- [ ] تقليل استهلاك البطارية

### 5.4 إمكانية الوصول (Accessibility)
- [ ] دعم Screen Readers
- [ ] تباين ألوان كافي (WCAG AA)
- [ ] أحجام خطوط قابلة للتعديل
- [ ] دعم لوحة المفاتيح

---

## سجل التغييرات

### الإصدار 1.0.0 (ديسمبر 2025)
- ✅ إطلاق التطبيق الأساسي
- ✅ نظام المصادقة (Email + Phone OTP)
- ✅ استعادة كلمة المرور
- ✅ حجز الرحلات ومطابقتها
- ✅ تتبع الرحلات في الوقت الحقيقي
- ✅ نظام التقييم
- ✅ لوحة الإدارة

### الإصدار 1.0.1 (ديسمبر 2025)
- ✅ إصلاح أمان بيانات السائقين (safe_drivers_view)
- ✅ إضافة trigger للتحقق من تحولات حالة الرحلة
- ✅ إضافة فهارس لتحسين الأداء

---

## 📝 ملاحظات للمطورين

### هيكل المشروع
```
src/
├── components/
│   ├── admin/       # مكونات لوحة الإدارة
│   ├── driver/      # مكونات واجهة السائق
│   ├── rider/       # مكونات واجهة الراكب
│   └── ui/          # مكونات Shadcn UI
├── hooks/           # React Hooks مخصصة
├── pages/           # صفحات التطبيق
├── lib/             # أدوات مساعدة
└── integrations/    # تكاملات Supabase
```

### أوامر مفيدة
```bash
# تشغيل التطبيق محلياً
npm run dev

# بناء للإنتاج
npm run build

# فحص TypeScript
npm run typecheck
```

### روابط مهمة
- [Supabase Dashboard](https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt)
- [Edge Functions Logs](https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/functions)
- [SQL Editor](https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/sql/new)

---

> **تنبيه**: يجب تحديث هذا الملف عند إكمال أي مهمة أو إضافة ميزة جديدة.
