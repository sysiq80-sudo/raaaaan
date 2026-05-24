-- =========================================================================
-- Migration: Add KYC Legal Documents for Iraq Market
-- =========================================================================

-- إضافة المتطلبات القانونية (بطاقة السكن وهوية الكفيل) لجدول السائقين
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS residency_image_url TEXT,
ADD COLUMN IF NOT EXISTS guarantor_image_url TEXT;

COMMENT ON COLUMN drivers.residency_image_url IS 'صورة بطاقة السكن (متطلب قانوني)';
COMMENT ON COLUMN drivers.guarantor_image_url IS 'صورة هوية الكفيل (متطلب قانوني)';
