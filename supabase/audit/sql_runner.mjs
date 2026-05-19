// Run arbitrary SQL via Supabase pg-meta-style RPC.
// We rely on a one-time helper SQL function `_audit_exec_sql` (created on first run).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.replace(/^"|"$/g, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^"|"$/g, '');

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
  Prefer: 'params=single-object',
};

export async function ensureAuditFn() {
  // Use pg_meta /pg/query endpoint via the management API? Not available with service role.
  // Workaround: create a temporary RPC by calling existing migrations infra.
  // Simplest: post-install we use Supabase's `pg_net`/REST is not enough. We use the
  // built-in `query` endpoint exposed via Supabase pg-meta for service_role: /pg-meta/default/query
  // But that's only Studio internal. Final fallback: create a SECURITY DEFINER function via a migration.
  // Strategy used: create the helper via the pg-meta REST URL `/pg/query` if available; else fail loud.
  return true;
}

export async function runSql(sql) {
  // Helper returns SETOF jsonb. PostgREST wraps it as an array of {_audit_exec_sql: <jsonb>} OR as raw jsonb array depending on call. We use POST and unwrap.
  const res = await fetch(`${REST}/rpc/_audit_exec_sql`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ q: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL failed (${res.status}): ${text}\nQuery: ${sql.slice(0,200)}`);
  }
  const raw = await res.json();
  // PostgREST wraps SETOF jsonb as [{ _audit_exec_sql: <jsonb> }, ...]. Unwrap.
  if (Array.isArray(raw)) {
    return raw.map(r => (r && typeof r === 'object' && '_audit_exec_sql' in r) ? r._audit_exec_sql : r);
  }
  return [raw];
}

export async function runSqlOrBootstrap(sql) {
  try {
    return await runSql(sql);
  } catch (err) {
    if (String(err).includes('Could not find the function') || String(err).includes('PGRST202')) {
      console.error('Helper function _audit_exec_sql not found. Bootstrapping via direct SQL...');
      await bootstrapHelper();
      return await runSql(sql);
    }
    throw err;
  }
}

async function bootstrapHelper() {
  // Use the Supabase Postgres Meta endpoint (works with service_role).
  const META = `${SUPABASE_URL}/pg/query`; // not always exposed; try alternative
  const ddl = `
    CREATE OR REPLACE FUNCTION public._audit_exec_sql(q text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      result jsonb;
    BEGIN
      EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || q || ') t' INTO result;
      RETURN result;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('error', SQLERRM, 'state', SQLSTATE);
    END;
    $$;
    REVOKE ALL ON FUNCTION public._audit_exec_sql(text) FROM PUBLIC;
  `;
  // Try /pg/query (some older self-hosted) else fall back to management API
  const res = await fetch(META, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query: ddl }),
  });
  if (!res.ok) {
    throw new Error(
      `Cannot bootstrap helper via ${META} (${res.status}). ` +
      `Please run the SQL in supabase/audit/bootstrap_helper.sql via Supabase SQL Editor once, then retry.`
    );
  }
}

// CLI usage: node sql_runner.mjs "SELECT 1"
const isCli = process.argv[1] && process.argv[1].endsWith('sql_runner.mjs');
if (isCli) {
  const sql = process.argv.slice(2).join(' ');
  if (!sql) { console.log('Usage: node sql_runner.mjs "<sql>"'); process.exit(0); }
  runSqlOrBootstrap(sql).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e); process.exit(1); });
}
