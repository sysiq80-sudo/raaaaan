/**
 * ════════════════════════════════════════════════════════════════════════════
 * RAAN — Voucher / Admin RPC Permission Verification (T0 → T10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * الهدف: إثبات عملي (Proven Fixed) أن صلاحيات الكاردات وRPCs الأدمن مغلقة
 *        ولا يمكن استغلالها من دور authenticated عادي (راكب/سائق) أو anon.
 *
 * ⚠️  بيئة التشغيل: Supabase staging أو local فقط — ممنوع على الإنتاج.
 *     السكربت يرفض التشغيل إذا اكتشف project الإنتاج (PROD_PROJECT_REF).
 *
 * يُنشئ السكربت مستخدمي اختبار (راكب/سائق/أدمن) + كاردات اختبار، ينفّذ
 * T0→T10، يطبع تقرير PASS/FAIL لكل اختبار وحكماً نهائياً، ثم ينظّف بياناته.
 *
 * التشغيل:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_ANON_KEY=... \
 *   npx tsx supabase/verification/voucher-admin-rpc-verify.ts
 *
 * (أو عبر bun: bun supabase/verification/voucher-admin-rpc-verify.ts)
 * ════════════════════════════════════════════════════════════════════════════
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// إعدادات وحراسة البيئة
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

// مرجع مشروع الإنتاج — لمنع التشغيل عليه عن طريق الخطأ.
const PROD_PROJECT_REF = "wgolkcztdrwdphwjvqxt";

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("SUPABASE_URL غير محدد في البيئة.");
if (!SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY غير محدد في البيئة.");
if (!ANON_KEY) fail("SUPABASE_ANON_KEY غير محدد في البيئة.");

// حارس الإنتاج: نرفض إن كان الـ URL يشير لمشروع الإنتاج — إلا بموافقة صريحة.
const allowProduction = process.env.RAAN_VERIFY_ALLOW_PRODUCTION === "yes";
if (SUPABASE_URL.includes(PROD_PROJECT_REF) && !allowProduction) {
  fail(
    `رُفض التشغيل: SUPABASE_URL يشير إلى مشروع الإنتاج (${PROD_PROJECT_REF}).\n` +
      `للتشغيل على الإنتاج (بيانات الاختبار ستُنشأ وتُحذف تلقائياً):\n` +
      `  RAAN_VERIFY_ALLOW_PRODUCTION=yes`,
  );
}
if (SUPABASE_URL.includes(PROD_PROJECT_REF) && allowProduction) {
  console.warn(
    "\n⚠️  تحذير: تشغيل على الإنتاج — بيانات الاختبار ستُنشأ وتُحذف خلال التشغيل." +
      "\n   دوّر service_role key بعد الانتهاء من: Dashboard → Settings → API.\n",
  );
}

// السماح الصريح: إما local أو staging أو إنتاج بموافقة.
const isLocal =
  SUPABASE_URL.includes("127.0.0.1") ||
  SUPABASE_URL.includes("localhost") ||
  SUPABASE_URL.includes("kong:8000");
const isProd = SUPABASE_URL.includes(PROD_PROJECT_REF);
const stagingAck = process.env.RAAN_VERIFY_ALLOW_STAGING === "yes";

if (!isLocal && !isProd && !stagingAck) {
  fail(
    "SUPABASE_URL ليس بيئة local. إن كنت متأكداً أنها staging (وليست production)، " +
      "أعد التشغيل مع RAAN_VERIFY_ALLOW_STAGING=yes.",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// أدوات مساعدة
// ─────────────────────────────────────────────────────────────────────────────

const RUN_ID = Math.random().toString(36).slice(2, 8);
const TS = Date.now();

interface TestUser {
  id: string;
  email: string;
  password: string;
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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** يُنشئ مستخدماً مؤكَّداً عبر admin API ويسجّل دخوله بعميل مستقل. */
async function createUser(label: string): Promise<TestUser> {
  const email = `verify_${label}_${RUN_ID}_${TS}@raan-verify.local`;
  const password = `Vf!${RUN_ID}${label}A9`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`فشل إنشاء مستخدم الاختبار (${label}): ${createErr?.message}`);
  }
  const id = created.user.id;
  createdUserIds.push(id); // سجّل فوراً حتى يُنظَّف عند أي خطأ لاحق

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) {
    throw new Error(`فشل تسجيل دخول مستخدم الاختبار (${label}): ${signInErr.message}`);
  }

  return { id, email, password, client };
}

