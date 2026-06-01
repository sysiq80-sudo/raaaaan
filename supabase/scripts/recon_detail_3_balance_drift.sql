-- ============================================================
-- تحقيق تفصيلي: فحص 3 — محافظ السائقين مع انحراف رصيد
-- ============================================================
SELECT
  dw.driver_id,
  dw.balance AS wallet_balance,
  COALESCE(last_tx.balance_after, 0) AS last_tx_balance_after,
  dw.balance - COALESCE(last_tx.balance_after, 0) AS drift,
  last_tx.created_at AS last_tx_at,
  last_tx.transaction_type,
  last_tx.amount AS last_tx_amount,
  -- مجموع كل المعاملات لهذا السائق
  COALESCE(all_tx.net_sum, 0) AS sum_all_transactions
FROM driver_wallets dw
LEFT JOIN LATERAL (
  SELECT balance_after, created_at, transaction_type, amount
  FROM wallet_transactions
  WHERE driver_id = dw.driver_id
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1
) last_tx ON true
LEFT JOIN LATERAL (
  SELECT sum(
    CASE
      WHEN transaction_type IN ('topup', 'ride_earning', 'bonus', 'tip') THEN amount
      WHEN transaction_type IN ('withdrawal', 'deduction', 'commission') THEN -amount
      ELSE amount
    END
  ) AS net_sum
  FROM wallet_transactions
  WHERE driver_id = dw.driver_id AND status = 'completed'
) all_tx ON true
WHERE ABS(dw.balance - COALESCE(last_tx.balance_after, 0)) > 0.01
ORDER BY ABS(dw.balance - COALESCE(last_tx.balance_after, 0)) DESC;
