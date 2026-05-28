-- ══════════════════════════════════════════════════════════════════════════════
-- ران — إصلاح: إعادة السماح بالقراءة العامة لـ driver_live_locations
-- 
-- السبب: migration 20260810000000 استبدل policy القراءة USING(true) بـ policy
-- تتطلب تسجيل الدخول. هذا يكسر صفحة /track/:token التي هي صفحة عامة (بدون auth).
--
-- الحل: إعادة policy القراءة إلى USING(true) مع الإبقاء على:
--   - INSERT: السائق المعتمد فقط يكتب موقعه الخاص (آمن ✅)
--   - UPDATE: السائق المعتمد فقط يحدّث موقعه الخاص (آمن ✅)
--   - DELETE: السائق فقط يحذف موقعه (آمن ✅)
--   - SELECT: مفتوح للجميع — مقبول لأن:
--     1. معرفات الرحلات UUIDs عشوائية (يصعب تخمينها)
--     2. البيانات تُحذف تلقائياً عند انتهاء/إلغاء الرحلة
--     3. التحكم في الوصول يتم في طبقة التطبيق (share token)
-- ══════════════════════════════════════════════════════════════════════════════

-- حذف جميع policies القراءة (الجديدة والقديمة) ثم إعادة إنشاء الصحيحة
DROP POLICY IF EXISTS "riders_view_their_ride_driver_location" ON public.driver_live_locations;
DROP POLICY IF EXISTS "public_read_live_locations" ON public.driver_live_locations;

-- إعادة policy القراءة المفتوحة (مطلوبة لصفحة التتبع العامة)
CREATE POLICY "public_read_live_locations"
ON public.driver_live_locations
FOR SELECT
USING (true);
