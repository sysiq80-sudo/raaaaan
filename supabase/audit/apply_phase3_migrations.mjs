// Apply Phase 3 (Dispatch v2) migrations to live DB via _audit_exec_ddl helper.
// Pre-requisite: bootstrap_ddl_helper.sql must be run ONCE in Supabase SQL Editor
//                AND SUPABASE_SERVICE_ROLE_KEY must be present in .env (temporarily).
//
// Usage:
//   node supabase/audit/apply_phase3_migrations.mjs
//
// Output: supabase/audit/apply_phase3_results.json

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const URL = process.env.VITE_SUPABASE_URL?.replace(/^"|"$/g, '');
const SR  = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^"|"$/g, '');

if (!URL || !SR) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   Add SUPABASE_SERVICE_ROLE_KEY temporarily, then remove after run.');
  process.exit(1);
}

const HEADERS = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function ddl(stmt) {
  const r = await fetch(`${URL}/rest/v1/rpc/_audit_exec_ddl`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ stmt }),
  });
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
}

// Splitter that respects $tag$ ... $tag$ dollar-quoted blocks (re-used from apply_migration.mjs).
function splitSql(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let inDollar = null;
  while (i < sql.length) {
    if (!inDollar) {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)\$/);
      if (m) {
        inDollar = m[1];
        buf += m[0];
        i += m[0].length;
        continue;
      }
      if (sql[i] === '-' && sql[i + 1] === '-') {
        const eol = sql.indexOf('\n', i);
        const end = eol === -1 ? sql.length : eol + 1;
        buf += sql.slice(i, end);
        i = end;
        continue;
      }
      if (sql[i] === ';') {
        const stmt = buf.trim();
        if (stmt) out.push(stmt);
        buf = '';
        i++;
        continue;
      }
      buf += sql[i];
      i++;
    } else {
      const tag = `$${inDollar}$`;
      if (sql.slice(i, i + tag.length) === tag) {
        buf += tag;
        i += tag.length;
        inDollar = null;
        continue;
      }
      buf += sql[i];
      i++;
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

const migrations = [
  '20260420130000_driver_matching_stats.sql',
  '20260420130001_directions_cache.sql',
  '20260420130002_dispatch_v2_settings.sql',
];

const allResults = [];
let totalOk = 0;
let totalFail = 0;

for (const file of migrations) {
  const fullPath = path.join(__dirname, '..', 'migrations', file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing migration file: ${file}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(fullPath, 'utf8');
  const stmts = splitSql(raw);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📂 ${file} — ${stmts.length} statements`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const fileResults = [];
  for (let idx = 0; idx < stmts.length; idx++) {
    const stmt = stmts[idx];
    const preview = stmt.slice(0, 80).replace(/\s+/g, ' ');
    process.stdout.write(`  [${idx + 1}/${stmts.length}] ${preview}... `);
    try {
      const res = await ddl(stmt);
      if (res?.ok) {
        console.log('✅');
        fileResults.push({ idx, ok: true, preview });
        totalOk++;
      } else {
        console.log(`❌ ${res?.error || JSON.stringify(res)}`);
        fileResults.push({ idx, ok: false, preview, error: res?.error, state: res?.state, full: stmt });
        totalFail++;
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
      fileResults.push({ idx, ok: false, preview, error: e.message, full: stmt });
      totalFail++;
    }
  }
  allResults.push({ file, stmts: stmts.length, results: fileResults });
}

const outPath = path.join(__dirname, 'apply_phase3_results.json');
fs.writeFileSync(outPath, JSON.stringify({
  applied_at: new Date().toISOString(),
  total_ok: totalOk,
  total_fail: totalFail,
  files: allResults,
}, null, 2));

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📊 Total: ${totalOk} OK, ${totalFail} FAIL`);
console.log(`📄 Results: ${outPath}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

if (totalFail > 0) {
  console.error('\n⚠️  Some statements failed. Review apply_phase3_results.json.');
  process.exit(1);
}

console.log('\n✅ All Phase 3 migrations applied. Next steps:');
console.log('   1. Deploy match-ride: supabase functions deploy match-ride');
console.log('   2. Verify dispatch_version: SELECT value FROM app_settings WHERE key=\'matching_settings\';');
console.log('   3. Run cleanup_helpers.mjs to drop _audit_exec_ddl');
console.log('   4. Remove SUPABASE_SERVICE_ROLE_KEY from .env');
