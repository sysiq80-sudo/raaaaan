-- =============================================
-- إضافة تسعير بالدقيقة (per_minute_fare) لجدول المناطق
-- مُستلهم من نموذج Ridy: base_fare + per_km + per_minute + minimum
-- =============================================

-- إضافة عمود per_minute_fare لجدول المناطق
ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS per_minute_fare INTEGER NOT NULL DEFAULT 0;

-- تعليق توضيحي
COMMENT ON COLUMN public.regions.per_minute_fare IS 
  'سعر الدقيقة أثناء الرحلة (دينار عراقي). يُحسب بناءً على الوقت المُقدَّر للرحلة. 0 = لا تسعير زمني.';

-- تحديث المناطق الحالية بقيمة افتراضية معقولة (150 دينار/دقيقة)
UPDATE public.regions
SET per_minute_fare = 150
WHERE per_minute_fare = 0 AND is_active = true;
