-- ============================================================
-- تقرير المطابقة المالية (Reconciliation Audit)
-- التاريخ: 2026-05-27
-- ============================================================
-- يجري استعلاماً واحداً يجمع جميع الفحوصات باستخدام CTE
-- ============================================================

WITH

-- ── فحص 0: إحصاء عام ─────────────────────────────────────────
summary_counts AS (
  SELECT
    (SELECT count(*) FROM rides WHERE status = 'completed') AS total_completed_rides,
    (SELECT count(*) FROM rides WHERE status = 'completed' AND driver_id IS NOT NULL) AS completed_with_driver,
    (SELECT count(*) FROM company_earnings) AS total_company_earnings_rows,
    (SELECT count(*) FROM wallet_transactions) AS total_wallet_tx_rows,
    (SELECT count(*) FROM withdrawal_requests WHERE status IN ('completed','approved')) AS total_completed_withdrawals,
    (SELECT count(*) FROM driver_wallets) AS total_driver_wallets
),

-- ── فحص 1: رحلات completed بلا company_earnings ───────────────
-- كل رحلة مكتملة يجب أن يكون لها سجل عمولة شركة
rides_no_commission AS (
  SELECT count(*) AS cnt, COALESCE(sum(r.final_fare), 0) AS total_fare_iqd
  FROM rides r
  LEFT JOIN company_earnings ce ON ce.ride_id = r.id
  WHERE r.status = 'completed'
    AND r.driver_id IS NOT NULL
    AND r.final_fare > 0
    AND ce.id IS NULL
),

-- ── فحص 2: رحلات completed بلا wallet_transactions (أرباح السائق) ─
-- ملاحظة: وضع daily_subscription لا يُنشئ قيوداً per-ride (بالتصميم)
-- نستثني الرحلات التي مرّت عبر complete_ride_transactional بوضع daily_subscription
rides_no_driver_ledger AS (
  SELECT count(*) AS cnt, COALESCE(sum(r.final_fare), 0) AS total_fare_iqd
  FROM rides r
  LEFT JOIN wallet_transactions wt ON wt.ride_id = r.id
  WHERE r.status = 'completed'
    AND r.driver_id IS NOT NULL
    AND r.final_fare > 0
    AND wt.id IS NULL
    -- استثناء وضع daily_subscription (لا قيود per-ride فيه بالتصميم)
    AND COALESCE(r.metadata->'receipt'->>'monetization_mode', '') != 'daily_subscription'
),

-- ── فحص 3: رحلات nas_wallet بلا خصم من rider_wallet_transactions ─
-- كل رحلة مدفوعة من المحفظة يجب أن يكون لها خصم مسجل
wallet_rides_no_deduction AS (
  SELECT count(*) AS cnt, COALESCE(sum(r.final_fare), 0) AS total_fare_iqd
  FROM rides r
  LEFT JOIN rider_wallet_transactions rwt
    ON rwt.ride_id = r.id
  WHERE r.status = 'completed'
    AND r.payment_method::text = 'nas_wallet'
    AND r.final_fare > 0
    AND rwt.id IS NULL
),

-- ── فحص 4: انحراف الرصيد (Balance Drift) ─────────────────────
-- driver_wallets.balance يجب أن يساوي SUM(amount) لجميع المعاملات
-- ملاحظة: استخدام SUM بدلاً من LIMIT 1 لتفادي تعادل الطوابع الزمنية
balance_drift AS (
  SELECT
    count(*) AS cnt,
    COALESCE(sum(ABS(dw.balance - COALESCE(tx_sum.running_total, 0))), 0) AS total_drift
  FROM driver_wallets dw
  LEFT JOIN (
    SELECT driver_id, SUM(amount) AS running_total
    FROM wallet_transactions
    WHERE status = 'completed'
    GROUP BY driver_id
  ) tx_sum ON tx_sum.driver_id = dw.driver_id
  WHERE ABS(dw.balance - COALESCE(tx_sum.running_total, 0)) > 0.01
),

-- ── فحص 5: طلبات سحب completed بلا قيد في wallet_transactions ──
withdrawals_no_ledger AS (
  SELECT count(*) AS cnt, COALESCE(sum(wr.amount), 0) AS total_amount
  FROM withdrawal_requests wr
  WHERE wr.status IN ('completed', 'approved')
    AND NOT EXISTS (
      SELECT 1 FROM wallet_transactions wt
      WHERE wt.driver_id = wr.driver_id
        AND wt.transaction_type ILIKE '%withdraw%'
        AND (
          wt.metadata->>'withdrawal_request_id' = wr.id::text
          OR wt.idempotency_key = 'withdrawal_' || wr.id::text
          OR (ABS(wt.amount - wr.amount) < 0.01
              AND wt.created_at BETWEEN wr.created_at - interval '1 hour'
                                    AND wr.updated_at + interval '1 hour')
        )
    )
),

-- ── فحص 6: إجمالي company_earnings مقابل إجمالي final_fare ────
-- المقارنة: رحلات مكتملة لديها company_earnings فقط (per-ride comparison)
fare_vs_earnings AS (
  SELECT
    COALESCE(sum(r.final_fare), 0) AS total_final_fare,
    COALESCE(sum(ce.total_fare), 0) AS total_in_earnings_table,
    COALESCE(sum(r.final_fare - ce.total_fare), 0) AS unrecorded_amount,
    count(*) FILTER (WHERE r.final_fare != ce.total_fare) AS mismatched_rides
  FROM rides r
  JOIN company_earnings ce ON ce.ride_id = r.id
  WHERE r.status = 'completed'
    AND r.final_fare > 0
)

-- ── التقرير النهائي ────────────────────────────────────────────
SELECT
  sc.total_completed_rides,
  sc.completed_with_driver,
  sc.total_company_earnings_rows,
  sc.total_wallet_tx_rows,
  sc.total_completed_withdrawals,
  sc.total_driver_wallets,
  -- فحص 1
  rnc.cnt AS rides_missing_commission,
  rnc.total_fare_iqd AS missing_commission_fare_sum,
  -- فحص 2
  rndl.cnt AS rides_missing_driver_ledger,
  rndl.total_fare_iqd AS missing_driver_ledger_fare_sum,
  -- فحص 3
  wrnd.cnt AS wallet_rides_missing_deduction,
  wrnd.total_fare_iqd AS missing_deduction_sum,
  -- فحص 4
  bd.cnt AS wallets_with_balance_drift,
  bd.total_drift AS total_drift_amount,
  -- فحص 5
  wnl.cnt AS withdrawals_missing_ledger,
  wnl.total_amount AS missing_withdrawal_amount,
  -- فحص 6
  fve.total_final_fare,
  fve.total_in_earnings_table,
  fve.unrecorded_amount AS fare_vs_earnings_gap,
  fve.mismatched_rides AS fare_amount_mismatches
FROM summary_counts sc
CROSS JOIN rides_no_commission rnc
CROSS JOIN rides_no_driver_ledger rndl
CROSS JOIN wallet_rides_no_deduction wrnd
CROSS JOIN balance_drift bd
CROSS JOIN withdrawals_no_ledger wnl
CROSS JOIN fare_vs_earnings fve;
