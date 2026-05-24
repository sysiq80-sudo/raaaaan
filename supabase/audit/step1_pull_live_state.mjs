// Step 1.1 — Pull live DB state and detect drift vs migrations
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSqlOrBootstrap } from './sql_runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;

const Q = {
  tables: `
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced,
      pg_total_relation_size(c.oid) AS size_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `,
  policies: `
    SELECT
      schemaname, tablename, policyname,
      permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `,
  definerFunctions: `
    SELECT
      n.nspname AS schema,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.prosecdef AS is_security_definer,
      r.rolname AS owner,
      l.lanname AS language,
      array_to_string(p.proacl, ',') AS acl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_authid r ON r.oid = p.proowner
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public' AND p.prosecdef = true
    ORDER BY p.proname
  `,
  definerSources: `
    SELECT
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_functiondef(p.oid) AS source
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
    ORDER BY p.proname
  `,
  triggers: `
    SELECT
      n.nspname AS schema,
      c.relname AS table_name,
      t.tgname AS trigger_name,
      pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `,
  grants: `
    SELECT
      table_schema, table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon','authenticated','service_role','public')
    ORDER BY table_name, grantee, privilege_type
  `,
  columnsSensitive: `
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name ~* '(password|secret|token|otp|phone|email|balance|amount|api_key|salt|hash)'
    ORDER BY table_name, column_name
  `,
};

async function main() {
  const out = {};
  for (const [name, sql] of Object.entries(Q)) {
    process.stdout.write(`Running ${name}... `);
    const data = await runSqlOrBootstrap(sql);
    out[name] = data;
    console.log(Array.isArray(data) ? `${data.length} rows` : `error/${typeof data}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'live_state.json'), JSON.stringify(out, null, 2));

  // Quick analysis
  const totalTables = out.tables.length;
  const noRls = out.tables.filter(t => !t.rls_enabled);
  const policiesByTable = new Map();
  for (const p of out.policies) {
    if (!policiesByTable.has(p.tablename)) policiesByTable.set(p.tablename, []);
    policiesByTable.get(p.tablename).push(p);
  }
  const rlsButNoPolicy = out.tables.filter(t => t.rls_enabled && !policiesByTable.has(t.table_name));
  const noRlsNoPolicy  = out.tables.filter(t => !t.rls_enabled && !policiesByTable.has(t.table_name));

  // Permissive grants leakage check — anon/authenticated direct table grants other than SELECT on lookup tables
  const anonWriteGrants = out.grants.filter(g =>
    g.grantee === 'anon' && ['INSERT','UPDATE','DELETE','TRUNCATE'].includes(g.privilege_type)
  );

  const summary = {
    totalTables,
    rlsEnabled: out.tables.filter(t => t.rls_enabled).length,
    rlsForced:  out.tables.filter(t => t.rls_forced).length,
    noRls: noRls.map(t => t.table_name),
    rlsButNoPolicy: rlsButNoPolicy.map(t => t.table_name),
    noRlsNoPolicy: noRlsNoPolicy.map(t => t.table_name), // 🔴 critical
    totalPolicies: out.policies.length,
    definerFunctions: out.definerFunctions.length,
    triggers: out.triggers.length,
    sensitiveColumns: out.columnsSensitive.length,
    anonWriteGrants: anonWriteGrants,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'live_state_summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
