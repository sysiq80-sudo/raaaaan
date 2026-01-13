-- ===================================
-- حذف جميع المعالم من قاعدة البيانات
-- ===================================

-- ⚠️ تحذير: هذا السكربت سيحذف جميع البيانات من جدول landmarks
-- تأكد من أخذ نسخة احتياطية قبل التشغيل

-- حذف جميع المعالم
DELETE FROM landmarks;

-- إعادة تعيين العداد (إذا كنت تستخدم SERIAL أو IDENTITY)
-- ALTER SEQUENCE landmarks_id_seq RESTART WITH 1;

-- التحقق من الحذف
SELECT COUNT(*) as remaining_landmarks FROM landmarks;

-- يجب أن تظهر النتيجة: 0
