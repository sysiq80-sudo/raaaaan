/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  ADMIN-ONLY — DANGEROUS TOOL — DO NOT RUN CASUALLY                 ║
 * ║  أداة إدارية خطيرة — للمدير التقني فقط — لا تُشغَّل بدون قصد         ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ما يفعله هذا السكربت:                                                  ║
 * ║  1. يقرأ service_role key من Supabase CLI                               ║
 * ║  2. إذا غاب INTERNAL_EDGE_SECRET → يُولّد token جديداً ويضبطه في:     ║
 * ║       • Supabase Edge Function Secrets (يُبطل السر الحالي)             ║
 * ║       • vault.secrets في DB                                             ║
 * ║       • يُعيد نشر financial-watchdog على الإنتاج                       ║
 * ║  3. يُعدّل wallet_balance لراكب حقيقي مؤقتاً (+5000 IQD)              ║
 * ║  4. يستدعي notify-admin-critical مما يُرسل تنبيهاً حقيقياً على Telegram║
 * ║                                                                          ║
 * ║  الاستخدام الصحيح:                                                      ║
 * ║  • Staging أولاً — ثم Production بموافقة صريحة                        ║
 * ║  • يُشغَّل بعد كل deployment جديد للـ watchdog للتحقق من سلامته       ║
 * ║  • لا يُشغَّل خلال ساعات الذروة (أوقات كثافة الرحلات)                ║
 * ║  • تحقق من Telegram بعد التشغيل — ستصل رسالة تنبيه حقيقية            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * التشغيل:
 *   npx tsx supabase/verification/run-watchdog-full.ts
 *
 * إذا كنت تعرف INTERNAL_EDGE_SECRET مسبقاً (لتجنب إعادة النشر):
 *   $env:INTERNAL_EDGE_SECRET = "<القيمة>" ; npx tsx supabase/verification/run-watchdog-full.ts
 */

import { execSync } from "child_process";
import { randomUUID } from "crypto";

const PROJ_REF = "wgolkcztdrwdphwjvqxt";
const SUPABASE_URL = `https://${PROJ_REF}.supabase.co`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. جلب service_role key من Supabase CLI (بدون عرضه)
// ─────────────────────────────────────────────────────────────────────────────

