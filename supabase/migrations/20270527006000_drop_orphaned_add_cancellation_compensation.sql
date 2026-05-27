-- ═══════════════════════════════════════════════════════════════════
-- Migration: حذف الدالة اليتيمة add_cancellation_compensation
-- ═══════════════════════════════════════════════════════════════════
-- الـ trigger الخاص بها (add_cancellation_compensation_trigger) حُذف
-- في migration 20260215120000_justice_cancellation_logic.sql
-- الدالة نفسها تبقى يتيمة بلا trigger → حذفها لتنظيف قاعدة البيانات
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.add_cancellation_compensation();

-- تأكيد: لا يوجد trigger يستدعيها
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'add_cancellation_compensation'
  ) THEN
    RAISE EXCEPTION 'add_cancellation_compensation لا تزال مرتبطة بـ trigger — أعد الفحص';
  ELSE
    RAISE NOTICE 'تم حذف الدالة اليتيمة add_cancellation_compensation بنجاح';
  END IF;
END;
$$;
