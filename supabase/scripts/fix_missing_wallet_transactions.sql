-- ══════════════════════════════════════════════════════════════
-- إصلاح: إدراج wallet_transactions المفقودة للسائق 362a73fc
-- رحلتان بدفع nas_wallet بتاريخ 2026-05-22 لم تُسجَّل أرباحهما
-- ══════════════════════════════════════════════════════════════
-- الأرقام المحسوبة:
--   ride 4cfcb3b5: fare=4000, rate=15%, commission=600, driver_share=3400
--   ride 8987680e: fare=13500, rate=15%, commission=2025, driver_share=11475
--   المجموع المفقود = 14,875 IQD
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ─── حماية: لا تُنفَّذ إذا وُجد أحد السجلين مسبقاً ─────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE idempotency_key IN (
      'ride_earn_4cfcb3b5-061c-4e25-a21c-17298fbcdbee',
      'ride_earn_8987680e-e7a4-47c6-857d-aec158e0dd36'
    )
  ) THEN
    RAISE EXCEPTION 'الإدراج مكرر: أحد الإدخالات موجود مسبقاً';
  END IF;
END;
$$;

-- ─── 1. إدراج ride_earning للرحلة الأولى (4cfcb3b5 — 4000 IQD) ───
INSERT INTO wallet_transactions (
  wallet_id, driver_id, transaction_type, amount,
  balance_before, balance_after, ride_id,
  description, metadata, status, settlement_type,
  idempotency_key, processed_at
)
VALUES (
  '61d4fde9-28e7-4144-962b-e64bf2a243ce',
  '362a73fc-8315-4266-9ebf-1de6b97fd245',
  'ride_earning',
  3400.00,
  2584622.50,
  2588022.50,
  '4cfcb3b5-061c-4e25-a21c-17298fbcdbee',
  'تصحيح: أرباح رحلة إلكترونية (صافي بعد عمولة 15%) — 2026-05-22 20:50',
  jsonb_build_object(
    'total_fare', 4000,
    'commission_rate', 15,
    'commission', 600,
    'payment', 'nas_wallet',
    'correction', true,
    'correction_date', now()::text
  ),
  'completed',
  'online_settlement',
  'ride_earn_4cfcb3b5-061c-4e25-a21c-17298fbcdbee',
  '2026-05-22 20:50:28.82+00'
);

-- ─── 2. إدراج ride_earning للرحلة الثانية (8987680e — 13500 IQD) ──
INSERT INTO wallet_transactions (
  wallet_id, driver_id, transaction_type, amount,
  balance_before, balance_after, ride_id,
  description, metadata, status, settlement_type,
  idempotency_key, processed_at
)
VALUES (
  '61d4fde9-28e7-4144-962b-e64bf2a243ce',
  '362a73fc-8315-4266-9ebf-1de6b97fd245',
  'ride_earning',
  11475.00,
  2588022.50,
  2599497.50,
  '8987680e-e7a4-47c6-857d-aec158e0dd36',
  'تصحيح: أرباح رحلة إلكترونية (صافي بعد عمولة 15%) — 2026-05-22 20:56',
  jsonb_build_object(
    'total_fare', 13500,
    'commission_rate', 15,
    'commission', 2025,
    'payment', 'nas_wallet',
    'correction', true,
    'correction_date', now()::text
  ),
  'completed',
  'online_settlement',
  'ride_earn_8987680e-e7a4-47c6-857d-aec158e0dd36',
  '2026-05-22 20:56:07.517+00'
);

-- ─── 3. تحديث رصيد المحفظة وإحصائيات السائق ──────────────────
UPDATE driver_wallets
SET
  balance          = balance + 14875.00,
  lifetime_earnings = lifetime_earnings + 14875.00,
  total_rides_completed = total_rides_completed + 2,
  updated_at       = now()
WHERE id = '61d4fde9-28e7-4144-962b-e64bf2a243ce';

-- ─── تحقق ختامي ────────────────────────────────────────────────
DO $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT balance INTO v_balance
  FROM driver_wallets
  WHERE id = '61d4fde9-28e7-4144-962b-e64bf2a243ce';

  IF v_balance < 2599497.50 THEN
    RAISE EXCEPTION 'خطأ: الرصيد بعد التصحيح % يبدو غير صحيح', v_balance;
  END IF;
  RAISE NOTICE 'تم التصحيح — الرصيد الجديد: % IQD', v_balance;
END;
$$;

COMMIT;

-- ─── تحقق نهائي: عرض النتيجة ──────────────────────────────────
SELECT
  wt.transaction_type,
  wt.amount,
  wt.balance_before,
  wt.balance_after,
  wt.ride_id,
  wt.processed_at
FROM wallet_transactions wt
WHERE wt.idempotency_key IN (
  'ride_earn_4cfcb3b5-061c-4e25-a21c-17298fbcdbee',
  'ride_earn_8987680e-e7a4-47c6-857d-aec158e0dd36'
)
ORDER BY wt.processed_at;
