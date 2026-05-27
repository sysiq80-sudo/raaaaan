-- ════════════════════════════════════════════════════════════
-- تحقيق 1: انحراف الرصيد في driver_wallets
-- هل الرصيد الحالي يطابق مجموع القيود في wallet_transactions؟
-- ════════════════════════════════════════════════════════════

-- 1a. تفاصيل كل محفظة: الرصيد الحالي، آخر balance_after، الفرق
SELECT
  dw.driver_id,
  dw.balance                                   AS current_balance,
  COALESCE(last_tx.balance_after, 0)           AS last_tx_balance_after,
  dw.balance - COALESCE(last_tx.balance_after, 0) AS drift,
  last_tx.created_at                           AS last_tx_at,
  last_tx.transaction_type                     AS last_tx_type,
  (SELECT count(*) FROM wallet_transactions wt WHERE wt.driver_id = dw.driver_id AND wt.status = 'completed') AS total_tx_count
FROM driver_wallets dw
LEFT JOIN LATERAL (
  SELECT balance_after, created_at, transaction_type
  FROM wallet_transactions
  WHERE driver_id = dw.driver_id AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1
) last_tx ON true;
