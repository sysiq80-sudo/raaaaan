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
  const driverId = "6e25a8a9-2ca8-4ae8-bc27-c6aa8e15a578";
  
  console.log("Updating driver status to 'approved'...");
  const { data: updateData, error: updateErr } = await supabase
    .from("drivers")
    .update({ status: "approved" })
    .eq("id", driverId)
    .select("*");
    
  if (updateErr) {
    console.error("Update error:", updateErr);
  } else {
    console.log("Update response:", updateData);
  }
  
  console.log("Re-fetching driver...");
  const { data: refetched } = await supabase
    .from("drivers")
    .select("status")
    .eq("id", driverId)
    .maybeSingle();
    
  console.log("Driver status is now:", refetched?.status);
}

main();
