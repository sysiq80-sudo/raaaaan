-- إلغاء الرحلات المعلقة القديمة
UPDATE rides 
SET status = 'cancelled', 
    cancellation_reason = 'تم إلغاؤها من قبل النظام - رحلة قديمة',
    cancelled_by = 'system',
    updated_at = now()
WHERE id IN (
  '3f66447d-7a4b-401d-bb0b-8bf7e829107a',
  '1e309468-67b8-4368-ba85-63ebb9d5dfcc',
  'e6226ea7-2f11-4eda-a723-1a0d89716c51'
);