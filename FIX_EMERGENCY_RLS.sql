-- ⚠️ قم بتشغيل هذا في Supabase SQL Editor مباشرة
-- هذا يصلح مشكلة RLS عند إنهاء الرحلة بحالة طوارئ

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "riders_can_emergency_end_rides" ON rides;
DROP POLICY IF EXISTS "drivers_can_emergency_end_rides" ON rides;

-- إضافة policy للسماح للراكب بإنهاء الرحلة في حالة طوارئ
CREATE POLICY "riders_can_emergency_end_rides" ON rides
  FOR UPDATE
  USING (
    rider_id = auth.uid() AND
    status IN ('accepted', 'arrived', 'in_progress')
  )
  WITH CHECK (
    rider_id = auth.uid() AND
    status = 'completed' AND
    emergency_completed = true AND
    emergency_end_reason = 'rider_ended'
  );

-- إضافة policy للسماح للسائق بإنهاء الرحلة في حالة طوارئ  
CREATE POLICY "drivers_can_emergency_end_rides" ON rides
  FOR UPDATE
  USING (
    driver_id = auth.uid() AND
    status IN ('accepted', 'arrived', 'in_progress')
  )
  WITH CHECK (
    driver_id = auth.uid() AND
    status = 'completed' AND
    emergency_completed = true AND
    emergency_end_reason = 'driver_ended'
  );

-- التحقق من السياسات
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'rides' AND policyname LIKE '%emergency%';
