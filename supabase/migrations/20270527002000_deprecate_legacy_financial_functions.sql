-- ══════════════════════════════════════════════════════════════════════════════
-- تعطيل الدوال المالية القديمة (legacy)
-- السبب: هذه الدوال تكتب في المسار المالي القديم:
--   • driver_wallet_transactions  (بدلاً من wallet_transactions)
--   • drivers.wallet_balance      (بدلاً من driver_wallets.balance)
-- النظام الجديد يعتمد: wallet_transactions + driver_wallets + idempotency_key
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. add_ride_earning(): تحويل إلى no-op ───────────────────────────────────
-- الـ trigger محذوف منذ 20260905200000، لكن الدالة قابلة للاستدعاء من authenticated.
-- نجعلها no-op: تعيد NEW فوراً دون أي كتابة.
CREATE OR REPLACE FUNCTION public.add_ride_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- DEPRECATED: هذه الدالة معطّلة عمداً.
  -- الـ trigger الخاص بها (add_ride_earning_trigger) محذوف في 20260905200000.
  -- تسوية أرباح السائق تتم الآن عبر process_ride_earnings() → wallet_transactions.
  RETURN NEW;
END;
$function$;

-- سحب صلاحية الاستدعاء من الجميع (كانت مفتوحة لـ PUBLIC)
REVOKE EXECUTE ON FUNCTION public.add_ride_earning() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.add_ride_earning() IS
'DEPRECATED — no-op منذ 2026-09-05. الـ trigger محذوف. استخدم process_ride_earnings() بدلاً منها.';


-- ── 2. transfer_wallet_to_driver(): تحويل إلى stub يرفع exception ────────────
-- الصلاحيات مسحوبة مسبقاً (authenticated=false, anon=false).
-- نجعل الدالة ترفع خطأ واضحاً إذا استُدعيت بأي طريقة (service_role مثلاً).
CREATE OR REPLACE FUNCTION public.transfer_wallet_to_driver(
  p_rider_user_id  UUID,
  p_driver_id      UUID,
  p_amount         INTEGER,
  p_ride_id        UUID,
  p_commission_rate NUMERIC DEFAULT 0.15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- DEPRECATED: هذه الدالة معطّلة عمداً.
  -- كانت تكتب في: drivers.wallet_balance + driver_wallet_transactions (نظام قديم).
  -- النظام الجديد يستخدم: driver_wallets.balance + wallet_transactions.
  -- للدفع الإلكتروني (nas_wallet) استخدم: process_ride_earnings() داخل complete-ride Edge Function.
  RAISE EXCEPTION 'DEPRECATED_FUNCTION'
    USING
      DETAIL  = 'transfer_wallet_to_driver writes to legacy tables (drivers.wallet_balance, driver_wallet_transactions)',
      HINT    = 'Use process_ride_earnings() via the complete-ride Edge Function instead';
END;
$function$;

-- التأكد من سحب الصلاحيات (كانت مسحوبة مسبقاً — نعيد السحب صراحةً للتوثيق)
REVOKE EXECUTE ON FUNCTION public.transfer_wallet_to_driver(UUID, UUID, INTEGER, UUID, NUMERIC)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.transfer_wallet_to_driver(UUID, UUID, INTEGER, UUID, NUMERIC) IS
'DEPRECATED — stub يرفع DEPRECATED_FUNCTION منذ 2026-05-27. استخدم process_ride_earnings() بدلاً منها.';
