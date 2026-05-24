// Step 1.2 — Audit SECURITY DEFINER functions for safety patterns
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(fs.readFileSync(path.join(__dirname,'live_state.json'),'utf8'));
// Note: live_state.json from step1 doesn't include source. We'll re-pull sources here.

import { runSqlOrBootstrap } from './sql_runner.mjs';

const SQL_SOURCES = `
  SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    pg_get_function_result(p.oid) AS return_type,
    pg_get_functiondef(p.oid) AS source,
    array_to_string(p.proacl, ',') AS acl,
    EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgfoid = p.oid AND NOT t.tgisinternal) AS is_trigger_used
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef = true
  ORDER BY p.proname
`;

const FINANCIAL = /(wallet|withdrawal|topup|commission|earning|payment|fare|payout|bonus|incentive|refund|debit|credit|balance)/i;
const ADMIN_TABLES = /(user_roles|admin|app_settings|payment_integrations|system_configs)/i;

const SAFE_AUTH_PATTERNS = [
  /auth\.uid\(\)/i,
  /current_setting\('request\.jwt/i,
  /has_role\(/i,
  /is_admin\(/i,
  /jwt_role/i,
];

async function main() {
  const fns = await runSqlOrBootstrap(SQL_SOURCES);
  const audit = [];
  for (const f of fns) {
    const src = f.source || '';
    const isTrigger = !!f.is_trigger_used || /RETURNS\s+trigger/i.test(src) || f.return_type === 'trigger';
    const writesFinancial = /INSERT|UPDATE|DELETE/i.test(src) && FINANCIAL.test(src);
    const writesAdmin     = /INSERT|UPDATE|DELETE/i.test(src) && ADMIN_TABLES.test(src);
    const hasAuthCheck    = SAFE_AUTH_PATTERNS.some(rx => rx.test(src));
    // ACL parsing: empty ACL = default (PUBLIC EXECUTE for FUNCTION). Look for explicit grants/revokes.
    const aclStr = f.acl || '';
    const callableByAnon  = aclStr === '' || /\banon=/i.test(aclStr);
    const callableByAuthd = aclStr === '' || /\bauthenticated=/i.test(aclStr);

    let severity = 'OK';
    const reasons = [];

    if (isTrigger) {
      // Triggers run in caller-DML context; auth is enforced at the table the DML hits.
      // Only flag triggers that WRITE financial AND have NO admin/auth gating in source.
      if (writesFinancial) { severity = 'INFO'; reasons.push('trigger writes financial — verify the source table RLS gates the firing DML'); }
      else if (writesAdmin) { severity = 'INFO'; reasons.push('trigger writes admin — verify source table RLS'); }
    } else {
      // Direct-callable RPC functions — strict checks
      if (writesFinancial && !hasAuthCheck && callableByAnon)  { severity = 'CRITICAL'; reasons.push('RPC writes financial w/o auth check, callable by anon'); }
      else if (writesFinancial && !hasAuthCheck && callableByAuthd) { severity = 'CRITICAL'; reasons.push('RPC writes financial w/o auth check, callable by authenticated'); }
      else if (writesAdmin && !hasAuthCheck && (callableByAnon || callableByAuthd)) { severity = 'HIGH'; reasons.push('RPC writes admin tables w/o auth check'); }
      else if (writesFinancial && !hasAuthCheck) { severity = 'HIGH'; reasons.push('RPC writes financial w/o auth check (limited callers)'); }
      else if (writesFinancial) { severity = 'REVIEW'; reasons.push('RPC financial write — verify caller checks'); }
      else if (writesAdmin)     { severity = 'REVIEW'; reasons.push('RPC admin write — verify caller checks'); }
    }

    audit.push({
      function: f.function_name,
      args: f.args,
      return_type: f.return_type,
      isTrigger,
      severity,
      reasons,
      writesFinancial,
      writesAdmin,
      hasAuthCheck,
      callableByAnon,
      callableByAuthd,
      acl: f.acl,
    });
  }
  audit.sort((a,b) => {
    const order = { CRITICAL: 0, HIGH: 1, REVIEW: 2, INFO: 3, OK: 4 };
    return (order[a.severity]??99) - (order[b.severity]??99) || a.function.localeCompare(b.function);
  });
  fs.writeFileSync(path.join(__dirname,'definer_audit.json'), JSON.stringify(audit, null, 2));

  const counts = audit.reduce((m,r)=>{ m[r.severity]=(m[r.severity]||0)+1; return m; }, {});
  console.log('SECURITY DEFINER audit:', counts);
  console.log('\n=== CRITICAL & HIGH (RPC functions only) ===');
  const risky = audit.filter(r => ['CRITICAL','HIGH'].includes(r.severity));
  console.log(risky.map(r => `[${r.severity}] ${r.function}(${r.args}) — ${r.reasons.join('; ')}`).join('\n') || '(none)');
}

main().catch(e => { console.error(e); process.exit(1); });
