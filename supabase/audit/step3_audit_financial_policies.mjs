// Step 1.3 — Audit policies on the 10 most financially sensitive tables
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(fs.readFileSync(path.join(__dirname,'live_state.json'),'utf8'));

const TARGETS = [
  'driver_wallet_transactions',
  'rider_wallet_transactions',
  'wallet_topup_requests',
  'withdrawal_requests',
  'payment_accounts',
  'payment_methods',
  'promo_codes',
  'promo_code_usage',
  'driver_incentive_claims',
  'company_earnings',
  'driver_wallets',
];

const findings = [];
for (const t of TARGETS) {
  const policies = live.policies.filter(p => p.tablename === t);
  const tableMeta = live.tables.find(x => x.table_name === t);
  if (!tableMeta) { findings.push({ table: t, severity: 'INFO', note: 'Table not present in live DB' }); continue; }

  const out = { table: t, rls: tableMeta.rls_enabled, forced: tableMeta.rls_forced, policies: policies.length, issues: [] };

  if (!tableMeta.rls_enabled) out.issues.push({ severity:'CRITICAL', msg: 'RLS not enabled' });
  if (policies.length === 0)  out.issues.push({ severity:'CRITICAL', msg: 'No policies defined' });

  // Check if any policy is overly permissive
  for (const p of policies) {
    const qual = (p.qual || '').toString();
    const wcheck = (p.with_check || '').toString();
    const blob = qual + ' ' + wcheck;
    const grantsAuthenticated = (p.roles || []).includes('authenticated') || (p.roles||[]).includes('public');
    if (grantsAuthenticated && (qual === 'true' || qual === '')) {
      out.issues.push({ severity:'HIGH', msg: `Policy ${p.policyname} (${p.cmd}) USING is unconditional (qual="${qual}")`, role: p.roles });
    }
    if (['INSERT','UPDATE','ALL'].includes(p.cmd) && grantsAuthenticated && (wcheck === 'true' || wcheck === '')) {
      out.issues.push({ severity:'HIGH', msg: `Policy ${p.policyname} (${p.cmd}) WITH CHECK is unconditional (wcheck="${wcheck}")`, role: p.roles });
    }
    // Heuristic: write policies on financial tables MUST reference is_admin or service-role pattern
    const isWrite = ['INSERT','UPDATE','DELETE','ALL'].includes(p.cmd);
    const writesAuthCheck = /(is_admin|has_role|service_role|jwt_role)/i.test(blob);
    if (isWrite && grantsAuthenticated && !writesAuthCheck && !/auth\.uid\(\)/i.test(blob)) {
      out.issues.push({ severity:'HIGH', msg: `Write policy ${p.policyname} (${p.cmd}) lacks auth/admin guards`, role: p.roles });
    }
  }
  findings.push(out);
}
fs.writeFileSync(path.join(__dirname,'financial_policy_audit.json'), JSON.stringify(findings, null, 2));

console.log('=== FINANCIAL TABLE POLICY AUDIT ===');
for (const f of findings) {
  const issues = (f.issues||[]).length;
  console.log(`${issues>0?'⚠️ ':'✅ '}${f.table} — RLS:${f.rls} policies:${f.policies} issues:${issues}`);
  for (const i of (f.issues||[])) console.log(`     [${i.severity}] ${i.msg}`);
}