const createdUserIds: string[] = [];
const createdVoucherIds: string[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// التهيئة: مستخدمون + أدوار + بيانات اختبار
// ─────────────────────────────────────────────────────────────────────────────

async function setup() {
  console.log(`\n🔧 التهيئة (RUN_ID=${RUN_ID}) — staging/local: ${SUPABASE_URL}\n`);

  const rider = await createUser("rider");
  const driver = await createUser("driver");
  const adminUser = await createUser("admin");
  // ملاحظة: createdUserIds يُملأ داخل createUser() مباشرة

  // منح دور admin لمستخدم الأدمن عبر service_role (يتجاوز RLS).
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: adminUser.id, role: "admin" });
  if (roleErr) throw new Error(`فشل منح دور admin: ${roleErr.message}`);

  // التأكد من وجود صفوف profiles للراكب (محفظة الراكب تعتمد عليها).
  await admin.from("profiles").upsert(
    { user_id: rider.id, full_name: "Verify Rider", phone: `+9647${RUN_ID}0` },
    { onConflict: "user_id" },
  );

  // إنشاء سجل سائق + محفظة سائق + طلب سحب pending للاختبارات T5/T6/T7.
  const { data: driverRow, error: drvErr } = await admin
    .from("drivers")
    .insert({
      user_id: driver.id,
      full_name: "Verify Driver",
      phone: `+9647${RUN_ID}1`,
      status: "approved",
    })
    .select("id")
    .single();
  if (drvErr || !driverRow) throw new Error(`فشل إنشاء سجل السائق: ${drvErr?.message}`);
  const driverId = driverRow.id as string;

  const { data: walletRow, error: walErr } = await admin
    .from("driver_wallets")
    .insert({ driver_id: driverId, balance: 50000 })
    .select("id")
    .single();
  if (walErr || !walletRow) throw new Error(`فشل إنشاء محفظة السائق: ${walErr?.message}`);
  const walletId = walletRow.id as string;

  const { data: wrRow, error: wrErr } = await admin
    .from("withdrawal_requests")
    .insert({
      driver_id: driverId,
      wallet_id: walletId,
      amount: 10000,
      withdrawal_method: "manual",
      account_details: { note: "verify" },
      account_holder_name: "Verify Driver",
      status: "pending",
    })
    .select("id")
    .single();
  if (wrErr || !wrRow) throw new Error(`فشل إنشاء طلب السحب: ${wrErr?.message}`);
  const withdrawalRequestId = wrRow.id as string;

  // كاردات اختبار للخلط (T4/T5) وإعادة الاستخدام (T10) عبر service_role.
  // ملاحظة: الدوال تُطبّق UPPER() على الكود قبل البحث — الأكواد يجب أن تُخزَّن uppercase.
  const RUN_ID_UPPER = RUN_ID.toUpperCase();
  const riderVoucherCode = `RR-VRF${RUN_ID_UPPER}-A1`;
  const driverVoucherCode = `RD-VRF${RUN_ID_UPPER}-B2`;
  const reuseVoucherCode = `RR-VRF${RUN_ID_UPPER}-C3`;

  const { data: vData, error: vErr } = await admin
    .from("voucher_codes")
    .insert([
      { code: riderVoucherCode, amount: 1000, status: "active", audience: "rider" },
      { code: driverVoucherCode, amount: 1000, status: "active", audience: "driver" },
      { code: reuseVoucherCode, amount: 1000, status: "active", audience: "rider" },
    ])
    .select("id");
  if (vErr || !vData) throw new Error(`فشل إنشاء كاردات الاختبار: ${vErr?.message}`);
  createdVoucherIds.push(...vData.map((v) => v.id as string));

  return {
    rider,
    driver,
    adminUser,
    driverId,
    walletId,
    withdrawalRequestId,
    riderVoucherCode,
    driverVoucherCode,
    reuseVoucherCode,
  };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

