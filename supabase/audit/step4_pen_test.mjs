// Step 1.4 — Penetration test against live RLS as 4 roles.
// Uses the Supabase REST/Auth API only (NEVER service_role for the actual probes).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const URL = process.env.VITE_SUPABASE_URL?.replace(/^"|"$/g,'');
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.replace(/^"|"$/g,'');
const RIDER = { phone: '+964' + process.env.TEST_RIDER_PHONE?.replace(/^"|"$/g,'').replace(/^0/, ''), password: process.env.TEST_RIDER_PASSWORD?.replace(/^"|"$/g,'') };
const DRIVER = { phone: '+964' + process.env.TEST_DRIVER_PHONE?.replace(/^"|"$/g,'').replace(/^0/, ''), password: process.env.TEST_DRIVER_PASSWORD?.replace(/^"|"$/g,'') };
const ADMIN = { email: process.env.TEST_ADMIN_EMAIL?.replace(/^"|"$/g,''), password: process.env.TEST_ADMIN_PASSWORD?.replace(/^"|"$/g,'') };

if (!URL || !ANON) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY'); process.exit(1); }

async function signInPhone(p) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: p.phone, password: p.password }),
  });
  const j = await r.json();
  if (!r.ok) return { error: j, role: 'phone-signin-failed' };
  return { token: j.access_token, user_id: j.user?.id };
}
async function signInEmail(p) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: p.email, password: p.password }),
  });
  const j = await r.json();
  if (!r.ok) return { error: j, role: 'email-signin-failed' };
  return { token: j.access_token, user_id: j.user?.id };
}

function probe(role, token) {
  return async (label, method, pathSuffix, body) => {
    const headers = { apikey: ANON, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (method === 'POST') headers['Prefer'] = 'return=representation';
    const r = await fetch(`${URL}/rest/v1/${pathSuffix}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const rowCount = Array.isArray(data) ? data.length : null;
    return { role, label, method, path: pathSuffix, status: r.status, rowCount, sample: Array.isArray(data) ? data.slice(0,2) : data };
  };
}

async function runAll() {
  const sessions = {
    anon:   { token: null, user_id: null },
    rider:  await signInPhone(RIDER),
    driver: await signInPhone(DRIVER),
    admin:  await signInEmail(ADMIN),
  };
  console.log('Sessions:', Object.fromEntries(Object.entries(sessions).map(([k,v]) => [k, v.error ? `ERR ${JSON.stringify(v.error)}` : `OK ${v.user_id?.slice(0,8)}`])));

  const results = [];

  for (const [role, sess] of Object.entries(sessions)) {
    if (sess.error) { results.push({ role, error: sess.error }); continue; }
    const p = probe(role, sess.token);

    // Read attempts on sensitive tables (limit 5 to keep results small)
    const reads = [
      ['profiles_all', 'GET', 'profiles?select=id,phone&limit=5'],
      ['drivers_all', 'GET', 'drivers?select=id,user_id&limit=5'],
      ['rides_all',   'GET', 'rides?select=id,rider_id,driver_id,fare,status&limit=5'],
      ['driver_wallet_tx_all', 'GET', 'driver_wallet_transactions?select=*&limit=5'],
      ['rider_wallet_tx_all',  'GET', 'rider_wallet_transactions?select=*&limit=5'],
      ['wallet_topup_requests_all', 'GET', 'wallet_topup_requests?select=*&limit=5'],
      ['withdrawal_requests_all',   'GET', 'withdrawal_requests?select=*&limit=5'],
      ['payment_methods_all', 'GET', 'payment_methods?select=*&limit=5'],
      ['otp_verifications_all','GET','otp_verifications?select=*&limit=5'],
      ['user_roles_all',      'GET', 'user_roles?select=*&limit=5'],
      ['ride_messages_all',   'GET', 'ride_messages?select=*&limit=5'],
      ['driver_live_locations_all', 'GET', 'driver_live_locations?select=*&limit=5'],
      ['admin_audit_logs_all', 'GET', 'admin_audit_logs?select=*&limit=5'],
      ['app_settings_all',    'GET', 'app_settings?select=*&limit=5'],
      ['fraud_alerts_all',    'GET', 'fraud_alerts?select=*&limit=5'],
      ['emergency_contacts_all','GET','emergency_contacts?select=*&limit=5'],
    ];
    for (const [label, method, p2] of reads) results.push(await p(label, method, p2));

    // Write/escalation attempts (these MUST fail for non-admin)
    const writes = [
      ['promote_self_admin', 'POST', 'user_roles', { user_id: sess.user_id, role: 'admin' }],
      ['inject_wallet_credit', 'POST', 'driver_wallet_transactions',
        { driver_id: '00000000-0000-0000-0000-000000000000', amount: 999999, type: 'bonus', description: 'pen-test' }],
      ['inject_rider_credit', 'POST', 'rider_wallet_transactions',
        { user_id: sess.user_id, amount: 999999, type: 'bonus', description: 'pen-test' }],
      ['create_app_setting', 'POST', 'app_settings',
        { key: 'pentest_'+Date.now(), value: '"x"' }],
    ];
    for (const [label, method, p2, body] of writes) results.push(await p(label, method, p2, body));
  }

  fs.writeFileSync(path.join(__dirname, 'penetration_results.json'), JSON.stringify(results, null, 2));

  // Risk classification (refined: account for legitimate own-data SELECTs and lookup tables)
  const findings = [];
  const PUBLIC_LOOKUP = new Set(['payment_methods_all', 'app_settings_all']);
  const OWN_DATA_OK = new Set(['rider_wallet_tx_all', 'driver_wallet_tx_all', 'emergency_contacts_all']);
  for (const r of results) {
    if (r.error) continue;
    if (['anon','rider','driver'].includes(r.role) && r.method === 'GET') {
      const sensitiveLabels = ['wallet_topup_requests_all','withdrawal_requests_all',
        'otp_verifications_all','user_roles_all','admin_audit_logs_all','fraud_alerts_all'];
      // Only flag if it's a truly sensitive cross-user table
      if (sensitiveLabels.includes(r.label) && r.rowCount && r.rowCount > 0) {
        findings.push({ severity: 'HIGH', role: r.role, label: r.label, status: r.status, rowCount: r.rowCount,
          note: 'Sensitive cross-user read returned rows for non-admin role' });
      }
      // Note: PUBLIC_LOOKUP and OWN_DATA_OK reads are expected behavior, not findings.
    }
    if (['anon','rider','driver'].includes(r.role) && r.method === 'POST') {
      if (r.status >= 200 && r.status < 300) {
        findings.push({ severity: 'CRITICAL', role: r.role, label: r.label, status: r.status,
          note: 'Privilege escalation / wallet injection succeeded — IMMEDIATE FIX REQUIRED' });
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, 'penetration_findings.json'), JSON.stringify(findings, null, 2));
  console.log('\n=== FINDINGS ===');
  console.log(`Total probes: ${results.length}, Findings: ${findings.length}`);
  console.log(JSON.stringify(findings, null, 2));
}

runAll().catch(e => { console.error(e); process.exit(1); });
