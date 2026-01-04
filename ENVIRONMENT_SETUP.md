# 🚀 دليل إعداد البيئة - تطبيق RAAN Taxi

## ⚡ الإعداد السريع (10 دقائق)

### الخطوة 1: إعداد Supabase
```
🔗 اذهب إلى: https://supabase.com/dashboard
```

#### أ) إنشاء مشروع جديد:
1. انقر على **"New Project"**
2. أدخل اسم المشروع: `raan-taxi-app`
3. اختر قاعدة البيانات: `PostgreSQL`
4. اختر المنطقة الأقرب: `Middle East (Tel Aviv)` أو `Europe (London)`
5. أدخل كلمة مرور قوية لقاعدة البيانات
6. انقر **"Create Project"**

#### ب) الحصول على مفاتيح API:
1. انتظر حتى يتم إنشاء المشروع (2-3 دقائق)
2. اذهب إلى **Settings → API**
3. انسخ **Project URL** و **anon/public key**

#### ج) تشغيل قاعدة البيانات:
```sql
-- في Supabase Dashboard → SQL Editor
-- شغل هذا الملف: supabase/ALL_NEW_MIGRATIONS.sql
```

---

### الخطوة 2: إعداد Mapbox
```
🔗 اذهب إلى: https://account.mapbox.com/access-tokens/
```

#### أ) إنشاء حساب:
1. سجل حساب جديد (إذا لم يكن لديك)
2. أكد بريدك الإلكتروني

#### ب) إنشاء Access Token:
1. انقر **"Create a token"**
2. أدخل اسم الـ token: `RAAN Taxi App`
3. حدد الصلاحيات: `Downloads: Read` و `Styles: Read`
4. انقر **"Create token"**
5. **انسخ الـ token فوراً** (لن يظهر مرة أخرى!)

---

### الخطوة 3: تحديث ملف .env

#### افتح ملف `.env` واستبدل القيم:

```env
# استبدل هذا بالقيم الحقيقية من Supabase
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# استبدل هذا بـ token من Mapbox
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGV4YW1wbGUifQ...
```

#### مثال على قيم صحيحة:
```env
VITE_SUPABASE_URL=https://wglkcztdrwdphwjvqxt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbGtjenRkcmdwaHdqcXZ4dCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjczNDgzNjAwLCJleHAiOjE5ODkwNTk2MDB9.example-real-key-here

VITE_MAPBOX_TOKEN=pk.eyJ1IjoidGFraS1pcmFxaSIsImEiOiJjbGV4YW1wbGUifQ.your-actual-mapbox-token-here
```

---

### الخطوة 4: تشغيل التطبيق

#### للمبتدئين:
```
انقر على run_app_quick.bat
```

#### للمطورين:
```
انقر على start_dev.bat
```

---

## 🔧 استكشاف الأخطاء

### خطأ: "supabaseKey is required"
**الحل:**
- تأكد من أن `VITE_SUPABASE_PUBLISHABLE_KEY` موجود وصحيح
- تأكد من عدم وجود مسافات إضافية في نهاية السطر

### خطأ: "Mapbox token required"
**الحل:**
- تأكد من أن `VITE_MAPBOX_TOKEN` يبدأ بـ `pk.`
- تأكد من أن الـ token نشط في Mapbox dashboard

### خطأ: "Failed to fetch"
**الحل:**
- تحقق من اتصال الإنترنت
- تأكد من أن Supabase project نشط
- تحقق من صحة URL في Supabase

---

## 📊 خطة التكاليف

### Supabase (مجاني للبداية):
- **Free Tier:** 500MB قاعدة بيانات، 50,000 شهرياً
- **Pro:** $25/شهر للمشاريع الكبيرة

### Mapbox (مجاني للبداية):
- **Free Tier:** 50,000 خريطة شهرياً
- **Pay-as-you-go:** $0.50 لكل 1,000 خريطة إضافية

---

## 🎯 التحقق من النجاح

### بعد الإعداد، تأكد من:
- ✅ التطبيق يفتح بدون أخطاء
- ✅ يمكن التسجيل كمستخدم جديد
- ✅ الخريطة تظهر بشكل صحيح
- ✅ يمكن طلب رحلة (حتى لو بدون سائق حقيقي)

---

## 📞 دعم إضافي

### إذا واجهت مشاكل:
1. تحقق من console المتصفح (F12)
2. تأكد من نسخ القيم بشكل صحيح
3. جرب إعادة تشغيل التطبيق
4. تحقق من اتصال الإنترنت

### الملفات المساعدة:
- `QUICK_START.md` - دليل التشغيل السريع
- `IMMEDIATE_ACTIONS.md` - الإجراءات العاجلة
- `BATCH_FILES_README.md` - دليل ملفات التشغيل

---

## 🚀 الخطوات التالية

بعد إكمال الإعداد:
1. **اختبر التطبيق** من هاتفك عبر رابط الشبكة
2. **أضف بيانات تجريبية** في Supabase
3. **جرب جميع الميزات** (طلب رحلة، تتبع، تقييم)
4. **ابدأ التطوير** حسب احتياجاتك

---

**🎉 تهانينا! التطبيق جاهز للاستخدام.**