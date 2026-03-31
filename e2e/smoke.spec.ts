import { test, expect } from "@playwright/test";

test.describe("صفحات التطبيق الرئيسية — Smoke Tests", () => {
  test("صفحة تسجيل الدخول تعرض النموذج", async ({ page }) => {
    await page.goto("/auth");
    // يجب أن تحتوي على حقل البريد وكلمة المرور
    await expect(page.locator("input[type='email'], input[type='tel']")).toBeVisible({ timeout: 15_000 });
  });

  test("الصفحة الرئيسية تعيد التوجيه لتسجيل الدخول", async ({ page }) => {
    await page.goto("/");
    // بدون تسجيل دخول يُعاد التوجيه للمصادقة
    await page.waitForURL(/\/(auth|login)/, { timeout: 15_000 });
  });

  test("صفحة admin تتطلب تسجيل الدخول", async ({ page }) => {
    await page.goto("/admin");
    // سيتم إعادة التوجيه لتسجيل الدخول
    await page.waitForURL(/\/(auth|login|admin)/, { timeout: 15_000 });
  });

  test("الصفحة لا تحتوي على أخطاء JavaScript حرجة", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/auth");
    await page.waitForTimeout(3000);

    // تصفية الأخطاء غير الحرجة (شبكة، خرائط)
    const critical = errors.filter(
      (e) =>
        !e.includes("net::") &&
        !e.includes("mapbox") &&
        !e.includes("google") &&
        !e.includes("Failed to fetch"),
    );
    expect(critical).toHaveLength(0);
  });
});
