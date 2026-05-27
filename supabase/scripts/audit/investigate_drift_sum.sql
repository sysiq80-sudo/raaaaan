-- ════════════════════════════════════════════════════════════
-- تحقيق 1c: التحقق الحسابي الكامل — هل الرصيد = مجموع القيود؟
-- ════════════════════════════════════════════════════════════

-- السائق الأول: فحص الترتيب الزمني الدقيق (مشكلة created_at متطابق)
SELECT
  'driver_1_all_tx' AS label,
  count(*) AS tx_count,
  sum(amount) AS sum_of_amounts,
  dw.balance AS current_balance,
  dw.balance - sum(amount) AS diff_from_zero  -- إذا بدأنا من 0، مجموع القيود يساوي الرصيد؟
FROM wallet_transactions wt
JOIN driver_wallets dw ON dw.driver_id = wt.driver_id
WHERE wt.driver_id = '362a73fc-8315-4266-9ebf-1de6b97fd245'
  AND wt.status = 'completed'
GROUP BY dw.balance

UNION ALL

-- السائق الثاني: كل المعاملات مرتبة
SELECT
  'driver_2_all_tx',
  count(*),
  sum(amount),
  dw.balance,
  dw.balance - sum(amount)
FROM wallet_transactions wt
JOIN driver_wallets dw ON dw.driver_id = wt.driver_id
WHERE wt.driver_id = '334f64af-2c82-4efb-8cfd-81e5225fc6e4'
  AND wt.status = 'completed'
GROUP BY dw.balance;
