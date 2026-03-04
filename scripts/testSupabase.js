import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnvValue(key) {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  const match = content.match(new RegExp(`${key}="?([^"\n]+)"?`));
  return match ? match[1] : '';
}

async function run() {
  const supabaseUrl = loadEnvValue('VITE_SUPABASE_URL');
  const supabaseKey = loadEnvValue('VITE_SUPABASE_PUBLISHABLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const driverId = '8b727754-a7db-48a8-83e5-33976b5ce2aa';
  // try original (broken)
  let res = await supabase
    .from('rides')
    .select(`*,rider:profiles!rides_rider_id_fkey(full_name,phone)`)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('original attempt', res.error);

  // attempt join via auth.users first then nested profile
  res = await supabase
    .from('rides')
    .select(`*,
      user:auth.users!rides_rider_id_fkey(id,
        profile:profiles!profiles_user_id_fkey(full_name,phone)
      )
    `)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('nested user->profile attempt', res.error);
  console.log('example row', res.data && res.data[0]);

  const { data: fkData, error: fkError } = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name,table_name')
    .eq('table_name','rides')
    .eq('constraint_type','FOREIGN KEY');

  console.log('foreign keys for rides', fkData, 'fkError', fkError);

  // test new two-step fetch & enrich
  const driverId = '8b727754-a7db-48a8-83e5-33976b5ce2aa';
  const { data: rides, error: ridesErr } = await supabase
    .from('rides')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('two-step rides error', ridesErr);
  console.log('sample rides', rides);
  const riderIdsArr = Array.from(new Set((rides || []).map(r => r.rider_id).filter(Boolean)));
  if (riderIdsArr.length) {
    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('user_id,full_name,phone')
      .in('user_id', riderIdsArr);
    console.log('profiles fetch', profErr, profs);
  }

  // also inspect constraint names
  const { data: constraints } = await supabase.rpc('sql', {
    sql: `
      select conname
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      join pg_namespace n on t.relnamespace = n.oid
      where t.relname = 'rides' and contype = 'f';
    `,
  });
  console.log('rides foreign keys', constraints);
}

run().catch(console.error);
