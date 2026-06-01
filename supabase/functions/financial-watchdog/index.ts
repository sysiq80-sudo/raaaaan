/**
 * ════════════════════════════════════════════════════════════════════════════
 * RAAN — Financial Watchdog
 * ════════════════════════════════════════════════════════════════════════════
 *
 * مراقب مالي دوري — يُشغَّل كل ساعة عبر pg_cron
 *
 * يفحص:
 *   W01 — Wallet Mismatch:       wallet_balance ≠ SUM(completed rider_wallet_transactions)
 *   W02 — Negative Balance:      wallet_balance < 0 في profiles أو driver_wallets
 *   W03 — Rider Ledger Gaps:     balance_after[n] ≠ balance_before[n+1] في rider_wallet_transactions
 *   W04 — Stuck Pending Tx:      rider_wallet_transactions بـ status=pending > 1 ساعة
 *   W05 — Stuck Withdrawals:     withdrawal_requests بـ status=pending > 24 ساعة
 *
 * عند اكتشاف أي مشكلة:
 *   1. يُدرج في جدول fraud_alerts (severity=high للشذوذ المالي)
 *   2. يستدعي notify-admin-critical لإرسال تنبيه Telegram للأدمن
 *
 * الأمان:
 *   - verify_jwt = false (يُستدعى من pg_cron)
 *   - محمي بـ requireInternalSecret (x-internal-secret header)
 *
 * التشغيل اليدوي للاختبار:
 *   curl -X POST https://PROJECT.supabase.co/functions/v1/financial-watchdog \
 *     -H "x-internal-secret: WATCHDOG_SECRET"
 * ════════════════════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, requireInternalSecret } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// حدود التسامح الحسابي (floating point)
const EPSILON = 0.005;

// عتبة drift تستحق التنبيه (بالدينار العراقي) — أقل من ذلك يُعدّ تقريباً حسابياً
const DRIFT_ALERT_THRESHOLD = 1.0;

interface WatchdogFinding {
  check: string;
  severity: "high" | "medium" | "low";
  count: number;
  details: string[];
}

interface WatchdogReport {
  run_at: string;
  findings: WatchdogFinding[];
  total_issues: number;
  alerts_sent: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: إدراج في fraud_alerts
// ─────────────────────────────────────────────────────────────────────────────
async function insertFraudAlert(
  svc: ReturnType<typeof createClient>,
  alertType: string,
  severity: "high" | "medium" | "low",
  description: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await svc.from("fraud_alerts").insert({
    alert_type: alertType,
    severity,
    user_id: "system",
    user_type: "rider",
    description,
    details,
    status: "pending",
  });
  if (error) {
    console.error(`[financial-watchdog] fraud_alert insert failed: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: إرسال تنبيه Telegram للأدمن
// ─────────────────────────────────────────────────────────────────────────────
async function notifyAdmin(
  svc: ReturnType<typeof createClient>,
  alertType: "wallet_mismatch" | "payment_failed" | "system_error",
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await svc.functions.invoke("notify-admin-critical", {
      body: { type: alertType, message, metadata },
    });
  } catch (e) {
    console.error(`[financial-watchdog] notify-admin-critical failed: ${(e as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// W01 — Wallet Mismatch (راكب)
// wallet_balance في profiles يجب أن يساوي SUM(amount) للمعاملات المكتملة
// ─────────────────────────────────────────────────────────────────────────────
async function checkW01(svc: ReturnType<typeof createClient>): Promise<WatchdogFinding | null> {
  // جلب جميع الركاب الذين لديهم معاملات
  const { data: riders, error: rErr } = await svc
    .from("profiles")
    .select("user_id, wallet_balance")
    .not("wallet_balance", "is", null);

  if (rErr || !riders?.length) return null;

  const { data: txs, error: tErr } = await svc
    .from("rider_wallet_transactions")
    .select("user_id, amount, status");

  if (tErr || !txs) return null;

  // تجميع المجاميع حسب user_id (فقط المعاملات المكتملة)
  const sumByUser: Record<string, number> = {};
  for (const tx of txs) {
    const t = tx as { user_id: string; amount: number; status: string };
    if (t.status !== "completed") continue;
    sumByUser[t.user_id] = (sumByUser[t.user_id] ?? 0) + Number(t.amount);
  }

  const mismatches: string[] = [];
  for (const rider of riders) {
    const r = rider as { user_id: string; wallet_balance: number };
    const sumTx = sumByUser[r.user_id] ?? 0;
    const drift = Math.abs(Number(r.wallet_balance) - sumTx);
    if (drift > DRIFT_ALERT_THRESHOLD) {
      mismatches.push(
        `user ${r.user_id.slice(0, 8)}… wallet_balance=${r.wallet_balance} vs SUM(tx)=${sumTx.toFixed(2)} drift=${drift.toFixed(2)} IQD`
      );
    }
  }

  if (mismatches.length === 0) return null;

  return {
    check: "W01_WALLET_MISMATCH",
    severity: "high",
    count: mismatches.length,
    details: mismatches,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// W02 — Negative Balance
// ─────────────────────────────────────────────────────────────────────────────
async function checkW02(svc: ReturnType<typeof createClient>): Promise<WatchdogFinding | null> {
  const details: string[] = [];

  const { data: negRiders } = await svc
    .from("profiles")
    .select("user_id, wallet_balance")
    .lt("wallet_balance", 0);

  if (negRiders?.length) {
    for (const r of negRiders) {
      const row = r as { user_id: string; wallet_balance: number };
      details.push(`rider ${row.user_id.slice(0, 8)}… wallet_balance=${row.wallet_balance}`);
    }
  }

  const { data: negDrivers } = await svc
    .from("driver_wallets")
    .select("driver_id, balance")
    .lt("balance", 0);

  if (negDrivers?.length) {
    for (const d of negDrivers) {
      const row = d as { driver_id: string; balance: number };
      details.push(`driver ${row.driver_id.slice(0, 8)}… balance=${row.balance}`);
    }
  }

  if (details.length === 0) return null;

  return {
    check: "W02_NEGATIVE_BALANCE",
    severity: "high",
    count: details.length,
    details,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// W03 — Rider Ledger Gaps
// balance_after[n] يجب أن يساوي balance_before[n+1] لكل راكب
// ─────────────────────────────────────────────────────────────────────────────
async function checkW03(svc: ReturnType<typeof createClient>): Promise<WatchdogFinding | null> {
  type RiderTx = { id: string; user_id: string; balance_before: number | null; balance_after: number | null; created_at: string };

  // جلب آخر 500 معاملة فقط لتجنب timeout (الـ watchdog يعمل دورياً فلا حاجة للكل في كل مرة)
  const { data: txs, error } = await svc
    .from("rider_wallet_transactions")
    .select("id, user_id, balance_before, balance_after, created_at")
    .not("balance_before", "is", null)
    .not("balance_after", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !txs?.length) return null;

  // تجميع حسب user_id وترتيب زمني
  const byUser: Record<string, RiderTx[]> = {};
  for (const tx of txs as RiderTx[]) {
    (byUser[tx.user_id] ??= []).push(tx);
  }

  const breaks: string[] = [];
  for (const [userId, rows] of Object.entries(byUser)) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (Math.abs(Number(prev.balance_after) - Number(curr.balance_before)) > EPSILON) {
        breaks.push(
          `user ${userId.slice(0, 8)}… gap: ${prev.balance_after} → ${curr.balance_before} ` +
          `(tx ${prev.id.slice(0, 8)}… → ${curr.id.slice(0, 8)}…)`
        );
        if (breaks.length >= 10) break; // حد أقصى 10 في التنبيه الواحد
      }
    }
    if (breaks.length >= 10) break;
  }

  if (breaks.length === 0) return null;

  return {
    check: "W03_RIDER_LEDGER_GAP",
    severity: "high",
    count: breaks.length,
    details: breaks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// W04 — Stuck Pending Rider Transactions (> 1 ساعة)
// ─────────────────────────────────────────────────────────────────────────────
async function checkW04(svc: ReturnType<typeof createClient>): Promise<WatchdogFinding | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: stuck, error } = await svc
    .from("rider_wallet_transactions")
    .select("id, user_id, amount, type, created_at")
    .eq("status", "pending")
    .lt("created_at", oneHourAgo)
    .limit(20);

  if (error || !stuck?.length) return null;

  const details = (stuck as { id: string; user_id: string; amount: number; type: string; created_at: string }[])
    .map(t => `tx ${t.id.slice(0, 8)}… user ${t.user_id.slice(0, 8)}… type=${t.type} amount=${t.amount} since ${t.created_at}`);

  return {
    check: "W04_STUCK_PENDING_TX",
    severity: "medium",
    count: details.length,
    details,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// W05 — Stuck Withdrawal Requests (> 24 ساعة)
// ─────────────────────────────────────────────────────────────────────────────
async function checkW05(svc: ReturnType<typeof createClient>): Promise<WatchdogFinding | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stuck, error } = await svc
    .from("withdrawal_requests")
    .select("id, driver_id, amount, created_at")
    .eq("status", "pending")
    .lt("created_at", oneDayAgo)
    .limit(20);

  if (error || !stuck?.length) return null;

  const details = (stuck as { id: string; driver_id: string; amount: number; created_at: string }[])
    .map(w => `request ${w.id.slice(0, 8)}… driver ${w.driver_id.slice(0, 8)}… amount=${w.amount} IQD since ${w.created_at}`);

  return {
    check: "W05_STUCK_WITHDRAWAL",
    severity: "medium",
    count: details.length,
    details,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;

  const runAt = new Date().toISOString();
  console.log(`[financial-watchdog] 🔍 بدء الفحص — ${runAt}`);

  try {
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // تشغيل جميع الفحوصات بالتوازي
    const [f01, f02, f03, f04, f05] = await Promise.all([
      checkW01(svc),
      checkW02(svc),
      checkW03(svc),
      checkW04(svc),
      checkW05(svc),
    ]);

    const findings = [f01, f02, f03, f04, f05].filter(Boolean) as WatchdogFinding[];
    let alertsSent = 0;

    for (const finding of findings) {
      console.warn(
        `[financial-watchdog] ⚠️ ${finding.check} — ${finding.count} مشكلة`,
        finding.details.slice(0, 3)
      );

      // إدراج في fraud_alerts
      await insertFraudAlert(
        svc,
        finding.check.toLowerCase(),
        finding.severity,
        `${finding.check}: ${finding.count} مشكلة مالية اكتُشفت تلقائياً`,
        { count: finding.count, samples: finding.details.slice(0, 5), run_at: runAt },
      );

      // إرسال Telegram للأدمن (فقط للـ HIGH severity)
      if (finding.severity === "high") {
        const alertType = finding.check.includes("MISMATCH") ? "wallet_mismatch" :
                          finding.check.includes("NEGATIVE") ? "wallet_mismatch" :
                          finding.check.includes("LEDGER") ? "wallet_mismatch" : "system_error";
        await notifyAdmin(svc, alertType as "wallet_mismatch", 
          `🚨 ${finding.check}\n${finding.count} مشكلة مالية\n\nعينات:\n${finding.details.slice(0, 3).join("\n")}`,
          { count: finding.count, check: finding.check, run_at: runAt }
        );
        alertsSent++;
      }
    }

    const report: WatchdogReport = {
      run_at: runAt,
      findings,
      total_issues: findings.reduce((s, f) => s + f.count, 0),
      alerts_sent: alertsSent,
    };

    if (findings.length === 0) {
      console.log(`[financial-watchdog] ✅ كل الفحوصات اجتازت — لا مشاكل مالية`);
    }

    return new Response(JSON.stringify({ ok: true, report }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[financial-watchdog] 💥 خطأ غير متوقع: ${msg}`);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