// ─────────────────────────────────────────────────────────────────────────────
// الاختبارات T0 → T10
// ─────────────────────────────────────────────────────────────────────────────

// T0 — نقطة الثقة: راكب يحاول ترقية دوره عبر user_roles ⇒ يجب أن يفشل (RLS).
async function T0(ctx: Ctx) {
  const { error } = await ctx.rider.client
    .from("user_roles")
    .insert({ user_id: ctx.rider.id, role: "admin" });
  // التحقق المؤكِّد: لا يوجد صف admin للراكب بعد المحاولة (قراءة بـ service_role).
  const { data: rows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.rider.id)
    .eq("role", "admin");
  const blocked = !!error || (rows?.length ?? 0) === 0;
  record(
    "T0",
    "راكب يحاول ترقية دوره إلى admin",
    "يفشل بـ RLS ولا يُنشأ صف admin",
    blocked && (rows?.length ?? 0) === 0,
    error
      ? `رُفض الإدراج: ${error.message}`
      : `لا صف admin للراكب (count=${rows?.length ?? 0})`,
  );
}

// T1 — راكب يستدعي generate_voucher_batch ⇒ EXCEPTION غير مصرح.
async function T1(ctx: Ctx) {
  const { data, error } = await ctx.rider.client.rpc("generate_voucher_batch", {
    p_count: 1,
    p_amount: 1000,
    p_batch_name: `vrf_${RUN_ID}`,
    p_audience: "rider",
  });
  const pass = !!error && /غير مصرح|not authorized|permission/i.test(error.message);
  record(
    "T1",
    "راكب يستدعي generate_voucher_batch",
    "يفشل (غير مصرح)",
    pass,
    error ? error.message : `نجح بشكل غير متوقع: ${JSON.stringify(data)}`,
  );
}

// T2 — سائق يستدعي generate_voucher_batch ⇒ EXCEPTION غير مصرح.
async function T2(ctx: Ctx) {
  const { data, error } = await ctx.driver.client.rpc("generate_voucher_batch", {
    p_count: 1,
    p_amount: 1000,
    p_batch_name: `vrf_${RUN_ID}`,
    p_audience: "driver",
  });
  const pass = !!error && /غير مصرح|not authorized|permission/i.test(error.message);
  record(
    "T2",
    "سائق يستدعي generate_voucher_batch",
    "يفشل (غير مصرح)",
    pass,
    error ? error.message : `نجح بشكل غير متوقع: ${JSON.stringify(data)}`,
  );
}

// T3 — admin يستدعي generate_voucher_batch ⇒ ينجح بالبادئة الصحيحة.
async function T3(ctx: Ctx) {
  const { data, error } = await ctx.adminUser.client.rpc("generate_voucher_batch", {
    p_count: 2,
    p_amount: 1000,
    p_batch_name: `vrf_admin_${RUN_ID}`,
    p_audience: "rider",
  });
  let pass = false;
  let detail: string;
  if (error) {
    detail = `فشل غير متوقع: ${error.message}`;
  } else {
    const codes = (data as Array<{ code: string; amount: number }> | null) ?? [];
    pass = codes.length === 2 && codes.every((c) => c.code.startsWith("RR-"));
    detail = `أُنشئ ${codes.length} كارت: ${codes.map((c) => c.code).join(", ")}`;
    // تتبّع للتنظيف.
    if (codes.length) {
      const { data: created } = await admin
        .from("voucher_codes")
        .select("id")
        .in("code", codes.map((c) => c.code));
      created?.forEach((r) => createdVoucherIds.push(r.id as string));
    }
  }
  record("T3", "admin يستدعي generate_voucher_batch", "ينجح بالبادئة RR-", pass, detail);
}

