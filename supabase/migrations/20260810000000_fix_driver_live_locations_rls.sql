-- ══════════════════════════════════════════════════════════════════════════════
-- ران — إصلاح أمني حرج: حماية مواقع السائقين الحية من التزوير
-- 
-- المشكلة: backgroundLocationService.ts يستخدم الـ anon key مباشرة لعمل
-- REST upsert على driver_live_locations. أي شخص يملك الـ anon key (مكشوف
-- في الـ JavaScript bundle) يمكنه تزوير موقع أي سائق.
--
-- الحل: إضافة RLS policy تتحقق من أن السائق يُحدّث موقعه الخاص فقط.
-- ══════════════════════════════════════════════════════════════════════════════

-- التأكد من أن RLS مفعل
ALTER TABLE driver_live_locations ENABLE ROW LEVEL SECURITY;

-- ═══ حذف جميع السياسات القديمة المتساهلة (USING true) ═══
-- من migration 20250712000002_fix_live_tracking_system.sql
DROP POLICY IF EXISTS "public_read_live_locations" ON driver_live_locations;
DROP POLICY IF EXISTS "drivers_insert_live_locations" ON driver_live_locations;
DROP POLICY IF EXISTS "drivers_update_live_locations" ON driver_live_locations;
DROP POLICY IF EXISTS "delete_live_locations" ON driver_live_locations;
-- أسماء قديمة أخرى محتملة
DROP POLICY IF EXISTS "Anyone can upsert driver locations" ON driver_live_locations;
DROP POLICY IF EXISTS "Public insert driver locations" ON driver_live_locations;
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON driver_live_locations;
-- حذف السياسات الجديدة أيضاً لإعادة إنشائها (idempotent)
DROP POLICY IF EXISTS "drivers_upsert_own_location" ON driver_live_locations;
DROP POLICY IF EXISTS "drivers_update_own_location" ON driver_live_locations;
DROP POLICY IF EXISTS "riders_view_their_ride_driver_location" ON driver_live_locations;
DROP POLICY IF EXISTS "drivers_delete_own_location" ON driver_live_locations;

-- ═══ سياسة الإدراج: السائق المعتمد يُدرج موقعه فقط ═══
CREATE POLICY "drivers_upsert_own_location"
ON driver_live_locations
FOR INSERT
WITH CHECK (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "drivers_update_own_location"
ON driver_live_locations
FOR UPDATE
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid() AND status = 'approved'
  )
);

-- ═══ سياسة القراءة: الراكب يقرأ موقع السائق في رحلته فقط ═══
CREATE POLICY "riders_view_their_ride_driver_location"
ON driver_live_locations
FOR SELECT
USING (
  -- الراكب يرى فقط موقع سائق الرحلة الخاصة به
  EXISTS (
    SELECT 1 FROM rides
    WHERE rides.id = driver_live_locations.ride_id
    AND rides.rider_id = auth.uid()
    AND rides.status IN ('accepted', 'arrived', 'in_progress')
  )
  OR
  -- السائق يرى موقعه الخاص
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
  OR
  -- الأدمن يرى الكل
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ═══ سياسة الحذف: السائق يحذف موقعه فقط ═══
CREATE POLICY "drivers_delete_own_location"
ON driver_live_locations
FOR DELETE
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  )
);

-- فهرس للأداء مع RLS
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_driver_id
ON driver_live_locations (driver_id);

COMMENT ON POLICY "drivers_upsert_own_location" ON driver_live_locations
IS 'يمنع تزوير مواقع سائقين آخرين — السائق المعتمد يُحدّث موقعه فقط';