function getServiceRoleKey(): string {
  console.log("⏳ جاري جلب service_role key من Supabase CLI...");
  try {
    const raw = execSync(
      `supabase projects api-keys --project-ref ${PROJ_REF} --output json`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    // الناتج قد يحتوي على أسطر إضافية — نبحث عن JSON array
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error("لم يُعثر على JSON في ناتج api-keys");
    const keys = JSON.parse(match[0]) as Array<{ name: string; api_key: string }>;
    const sr = keys.find(k => k.name === "service_role");
    if (!sr?.api_key) throw new Error("service_role key غير موجود في الناتج");
    console.log(`✅ service_role key: تم الجلب (طول=${sr.api_key.length})`);
    return sr.api_key;
  } catch (e) {
    console.error(`❌ فشل جلب service_role key: ${(e as Error).message}`);
    console.error("   تأكد من تسجيل الدخول: supabase login");
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. جلب INTERNAL_EDGE_SECRET من Supabase Vault عبر db execute
// ─────────────────────────────────────────────────────────────────────────────

function getInternalSecretFromVault(): string {
  console.log("⏳ جاري جلب INTERNAL_EDGE_SECRET من Vault عبر db query...");
  try {
    const raw = execSync(
      `supabase db query "SELECT private.get_internal_edge_secret() AS s" --linked --output json`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );

    // الناتج JSON: [{ "s": "<value>" }]
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const rows = JSON.parse(jsonMatch[0]) as Array<Record<string, string>>;
      const val = rows[0]?.s;
      if (val && val !== "null" && val.length > 5) {
        console.log(`✅ INTERNAL_EDGE_SECRET: تم الجلب من Vault (طول=${val.length})`);
        return val;
      }
    }

    // نمط table: ---\n <value>
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const sepIdx = lines.findIndex(l => /^-+$/.test(l));
    if (sepIdx !== -1 && lines[sepIdx + 1] && !lines[sepIdx + 1].startsWith("(")) {
      const val = lines[sepIdx + 1].trim();
      if (val && val !== "NULL" && val.length > 5) {
        console.log(`✅ INTERNAL_EDGE_SECRET: تم الجلب (table) (طول=${val.length})`);
        return val;
      }
    }

    throw new Error(`تعذّر تحليل ناتج db query:\n${raw.slice(0, 300)}`);
  } catch (e) {
    const msg = (e as Error).message;
    console.warn(`⚠️  db query فشل: ${msg.slice(0, 120)}`);
    // إعادة throw — الـ caller سيجرّب RPC
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b. بديل: استدعاء private.get_internal_edge_secret عبر REST مع service_role
// ─────────────────────────────────────────────────────────────────────────────

async function getInternalSecretViaRPCAsync(srKey: string): Promise<string | null> {
  // نجرّب استدعاء الـ function عبر PostgREST مع service_role
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_internal_edge_secret`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${srKey}`,
        "apikey": srKey,
        "Content-Profile": "private",
      },
      body: "{}",
    });
    if (res.ok) {
      const text = await res.text();
      const val = text.replace(/^"|"$/g, "").trim();
      if (val && val !== "null" && val.length > 5) {
        console.log(`✅ INTERNAL_EDGE_SECRET: تم الجلب عبر RPC (طول=${val.length})`);
        return val;
      }
    }
  } catch {}
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  ⚠️  RAAN — Watchdog Full Verification Runner        ║");
  console.log("║     ADMIN-ONLY — PRODUCTION TOOL                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  المشروع: ${PROJ_REF}`);
  console.log(`  الوقت  : ${new Date().toISOString()}\n`);

  // ─── Guard: يطلب تأكيداً صريحاً لمنع التشغيل العرضي ───
  const adminConfirm = process.env.RAAN_ADMIN_CONFIRM === "yes";
  const envConfirm   = process.env.RAAN_ENV === "production";

  if (!adminConfirm || !envConfirm) {
    console.error("❌ مرفوض: هذه أداة إدارية خطيرة.");
    console.error("");
    if (!adminConfirm) console.error("   ✗ RAAN_ADMIN_CONFIRM غير مضبوط (مطلوب: 'yes')");
    if (!envConfirm)   console.error("   ✗ RAAN_ENV غير مضبوط (مطلوب: 'production')");
    console.error("");
    console.error("   ما ستفعله إذا نقص INTERNAL_EDGE_SECRET:");
    console.error("   • يُعيد ضبط INTERNAL_EDGE_SECRET على الإنتاج (يُبطل السر الحالي)");
    console.error("   • يُعيد نشر financial-watchdog");
    console.error("   • يُعدّل wallet_balance لراكب حقيقي مؤقتاً");
    console.error("   • يُرسل تنبيه Telegram حقيقي للأدمن");
    console.error("");
    console.error("   للتأكيد والمتابعة:");
    console.error("   $env:RAAN_ADMIN_CONFIRM = 'yes' ; $env:RAAN_ENV = 'production' ; npx tsx supabase/verification/run-watchdog-full.ts");
    console.error("");
    console.error("   إذا كان INTERNAL_EDGE_SECRET معروفاً (أفضل — بدون إعادة نشر):");
    console.error("   $env:RAAN_ADMIN_CONFIRM = 'yes' ; $env:RAAN_ENV = 'production' ; $env:INTERNAL_EDGE_SECRET = '<القيمة>' ; npx tsx supabase/verification/run-watchdog-full.ts");
    process.exit(1);
  }

  // ─── الخطوة 1: service_role key ───
  const srKey = getServiceRoleKey();

  // ─── الخطوة 2: INTERNAL_EDGE_SECRET ───
  let internalSecret = process.env.INTERNAL_EDGE_SECRET ?? "";

  if (internalSecret) {
    console.log(`✅ INTERNAL_EDGE_SECRET: من متغير البيئة (طول=${internalSecret.length})`);
  } else {
    // محاولة 1: vault
    try { internalSecret = getInternalSecretFromVault(); } catch {}
    // محاولة 2: RPC
    if (!internalSecret) {
      try { const r = await getInternalSecretViaRPCAsync(srKey); if (r) internalSecret = r; } catch {}
    }

    if (!internalSecret) {
      // ─── الحل النهائي: إنشاء token جديد + ضبطه في Supabase + Vault + إعادة نشر ───
      console.log("\n⚙️  INTERNAL_EDGE_SECRET غير متاح — جاري إنشاء token جديد وضبطه...");
      internalSecret = `raan-internal-${randomUUID()}`;

      // أ) ضبط Edge Function secret
      console.log("   ⏳ supabase secrets set INTERNAL_EDGE_SECRET=*** ...");
      execSync(
        `supabase secrets set "INTERNAL_EDGE_SECRET=${internalSecret}" --project-ref ${PROJ_REF}`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" }
      );
      console.log("   ✅ Edge Function secret: تم الضبط");

      // ب) تحديث vault.secrets (لـ pg_cron)
      console.log("   ⏳ تحديث vault.secrets...");
      try {
        const escaped = internalSecret.replace(/'/g, "''");
        const vaultSql = `DO $b$ BEGIN IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'internal_edge_secret') THEN UPDATE vault.secrets SET secret = '${escaped}' WHERE name = 'internal_edge_secret'; ELSE PERFORM vault.create_secret('${escaped}', 'internal_edge_secret', 'RAAN internal edge function auth token'); END IF; END $b$;`;
        execSync(
          `supabase db query "${vaultSql.replace(/"/g, '\\"')}" --linked`,
          { stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" }
        );
        console.log("   ✅ vault.secrets: تم التحديث");
      } catch (e) {
        console.warn(`   ⚠️  vault.secrets تحديث فشل (غير critical): ${(e as Error).message.slice(0, 80)}`);
      }

      // ج) إعادة نشر financial-watchdog (ليلتقط السر الجديد)
      console.log("   ⏳ إعادة نشر financial-watchdog...");
      execSync(
        `supabase functions deploy financial-watchdog --project-ref ${PROJ_REF}`,
        { stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" }
      );
      console.log("   ✅ financial-watchdog: نُشر مجدداً مع السر الجديد\n");
    }
  }

  console.log("\n🚀 جاري تشغيل watchdog-verification.ts...\n");
  console.log("══════════════════════════════════════════════════════");

  execSync(
    `npx tsx supabase/verification/watchdog-verification.ts`,
    {
      stdio: "inherit",
      env: {
        ...process.env,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: srKey,
        INTERNAL_EDGE_SECRET: internalSecret,
        RAAN_VERIFY_ALLOW_PRODUCTION: "yes",
      },
    }
  );
}

main().catch(e => {
  console.error(`\n💥 ${(e as Error).message}`);
  process.exit(1);
});