// T4 — راكب يستخدم كارت سائق (RD-) عبر redeem_voucher ⇒ يُرفض.
async function T4(ctx: Ctx) {
  const { data, error } = await ctx.rider.client.rpc("redeem_voucher", {
    p_code: ctx.driverVoucherCode,
    p_user_id: ctx.rider.id,
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass = !error && res?.success === false && /كارت سائق/.test(res?.error ?? "");
  record(
    "T4",
    "راكب يستخدم كارت سائق (RD-)",
    "success:false — هذا كارت سائق",
    pass,
    error ? `RPC error: ${error.message}` : JSON.stringify(res),
  );
}

// T5 — سائق يستخدم كارت راكب (RR-) عبر redeem_voucher_driver ⇒ يُرفض.
async function T5(ctx: Ctx) {
  const { data, error } = await ctx.driver.client.rpc("redeem_voucher_driver", {
    p_code: ctx.riderVoucherCode,
    p_driver_id: ctx.driverId,
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass = !error && res?.success === false && /كارت راكب/.test(res?.error ?? "");
  record(
    "T5",
    "سائق يستخدم كارت راكب (RR-)",
    "success:false — هذا كارت راكب",
    pass,
    error ? `RPC error: ${error.message}` : JSON.stringify(res),
  );
}

// T6 — admin يستدعي admin_complete_withdrawal ⇒ ينجح.
async function T6(ctx: Ctx) {
  const { data, error } = await ctx.adminUser.client.rpc("admin_complete_withdrawal", {
    p_request_id: ctx.withdrawalRequestId,
    p_tx_reference: `vrf_${RUN_ID}`,
    p_notes: "verification",
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass = !error && res?.success === true;
  record(
    "T6",
    "admin يكمل طلب سحب",
    "success:true",
    pass,
    error ? `RPC error: ${error.message}` : JSON.stringify(res),
  );
}

// T7 — راكب (غير admin) يستدعي admin_complete_withdrawal ⇒ Unauthorized.
async function T7(ctx: Ctx) {
  // طلب سحب جديد لضمان عدم التأثر بنتيجة T6.
  const { data: w } = await admin
    .from("withdrawal_requests")
    .insert({
      driver_id: ctx.driverId,
      wallet_id: ctx.walletId,
      amount: 5000,
      withdrawal_method: "manual",
      account_details: { note: "verify-t7" },
      account_holder_name: "Verify Driver",
      status: "pending",
    })
    .select("id")
    .single();

  const { data, error } = await ctx.rider.client.rpc("admin_complete_withdrawal", {
    p_request_id: w?.id,
    p_tx_reference: `vrf_${RUN_ID}`,
    p_notes: "verification",
  });
  const res = data as { success?: boolean; error?: string } | null;
  // النجاح = الاستدعاء لم يُكمل السحب (إما خطأ صلاحية أو success:false/Unauthorized).
  const pass = !!error || (res?.success === false && /unauthorized/i.test(res?.error ?? ""));
  record(
    "T7",
    "غير-admin يكمل طلب سحب",
    "يفشل (Unauthorized)",
    pass,
    error ? error.message : JSON.stringify(res),
  );
}

// T8 — راكب يحاول شحن محفظة مستخدم آخر ⇒ يُرفض.
async function T8(ctx: Ctx) {
  const { data, error } = await ctx.rider.client.rpc("redeem_voucher", {
    p_code: ctx.reuseVoucherCode,
    p_user_id: ctx.adminUser.id, // مستخدم آخر
  });
  const res = data as { success?: boolean; error?: string } | null;
  const pass = !error && res?.success === false && /محفظتك فقط|غير مصرح/.test(res?.error ?? "");
  record(
    "T8",
    "راكب يشحن محفظة مستخدم آخر",
    "success:false — يمكنك شحن محفظتك فقط",
    pass,
    error ? `RPC error: ${error.message}` : JSON.stringify(res),
  );
}

// T9 — anon يستدعي الدوال ⇒ يفشل (REVOKE من anon).
async function T9(ctx: Ctx) {
  const gen = await anonClient.rpc("generate_voucher_batch", {
    p_count: 1,
    p_amount: 1000,
    p_audience: "rider",
  });
  const red = await anonClient.rpc("redeem_voucher", {
    p_code: ctx.reuseVoucherCode,
    p_user_id: ctx.rider.id,
  });
  const genBlocked = !!gen.error;
  // redeem: anon لا يملك auth.uid() ⇒ يُرفض إما بخطأ صلاحية أو success:false.
  const redRes = red.data as { success?: boolean } | null;
  const redBlocked = !!red.error || redRes?.success === false;
  const pass = genBlocked && redBlocked;
  record(
    "T9",
    "anon يستدعي generate_voucher_batch / redeem_voucher",
    "كلاهما يفشل (REVOKE من anon / لا auth.uid())",
    pass,
    `generate: ${gen.error?.message ?? "نجح!"} | redeem: ${
      red.error?.message ?? JSON.stringify(redRes)
    }`,
  );
}

// T10 — إعادة استخدام نفس الكارت مرتين ⇒ الثانية تُرفض (idempotency).
async function T10(ctx: Ctx) {
  const first = await ctx.rider.client.rpc("redeem_voucher", {
    p_code: ctx.reuseVoucherCode,
    p_user_id: ctx.rider.id,
  });
  const second = await ctx.rider.client.rpc("redeem_voucher", {
    p_code: ctx.reuseVoucherCode,
    p_user_id: ctx.rider.id,
  });
  const r1 = first.data as { success?: boolean } | null;
  const r2 = second.data as { success?: boolean; error?: string } | null;
  const pass =
    !first.error &&
    r1?.success === true &&
    !second.error &&
    r2?.success === false &&
    /مستخدم مسبقاً/.test(r2?.error ?? "");
  record(
    "T10",
    "إعادة استخدام نفس الكارت مرتين",
    "الأولى تنجح، الثانية تُرفض (مستخدم مسبقاً)",
    pass,
    `الأولى: ${JSON.stringify(r1)} | الثانية: ${JSON.stringify(r2)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// التنظيف
// ─────────────────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("\n🧹 تنظيف بيانات الاختبار...");
  try {
    if (createdVoucherIds.length) {
      await admin.from("voucher_codes").delete().in("id", createdVoucherIds);
    }
    // حذف الكاردات المنشأة بالـ run id احتياطاً.
    await admin.from("voucher_codes").delete().like("code", `%VRF${RUN_ID.toUpperCase()}%`);

    for (const uid of createdUserIds) {
      // حذف المستخدم يُسقط profiles/drivers/wallets عبر ON DELETE CASCADE.
      await admin.auth.admin.deleteUser(uid).catch(() => undefined);
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
  console.log("  RAAN — Voucher/Admin RPC Permission Verification — التقرير النهائي");
  console.log("═".repeat(72));
  for (const r of results) {
    console.log(`  ${r.pass ? "✅ PASS" : "❌ FAIL"}  ${r.id.padEnd(4)} ${r.name}`);
  }
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allPass = passed === total;
  console.log("─".repeat(72));
  console.log(`  النتيجة: ${passed}/${total}`);
  console.log(`  الحكم النهائي: ${allPass ? "✅ PASS" : "❌ FAIL"}`);
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
    console.log("\n▶️  تشغيل الاختبارات T0 → T10:\n");
    await T0(ctx);
    await T1(ctx);
    await T2(ctx);
    await T3(ctx);
    await T4(ctx);
    await T5(ctx);
    await T6(ctx);
    await T7(ctx);
    await T8(ctx);
    await T9(ctx);
    await T10(ctx);
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
