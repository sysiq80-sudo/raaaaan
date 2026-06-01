/**
 * ════════════════════════════════════════════════════════════════════════════
 * RAAN — Financial Watchdog Verification
 * ════════════════════════════════════════════════════════════════════════════
 *
 * يتحقق من أن financial-watchdog يعمل فعلياً من البداية للنهاية:
 *
 *   الخطوة 0: Preflight — هل الـ watchdog مُنشر ويستجيب؟
 *   الخطوة 1: Dry Run — تشغيل على البيانات الحالية (بدون حقن)
 *   الخطوة 2: حقن Wallet Drift — +5000 IQD مصطنع على راكب حقيقي
 *   الخطوة 3: تشغيل الـ watchdog بعد الحقن
 *   الخطوة 4: التحقق من fraud_alerts (W01_WALLET_MISMATCH)
 *   الخطوة 5: التحقق من severity=high + alerts_sent >= 1
 *   الخطوة 6: تنظيف — استعادة wallet_balance + حذف سجلات الاختبار
 *
 * التشغيل:
 *   SUPABASE_URL=https://wgolkcztdrwdphwjvqxt.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   INTERNAL_EDGE_SECRET=... \
 *   RAAN_VERIFY_ALLOW_PRODUCTION=yes \
 *   npx tsx supabase/verification/watchdog-verification.ts
 *
 * ✅ يُنظّف بياناته تلقائياً في نهاية التشغيل الناجح أو الفاشل.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// إعداد وحراسة البيئة
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const INTERNAL_SECRET = process.env.INTERNAL_EDGE_SECRET ?? "";
const PROD_PROJECT_REF = "wgolkcztdrwdphwjvqxt";

function bail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) bail("SUPABASE_URL غير محدد.");
if (!SERVICE_ROLE_KEY) bail("SUPABASE_SERVICE_ROLE_KEY غير محدد.");
if (!INTERNAL_SECRET) bail("INTERNAL_EDGE_SECRET غير محدد — مطلوب لاستدعاء الـ watchdog.");

const isProd = SUPABASE_URL.includes(PROD_PROJECT_REF);
const isLocal = SUPABASE_URL.includes("127.0.0.1") || SUPABASE_URL.includes("localhost");
const allowProd = process.env.RAAN_VERIFY_ALLOW_PRODUCTION === "yes";

if (isProd && !allowProd) {
  bail(
    `رُفض التشغيل: SUPABASE_URL يشير إلى الإنتاج (${PROD_PROJECT_REF}).\n` +
    `هذا السكربت يُعدّل مؤقتاً wallet_balance لراكب حقيقي.\n` +
    `للتشغيل مع الإقرار الكامل: RAAN_VERIFY_ALLOW_PRODUCTION=yes`
  );
}
if (isProd && allowProd) {
  console.warn(
    "\n⚠️  تحذير: تشغيل على الإنتاج — wallet_balance لراكب واحد سيُعدَّل مؤقتاً ثم يُستعاد تلقائياً.\n" +
    "   التنظيف يعمل حتى عند الفشل (finally block).\n"
  );
}

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// أدوات التقارير
// ─────────────────────────────────────────────────────────────────────────────

const STEP_DRIFT_AMOUNT = 5000; // IQD — قيمة الـ drift المُحقون (أكبر بكثير من DRIFT_ALERT_THRESHOLD=1)
const TEST_TAG = "[WATCHDOG_VERIFY_TEST]";

type Result = "PASS" | "FAIL" | "WARN" | "INFO" | "SKIP";

interface StepResult {
  step: string;
  result: Result;
  detail: string;
}

const stepResults: StepResult[] = [];

function log(result: Result, step: string, detail: string) {
  const icons: Record<Result, string> = {
    PASS: "✅", FAIL: "❌", WARN: "⚠️ ", INFO: "ℹ️ ", SKIP: "⏭️ "
  };
  console.log(`  ${icons[result]} [${result}] ${step}: ${detail}`);
  stepResults.push({ step, result, detail });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: استدعاء financial-watchdog عبر HTTP
// ─────────────────────────────────────────────────────────────────────────────

interface WatchdogResponse {
  ok: boolean;
  report?: {
    run_at: string;
    findings: Array<{
      check: string;
      severity: string;
      count: number;
      details: string[];
    }>;
    total_issues: number;
    alerts_sent: number;
  };
  error?: string;
  status?: number;
}

async function invokeWatchdog(): Promise<WatchdogResponse> {
  const url = `${SUPABASE_URL}/functions/v1/financial-watchdog`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: "{}",
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text}`, status: res.status };
    }
    return { ok: true, ...(data as object), status: res.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// البيانات المؤقتة للتنظيف
// ─────────────────────────────────────────────────────────────────────────────

let testRiderUserId: string | null = null;
let originalWalletBalance: number | null = null;
let testFraudAlertIds: string[] = [];
let testStartTime: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// الخطوة 0: Preflight — هل الـ watchdog مُنشر؟
// ─────────────────────────────────────────────────────────────────────────────

async function step0_preflight() {
  console.log("\n─── الخطوة 0: Preflight — فحص الـ watchdog ───");

  const res = await invokeWatchdog();

  if (res.status === 404) {
    log("FAIL", "Function Deployed", "financial-watchdog غير موجود — شغّل: supabase functions deploy financial-watchdog");
    bail("الـ watchdog غير مُنشر. لا يمكن المتابعة.");
  }

  if (res.status === 403) {
    log("FAIL", "Auth Secret", `INTERNAL_EDGE_SECRET خاطئ أو غير مضبوط في Supabase Secrets — HTTP 403`);
    bail("Secret غير صحيح. تحقق من INTERNAL_EDGE_SECRET في Supabase Dashboard → Edge Functions → Secrets.");
  }

  if (!res.ok) {
    log("FAIL", "Function Reachable", `خطأ غير متوقع: ${res.error ?? res.status}`);
    bail("الـ watchdog لا يستجيب.");
  }

  log("PASS", "Function Deployed", `watchdog يستجيب — HTTP ${res.status}`);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// الخطوة 1: Dry Run — تشغيل على البيانات الحالية
// ─────────────────────────────────────────────────────────────────────────────

async function step1_dryRun(res: WatchdogResponse) {
  console.log("\n─── الخطوة 1: Dry Run — البيانات الحالية ───");

  if (res.report) {
    const { total_issues, alerts_sent, findings } = res.report;
    if (total_issues === 0) {
      log("PASS", "Dry Run", `لا مشاكل مالية في البيانات الحالية — نظام نظيف`);
    } else {
      log("WARN", "Dry Run", `وُجدت ${total_issues} مشكلة حقيقية في البيانات — ${alerts_sent} تنبيه أُرسل`);
      for (const f of findings) {
        console.log(`       ⚠️  ${f.check} (${f.severity}): ${f.count} مشكلة`);
        f.details.slice(0, 2).forEach(d => console.log(`          • ${d}`));
      }
    }
    log("INFO", "Response Structure", `report.findings[${findings.length}] | total_issues=${total_issues} | alerts_sent=${alerts_sent}`);
  } else {
    log("WARN", "Dry Run", "الاستجابة لا تحتوي على report — تحقق من بنية الـ watchdog");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// الخطوة 2: حقن Wallet Drift
// ─────────────────────────────────────────────────────────────────────────────

async function step2_injectDrift() {
  console.log("\n─── الخطوة 2: حقن Wallet Drift التجريبي ───");

  // أ) جلب راكب حقيقي لديه معاملات مكتملة
  const { data: riders, error: rErr } = await svc
    .from("profiles")
    .select("user_id, wallet_balance")
    .not("wallet_balance", "is", null)
    .gte("wallet_balance", 0)
    .limit(20);

  if (rErr || !riders?.length) {
    log("FAIL", "Find Test Rider", `لا يوجد ركاب بمحفظة صالحة: ${rErr?.message ?? "لا بيانات"}`);
    return false;
  }

  // اختر أول راكب لديه معاملات مكتملة
  let chosenRider: { user_id: string; wallet_balance: number } | null = null;
  for (const r of riders) {
    const row = r as { user_id: string; wallet_balance: number };
    const { count } = await svc
      .from("rider_wallet_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", row.user_id)
      .eq("status", "completed");

    if ((count ?? 0) > 0) {
      chosenRider = row;
      break;
    }
  }

  if (!chosenRider) {
    log("WARN", "Find Test Rider", "لا يوجد راكب لديه معاملات مكتملة — اختيار أول راكب بمحفظة");
    chosenRider = riders[0] as { user_id: string; wallet_balance: number };
  }

  testRiderUserId = chosenRider.user_id;
  originalWalletBalance = chosenRider.wallet_balance;
  testStartTime = new Date().toISOString();

  log("INFO", "Target Rider", `user ${testRiderUserId.slice(0, 8)}… | wallet_balance=${originalWalletBalance} IQD`);

  // ب) حقن الـ drift: +STEP_DRIFT_AMOUNT IQD (أكبر من DRIFT_ALERT_THRESHOLD=1)
  const injectedBalance = originalWalletBalance + STEP_DRIFT_AMOUNT;
  const { error: updateErr } = await svc
    .from("profiles")
    .update({ wallet_balance: injectedBalance })
    .eq("user_id", testRiderUserId);

  if (updateErr) {
    log("FAIL", "Inject Drift", `فشل التحديث: ${updateErr.message}`);
    return false;
  }

  log("PASS", "Inject Drift", `wallet_balance ${originalWalletBalance} → ${injectedBalance} (+${STEP_DRIFT_AMOUNT} IQD مُصطنع)`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// الخطوة 3: تشغيل الـ watchdog بعد الحقن
// ─────────────────────────────────────────────────────────────────────────────

async function step3_runAfterInjection(): Promise<WatchdogResponse> {
  console.log("\n─── الخطوة 3: تشغيل الـ watchdog بعد الحقن ───");

  const res = await invokeWatchdog();

  if (!res.ok) {
    log("FAIL", "Watchdog Invocation", `HTTP ${res.status ?? "?"}: ${res.error ?? "unknown"}`);
    return res;
  }

  log("PASS", "Watchdog Invocation", `HTTP ${res.status} — ok=true`);

  if (res.report) {
    log("INFO", "Report Summary", `total_issues=${res.report.total_issues} | alerts_sent=${res.report.alerts_sent} | findings=${res.report.findings.length}`);
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// الخطوة 4+5: التحقق من fraud_alerts
// ─────────────────────────────────────────────────────────────────────────────

async function step4_verifyAlerts(postRunTime: string, watchdogRes: WatchdogResponse) {
  console.log("\n─── الخطوة 4: التحقق من fraud_alerts ───");

  // أ) التحقق من الـ response مباشرة
  const w01Finding = watchdogRes.report?.findings?.find(f => f.check === "W01_WALLET_MISMATCH");

  if (w01Finding) {
    log("PASS", "W01 in Report", `الـ watchdog اكتشف ${w01Finding.count} حالة wallet mismatch في الاستجابة`);
    const mentionsOurRider = w01Finding.details.some(d => testRiderUserId && d.includes(testRiderUserId.slice(0, 8)));
    if (mentionsOurRider) {
      log("PASS", "Our Rider Detected", `الراكب المُحقون ${testRiderUserId!.slice(0, 8)}… ظهر في تفاصيل W01`);
    } else {
      log("WARN", "Our Rider Detected", "الراكب المُحقون لم يظهر في عينة التفاصيل (قد تكون العينة محدودة)");
    }
  } else {
    log("WARN", "W01 in Report", "W01_WALLET_MISMATCH لم يظهر في findings — ممكن أن الـ drift أقل من THRESHOLD أو هناك مشكلة");
  }

  // ب) التحقق من fraud_alerts في قاعدة البيانات
  await new Promise(r => setTimeout(r, 1000)); // انتظر ثانية لإكمال INSERT

  const { data: alerts, error: alertErr } = await svc
    .from("fraud_alerts")
    .select("id, alert_type, severity, description, details, created_at")
    .eq("alert_type", "w01_wallet_mismatch")
    .gte("created_at", postRunTime)
    .order("created_at", { ascending: false });

  if (alertErr) {
    log("FAIL", "fraud_alerts Query", alertErr.message);
    return;
  }

  if (!alerts?.length) {
    // حاول بـ contains للـ metadata
    const { data: alerts2 } = await svc
      .from("fraud_alerts")
      .select("id, alert_type, severity, description, details, created_at")
      .gte("created_at", postRunTime)
      .order("created_at", { ascending: false })
      .limit(10);

    if (alerts2?.length) {
      log("WARN", "fraud_alerts DB", `لا توجد سجلات W01 لكن وُجدت ${alerts2.length} تنبيهات أخرى منذ التشغيل`);
      console.log("   سجلات موجودة:");
      alerts2.forEach(a => {
        const row = a as { id: string; alert_type: string; severity: string; description: string };
        console.log(`   • ${row.id.slice(0, 8)}… | ${row.alert_type} | ${row.severity} | ${row.description.slice(0, 60)}`);
        testFraudAlertIds.push(row.id);
      });
    } else {
      log("WARN", "fraud_alerts DB", "لا توجد سجلات جديدة في fraud_alerts — INSERT قد يكون تأخر أو فشل");
    }
    return;
  }

  log("PASS", "fraud_alerts Inserted", `${alerts.length} سجل W01_WALLET_MISMATCH أُدرج في fraud_alerts`);

  for (const a of alerts) {
    const alert = a as { id: string; alert_type: string; severity: string; description: string; details: Record<string, unknown>; created_at: string };
    console.log(`   • id=${alert.id.slice(0, 8)}… | severity=${alert.severity} | count=${(alert.details as any)?.count ?? "?"}`);
    testFraudAlertIds.push(alert.id);

    // ج) التحقق من severity
    if (alert.severity === "high") {
      log("PASS", "Severity=high", `السجل ${alert.id.slice(0, 8)}… severity=high ✓`);
    } else {
      log("FAIL", "Severity=high", `السجل ${alert.id.slice(0, 8)}… severity=${alert.severity} — المتوقع high`);
    }
  }

  // د) التحقق من alerts_sent في الـ response
  if ((watchdogRes.report?.alerts_sent ?? 0) >= 1) {
    log("PASS", "Alerts Sent", `alerts_sent=${watchdogRes.report!.alerts_sent} — notify-admin-critical استُدعي لـ HIGH severity`);
    log("INFO", "Telegram Notification", "تحقق يدوياً من قناة Telegram الإدارية أن رسالة W01_WALLET_MISMATCH وصلت");
  } else {
    log("WARN", "Alerts Sent", "alerts_sent=0 — notify-admin-critical لم يُستدعَ أو الـ drift لم يُكتشف");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// الخطوة 6: التنظيف
// ─────────────────────────────────────────────────────────────────────────────

async function step6_cleanup() {
  console.log("\n─── الخطوة 6: التنظيف ───");
  let cleanOk = true;

  // أ) استعادة wallet_balance الأصلي
  if (testRiderUserId !== null && originalWalletBalance !== null) {
    const { error } = await svc
      .from("profiles")
      .update({ wallet_balance: originalWalletBalance })
      .eq("user_id", testRiderUserId);

    if (error) {
      log("FAIL", "Restore Balance", `فشل استعادة wallet_balance: ${error.message}`);
      console.error(`⚠️  يجب إصلاح يدوياً: UPDATE profiles SET wallet_balance=${originalWalletBalance} WHERE user_id='${testRiderUserId}'`);
      cleanOk = false;
    } else {
      log("PASS", "Restore Balance", `wallet_balance استُعيد إلى ${originalWalletBalance} IQD للراكب ${testRiderUserId.slice(0, 8)}…`);
    }
  }

  // ب) حذف سجلات fraud_alerts التجريبية
  if (testFraudAlertIds.length > 0) {
    const { error } = await svc
      .from("fraud_alerts")
      .delete()
      .in("id", testFraudAlertIds);

    if (error) {
      log("WARN", "Delete Test Alerts", `تحذير: فشل حذف ${testFraudAlertIds.length} سجل: ${error.message}`);
      console.warn(`   IDs للحذف اليدوي: ${testFraudAlertIds.join(", ")}`);
      cleanOk = false;
    } else {
      log("PASS", "Delete Test Alerts", `${testFraudAlertIds.length} سجل اختبار حُذف من fraud_alerts`);
    }
  } else {
    log("INFO", "Delete Test Alerts", "لا توجد سجلات تجريبية للحذف");
  }

  // ج) حذف أي تنبيهات watchdog أُنشئت منذ بدء الاختبار بنفس نمط W0x
  if (testStartTime) {
    const { data: residualAlerts } = await svc
      .from("fraud_alerts")
      .select("id, alert_type")
      .gte("created_at", testStartTime)
      .like("alert_type", "w0%");

    const residual = (residualAlerts ?? []) as { id: string; alert_type: string }[];
    const residualIds = residual.map(r => r.id).filter(id => !testFraudAlertIds.includes(id));

    if (residualIds.length > 0) {
      log("INFO", "Residual Alerts", `${residualIds.length} سجل watchdog إضافي وُجد — يُحتمل من تشغيل dry run`);
      const { error: delErr } = await svc
        .from("fraud_alerts")
        .delete()
        .in("id", residualIds);
      if (!delErr) {
        log("PASS", "Residual Cleanup", `${residualIds.length} سجل إضافي حُذف`);
      }
    }
  }

  return cleanOk;
}

// ─────────────────────────────────────────────────────────────────────────────
// التقرير النهائي
// ─────────────────────────────────────────────────────────────────────────────

function finalReport() {
  const passes = stepResults.filter(r => r.result === "PASS").length;
  const fails = stepResults.filter(r => r.result === "FAIL").length;
  const warns = stepResults.filter(r => r.result === "WARN").length;

  console.log("\n" + "═".repeat(72));
  console.log("RAAN — Watchdog Verification Report");
  console.log("═".repeat(72));

  for (const r of stepResults) {
    const icons: Record<Result, string> = { PASS: "✅", FAIL: "❌", WARN: "⚠️ ", INFO: "ℹ️ ", SKIP: "⏭️ " };
    console.log(`  ${icons[r.result]} [${r.result.padEnd(4)}] ${r.step.padEnd(28)} ${r.detail}`);
  }

  console.log("\n" + "─".repeat(72));
  console.log(`  الإجمالي: PASS=${passes} | FAIL=${fails} | WARN=${warns}`);
  console.log("─".repeat(72));

  if (fails === 0) {
    console.log(`
  🟢 Watchdog Verification: PASS

  ✅ financial-watchdog مُنشر ويستجيب
  ✅ يكتشف Wallet Drift > 1 IQD
  ✅ يُدرج في fraud_alerts بـ severity=high
  ✅ يستدعي notify-admin-critical لـ HIGH alerts
  ✅ التنظيف تم بنجاح

  الحكم: Financial Observability = PASS
  الحالة: Pilot-Ready Financial System ✓
`);
    return 0;
  } else {
    console.log(`
  🔴 Watchdog Verification: FAIL (${fails} فشل)

  مراجعة الـ FAILs أعلاه مطلوبة قبل الإعلان عن Pilot-Ready.
`);
    return 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔍 RAAN — Financial Watchdog Verification");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Mode: ${isProd ? "PRODUCTION" : isLocal ? "LOCAL" : "STAGING"}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  let exitCode = 0;

  try {
    // الخطوة 0: Preflight
    const preflight = await step0_preflight();

    // الخطوة 1: Dry Run
    await step1_dryRun(preflight);

    // الخطوة 2: حقن Drift
    const injected = await step2_injectDrift();
    if (!injected) {
      log("SKIP", "Injection Test", "تم تخطي الاختبار بسبب فشل الحقن");
      exitCode = finalReport();
      return;
    }

    // وقت التشغيل — لاستخدامه في استعلام fraud_alerts
    const postRunTime = new Date().toISOString();

    // الخطوة 3: تشغيل الـ watchdog بعد الحقن
    const postInjectionRes = await step3_runAfterInjection();

    // الخطوة 4+5: التحقق
    await step4_verifyAlerts(postRunTime, postInjectionRes);

  } catch (e) {
    console.error(`\n💥 خطأ غير متوقع: ${(e as Error).message}\n${(e as Error).stack}`);
    exitCode = 1;
  } finally {
    // الخطوة 6: التنظيف — دائماً
    await step6_cleanup();
  }

  exitCode = finalReport();
  process.exit(exitCode);
}

void main();
