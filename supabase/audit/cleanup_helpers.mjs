// Apply DDL to drop the audit helper functions (cleanup at end of Phase 1).
import 'dotenv/config';

const URL = process.env.VITE_SUPABASE_URL?.replace(/^"|"$/g,'');
const SR  = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^"|"$/g,'');
const HEADERS = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function ddl(stmt) {
  const r = await fetch(`${URL}/rest/v1/rpc/_audit_exec_ddl`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ stmt }),
  });
  return r.json();
}

console.log('Dropping _audit_exec_sql...');
console.log(await ddl('DROP FUNCTION IF EXISTS public._audit_exec_sql(text)'));
console.log('Dropping _audit_exec_ddl (self)...');
// _audit_exec_ddl drops itself last
console.log(await ddl('DROP FUNCTION IF EXISTS public._audit_exec_ddl(text)'));
console.log('Done.');
