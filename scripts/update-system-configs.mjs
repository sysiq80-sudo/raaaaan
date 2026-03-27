#!/usr/bin/env node
/**
 * ران — تحديث system_configs من متغيرات البيئة (للاستخدام بعد الترحيل)
 *
 * الاستخدام:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=eyJ... \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/update-system-configs.mjs
 *
 * أو من ملف .env (لا ترفع .env إلى المستودع):
 *   node -r dotenv/config scripts/update-system-configs.mjs
 *
 * يحدّث المفتاحين SUPABASE_URL و SUPABASE_ANON_KEY في جدول system_configs
 * (مطلوب لـ triggers التي تستدعي Edge Functions وتقرأ base URL و anon key من DB)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ المطلوب: SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (أو VITE_SUPABASE_URL مع SERVICE_ROLE)');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ المطلوب: SUPABASE_ANON_KEY أو VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const base = SUPABASE_URL.replace(/\/$/, '');
const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

async function main() {
  // تحديث كل مفتاح (الصفوف يُفترض أن تكون موجودة بعد الـ migration)
  const updates = [
    { key_name: 'SUPABASE_URL', key_value: SUPABASE_URL },
    { key_name: 'SUPABASE_ANON_KEY', key_value: SUPABASE_ANON_KEY },
  ];

  for (const { key_name, key_value } of updates) {
    const res = await fetch(`${base}/rest/v1/system_configs?key_name=eq.${encodeURIComponent(key_name)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ key_value }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ فشل تحديث ${key_name}:`, res.status, text);
      process.exit(1);
    }
  }

  console.log('✅ تم تحديث system_configs (SUPABASE_URL, SUPABASE_ANON_KEY) بنجاح');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
