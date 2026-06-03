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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const phone = "+9647800000000";
  console.log("Querying profile...");
  const { data: profile } = await supabase.from("profiles").select("*").eq("phone", phone).maybeSingle();
  console.log("Profile:", profile);

  if (profile) {
    console.log("Querying driver...");
    const { data: driver } = await supabase.from("drivers").select("*").eq("user_id", profile.user_id).maybeSingle();
    console.log("Driver:", driver);
  }
}

main();
