# 🧪 دليل الاختبار السريع

## ✅ اختبار SQL Migration

### بعد تطبيق Migration:

```sql
-- في Supabase SQL Editor:

-- 1. تحقق من وجود الجدول:
SELECT * FROM information_schema.tables 
WHERE table_name = 'ride_ratings';
-- ✅ يجب أن يظهر صف واحد

-- 2. تحقق من الـ columns:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ride_ratings'
ORDER BY ordinal_position;
-- ✅ يجب أن تظهر جميع الأعمدة

-- 3. تحقق من الـ indexes:
SELECT indexname FROM pg_indexes 
WHERE tablename = 'ride_ratings';
-- ✅ يجب أن تظهر 3 indexes:
--    - idx_ride_ratings_driver
--    - idx_ride_ratings_rider
--    - idx_ride_ratings_created

-- 4. تحقق من الـ RLS policies:
SELECT policyname FROM pg_policies 
WHERE tablename = 'ride_ratings';
-- ✅ يجب أن تظهر 5 policies

-- 5. تحقق من الـ trigger:
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'ride_ratings';
-- ✅ يجب أن تظهر: update_driver_rating_trigger
```

---

## ✅ اختبار Google Maps

### في Browser Console (F12):

```javascript
// 1. تحقق من تحميل Google Maps:
console.log('Google Maps:', typeof google?.maps);
// ✅ يجب أن يُطبع: object

// 2. تحقق من Maps JavaScript API:
console.log('Map:', typeof google?.maps?.Map);
// ✅ يجب أن يُطبع: function

// 3. تحقق من Geocoder:
console.log('Geocoder:', typeof google?.maps?.Geocoder);
// ✅ يجب أن يُطبع: function

// 4. تحقق من PlacesService:
console.log('Places:', typeof google?.maps?.places?.PlacesService);
// ✅ يجب أن يُطبع: function
```

### في Network Tab:

```
ابحث عن:
1. maps.googleapis.com ✅ Status: 200
2. maps.gstatic.com ✅ Status: 200
3. mapsplatformapps.com ✅ Status: 200
```

---

## ✅ اختبار Rating System

### خطوات الاختبار:

```
1. ابدأ التطبيق:
   npm run dev

2. أكمل رحلة اختبار:
   - اختر نقطة انطلاق
   - اختر وجهة
   - احجز الرحلة
   - انتظر قبول
   - وصول السائق
   - ابدأ الرحلة
   - أكمل الرحلة ✓

3. تحقق من ظهور RideRatingScreen:
   - يجب أن تظهر تلقائياً ✅
   - عنوان: "كيف كانت الرحلة؟"
   - 5 نجوم تفاعلية ✅
   - 6 علامات سريعة ✅
   - حقل تعليق ✅

4. اختبر الميزات:
   - انقر على النجوم ✅
   - اختر علامة ✅
   - اكتب تعليق ✅
   - اضغط "إرسال التقييم" ✅

5. تحقق من الحفظ:
   - يجب أن تُرى رسالة نجاح ✅
   - تغلّق الشاشة ✅
   - ظهور RideCompletedScreen ✅
```

---

## ✅ اختبار Supabase

### بعد تقديم تقييم:

```sql
-- في Supabase SQL Editor:

-- 1. تحقق من وجود التقييم:
SELECT * FROM ride_ratings 
ORDER BY created_at DESC LIMIT 1;
-- ✅ يجب أن تظهر البيانات

-- 2. تحقق من التفاصيل:
SELECT 
  id, 
  ride_id, 
  driver_id, 
  rider_id,
  rating,
  tags,
  comment,
  created_at
FROM ride_ratings 
ORDER BY created_at DESC LIMIT 1;
-- ✅ جميع الحقول يجب أن تكون صحيحة

-- 3. تحقق من تحديث Driver rating:
SELECT user_id, rating, total_ratings 
FROM drivers 
WHERE user_id = 'driver-id-here';
-- ✅ rating و total_ratings يجب أن يتحدثا

-- 4. تحقق من متوسط التقييم:
SELECT 
  driver_id,
  AVG(rating) as avg_rating,
  COUNT(*) as total_ratings
FROM ride_ratings 
GROUP BY driver_id;
-- ✅ يجب أن تُرى إحصائيات صحيحة
```

---

## 🐛 استكشاف الأخطاء

### إذا فشل SQL Migration:

```sql
-- تحقق من الجداول المطلوبة:
SELECT * FROM information_schema.tables 
WHERE table_name IN ('rides', 'drivers', 'admins');
-- يجب أن تظهر جميع الجداول ✅

-- إذا لم تظهر جداول:
-- ✅ أنشئ جداول أولاً
-- ✅ ثم طبّق ride_ratings migration
```

### إذا لم تظهر RideRatingScreen:

```javascript
// في Console:
console.log('showCompletedScreen:', showCompletedScreen);
console.log('completedRide:', completedRide);
console.log('showRatingScreen:', showRatingScreen);

// يجب أن تكون:
// showCompletedScreen: true
// completedRide: {...}
// showRatingScreen: true
```

### إذا لم تحفظ البيانات:

```javascript
// في Console:
const result = await supabase
  .from('ride_ratings')
  .select('*')
  .limit(1);
console.log(result);

// يجب أن تُرى البيانات بدون أخطاء
```

---

## ✨ النتيجة المتوقعة

### عند النجاح:

```
✅ SQL Migration: تطبيق بنجاح
✅ Google Maps: تحمّل بدون أخطاء
✅ RideRatingScreen: تظهر تلقائياً
✅ التقييم: يُحفظ في Supabase
✅ Driver Rating: يتحدث تلقائياً
✅ كل الـ Features: تعمل بسلاسة
✅ Console: بدون أخطاء
✅ Network: جميع الـ Requests: 200

🎉 النظام: 100% جاهز
```

---

## 📋 قائمة التحقق النهائية

```
قبل الاختبار:
□ SQL Migration تطبيق ✓
□ Google Maps APIs مفعّلة ✓
□ Website Restrictions مضافة ✓
□ Browser Cache مسّح ✓

أثناء الاختبار:
□ لا أخطاء في Console ✓
□ الخريطة تحمّل ✓
□ Rating Screen يظهر ✓
□ التقييم يُحفظ ✓

بعد الاختبار:
□ جميع البيانات صحيحة ✓
□ Driver Rating تحدّث ✓
□ لا توصيات علاق ✓
□ كل شيء يعمل ✓
```

---

**والحمد لله رب العالمين** 🙏

**الحالة**: ✅ **جاهز للاختبار الشامل**
