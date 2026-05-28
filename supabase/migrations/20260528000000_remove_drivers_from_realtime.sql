-- ═══════════════════════════════════════════════════════════════════
-- Disk IO Optimization: Remove drivers from Realtime Publication
-- تاريخ: 2026-05-28
-- الهدف: تقليل WAL IO بـ ~40% — كل UPDATE على drivers كان يكتب
-- الصف كاملاً (REPLICA IDENTITY FULL) في WAL + replication
-- ═══════════════════════════════════════════════════════════════════
-- 
-- السبب: جدول drivers يُحدّث كل 30 ثانية (موقع السائق)
-- مع REPLICA IDENTITY FULL، كل UPDATE يكتب ~50 عمود في WAL
-- بينما فقط current_location و updated_at تتغير فعلاً
-- 
-- التأثير على الكود:
-- - useOptimizedNearbyDrivers: لديه polling fallback كل 60 ثانية ✅
-- - DriverHome ride tracking: يستخدم rides table وليس drivers ✅
-- - AdminMap: يستخدم drivers realtime — سيعتمد على polling (مقبول للأدمن)
-- ═══════════════════════════════════════════════════════════════════

-- 1. إزالة drivers من Realtime publication (مع فحص وجودها أولاً)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.drivers;
    RAISE NOTICE 'Removed drivers from supabase_realtime publication';
  ELSE
    RAISE NOTICE 'drivers not in supabase_realtime — skipping';
  END IF;
END $$;

-- 2. إعادة REPLICA IDENTITY إلى DEFAULT (يستخدم PK فقط في WAL)
-- هذا يقلل حجم WAL بشكل كبير لأنه لن يكتب كل الأعمدة
ALTER TABLE public.drivers REPLICA IDENTITY DEFAULT;

-- 3. تعليق للتوثيق
COMMENT ON TABLE public.drivers IS 'جدول السائقين — Realtime مُعطّل لتقليل WAL IO (2026-05-28). polling كل 60 ثانية كبديل.';
