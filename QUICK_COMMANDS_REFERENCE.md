# ران RAAN - Quick Commands Reference

**معلومة سريعة غير تقنية 🚀**

---

## ⚡ أوامر التطوير الأساسية

### البدء السريع

```bash
# تثبيت الاعتماديات
npm install
# أو
bun install

# تشغيل الخادم
npm run dev
# التطبيق سيكون متاح على http://localhost:5173

# البناء للإنتاج
npm run build

# معاينة البناء
npm run preview
```

### التحقق من الأخطاء

```bash
# التحقق من TypeScript
npm run tsc

# ESLint check
npm run lint

# كل شيء معاً
npm run build  # سيوقفك إذا كان هناك أخطاء
```

---

## 🗂️ المجلدات الرئيسية

```
src/
├── components/       # React components
│   ├── admin/       # Admin pages (24)
│   ├── rider/       # Rider UI
│   ├── driver/      # Driver UI
│   └── ui/          # shadcn/ui components
├── pages/           # Router pages
├── hooks/           # Custom hooks (مهم!)
├── lib/             # Utilities & config
├── stores/          # Zustand state
└── integrations/    # Supabase types
```

### أهم الملفات

```
src/hooks/
├── useFareCalculation.ts     # حساب الأسعار
├── useNearbyDrivers.ts       # السائقين القريبين
├── useOptimizedRealtime.ts   # Realtime optimization (NEW!)
└── useRiderLocation.ts       # تتبع الموقع

src/lib/
├── supabaseConfig.ts         # Supabase setup
└── constants.ts              # الثوابت

supabase/
├── migrations/               # Database migrations
└── functions/                # Edge Functions
```

---

## 🔧 أوامر Supabase

### العمل مع Supabase محليًا

```bash
# بدء supabase محلي
supabase start

# إيقاف supabase
supabase stop

# عرض الحالة
supabase status

# تنفيذ migration
supabase migration up

# reset كل شيء
supabase reset
```

### في الإنتاج

```bash
# push migrations
supabase db push

# pull schema من الإنتاج
supabase db pull
```

---

## 📝 Git Commands

### قبل الـ Commit

```bash
# تحقق من التغييرات
git status

# اعرض الفروق
git diff

# اضف الملفات
git add .

# تحقق من أنك على branch صحيح
git branch
```

### الـ Commit

```bash
# رسالة commit موجزة
git commit -m "fix: اسم المشكلة"

# أو رسالة طويلة
git commit -m "feat: description

- التفاصيل الأولى
- التفاصيل الثانية

Closes #123"
```

### Push & Pull

```bash
# push لـ branch الحالي
git push

# pull latest
git pull

# إذا كان هناك conflicts، اقرأ:
# PUSH_INSTRUCTIONS.md
```

---

## 🧪 Testing Commands

### اختبار البناء

```bash
npm run build
# إذا كانت النتيجة ✅ فكل شيء OK
# إذا كانت ❌ اقرأ الأخطاء بعناية
```

### اختبار الأداء

```bash
# بناء + معاينة
npm run build && npm run preview

# ثم اختبر في المتصفح على http://localhost:4173
```

### TypeScript Check

```bash
npm run tsc

# يجب أن تصل إلى: 0 errors
```

---

## 🚀 Pre-Deployment Checklist

### قبل الـ Push

```bash
# 1. Update code
npm install  # تأكد من dependencies

# 2. Check errors
npm run tsc  # No TypeScript errors
npm run build # Build succeeds

# 3. Check Git
git status   # Nothing uncommitted
git diff     # Review changes

# 4. Commit & Push
git add .
git commit -m "message"
git push
```

### ملف Checklist متكامل

👉 اقرأ: **FINAL_CHECKLIST.md**

---

## 📱 اختبار على أجهزة مختلفة

### Mobile Testing

```bash
# في terminal
npm run dev

# على هاتفك:
# اذهب إلى: http://YOUR_COMPUTER_IP:5173
# مثال: http://192.168.1.100:5173
```

### Browser DevTools

```
F12 أو Right-click > Inspect

Tabs:
- Elements: check HTML
- Console: check errors
- Network: check API calls
- Application: check localStorage
- Responsive Design: test mobile
```

---

## 🐛 Debugging Common Issues

### المشكلة: "Cannot find module"

```bash
# الحل:
npm install
npm run build
```

### المشكلة: "TypeScript error"

```bash
# الحل:
npm run tsc  # اقرأ الخطأ بعناية
# اصلح الملف المشار إليه
```

### المشكلة: "Build failed"

```bash
# الحل:
npm run lint  # check syntax
npm run tsc   # check types
# اقرأ الأخطاء بعناية وأصلحها
```

### المشكلة: "Supabase connection error"

```
اقرأ: MAP_BLACK_SCREEN_FIX.md
أو: QUICK_START_GUIDE.md
```

---

## 📊 Project Status Quick Check

### Build Status

```bash
npm run build

الناتج المتوقع:
✓ 4,167 modules transformed.
✓ built in ~30s
Exit Code: 0
```

