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

// Service client to assign roles
const serviceSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const riderUserId = "88a5da11-f728-47f3-9bbe-bf31e736df35";
  const driverId = "6e25a8a9-2ca8-4ae8-bc27-c6aa8e15a578";

  console.log("1. Assigning admin role to rider in user_roles...");
  const { error: roleErr } = await serviceSupabase
    .from("user_roles")
    .upsert({ user_id: riderUserId, role: "admin" }, { onConflict: "user_id,role" });

  if (roleErr) {
    console.error("Failed to assign role:", roleErr);
    return;
  }
  console.log("✅ Admin role upserted.");

  console.log("2. Signing in as rider (+9647700000000) to get an authenticated session...");
  const userSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  const { data: authData, error: authErr } = await userSupabase.auth.signInWithPassword({
    phone: "+9647700000000",
    password: "password123",
  });

  if (authErr || !authData.session) {
    console.error("Failed to sign in:", authErr);
    return;
  }
  console.log("✅ Signed in. User ID:", authData.user.id);

  console.log("3. Updating driver status to 'approved' using the authenticated session...");
  const { data: updateData, error: updateErr } = await userSupabase
    .from("drivers")
    .update({ status: "approved" })
    .eq("id", driverId)
    .select("*");

  if (updateErr) {
    console.error("❌ Update failed:", updateErr);
  } else {
    console.log("✅ Update response status:", updateData?.[0]?.status);
  }

  console.log("4. Cleaning up admin role from user_roles...");
  const { error: delErr } = await serviceSupabase
    .from("user_roles")
    .delete()
    .eq("user_id", riderUserId)
    .eq("role", "admin");

  if (delErr) {
    console.error("Failed to clean up role:", delErr);
  } else {
    console.log("✅ Role cleaned up.");
  }
}

main().catch(console.error);
