import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const RIDER_USER_ID = process.env.E2E_RIDER_USER_ID;
const DRIVER_ID = process.env.E2E_DRIVER_ID;

test.describe("Rider ride-status notifications (DB trigger flow)", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY || !RIDER_USER_ID || !DRIVER_ID,
    "Set E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_RIDER_USER_ID, E2E_DRIVER_ID to run this integration flow.",
  );

  test("pending -> accepted -> arrived -> in_progress -> completed creates rider notifications", async () => {
    const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

    const marker = `e2e-status-${Date.now()}`;

    const { data: ride, error: insertError } = await supabase
      .from("rides")
      .insert({
        rider_id: RIDER_USER_ID,
        driver_id: null,
        pickup_location: { lat: 33.3152, lng: 44.3661 },
        dropoff_location: { lat: 33.3000, lng: 44.3500 },
        pickup_address: `E2E Pickup ${marker}`,
        dropoff_address: `E2E Dropoff ${marker}`,
        vehicle_type: "economy",
        status: "pending",
        estimated_fare: 5000,
        payment_method: "cash",
      })
      .select("id")
      .single();

    expect(insertError).toBeNull();
    expect(ride?.id).toBeTruthy();
    const rideId = ride!.id as string;

    const waitForRiderNotification = async (type: string) => {
      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        const { data } = await supabase
          .from("rider_notifications")
          .select("id, type, data, created_at")
          .eq("user_id", RIDER_USER_ID)
          .eq("type", type)
          .contains("data", { ride_id: rideId })
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) return data[0];
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return null;
    };

    const updateStatus = async (status: string, patch: Record<string, unknown> = {}) => {
      const { error } = await supabase
        .from("rides")
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...patch,
        })
        .eq("id", rideId);
      expect(error).toBeNull();
    };

    await updateStatus("accepted", { driver_id: DRIVER_ID });
    await expect.poll(async () => !!(await waitForRiderNotification("ride_accepted")), {
      timeout: 25000,
      intervals: [1000],
    }).toBeTruthy();

    await updateStatus("arrived");
    await expect.poll(async () => !!(await waitForRiderNotification("driver_arrived")), {
      timeout: 25000,
      intervals: [1000],
    }).toBeTruthy();

    await updateStatus("in_progress");
    await expect.poll(async () => !!(await waitForRiderNotification("ride_started")), {
      timeout: 25000,
      intervals: [1000],
    }).toBeTruthy();

    await updateStatus("completed", {
      completed_at: new Date().toISOString(),
      final_fare: 5200,
    });
    await expect.poll(async () => !!(await waitForRiderNotification("ride_completed")), {
      timeout: 25000,
      intervals: [1000],
    }).toBeTruthy();

    await supabase.from("rides").delete().eq("id", rideId);
  });
});
