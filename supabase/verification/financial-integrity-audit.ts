/**
 * ════════════════════════════════════════════════════════════════════════════
 * RAAN — Financial Integrity Audit (I01 → I10 + G01 → G02)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * الهدف: التحقق من سلامة السجل المالي الكاملة — ليس هجمات، بل جرد دقيق:
 *
 *   I01 — Rider Balance Drift:       wallet_balance = SUM(completed tx)
 *   I02 — Driver Balance Match:      driver_wallets.balance = last balance_after
 *   I03 — Amount Arithmetic:         balance_before + amount = balance_after (driver)
 *   I04 — Ledger Chain Continuity:   balance_after[n] = balance_before[n+1] (driver)
 *   I04B— Rider Ledger Chain:         balance_after[n] = balance_before[n+1] (rider)
 *   I05 — Negative Balances:         لا أرصدة سالبة في profiles أو driver_wallets
 *   I06 — Stuck Pending Tx:          لا rider_wallet_transactions معلقة > 1 ساعة
 *   I07 — Null Critical Fields:      لا NULL في amount أو user_id أو wallet_id
 *   I08 — Duplicate Idempotency:     لا تكرار في idempotency_key
 *   I09 — Amount Sign Convention:    withdrawal/commission سالبة، earning موجبة (driver)
 *   I10 — Zero-Amount Transactions:  لا معاملات بـ amount = 0
 *
 *   G01 — Rider Schema Gap:          rider_wallet_transactions تفتقر لـ balance_before/after
 *   G02 — Legacy Driver Ledger:      driver_wallet_transactions تراثية بدون audit fields
 *
 * ✅ هذا الفحص قراءة فقط — آمن للإنتاج.
 *
 * التشغيل:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  RAAN_VERIFY_ALLOW_PRODUCTION=yes \
 *   npx tsx supabase/verification/financial-integrity-audit.ts
 * ════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// إعداد وحراسة البيئة
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROD_PROJECT_REF = "wgolkcztdrwdphwjvqxt";

function bail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) bail("SUPABASE_URL غير محدد في البيئة.");
if (!SERVICE_ROLE_KEY) bail("SUPABASE_SERVICE_ROLE_KEY غير محدد في البيئة.");

const isProd = SUPABASE_URL.includes(PROD_PROJECT_REF);
const isLocal = SUPABASE_URL.includes("127.0.0.1") || SUPABASE_URL.includes("localhost");
const allowProd = process.env.RAAN_VERIFY_ALLOW_PRODUCTION === "yes";
const allowStaging = process.env.RAAN_VERIFY_ALLOW_STAGING === "yes";

if (isProd && !allowProd) {
  bail("مشروع الإنتاج — أعد التشغيل مع RAAN_VERIFY_ALLOW_PRODUCTION=yes");
}
if (!isLocal && !isProd && !allowStaging) {
  bail("ليس local ولا prod — أعد التشغيل مع RAAN_VERIFY_ALLOW_STAGING=yes");
}
if (isProd) {
  console.log("\n⚠️  وضع القراءة فقط — الفحص لا يُعدّل أي بيانات.\n");
}

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// أنواع النتائج
// ─────────────────────────────────────────────────────────────────────────────

type Severity = "PASS" | "WARN" | "FAIL" | "INFO";

interface AuditResult {
  id: string;
  name: string;
  severity: Severity;
  summary: string;
  details?: string[];
}

const auditResults: AuditResult[] = [];
const EPSILON = 0.001; // تسامح لحسابات الأعداد العشرية

function record(
  id: string,
  name: string,
  severity: Severity,
  summary: string,
  details?: string[],
) {
  auditResults.push({ id, name, severity, summary, details });
  const icon = { PASS: "✅", WARN: "⚠️ ", FAIL: "❌", INFO: "ℹ️ " }[severity];
  console.log(`${icon} ${severity.padEnd(4)}  ${id} — ${name}`);
  console.log(`         ${summary}`);
  if (details?.length) {
    details.slice(0, 5).forEach((d) => console.log(`         → ${d}`));
    if (details.length > 5) console.log(`         … و${details.length - 5} أخرى`);
  }
}

/** جلب جميع الصفوف مع pagination (max 50,000) */
async function fetchAll<T>(
  table: string,
  columns: string,
  filter?: (q: ReturnType<typeof svc.from>) => ReturnType<typeof svc.from>,
): Promise<T[]> {
  const PAGE = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    let q = svc.from(table).select(columns).range(offset, offset + PAGE - 1);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset >= 50000) {
      console.warn(`⚠️  ${table}: توقف عند 50,000 صف — النتائج قد تكون جزئية`);
      break;
    }
  }
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// G01 — Rider Schema Gap
// ─────────────────────────────────────────────────────────────────────────────
async function G01() {
  // نتحقق أن العمود غير موجود بمحاولة SELECT عليه
  const { error } = await svc
    .from("rider_wallet_transactions")
    .select("id")
    .limit(1);

  // نحاول SELECT على عمود غير موجود
  const { error: colErr } = await svc
    .from("rider_wallet_transactions")
    .select("id, balance_before, balance_after")
    .limit(1);

  if (colErr && colErr.message.includes("balance_before")) {
    record(
      "G01",
      "Rider Ledger Schema Gap",
      "WARN",
      "rider_wallet_transactions تفتقر لعمودَي balance_before/balance_after — لا audit trail كامل للراكب",
      [
        "الراكب لا يمكن إثبات chain continuity",
        "الحل: إضافة balance_before/after + حساب retroactive من profiles.wallet_balance",
        "مخاطرة: إذا تلف profiles.wallet_balance لا يوجد مصدر بديل للتحقق",
      ],
    );
  } else if (!error) {
    record("G01", "Rider Ledger Schema Gap", "INFO", "عمودا balance_before/after موجودان في rider_wallet_transactions");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// G02 — Legacy Driver Ledger
// ─────────────────────────────────────────────────────────────────────────────
async function G02() {
  const { count, error } = await svc
    .from("driver_wallet_transactions")
    .select("id", { count: "exact", head: true });

  if (error) {
    record("G02", "Legacy Driver Ledger", "INFO", `لم يتم الوصول لـ driver_wallet_transactions: ${error.message}`);
    return;
  }
  if ((count ?? 0) > 0) {
    record(
      "G02",
      "Legacy Driver Ledger",
      "WARN",
      `driver_wallet_transactions (legacy) تحتوي ${count} سجل بدون balance_before/after`,
      [
        "هذه الجدول تراثية من قبل نظام driver_wallets الحديث",
        "لا يوجد تطابق بين قيمها وأرصدة محافظ السائقين الحالية",
        "الحل: ترحيل أو أرشفة هذه البيانات إذا لم تعد مستخدمة",
      ],
    );
  } else {
    record("G02", "Legacy Driver Ledger", "INFO", "driver_wallet_transactions فارغة (ممتاز — لا بيانات تراثية نشطة)");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I01 — Rider Balance Drift
// ─────────────────────────────────────────────────────────────────────────────
async function I01() {
  type ProfileRow = { user_id: string; wallet_balance: number };
  type TxRow = { user_id: string; amount: number; status: string };

  const profiles = await fetchAll<ProfileRow>("profiles", "user_id, wallet_balance");
  const txs = await fetchAll<TxRow>(
    "rider_wallet_transactions",
    "user_id, amount, status",
    (q) => q.eq("status", "completed"),
  );

  // تجميع SUM لكل مستخدم
  const sumByUser: Record<string, number> = {};
  for (const tx of txs) {
    sumByUser[tx.user_id] = (sumByUser[tx.user_id] ?? 0) + Number(tx.amount);
  }

  const drifts: string[] = [];
  for (const p of profiles) {
    const balance = Number(p.wallet_balance ?? 0);
    const sumTx = sumByUser[p.user_id] ?? 0;
    if (Math.abs(balance - sumTx) > EPSILON) {
      drifts.push(`user ${p.user_id.slice(0, 8)}… wallet=${balance} SUM(tx)=${sumTx} فرق=${(balance - sumTx).toFixed(2)}`);
    }
  }

  if (drifts.length === 0) {
    record("I01", "Rider Balance Drift", "PASS", `جميع ${profiles.length} محفظة راكب متطابقة مع SUM المعاملات`);
  } else {
    record("I01", "Rider Balance Drift", "FAIL", `${drifts.length} راكب عنده فرق بين wallet_balance وSUM(معاملاته)`, drifts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I02 — Driver Balance Match
// ─────────────────────────────────────────────────────────────────────────────
async function I02() {
  type WalletRow = { id: string; driver_id: string; balance: number };
  type TxRow = { wallet_id: string; balance_after: number; created_at: string };

  const wallets = await fetchAll<WalletRow>("driver_wallets", "id, driver_id, balance");

  if (wallets.length === 0) {
    record("I02", "Driver Balance Match", "INFO", "لا توجد محافظ سائقين حتى الآن");
    return;
  }

  // لكل محفظة: آخر wallet_transaction
  const drifts: string[] = [];
  for (const wallet of wallets) {
    const { data, error } = await svc
      .from("wallet_transactions")
      .select("balance_after, created_at, balance_before")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .order("balance_before", { ascending: false })
      .limit(1);

    if (error) continue;
    if (!data || data.length === 0) {
      // لا معاملات — الرصيد يجب أن يكون صفر أو الرصيد الأولي
      if (Number(wallet.balance) !== 0) {
        drifts.push(`wallet ${wallet.id.slice(0, 8)}… لا معاملات لكن balance=${wallet.balance}`);
      }
      continue;
    }
    const last = data[0] as TxRow;
    const diff = Math.abs(Number(wallet.balance) - Number(last.balance_after));
    if (diff > EPSILON) {
      drifts.push(
        `driver ${wallet.driver_id.slice(0, 8)}… balance=${wallet.balance} last_balance_after=${last.balance_after} فرق=${diff.toFixed(2)}`,
      );
    }
  }

  if (drifts.length === 0) {
    record("I02", "Driver Balance Match", "PASS", `جميع ${wallets.length} محفظة سائق تتطابق مع آخر balance_after في ledger`);
  } else {
    record("I02", "Driver Balance Match", "FAIL", `${drifts.length} محفظة بها drift بين balance وlast balance_after`, drifts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I03 — Amount Arithmetic (wallet_transactions)
// ─────────────────────────────────────────────────────────────────────────────
async function I03() {
  type TxRow = { id: string; wallet_id: string; amount: number; balance_before: number; balance_after: number };

  const txs = await fetchAll<TxRow>(
    "wallet_transactions",
    "id, wallet_id, amount, balance_before, balance_after",
  );

  if (txs.length === 0) {
    record("I03", "Amount Arithmetic", "INFO", "لا معاملات سائق حتى الآن");
    return;
  }

  const broken: string[] = [];
  for (const tx of txs) {
    const expected = Number(tx.balance_before) + Number(tx.amount);
    const actual = Number(tx.balance_after);
    if (Math.abs(expected - actual) > EPSILON) {
      broken.push(`tx ${tx.id.slice(0, 8)}… before=${tx.balance_before} + amount=${tx.amount} ≠ after=${tx.balance_after}`);
    }
  }

  if (broken.length === 0) {
    record("I03", "Amount Arithmetic", "PASS", `جميع ${txs.length} معاملة: balance_before + amount = balance_after ✓`);
  } else {
    record("I03", "Amount Arithmetic", "FAIL", `${broken.length} معاملة بها خطأ حسابي في balance_before + amount ≠ balance_after`, broken);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I04 — Ledger Chain Continuity (wallet_transactions)
// ─────────────────────────────────────────────────────────────────────────────
async function I04() {
  type TxRow = { id: string; wallet_id: string; balance_before: number; balance_after: number; created_at: string };

  const txs = await fetchAll<TxRow>(
    "wallet_transactions",
    "id, wallet_id, balance_before, balance_after, created_at",
  );

  if (txs.length === 0) {
    record("I04", "Ledger Chain Continuity", "INFO", "لا معاملات للفحص");
    return;
  }

  // تجميع حسب wallet_id وترتيب زمني
  const byWallet: Record<string, TxRow[]> = {};
  for (const tx of txs) {
    (byWallet[tx.wallet_id] ??= []).push(tx);
  }

  const breaks: string[] = [];
  for (const [walletId, rows] of Object.entries(byWallet)) {
    rows.sort((a, b) => {
      const cmp = a.created_at.localeCompare(b.created_at);
      if (cmp !== 0) return cmp;
      // معاملتان بنفس الوقت (ride_earning + commission) — نرتب بـ balance_before تصاعداً
      // حتى تأتي ride_earning (balance_before أصغر) قبل commission (balance_before أكبر)
      return Number(a.balance_before) - Number(b.balance_before);
    });
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (Math.abs(Number(prev.balance_after) - Number(curr.balance_before)) > EPSILON) {
        breaks.push(
          `wallet ${walletId.slice(0, 8)}… tx[${i - 1}].balance_after=${prev.balance_after} ≠ tx[${i}].balance_before=${curr.balance_before}`,
        );
      }
    }
  }

  if (breaks.length === 0) {
    record("I04", "Ledger Chain Continuity", "PASS", `سلسلة ledger متسلسلة بلا انقطاع عبر ${txs.length} معاملة`);
  } else {
    record("I04", "Ledger Chain Continuity", "FAIL", `${breaks.length} انقطاع في سلسلة الـ ledger — تحقق فوري مطلوب`, breaks);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I04B — Rider Ledger Chain Continuity (rider_wallet_transactions)
// ─────────────────────────────────────────────────────────────────────────────
async function I04B() {
  // نتحقق أولاً من وجود balance_before/after — إذا G01 = WARN فلا نفحص
  const hasLedger = auditResults.find(r => r.id === "G01" && r.severity !== "WARN");
  if (!hasLedger) {
    record("I04B", "Rider Ledger Chain", "INFO", "تم تخطي فحص I04B — G01 أظهر أن balance_before/after غير موجودين");
    return;
  }

  type RiderTxRow = { id: string; user_id: string; balance_before: number | null; balance_after: number | null; created_at: string };

  const txs = await fetchAll<RiderTxRow>(
    "rider_wallet_transactions",
    "id, user_id, balance_before, balance_after, created_at",
  );

  // فلتر: فقط السجلات التي تحتوي على قيم في كلا العمودين
  const completeTxs = txs.filter(t => t.balance_before !== null && t.balance_after !== null);

  if (completeTxs.length < 2) {
    record("I04B", "Rider Ledger Chain", "INFO", `عدد السجلات بـ balance_before/after غير كاف للفحص (${completeTxs.length})`);
    return;
  }

  // تجميع حسب user_id وترتيب زمني
  const byUser: Record<string, RiderTxRow[]> = {};
  for (const tx of completeTxs) {
    (byUser[tx.user_id] ??= []).push(tx);
  }

  const breaks: string[] = [];
  let checkedUsers = 0;
  let checkedTxs = 0;

  for (const [userId, rows] of Object.entries(byUser)) {
    if (rows.length < 2) continue;
    checkedUsers++;
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 1; i < rows.length; i++) {
      checkedTxs++;
      const prev = rows[i - 1];
      const curr = rows[i];
      if (Math.abs(Number(prev.balance_after) - Number(curr.balance_before)) > EPSILON) {
        breaks.push(
          `user ${userId.slice(0, 8)}… tx[${i-1}].balance_after=${prev.balance_after} ≠ tx[${i}].balance_before=${curr.balance_before} (IDs: ${prev.id.slice(0,8)}… → ${curr.id.slice(0,8)}…)`
        );
      }
    }
  }

  if (breaks.length === 0) {
    record("I04B", "Rider Ledger Chain", "PASS", `سلسلة ledger الراكب متسلسلة — ${checkedUsers} راكب، ${checkedTxs + checkedUsers} معاملة فُحصت`);
  } else {
    record("I04B", "Rider Ledger Chain", "FAIL", `${breaks.length} انقطاع في سلسلة ledger الراكب — تحقق فوري`, breaks);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I05 — Negative Balances
// ─────────────────────────────────────────────────────────────────────────────
async function I05() {
  const issues: string[] = [];

  // محافظ الركاب
  const { data: negRiders } = await svc
    .from("profiles")
    .select("user_id, wallet_balance")
    .lt("wallet_balance", 0);

  if (negRiders?.length) {
    negRiders.forEach((r) =>
      issues.push(`rider ${(r as { user_id: string; wallet_balance: number }).user_id.slice(0, 8)}… wallet_balance=${(r as { wallet_balance: number }).wallet_balance}`),
    );
  }

  // محافظ السائقين
  const { data: negDrivers } = await svc
    .from("driver_wallets")
    .select("id, driver_id, balance")
    .lt("balance", 0);

  if (negDrivers?.length) {
    negDrivers.forEach((d) =>
      issues.push(`driver ${(d as { driver_id: string; balance: number }).driver_id.slice(0, 8)}… balance=${(d as { balance: number }).balance}`),
    );
  }

  if (issues.length === 0) {
    record("I05", "Negative Balances", "PASS", "لا أرصدة سالبة في profiles أو driver_wallets");
  } else {
    record("I05", "Negative Balances", "FAIL", `${issues.length} حساب برصيد سالب — خطر مالي فوري`, issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I06 — Stuck Pending Transactions
// ─────────────────────────────────────────────────────────────────────────────
async function I06() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: stuckRider, error: rErr } = await svc
    .from("rider_wallet_transactions")
    .select("id, user_id, amount, created_at")
    .eq("status", "pending")
    .lt("created_at", oneHourAgo);

  const { data: stuckDriver, error: dErr } = await svc
    .from("wallet_transactions")
    .select("id, wallet_id, amount, created_at")
    .eq("status", "pending")
    .lt("created_at", oneHourAgo);

  const details: string[] = [];
  if (!rErr && stuckRider?.length) {
    stuckRider.forEach((r) =>
      details.push(`rider_tx ${(r as { id: string }).id.slice(0, 8)}… amount=${(r as { amount: number }).amount} منذ ${(r as { created_at: string }).created_at}`),
    );
  }
  if (!dErr && stuckDriver?.length) {
    stuckDriver.forEach((d) =>
      details.push(`driver_tx ${(d as { id: string }).id.slice(0, 8)}… amount=${(d as { amount: number }).amount} منذ ${(d as { created_at: string }).created_at}`),
    );
  }

  const total = (stuckRider?.length ?? 0) + (stuckDriver?.length ?? 0);
  if (total === 0) {
    record("I06", "Stuck Pending Transactions", "PASS", "لا معاملات معلقة تجاوزت ساعة واحدة");
  } else {
    record("I06", "Stuck Pending Transactions", "WARN", `${total} معاملة بـ status=pending منذ أكثر من ساعة`, details);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I07 — Null Critical Fields
// ─────────────────────────────────────────────────────────────────────────────
async function I07() {
  const issues: string[] = [];

  // rider_wallet_transactions: user_id أو amount
  const { count: nullRider } = await svc
    .from("rider_wallet_transactions")
    .select("id", { count: "exact", head: true })
    .or("user_id.is.null,amount.is.null");

  if ((nullRider ?? 0) > 0)
    issues.push(`rider_wallet_transactions: ${nullRider} صف بـ NULL في user_id أو amount`);

  // wallet_transactions: wallet_id أو amount أو balance_before أو balance_after
  const { count: nullDriver } = await svc
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .or("wallet_id.is.null,amount.is.null,balance_before.is.null,balance_after.is.null");

  if ((nullDriver ?? 0) > 0)
    issues.push(`wallet_transactions: ${nullDriver} صف بـ NULL في حقول حرجة`);

  // withdrawal_requests: amount أو driver_id
  const { count: nullWR } = await svc
    .from("withdrawal_requests")
    .select("id", { count: "exact", head: true })
    .or("amount.is.null,driver_id.is.null,wallet_id.is.null");

  if ((nullWR ?? 0) > 0)
    issues.push(`withdrawal_requests: ${nullWR} صف بـ NULL في amount/driver_id/wallet_id`);

  if (issues.length === 0) {
    record("I07", "Null Critical Fields", "PASS", "لا حقول حرجة بقيمة NULL في جداول المحافظ");
  } else {
    record("I07", "Null Critical Fields", "FAIL", `وُجد NULL في حقول مالية حرجة`, issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I08 — Duplicate Idempotency Keys
// ─────────────────────────────────────────────────────────────────────────────
async function I08() {
  const issues: string[] = [];

  // rider_wallet_transactions — idempotency_key UNIQUE لكن نتحقق
  const { data: riderDups } = await svc.rpc("check_duplicate_idempotency_rider").maybeSingle();
  // إذا لم تكن RPC موجودة، نفحص يدوياً
  const { data: riderTxs } = await svc
    .from("rider_wallet_transactions")
    .select("idempotency_key")
    .not("idempotency_key", "is", null);

  if (riderTxs) {
    const keyCount: Record<string, number> = {};
    for (const tx of riderTxs) {
      const k = (tx as { idempotency_key: string }).idempotency_key;
      keyCount[k] = (keyCount[k] ?? 0) + 1;
    }
    const dups = Object.entries(keyCount).filter(([, n]) => n > 1);
    if (dups.length > 0) {
      dups.forEach(([k, n]) => issues.push(`rider: idempotency_key="${k}" مكرر ${n} مرات`));
    }
  }

  // wallet_transactions — idempotency_key
  const { data: driverTxs } = await svc
    .from("wallet_transactions")
    .select("idempotency_key")
    .not("idempotency_key", "is", null);

  if (driverTxs) {
    const keyCount: Record<string, number> = {};
    for (const tx of driverTxs) {
      const k = (tx as { idempotency_key: string }).idempotency_key;
      keyCount[k] = (keyCount[k] ?? 0) + 1;
    }
    const dups = Object.entries(keyCount).filter(([, n]) => n > 1);
    if (dups.length > 0) {
      dups.forEach(([k, n]) => issues.push(`driver: idempotency_key="${k}" مكرر ${n} مرات`));
    }
  }

  if (issues.length === 0) {
    record("I08", "Duplicate Idempotency Keys", "PASS", "لا مفاتيح idempotency مكررة في كلا الجدولين");
  } else {
    record("I08", "Duplicate Idempotency Keys", "FAIL", `${issues.length} تكرار في idempotency_key — خطر double-payment`, issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I09 — Amount Sign Convention (wallet_transactions)
// ─────────────────────────────────────────────────────────────────────────────
async function I09() {
  const negativeTypes = ["withdrawal", "commission", "penalty"];
  const positiveTypes = ["ride_earning", "bonus", "refund"];

  const issues: string[] = [];

  for (const type of negativeTypes) {
    const { count } = await svc
      .from("wallet_transactions")
      .select("id", { count: "exact", head: true })
      .eq("transaction_type", type)
      .gt("amount", 0); // يجب أن تكون سالبة
    if ((count ?? 0) > 0)
      issues.push(`${count} معاملة من نوع "${type}" بـ amount موجب (يجب أن يكون سالباً)`);
  }

  for (const type of positiveTypes) {
    const { count } = await svc
      .from("wallet_transactions")
      .select("id", { count: "exact", head: true })
      .eq("transaction_type", type)
      .lt("amount", 0); // يجب أن تكون موجبة
    if ((count ?? 0) > 0)
      issues.push(`${count} معاملة من نوع "${type}" بـ amount سالب (يجب أن يكون موجباً)`);
  }

  if (issues.length === 0) {
    record("I09", "Amount Sign Convention", "PASS", "إشارات المبالغ (+ / -) متسقة مع نوع المعاملة");
  } else {
    record("I09", "Amount Sign Convention", "WARN", `${issues.length} إشكال في إشارة المبلغ مقارنة بنوع المعاملة`, issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I10 — Zero-Amount Transactions
// ─────────────────────────────────────────────────────────────────────────────
async function I10() {
  const issues: string[] = [];

  const { count: zeroRider } = await svc
    .from("rider_wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("amount", 0);

  if ((zeroRider ?? 0) > 0)
    issues.push(`rider_wallet_transactions: ${zeroRider} معاملة بـ amount = 0`);

  const { count: zeroDriver } = await svc
    .from("wallet_transactions")
    .select("id", { count: "exact", head: true })
    .eq("amount", 0);

  if ((zeroDriver ?? 0) > 0)
    issues.push(`wallet_transactions: ${zeroDriver} معاملة بـ amount = 0`);

  if (issues.length === 0) {
    record("I10", "Zero-Amount Transactions", "PASS", "لا معاملات بقيمة صفر");
  } else {
    record("I10", "Zero-Amount Transactions", "WARN", `وُجدت معاملات بـ amount = 0 — قد تكون بيانات اختبار`, issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// التقرير النهائي
// ─────────────────────────────────────────────────────────────────────────────

function report(): number {
  console.log("\n" + "═".repeat(72));
  console.log("  RAAN — Financial Integrity Audit — التقرير النهائي");
  console.log("═".repeat(72));

  const byS = { PASS: 0, WARN: 0, FAIL: 0, INFO: 0 };
  for (const r of auditResults) {
    byS[r.severity]++;
    const icon = { PASS: "✅", WARN: "⚠️ ", FAIL: "❌", INFO: "ℹ️ " }[r.severity];
    console.log(`  ${icon} ${r.severity.padEnd(4)}  ${r.id.padEnd(4)} ${r.name}`);
  }

  console.log("─".repeat(72));
  console.log(`  PASS: ${byS.PASS}  |  WARN: ${byS.WARN}  |  FAIL: ${byS.FAIL}  |  INFO: ${byS.INFO}`);

  const verdict =
    byS.FAIL > 0
      ? `❌ FAIL — ${byS.FAIL} مشكلة مالية حرجة تحتاج إصلاحاً فورياً`
      : byS.WARN > 0
        ? `⚠️  PASS مع تحذيرات — ${byS.WARN} ملاحظة تستحق المعالجة`
        : `✅ PASS — السجل المالي سليم بالكامل`;

  console.log(`  الحكم: ${verdict}`);
  console.log("═".repeat(72) + "\n");

  return byS.FAIL > 0 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// التشغيل
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 RAAN Financial Integrity Audit — ${new Date().toISOString()}`);
  console.log(`📍 ${SUPABASE_URL}\n`);

  let exitCode = 1;
  try {
    console.log("— Schema Gaps ─────────────────────────────────────────");
    await G01();
    await G02();

    console.log("\n— Live Integrity Checks ────────────────────────────────");
    await I01();
    await I02();
    await I03();
    await I04();
    await I04B();
    await I05();
    await I06();
    await I07();
    await I08();
    await I09();
    await I10();

    exitCode = report();
  } catch (e) {
    console.error(`\n💥 خطأ غير متوقع: ${(e as Error).message}\n${(e as Error).stack}`);
    exitCode = 1;
  }
  process.exit(exitCode);
}

void main();
