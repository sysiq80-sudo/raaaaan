-- ═══════════════════════════════════════════════════════════════════
-- Disk IO Optimization: Composite & Partial Indexes
-- تاريخ: 2026-05-27
-- الهدف: تحويل full-table scans إلى index scans على الجداول الأكثر استعمالاً
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. rides: partial composite index لاستعلامات cleanup الأكثر تكراراً
--    WHERE status = 'pending' AND driver_id IS NULL
--    مستخدمة بـ: cron-cancel-stale-rides, cleanup-stale-rides, match-ride
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rides_pending_no_driver
  ON public.rides (created_at DESC)
  WHERE status = 'pending' AND driver_id IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- 2. drivers: تحويل boolean index إلى partial index
--    الاستعلامات تستخدم: WHERE is_online = true فقط
--    Partial index أصغر حجماً وأسرع بكثير من index كامل على boolean
-- ─────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_drivers_is_online;
CREATE INDEX idx_drivers_is_online
  ON public.drivers (id)
  WHERE is_online = true;

-- compound index لاستعلامات match-ride:
--   WHERE is_online = true AND is_available = true AND status = 'approved'
CREATE INDEX IF NOT EXISTS idx_drivers_available_online
  ON public.drivers (vehicle_type, status)
  WHERE is_online = true AND is_available = true AND status = 'approved';

-- ─────────────────────────────────────────────────────────────────
-- 3. notifications_log: compound index لاستعلامات الفلترة المتعددة
--    WHERE notification_type = X AND driver_id = Y AND created_at > Z
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_log_compound
  ON public.notifications_log (notification_type, driver_id, created_at DESC)
  WHERE status != 'delivered';

-- ─────────────────────────────────────────────────────────────────
-- 4. driver_live_locations: index على updated_at للاستعلامات الزمنية
--    WHERE updated_at > NOW() - INTERVAL '5 minutes'
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_driver_live_locations_updated_at
  ON public.driver_live_locations (updated_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 5. wallet_transactions (driver): compound لاستعلامات التاريخ
--    WHERE driver_id = X AND created_at BETWEEN ...
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_driver_wallet_compound
  ON public.driver_wallet_transactions (driver_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 6. scheduled_rides: compound لاستعلامات الراكب + الوقت
--    WHERE rider_id = X AND scheduled_at > NOW() AND status IN (...)
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scheduled_rides_rider_time
  ON public.scheduled_rides (rider_id, scheduled_at DESC)
  WHERE status IN ('scheduled', 'reserved', 'confirmed', 'processing');

-- ─────────────────────────────────────────────────────────────────
-- 7. company_earnings: partial index للرحلات النشطة في التقارير
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_company_earnings_driver_date
  ON public.company_earnings (driver_id, created_at DESC);
