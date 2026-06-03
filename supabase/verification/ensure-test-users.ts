import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env file manually to keep it dependency-free
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://wgolkcztdrwdphwjvqxt.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY is not defined in .env file!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🚀 Ensuring test users in hosted Supabase database...");

  const driverPhone = "+9647800000000";
  const riderPhone = "+9647700000000";
  const password = "password123";

  // 1. Create or get Rider
  let riderUserId = "";
  const { data: riderSearch, error: riderSearchErr } = await supabase.from("profiles").select("user_id").eq("phone", riderPhone).maybeSingle();
  if (riderSearchErr) {
    console.error("Error searching rider profile:", riderSearchErr);
  }

  if (riderSearch?.user_id) {
    console.log(`✅ Rider exists with user_id: ${riderSearch.user_id}`);
    riderUserId = riderSearch.user_id;
  } else {
    console.log("➕ Creating new Rider auth user...");
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      phone: riderPhone,
      password: password,
      phone_confirm: true,
      user_metadata: { full_name: "Test Rider" }
    });

    if (createErr || !created.user) {
      console.error("Error creating rider auth user:", createErr);
    } else {
      riderUserId = created.user.id;
      console.log(`✅ Rider auth user created: ${riderUserId}`);

      // Upsert profile
      const { error: profErr } = await supabase.from("profiles").upsert({
        user_id: riderUserId,
        full_name: "Test Rider",
        phone: riderPhone,
        wallet_balance: 10000
      }, { onConflict: "user_id" });
      if (profErr) console.error("Error upserting rider profile:", profErr);
    }
  }

  // 2. Create or get Driver
  let driverUserId = "";
  const { data: driverSearch, error: driverSearchErr } = await supabase.from("profiles").select("user_id").eq("phone", driverPhone).maybeSingle();
  if (driverSearchErr) {
    console.error("Error searching driver profile:", driverSearchErr);
  }

  if (driverSearch?.user_id) {
    console.log(`✅ Driver exists with user_id: ${driverSearch.user_id}`);
    driverUserId = driverSearch.user_id;
  } else {
    console.log("➕ Creating new Driver auth user...");
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      phone: driverPhone,
      password: password,
      phone_confirm: true,
      user_metadata: { full_name: "Test Captain" }
    });

    if (createErr || !created.user) {
      console.error("Error creating driver auth user:", createErr);
    } else {
      driverUserId = created.user.id;
      console.log(`✅ Driver auth user created: ${driverUserId}`);

      // Upsert profile
      const { error: profErr } = await supabase.from("profiles").upsert({
        user_id: driverUserId,
        full_name: "Test Captain",
        phone: driverPhone,
        wallet_balance: 0
      }, { onConflict: "user_id" });
      if (profErr) console.error("Error upserting driver profile:", profErr);
    }
  }

  if (driverUserId) {
    // Upsert driver profile
    console.log("➕ Ensuring driver record exists and is approved...");
    const { data: driverRow, error: drvErr } = await supabase.from("drivers").upsert({
      user_id: driverUserId,
      full_name: "Test Captain",
      phone: driverPhone,
      status: "approved"
    }, { onConflict: "user_id" }).select("id").maybeSingle();

    if (drvErr) {
      console.error("Error upserting driver:", drvErr);
    } else {
      console.log("✅ Driver record upserted and approved:", driverRow);
      const driverId = driverRow?.id;

      if (driverId) {
        // Ensure wallet
        const { error: walErr } = await supabase.from("driver_wallets").upsert({
          driver_id: driverId,
          balance: 50000
        }, { onConflict: "driver_id" });
        if (walErr) console.error("Error upserting driver wallet:", walErr);
        else console.log("✅ Driver wallet ensured with 50,000 IQD balance");
      }
    }
  }

  console.log("🎉 Test accounts setup complete.");
}

main().catch(err => {
  console.error("Fatal error:", err);
});
