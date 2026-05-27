-- ══════════════════════════════════════════════════════════════════════════
-- تعطيل trigger_driver_compensation_90s — منع التعويض المزدوج/الثلاثي
-- التاريخ: 2026-05-27
-- ══════════════════════════════════════════════════════════════════════════
--
-- المشكلة:
--   عند إلغاء الراكب بعد > 90 ثانية من القبول (أو الوصول)، تتسابق ثلاثة
--   مسارات على منح السائق تعويضاً لنفس الرحلة:
--
--   1. trigger_driver_compensation_90s  (BEFORE UPDATE)
--      → handle_driver_compensation_90s()
--      → يكتب في النظام القديم فقط (driver_wallet_transactions + drivers.wallet_balance)
--      → ليس له idempotency
--
--   2. trigger_rider_cancellation_penalty (BEFORE UPDATE)
--      → handle_rider_cancellation_penalty()
--      → يكتب في القديم + الجديد (create_wallet_transaction)
--      → شروط أدق (> 2 دقيقة أو ضمن 500م أو وصل)
--      → ليس له idempotency
--
--   3. captain_compensation_shield (AFTER UPDATE)
--      → يستدعي Edge Function captain-guardian-alerts
--      → يكتب في النظام الجديد (wallet_transactions + driver_wallets)
--
--   النتيجة: السائق يتلقى التعويض 2-3 مرات لنفس الإلغاء.
--
-- القرار:
--   تعطيل trigger_driver_compensation_90s (DISABLE لا DROP) لأن:
--   - مهامه مغطاة بالكامل من trigger_rider_cancellation_penalty
--   - trigger_rider_cancellation_penalty أدق منطقياً وله شروط إضافية
--   - DISABLE يسمح بإعادة التفعيل لو اكتُشف خطأ لاحقاً
--   - الدالة handle_driver_compensation_90s تبقى في DB دون تغيير
--
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rides
  DISABLE TRIGGER trigger_driver_compensation_90s;

COMMENT ON FUNCTION public.handle_driver_compensation_90s() IS
'[DISABLED TRIGGER] مغطى بـ trigger_rider_cancellation_penalty (أدق)
 تم تعطيل الـ trigger لمنع التعويض المزدوج.
 migration: 20270527003000_disable_duplicate_compensation_trigger';
