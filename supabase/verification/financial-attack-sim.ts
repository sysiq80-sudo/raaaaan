/**
 * ════════════════════════════════════════════════════════════════════════════
 * RAAN — Financial Attack Simulation (A01 → A08)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * الهدف: محاكاة هجمات مالية حقيقية على طبقة Supabase:
 *   A01 — Double-spend كارت: 10 طلبات متزامنة على نفس الكارت → واحد فقط ينجح
 *   A02 — Double-withdrawal: أدمنان يكملان نفس السحب معاً → واحد فقط ينجح
 *   A03 — Concurrent rider topup: راكب يرسل 10 طلبات كارت متزامنة → واحد فقط
 *   A04 — Balance Integrity (rider): SUM(transactions) = wallet_balance
 *   A05 — Balance Integrity (driver): SUM(transactions) = driver_wallet.balance
 *   A06 — IDOR: راكب يكمل سحب سائق آخر → Unauthorized
 *   A07 — Status Gate: أدمن يكمل سحب مكتمل مسبقاً → يُرفض
 *   A08 — Negative Balance: سحب أكثر من الرصيد → يُرفض بـ "رصيد غير كافٍ"
 *
 * ⚠️  شغّل على staging أو بيئة محلية فقط (ليس production).
 *     يُنشئ بيانات اختبار حقيقية ويُشغّل طلبات متزامنة — قد يسبب تلوثاً.
 *
 * التشغيل:
 *   SUPABASE_URL=https://<staging>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_ANON_KEY=... \
 *   RAAN_VERIFY_ALLOW_STAGING=yes \
 *   npx tsx supabase/verification/financial-attack-sim.ts
 *
 * (للإنتاج — بتحذير صريح):
 *   RAAN_VERIFY_ALLOW_PRODUCTION=yes
 * ════════════════════════════════════════════════════════════════════════════
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// إعدادات وحراسة البيئة
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const PROD_PROJECT_REF = "wgolkcztdrwdphwjvqxt";

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("SUPABASE_URL غير محدد في البيئة.");
if (!SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY غير محدد في البيئة.");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY غير محدد في البيئة.");

const allowProduction = process.env.RAAN_VERIFY_ALLOW_PRODUCTION === "yes";
const isLocal =
  SUPABASE_URL.includes("127.0.0.1") ||
  SUPABASE_URL.includes("localhost") ||
  SUPABASE_URL.includes("kong:8000");
const isProd = SUPABASE_URL.includes(PROD_PROJECT_REF);
const stagingAck = process.env.RAAN_VERIFY_ALLOW_STAGING === "yes";

if (isProd && !allowProduction) {
  fail(
    `رُفض التشغيل: SUPABASE_URL يشير إلى مشروع الإنتاج (${PROD_PROJECT_REF}).\n` +
      `هذا السكربت يرسل 10 طلبات متزامنة — قد يُلوّث بيانات حقيقية.\n` +
      `للتشغيل على staging: RAAN_VERIFY_ALLOW_STAGING=yes\n` +
      `للتشغيل على الإنتاج (خطر): RAAN_VERIFY_ALLOW_PRODUCTION=yes`,
  );
}
if (isProd && allowProduction) {
  console.warn(
    "\n⚠️  تحذير عالي: تشغيل على الإنتاج — بيانات الاختبار ستُنشأ وتُحذف تلقائياً." +
      "\n   دوّر service_role key بعد الانتهاء من: Dashboard → Settings → API.\n",
  );
}
if (!isLocal && !isProd && !stagingAck) {
  fail(
    "SUPABASE_URL ليس بيئة local ولا prod. إن كنت على staging أعد التشغيل مع RAAN_VERIFY_ALLOW_STAGING=yes.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// أدوات مساعدة
// ─────────────────────────────────────────────────────────────────────────────

const RUN_ID = Math.random().toString(36).slice(2, 8).toUpperCase();
const TS = Date.now();

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}
interface Result {
  id: string;
  name: string;
  expectation: string;
  pass: boolean;
  detail: string;
}

const results: Result[] = [];

function record(id: string, name: string, expectation: string, pass: boolean, detail: string) {
  results.push({ id, name, expectation, pass, detail });
  const tag = pass ? "✅ PASS" : "❌ FAIL";
  console.log(`${tag}  ${id} — ${name}`);
  console.log(`        المتوقع: ${expectation}`);
  console.log(`        الفعلي:  ${detail}`);
}

/** تشغيل n نسخة متزامنة من fn ثم جمع النتائج. */
async function concurrent<T>(n: number, fn: () => Promise<T>): Promise<T[]> {
  return Promise.all(Array.from({ length: n }, fn));
}

