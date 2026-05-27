-- ════════════════════════════════════════════════════════════
-- تحقيق 2: الـ 71 رحلة بلا قيد دفتري
-- هل هي قبل نظام wallet_transactions أم خلل حالي؟
-- ════════════════════════════════════════════════════════════

-- 2a. أقدم وأحدث تاريخ لـ wallet_transactions
SELECT
  min(created_at) AS first_wallet_tx,
  max(created_at) AS last_wallet_tx,
  count(*) AS total
FROM wallet_transactions;
