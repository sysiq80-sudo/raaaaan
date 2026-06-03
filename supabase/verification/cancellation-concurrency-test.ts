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

async function runTest() {
  console.log("🚀 Starting Concurrency & Safety test for Cancellation Penalties...");

  // 1. Get test users
  const { data: riderProfile, error: rErr } = await supabase
    .from("profiles")
    .select("user_id, wallet_balance")
    .eq("phone", "+9647700000000")
    .maybeSingle();

  const { data: driverProfile, error: dErr } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("phone", "+9647800000000")
    .maybeSingle();

  if (!riderProfile || !driverProfile) {
    console.error("❌ Test users not found. Run ensure-test-users.ts first!");
    return;
  }

  const { data: driverRow } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", driverProfile.user_id)
    .maybeSingle();

  const riderId = riderProfile.user_id;
  const driverId = driverRow?.id;

  if (!driverId) {
    console.error("❌ Driver record not found in drivers table.");
    return;
  }

  console.log(`👤 Test Rider ID: ${riderId}`);
  console.log(`🚕 Test Driver ID: ${driverId}`);

  // 2. Reset rider balance to 10,000 IQD and clear old test transaction conflicts
  console.log("🔄 Resetting rider profile balance to 10,000 IQD...");
  await supabase.from("profiles").update({ wallet_balance: 10000 }).eq("user_id", riderId);

  // 3. Create a test ride in 'accepted' status
  console.log("➕ Creating a dummy accepted ride...");
  const { data: ride, error: rideErr } = await supabase
    .from("rides")
    .insert({
      rider_id: riderId,
      driver_id: driverId,
      status: "accepted",
      pickup_location: { lat: 33.3128, lng: 44.3615 },
      dropoff_location: { lat: 33.3150, lng: 44.3650 },
      pickup_address: "Baghdad Airport",
      dropoff_address: "Mansour",
      estimated_fare: 5000,
      cancellation_fee: 0,
      cancellation_fee_paid: false,
      matched_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (rideErr || !ride) {
    console.error("❌ Error creating test ride:", rideErr);
    return;
  }

  const rideId = ride.id;
  console.log(`✅ Created Ride ID: ${rideId}`);

  // Ensure cancellation setting is enabled for testing
  console.log("⚙️ Ensuring cancellation_fee is enabled in settings...");
  await supabase
    .from("app_settings")
    .upsert({
      key: "cancellation_fee",
      value: { enabled: true, amount: 2000 },
      description: "Cancellation penalty setting"
    }, { onConflict: "key" });

  // 4. Trigger concurrent cancellation calls
  console.log("⚡ Executing concurrent cancellation calls (RPC + Direct Update) in parallel...");

  const rpcCall = supabase.rpc("cancel_ride_by_rider", {
    p_ride_id: rideId,
    p_rider_user_id: riderId,
    p_reason: "Cancelled by rider concurrent RPC call"
  });

  const directUpdateCall = supabase
    .from("rides")
    .update({
      status: "cancelled",
      cancelled_by: "rider",
      cancellation_reason: "Cancelled by rider concurrent Update call"
    })
    .eq("id", rideId);

  // Run both calls in parallel to trigger a race condition
  const [rpcResult, directUpdateResult] = await Promise.all([rpcCall, directUpdateCall]);

  console.log("📥 RPC Response:", rpcResult.data || rpcResult.error);
  console.log("📥 Direct Update Response Status:", directUpdateResult.status, directUpdateResult.error);

  // 5. Query results to verify integrity
  console.log("🔍 Fetching results for database integrity audit...");

  const { data: updatedRide } = await supabase
    .from("rides")
    .select("status, cancellation_fee, cancellation_fee_paid")
    .eq("id", rideId)
    .single();

  const { data: finalRiderProfile } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("user_id", riderId)
    .single();

  const { data: riderTxs } = await supabase
    .from("rider_wallet_transactions")
    .select("*")
    .eq("ride_id", rideId);

  const { data: driverTxs } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("ride_id", rideId);

  console.log("\n==================== VERIFICATION AUDIT ====================");
  console.log(`Ride status: ${updatedRide?.status}`);
  console.log(`Ride cancellation fee: ${updatedRide?.cancellation_fee} IQD`);
  console.log(`Ride cancellation fee paid: ${updatedRide?.cancellation_fee_paid}`);
  console.log(`Initial Rider Wallet: 10,000 IQD`);
  console.log(`Final Rider Wallet: ${finalRiderProfile?.wallet_balance} IQD`);
  console.log(`Rider Wallet Debit Count: ${riderTxs?.length || 0}`);
  if (riderTxs && riderTxs.length > 0) {
    riderTxs.forEach((tx, idx) => {
      console.log(`   Rider Tx #${idx + 1}: Amount: ${tx.amount} IQD, Type: ${tx.type}, Desc: ${tx.description}`);
    });
  }
  console.log(`Driver Wallet Credit Count: ${driverTxs?.length || 0}`);
  if (driverTxs && driverTxs.length > 0) {
    driverTxs.forEach((tx, idx) => {
      console.log(`   Driver Tx #${idx + 1}: Amount: ${tx.amount} IQD, Type: ${tx.transaction_type}, Desc: ${tx.description}`);
    });
  }
  console.log("============================================================\n");

  // 6. Assertions
  let success = true;

  if (finalRiderProfile && finalRiderProfile.wallet_balance !== 8000) {
    console.error("❌ FAILURE: Rider was not charged exactly once (expected balance: 8000 IQD).");
    success = false;
  }

  if (riderTxs && riderTxs.length !== 1) {
    console.error(`❌ FAILURE: Expected exactly 1 rider wallet transaction, found ${riderTxs.length}.`);
    success = false;
  }

  if (driverTxs && driverTxs.length !== 1) {
    console.error(`❌ FAILURE: Expected exactly 1 driver wallet compensation transaction, found ${driverTxs.length}.`);
    success = false;
  }

  if (success) {
    console.log("🎉 Phase 1 Passed: Double-deduction prevented and driver compensation remains idempotent!");
  } else {
    console.log("❌ Phase 1 FAILED.");
  }

  // ==========================================
  // PHASE 2: Insufficient Balance Verification
  // ==========================================
  console.log("\n🧪 Starting Phase 2: Insufficient Balance Verification (Rider Balance: 500 IQD)...");
  
  // 1. Reset rider balance to 500 IQD (less than the 2000 IQD penalty)
  await supabase.from("profiles").update({ wallet_balance: 500 }).eq("user_id", riderId);
  
  // 2. Create another dummy accepted ride
  const { data: ride2, error: rideErr2 } = await supabase
    .from("rides")
    .insert({
      rider_id: riderId,
      driver_id: driverId,
      status: "accepted",
      pickup_location: { lat: 33.3128, lng: 44.3615 },
      dropoff_location: { lat: 33.3150, lng: 44.3650 },
      pickup_address: "Baghdad Airport",
      dropoff_address: "Mansour",
      estimated_fare: 5000,
      cancellation_fee: 0,
      cancellation_fee_paid: false,
      matched_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (rideErr2 || !ride2) {
    console.error("❌ Error creating Phase 2 test ride:", rideErr2);
    return;
  }

  const rideId2 = ride2.id;
  console.log(`✅ Phase 2 Ride ID: ${rideId2}`);

  // 3. Call cancel RPC (since rider has 500 IQD, it should cancel but NOT deduct and NOT pay penalty)
  const rpcResult2 = await supabase.rpc("cancel_ride_by_rider", {
    p_ride_id: rideId2,
    p_rider_user_id: riderId,
    p_reason: "Cancelled by rider Phase 2 RPC call"
  });

  console.log("📥 Phase 2 RPC Response:", rpcResult2.data || rpcResult2.error);

  // 4. Verify Phase 2 results
  const { data: updatedRide2 } = await supabase
    .from("rides")
    .select("status, cancellation_fee, cancellation_fee_paid")
    .eq("id", rideId2)
    .single();

  const { data: finalRiderProfile2 } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("user_id", riderId)
    .single();

  const { data: riderTxs2 } = await supabase
    .from("rider_wallet_transactions")
    .select("*")
    .eq("ride_id", rideId2);

  const { data: driverTxs2 } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("ride_id", rideId2);

  console.log("\n==================== PHASE 2 AUDIT ====================");
  console.log(`Ride status: ${updatedRide2?.status}`);
  console.log(`Ride cancellation fee: ${updatedRide2?.cancellation_fee} IQD`);
  console.log(`Ride cancellation fee paid: ${updatedRide2?.cancellation_fee_paid}`);
  console.log(`Initial Rider Wallet (Phase 2): 500 IQD`);
  console.log(`Final Rider Wallet (Phase 2): ${finalRiderProfile2?.wallet_balance} IQD`);
  console.log(`Rider Wallet Debit Count (Phase 2): ${riderTxs2?.length || 0}`);
  console.log(`Driver Wallet Credit Count (Phase 2): ${driverTxs2?.length || 0}`);
  console.log("========================================================\n");

  let p2Success = true;

  if (finalRiderProfile2 && finalRiderProfile2.wallet_balance !== 500) {
    console.error("❌ FAILURE: Rider balance was modified (expected: 500 IQD, actual negative/modified balance!).");
    p2Success = false;
  }

  if (updatedRide2?.cancellation_fee_paid !== false) {
    console.error(`❌ FAILURE: Expected cancellation_fee_paid to be false, got ${updatedRide2?.cancellation_fee_paid}`);
    p2Success = false;
  }

  if (riderTxs2 && riderTxs2.length !== 0) {
    console.error(`❌ FAILURE: Expected 0 rider transactions, found ${riderTxs2.length}`);
    p2Success = false;
  }

  if (driverTxs2 && driverTxs2.length !== 0) {
    console.error(`❌ FAILURE: Expected 0 driver transactions, found ${driverTxs2.length}`);
    p2Success = false;
  }

  if (success && p2Success) {
    console.log("🎉 SUCCESS: All database integrity checks and insufficient balance checks passed successfully!");
  } else {
    console.log("❌ TEST FAILED: Financial drift or insufficient balance logic check failed.");
  }
}

runTest().catch((err) => console.error("Unhandled error:", err));
