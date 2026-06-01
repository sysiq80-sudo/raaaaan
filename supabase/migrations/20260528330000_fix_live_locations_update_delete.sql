-- ══════════════════════════════════════════════════════════════════════════════
-- إصلاح سياسات UPDATE و DELETE على driver_live_locations
--
-- المشكلة: سياستان USING(true) على UPDATE و DELETE — أي شخص يستطيع:
--   - تزوير موقع أي سائق (UPDATE)
--   - حذف موقع أي سائق (DELETE)
--
-- الحل: تقييد على السائق الذي يملك السجل فقط
-- ══════════════════════════════════════════════════════════════════════════════

-- حذف السياسات المفتوحة
DROP POLICY IF EXISTS "drivers_update_live_locations" ON public.driver_live_locations;
DROP POLICY IF EXISTS "delete_live_locations" ON public.driver_live_locations;

-- حذف السياسات الجديدة إن وُجدت (idempotent)
DROP POLICY IF EXISTS "drivers_update_own_location" ON public.driver_live_locations;
DROP POLICY IF EXISTS "drivers_delete_own_location" ON public.driver_live_locations;

-- ═══ UPDATE: السائق المعتمد يُحدّث موقعه فقط ═══
CREATE POLICY "drivers_update_own_location"
ON public.driver_live_locations
FOR UPDATE
USING (
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid() AND status = 'approved'
  )
);

-- ═══ DELETE: السائق يحذف موقعه فقط ═══
CREATE POLICY "drivers_delete_own_location"
ON public.driver_live_locations
FOR DELETE
USING (
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
);