const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createUser(label: string): Promise<TestUser> {
  const email = `atk_${label}_${RUN_ID}_${TS}@raan-attack.local`;
  const password = `Atk!${RUN_ID}${label}Z7`;

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`فشل إنشاء مستخدم (${label}): ${createErr?.message}`);
  }
  const id = created.user.id;
  createdUserIds.push(id);

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`فشل تسجيل دخول (${label}): ${signInErr.message}`);

  return { id, email, client };
}

const createdUserIds: string[] = [];
const createdVoucherIds: string[] = [];
const createdRequestIds: string[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// التهيئة
// ─────────────────────────────────────────────────────────────────────────────

interface Ctx {
  rider: TestUser;
  rider2: TestUser;
  driver: TestUser;
  admin1: TestUser;
  admin2: TestUser;
  driverId: string;
  walletId: string;
  sharedVoucherCode: string;
  sharedRequestId: string;
  extraRequestId: string;
}

async function setup(): Promise<Ctx> {
  console.log(`\n🔧 التهيئة (RUN_ID=${RUN_ID}) — ${SUPABASE_URL}\n`);

  const [rider, rider2, driver, admin1, admin2] = await Promise.all([
    createUser("rider"),
    createUser("rider2"),
    createUser("driver"),
    createUser("adm1"),
    createUser("adm2"),
  ]);

  // منح دور admin للاثنين
  const { error: roleErr } = await svc
    .from("user_roles")
    .insert([
      { user_id: admin1.id, role: "admin" },
      { user_id: admin2.id, role: "admin" },
    ]);
  if (roleErr) throw new Error(`فشل منح دور admin: ${roleErr.message}`);

  // profiles للراكب
  await svc.from("profiles").upsert(
    { user_id: rider.id, full_name: "Atk Rider", phone: `+9647${RUN_ID}0` },
    { onConflict: "user_id" },
  );
  await svc.from("profiles").upsert(
    { user_id: rider2.id, full_name: "Atk Rider2", phone: `+9647${RUN_ID}9` },
    { onConflict: "user_id" },
  );

  // سجل سائق + محفظة بـ 100,000 رصيد
  const { data: driverRow, error: drvErr } = await svc
    .from("drivers")
    .insert({
      user_id: driver.id,
      full_name: "Atk Driver",
      phone: `+9647${RUN_ID}1`,
      status: "approved",
    })
    .select("id")
    .single();
  if (drvErr || !driverRow) throw new Error(`فشل إنشاء السائق: ${drvErr?.message}`);
  const driverId = driverRow.id as string;

  const { data: walletRow, error: walErr } = await svc
    .from("driver_wallets")
    .insert({ driver_id: driverId, balance: 100000 })
    .select("id")
    .single();
  if (walErr || !walletRow) throw new Error(`فشل إنشاء المحفظة: ${walErr?.message}`);
  const walletId = walletRow.id as string;

  // طلب سحب مشترك (للاختبار A02: أدمنان يكملانه معاً)
  const { data: req1, error: req1Err } = await svc
    .from("withdrawal_requests")
    .insert({
      driver_id: driverId,
      wallet_id: walletId,
      amount: 5000,
      withdrawal_method: "manual",
      account_details: { note: "attack-a02" },
      account_holder_name: "Atk Driver",
      status: "pending",
    })
    .select("id")
    .single();
  if (req1Err || !req1) throw new Error(`فشل إنشاء طلب سحب A02: ${req1Err?.message}`);
  createdRequestIds.push(req1.id as string);
  const sharedRequestId = req1.id as string;

  // طلب سحب للاختبار A07 (إكمال مكتمل)
  const { data: req2, error: req2Err } = await svc
    .from("withdrawal_requests")
    .insert({
      driver_id: driverId,
      wallet_id: walletId,
      amount: 1000,
      withdrawal_method: "manual",
      account_details: { note: "attack-a07" },
      account_holder_name: "Atk Driver",
      status: "completed", // مكتمل مسبقاً
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (req2Err || !req2) throw new Error(`فشل إنشاء طلب A07: ${req2Err?.message}`);
  createdRequestIds.push(req2.id as string);
  const extraRequestId = req2.id as string;

  // كارت مشترك للهجمات A01/A03 — rider فقط
  const sharedVoucherCode = `RR-ATK${RUN_ID}-SH`;
  const { data: vData, error: vErr } = await svc
    .from("voucher_codes")
    .insert([{ code: sharedVoucherCode, amount: 2000, status: "active", audience: "rider" }])
    .select("id");
  if (vErr || !vData) throw new Error(`فشل إنشاء كارت الهجوم: ${vErr?.message}`);
  createdVoucherIds.push(...vData.map((v) => v.id as string));

  return {
    rider,
    rider2,
    driver,
    admin1,
    admin2,
    driverId,
    walletId,
    sharedVoucherCode,
    sharedRequestId,
    extraRequestId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// الاختبارات A01 → A08
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A01 — Double-Spend: 10 طلبات متزامنة على نفس الكارت من نفس الراكب.
 * المتوقع: واحد فقط ينجح (success:true)، الباقون "مستخدم مسبقاً".
 */
async function A01(ctx: Ctx) {
  console.log("\n  ⏱  A01 — تشغيل 10 طلبات متزامنة...");
  const responses = await concurrent(10, () =>
    ctx.rider.client.rpc("redeem_voucher", {
      p_code: ctx.sharedVoucherCode,
      p_user_id: ctx.rider.id,
    }),
  );

  const successes = responses.filter((r) => {
    const d = r.data as { success?: boolean } | null;
    return !r.error && d?.success === true;
  });
  const failures = responses.filter((r) => {
    const d = r.data as { success?: boolean } | null;
    return r.error || d?.success === false;
  });

  const pass = successes.length === 1 && failures.length === 9;
  record(
    "A01",
    "Double-Spend: 10 طلبات متزامنة على كارت واحد",
    "1 ينجح، 9 يُرفضون",
    pass,
    `نجح: ${successes.length} | فشل: ${failures.length}`,
  );
}

/**
 * A02 — Double-Withdrawal: أدمنان يكملان نفس طلب السحب في آنٍ واحد.
 * المتوقع: واحد ينجح، الثاني "Request already completed".
 */
async function A02(ctx: Ctx) {
  console.log("\n  ⏱  A02 — أدمنان يكملان نفس السحب...");
  const [r1, r2] = await Promise.all([
    ctx.admin1.client.rpc("admin_complete_withdrawal", {
      p_request_id: ctx.sharedRequestId,
      p_tx_reference: `atk1_${RUN_ID}`,
    }),
    ctx.admin2.client.rpc("admin_complete_withdrawal", {
      p_request_id: ctx.sharedRequestId,
      p_tx_reference: `atk2_${RUN_ID}`,
    }),
  ]);

  const d1 = r1.data as { success?: boolean; error?: string } | null;
  const d2 = r2.data as { success?: boolean; error?: string } | null;
  const results2 = [d1, d2];
  const successes = results2.filter((d) => d?.success === true).length;
  const failures = results2.filter((d) => d?.success === false).length;

  const pass = successes === 1 && failures === 1;
  record(
    "A02",
    "Double-Withdrawal: أدمنان يكملان نفس السحب",
    "1 ينجح، 1 يُرفض",
    pass,
    `admin1: ${JSON.stringify(d1)} | admin2: ${JSON.stringify(d2)}`,
  );
}

/**
 * A03 — Concurrent Topup: راكب يُرسل 10 طلبات متزامنة بكارت جديد.
 * (نفس المنطق A01 لكن بكارت منفصل — يتحقق أن FOR UPDATE يعمل بدون deadlock.)
 */
async function A03(ctx: Ctx) {
  // إنشاء كارت جديد خاص بـ A03
  const code = `RR-ATK${RUN_ID}-C3`;
  const { data: vData, error: vErr } = await svc
    .from("voucher_codes")
    .insert([{ code, amount: 1500, status: "active", audience: "rider" }])
    .select("id");
  if (vErr || !vData) {
    record("A03", "Concurrent Topup: 10 طلبات متزامنة (كارت جديد)", "1 ينجح، 9 يُرفضون", false, `فشل إنشاء الكارت: ${vErr?.message}`);
    return;
  }
  createdVoucherIds.push(...vData.map((v) => v.id as string));

  console.log("\n  ⏱  A03 — تشغيل 10 طلبات متزامنة (كارت جديد)...");
  const responses = await concurrent(10, () =>
    ctx.rider.client.rpc("redeem_voucher", {
      p_code: code,
      p_user_id: ctx.rider.id,
    }),
  );

  const successes = responses.filter((r) => {
    const d = r.data as { success?: boolean } | null;
    return !r.error && d?.success === true;
  }).length;

  const pass = successes === 1;
  record(
    "A03",
    "Concurrent Topup: 10 طلبات متزامنة (كارت جديد)",
    "1 ينجح، 9 يُرفضون",
    pass,
    `نجح: ${successes} / 10`,
  );
}

/**
 * A04 — Balance Integrity (Rider): SUM(wallet_transactions) = profiles.wallet_balance
 * يُنفَّذ بعد A01/A03 — يتحقق لا يوجد drift.
 */
async function A04(ctx: Ctx) {
  const { data: profile } = await svc
    .from("profiles")
    .select("wallet_balance")
    .eq("user_id", ctx.rider.id)
    .single();

  const { data: txRows } = await svc
    .from("rider_wallet_transactions")
    .select("amount")
    .eq("user_id", ctx.rider.id)
    .eq("status", "completed");

  const walletBalance = (profile as { wallet_balance: number } | null)?.wallet_balance ?? 0;
  const sumTx = (txRows ?? []).reduce((acc, r) => acc + Number((r as { amount: number }).amount), 0);

  const pass = walletBalance === sumTx;
  record(
    "A04",
    "Balance Integrity — Rider: SUM(transactions) = wallet_balance",
    "تطابق تام (صفر فرق)",
    pass,
    `wallet_balance=${walletBalance} | SUM(tx)=${sumTx} | فرق=${walletBalance - sumTx}`,
  );
}

/**
 * A05 — Balance Integrity (Driver): SUM(wallet_transactions) + balance_after = balance
 * يتحقق أن FOR UPDATE في admin_complete_withdrawal لم يسبب drift.
 */
async function A05(ctx: Ctx) {
  const { data: wallet } = await svc
    .from("driver_wallets")
    .select("balance")
    .eq("id", ctx.walletId)
    .single();

  const { data: txRows } = await svc
    .from("wallet_transactions")
    .select("amount, balance_after")
    .eq("wallet_id", ctx.walletId)
    .order("created_at", { ascending: false })
    .limit(1);

  const currentBalance = (wallet as { balance: number } | null)?.balance ?? 0;
  const lastBalanceAfter =
    txRows && txRows.length > 0
      ? Number((txRows[0] as { balance_after: number }).balance_after)
      : null;

  // إذا لم تكن هناك معاملات، الرصيد الأولي 100,000 صحيح
  const pass =
    lastBalanceAfter === null ? currentBalance === 100000 : currentBalance === lastBalanceAfter;
  record(
    "A05",
    "Balance Integrity — Driver: balance = last balance_after في ledger",
    "تطابق تام",
    pass,
    `balance=${currentBalance} | last_balance_after=${lastBalanceAfter ?? "لا توجد معاملات"}`,
  );
}

/**
 * A06 — IDOR: راكب يحاول إكمال سحب سائق آخر.
 * admin_complete_withdrawal محجوب بـ is_admin_or_moderator() — لكن نتحقق عملياً.
 */
async function A06(ctx: Ctx) {
  // نُنشئ طلب سحب جديد
  const { data: req } = await svc
    .from("withdrawal_requests")
    .insert({
      driver_id: ctx.driverId,
      wallet_id: ctx.walletId,
      amount: 500,
      withdrawal_method: "manual",
      account_details: { note: "attack-a06" },
      account_holder_name: "Atk Driver",
      status: "pending",
    })
    .select("id")
    .single();
  if (req?.id) createdRequestIds.push(req.id as string);

  const { data, error } = await ctx.rider.client.rpc("admin_complete_withdrawal", {
    p_request_id: req?.id,
    p_tx_reference: `atk_idor_${RUN_ID}`,
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass = !!error || res?.success === false;
  record(
    "A06",
    "IDOR: راكب يكمل سحب سائق آخر",
    "يُرفض (Unauthorized)",
    pass,
    error ? error.message : JSON.stringify(res),
  );
}

/**
 * A07 — Status Gate: أدمن يُعيد إكمال سحب مكتمل مسبقاً.
 * يجب أن يُرفض بـ "Request already completed".
 */
async function A07(ctx: Ctx) {
  const { data, error } = await ctx.admin1.client.rpc("admin_complete_withdrawal", {
    p_request_id: ctx.extraRequestId,
    p_tx_reference: `atk_replay_${RUN_ID}`,
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass =
    !error &&
    res?.success === false &&
    /already|completed|مكتمل/i.test(res?.error ?? "");
  record(
    "A07",
    "Status Gate: إعادة إكمال سحب مكتمل",
    "يُرفض (already completed)",
    pass,
    error ? error.message : JSON.stringify(res),
  );
}

/**
 * A08 — Negative Balance: طلب سحب يتجاوز رصيد المحفظة.
 * المتوقع: success:false — "رصيد غير كافٍ".
 */
async function A08(ctx: Ctx) {
  // طلب سحب بمبلغ أكبر من الرصيد المتبقي (نبدأ بـ 200,000 > 100,000)
  const { data: req } = await svc
    .from("withdrawal_requests")
    .insert({
      driver_id: ctx.driverId,
      wallet_id: ctx.walletId,
      amount: 200000,
      withdrawal_method: "manual",
      account_details: { note: "attack-a08" },
      account_holder_name: "Atk Driver",
      status: "pending",
    })
    .select("id")
    .single();
  if (req?.id) createdRequestIds.push(req.id as string);

  const { data, error } = await ctx.admin1.client.rpc("admin_complete_withdrawal", {
    p_request_id: req?.id,
    p_tx_reference: `atk_negbal_${RUN_ID}`,
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass =
    !error &&
    res?.success === false &&
    /غير كافٍ|insufficient|not enough/i.test(res?.error ?? "");
  record(
    "A08",
    "Negative Balance: سحب أكثر من الرصيد",
    "يُرفض (رصيد غير كافٍ)",
    pass,
    error ? error.message : JSON.stringify(res),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// التنظيف
// ─────────────────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("\n🧹 تنظيف بيانات الاختبار...");
  try {
    if (createdVoucherIds.length) {
      await svc.from("voucher_codes").delete().in("id", createdVoucherIds);
    }
    // احتياطي: حذف بالـ run_id
    await svc.from("voucher_codes").delete().like("code", `%ATK${RUN_ID}%`);

    if (createdRequestIds.length) {
      // حذف طلبات السحب (لا CASCADE عليها عادةً — يجب حذفها يدوياً)
      await svc.from("withdrawal_requests").delete().in("id", createdRequestIds);
    }

    for (const uid of createdUserIds) {
      await svc.auth.admin.deleteUser(uid).catch(() => undefined);
    }
    console.log("✓ تم التنظيف.");
  } catch (e) {
    console.warn(`⚠️ تحذير أثناء التنظيف: ${(e as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// التقرير النهائي
// ─────────────────────────────────────────────────────────────────────────────

function report(): number {
  console.log("\n" + "═".repeat(72));
  console.log("  RAAN — Financial Attack Simulation — التقرير النهائي");
  console.log("═".repeat(72));
  for (const r of results) {
    console.log(`  ${r.pass ? "✅ PASS" : "❌ FAIL"}  ${r.id.padEnd(4)} ${r.name}`);
  }
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allPass = passed === total;
  console.log("─".repeat(72));
  console.log(`  النتيجة: ${passed}/${total}`);
  console.log(`  الحكم النهائي: ${allPass ? "✅ PASS — النظام المالي يقاوم الهجمات" : "❌ FAIL — يوجد ثغرات مالية تحتاج إصلاحاً"}`);
  console.log("═".repeat(72) + "\n");
  return allPass ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// التشغيل
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  let ctx: Ctx | null = null;
  let exitCode = 1;
  try {
    ctx = await setup();
    console.log("\n▶️  تشغيل الاختبارات A01 → A08:\n");
    await A01(ctx);
    await A02(ctx);
    await A03(ctx);
    await A04(ctx);
    await A05(ctx);
    await A06(ctx);
    await A07(ctx);
    await A08(ctx);
    exitCode = report();
  } catch (e) {
    console.error(`\n💥 خطأ غير متوقع: ${(e as Error).message}\n${(e as Error).stack}`);
    exitCode = 1;
  } finally {
    await cleanup();
  }
  process.exit(exitCode);
}

void main();
