// سكريبت تنظيف قاعدة البيانات
// تشغيل: npx tsx supabase/cleanup.ts

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wgolkcztdrwdphwjvqxt.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ يجب تعيين SUPABASE_SERVICE_ROLE_KEY");
  console.log('استخدم: $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupDatabase() {
  console.log("🧹 بدء تنظيف قاعدة البيانات...\n");

  const tables = [
    // المرحلة 1: الجداول المعتمدة على الرحلات
    "ride_ratings",
    "ride_messages",
    "driver_wallet_transactions",
    "wallet_transactions",
    "scheduled_rides",

    // المرحلة 2: الرحلات والبيانات المرتبطة
    "rides",
    "driver_location_history",
    "driver_challenges",
    "driver_offers",

    // المرحلة 3: السائقين
    "fake_drivers",
    "drivers",

    // المرحلة 4: المستخدمين
    "saved_places",
    "profiles",

    // المرحلة 5: التنظيف
    "admin_notifications",
    "api_usage_logs",
    "ip_rate_limits",
    "blocked_phones",
  ];

  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // حذف كل شيء

      if (error) {
        console.log(`⚠️ ${table}: ${error.message}`);
      } else {
        console.log(`✅ تم حذف ${table}`);
      }
    } catch (err) {
      console.log(`❌ خطأ في ${table}:`, err);
    }
  }

  console.log("\n✅ اكتمل التنظيف!");
}

cleanupDatabase();
