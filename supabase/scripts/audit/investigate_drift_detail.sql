-- ════════════════════════════════════════════════════════════
-- تحقيق 1b: البحث عن سبب الانحراف
-- ════════════════════════════════════════════════════════════

-- السائق الأول: آخر 10 معاملات (بكل الحالات)
SELECT
  transaction_type, amount, balance_before, balance_after,
  status, created_at, idempotency_key
FROM wallet_transactions
WHERE driver_id = '362a73fc-8315-4266-9ebf-1de6b97fd245'
ORDER BY created_at DESC
LIMIT 15;