### Current Phase

```
✅ Phase 1: Multi-stop booking (COMPLETE)
✅ Phase 2: Driver dispatch (COMPLETE)
✅ Phase 3: Realtime & Surge (COMPLETE)
⏳ Phase 4: RTL & i18n (PLANNED)
⏳ Phase 5: Security & MFA (PLANNED)

Progress: 60% Complete
```

### Key Statistics

```
Lines of Code: 10,000+ lines
Components: 200+ components
Hooks: 30+ custom hooks
Functions: Edge Functions available
Database: 40+ tables
Migrations: 75+ migrations
Documentation: 4,000+ lines
```

---

## 🎯 Most Important Remember:

### ✅ DO:

- ✅ اقرأ **AI_MASTER_REFERENCE.md** قبل أي تغيير مهم
- ✅ اختبر محلياً قبل الـ push
- ✅ اكتب رسالة commit واضحة
- ✅ تحقق من **IMPORTANT_README.md** قبل التعديل

### ❌ DON'T:

- ❌ لا تعدل migrations بدون موافقة
- ❌ لا تحذف بيانات الإنتاج بدون backup
- ❌ لا تعطل RLS على الجداول
- ❌ لا تنشر credentials في Git

---

## 📚 Documentation Quick Links

| ملف                              | الغرض              |
| -------------------------------- | ------------------ |
| **AI_MASTER_REFERENCE.md**       | المرجع الرئيسي     |
| **QUICK_START_GUIDE.md**         | البدء السريع       |
| **PUSH_INSTRUCTIONS.md**         | كيفية الـ Push     |
| **FINAL_CHECKLIST.md**           | قبل الـ Deployment |
| **PHASE_4_5_PLANNING.md**        | المراحل التالية    |
| **PROJECT_STATUS_2026_01_15.md** | حالة المشروع       |

---

## 🔗 Useful Links

### Development

- Vite Docs: https://vitejs.dev
- React Docs: https://react.dev
- TypeScript Docs: https://www.typescriptlang.org

### Database

- Supabase Docs: https://supabase.com/docs
- PostgreSQL Docs: https://www.postgresql.org/docs

### Maps

- Google Maps API: https://developers.google.com/maps
- Mapbox Docs: https://docs.mapbox.com

### UI

- shadcn/ui: https://ui.shadcn.com
- Tailwind CSS: https://tailwindcss.com
- Framer Motion: https://www.framer.com/motion

---

## ⏱️ Time Estimates

### مهام شائعة

```
إنشاء مكون جديد: 30 دقيقة
إضافة hook: 45 دقيقة
إصلاح bug: 30-60 دقيقة
إضافة feature: 2-4 ساعات
اختبار شامل: 1 ساعة
الـ Deployment: 30 دقيقة
```

### المراحل المتبقية

```
Phase 4 (RTL + i18n): 1-2 أيام
Phase 5 (Security + MFA): 1.5-2 أيام
Testing & QA: 1 يوم
الـ Deployment الأخير: ساعات
```

---

## 🎓 للمطورين الجدد

### أول يوم:

1. اقرأ **QUICK_START_GUIDE.md**
2. شغل `npm run dev`
3. افحص **src/components/ui/** لفهم القاعدة

### أول أسبوع:

1. اقرأ **AI_MASTER_REFERENCE.md**
2. اقرأ **RIDER_FLOW_DOCUMENTATION.md**
3. اقرأ **src/hooks/** (custom hooks)

### قبل الـ Contribution:

1. اقرأ **IMPORTANT_README.md**
2. اقرأ **COMMIT_MESSAGES.md**
3. اقرأ **FINAL_CHECKLIST.md**

---

## 📞 Quick Help

**سؤال:** كيف أضيف feature جديد؟
**الجواب:** اقرأ PHASE_4_5_PLANNING.md ثم ابدأ!

**سؤال:** ما هي الأوامر الأساسية؟
**الجواب:** الأعلى في هذا الملف!

**سؤال:** كيف أختبر التغييرات؟
**الجواب:** npm run build (لا بد أن تنجح)

**سؤال:** كيف أنشر التغييرات؟
**الجواب:** اقرأ PUSH_INSTRUCTIONS.md

---

## ✅ الخلاصة

### المهم:

1. `npm run dev` - شغل التطبيق
2. `npm run build` - اختبر البناء
3. `npm run tsc` - اختبر الأنواع
4. اقرأ المستندات **قبل** التعديل

### الممنوع:

1. ❌ تعديل migrations بدون إذن
2. ❌ حذف بيانات الإنتاج
3. ❌ نشر credentials
4. ❌ تعطل RLS

### الموصى به:

1. ✅ اقرأ الملفات أولاً
2. ✅ اختبر محلياً
3. ✅ اطلب مراجعة
4. ✅ اكتب رسالة واضحة

---

**تم الحمد لله رب العالمين** 🤲

**آخر تحديث:** 2026-01-15
**نسخة:** 1.0
