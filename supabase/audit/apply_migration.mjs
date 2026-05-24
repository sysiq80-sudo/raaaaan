// Apply Phase 1 security migration to live DB via _audit_exec_ddl helper.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const URL = process.env.VITE_SUPABASE_URL?.replace(/^"|"$/g,'');
const SR  = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^"|"$/g,'');
const HEADERS = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function ddl(stmt) {
  const r = await fetch(`${URL}/rest/v1/rpc/_audit_exec_ddl`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ stmt }),
  });
  const j = await r.json();
  // SETOF? It's `RETURNS jsonb` — single row.
  const result = Array.isArray(j) ? j[0] : j;
  return result;
}

const migrationFile = process.argv[2] || path.join(__dirname,'..','migrations','20260420120000_phase1_security_audit_fixes.sql');
const raw = fs.readFileSync(migrationFile, 'utf8');

// Split SQL into statements. A naive splitter that respects $func$ / $fix$ dollar-quoted blocks.
function splitSql(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let inDollar = null; // tag of currently open $tag$
  while (i < sql.length) {
    if (!inDollar) {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)\$/);
      if (m) {
        inDollar = m[1];
        buf += m[0];
        i += m[0].length;
        continue;
      }
      if (sql[i] === '-' && sql[i+1] === '-') {
        // comment to end of line
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
      buf += sql[i++];
    } else {
      const close = `$${inDollar}$`;
      if (sql.startsWith(close, i)) {
        buf += close;
        i += close.length;
        inDollar = null;
        continue;
      }
      buf += sql[i++];
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

const stmts = splitSql(raw).filter(s => s && !s.match(/^(--|\s)*$/));
console.log(`Applying ${stmts.length} statements from ${path.basename(migrationFile)}\n`);

const results = [];
let ok = 0, fail = 0;
for (let i = 0; i < stmts.length; i++) {
  const s = stmts[i];
  const preview = s.replace(/\s+/g,' ').slice(0,90);
  process.stdout.write(`[${String(i+1).padStart(3,' ')}/${stmts.length}] ${preview}... `);
  try {
    const r = await ddl(s);
    if (r && r.ok) { console.log('OK'); ok++; results.push({ i, ok: true, preview }); }
    else { console.log(`FAIL: ${r?.error || JSON.stringify(r)}`); fail++; results.push({ i, ok: false, preview, error: r }); }
  } catch (e) {
    console.log(`THROW: ${e.message}`); fail++; results.push({ i, ok: false, preview, error: String(e) });
  }
}

console.log(`\n=== APPLY SUMMARY ===\nOK: ${ok}\nFAIL: ${fail}`);
fs.writeFileSync(path.join(__dirname,'apply_results.json'), JSON.stringify(results, null, 2));
process.exit(fail > 0 ? 1 : 0);
