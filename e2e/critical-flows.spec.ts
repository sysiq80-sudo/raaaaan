import { test, expect } from "@playwright/test";

/**
 * مسارات حرجة للإنتاج: مصادقة، توجيه، عدم كسر التطبيق بدون جلسة.
 * (لا تتطلب خادماً حقيقياً — تستخدم placeholder env في CI)
 */
test.describe("Critical app flows", () => {
  test("auth page loads without throwing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/auth");
    await expect(
      page.locator("input[type='email'], input[type='tel']"),
    ).toBeVisible({ timeout: 15_000 });

    const critical = errors.filter(
      (e) =>
        !e.includes("net::") &&
        !e.includes("mapbox") &&
        !e.includes("google") &&
        !e.includes("Failed to fetch"),
    );
    expect(critical).toHaveLength(0);
  });

  test("rider go page or redirect stays within app", async ({ page }) => {
    await page.goto("/rider/go");
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toMatch(/localhost:8080/);
  });

  test("static terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  });
});
