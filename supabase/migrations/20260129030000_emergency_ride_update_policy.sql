-- =====================================================
-- سياسة تحديث الرحلة في حالة الطوارئ
-- تاريخ الإنشاء: 2026-01-29
-- الوصف: السماح للراكب والسائق بإنهاء الرحلة في حالة الطوارئ
-- =====================================================

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

-- تعليق: هذه السياسات تسمح فقط بإنهاء الرحلة في حالة الطوارئ
-- لا يمكن تعديل أي حقول أخرى
