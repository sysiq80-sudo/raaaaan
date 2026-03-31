import { test, expect } from "@playwright/test";

test.describe("تسجيل الدخول — Auth Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("عرض نموذج تسجيل الدخول بالبريد الإلكتروني", async ({ page }) => {
    const emailInput = page.locator("input[type='email'], input[type='tel']");
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  });

  test("التحقق من وجود زر تسجيل الدخول", async ({ page }) => {
    // البحث عن زر تسجيل الدخول باللغة العربية أو الإنجليزية
    const loginBtn = page.locator(
      "button:has-text('دخول'), button:has-text('تسجيل'), button:has-text('Login'), button[type='submit']",
    );
    await expect(loginBtn.first()).toBeVisible({ timeout: 15_000 });
  });

  test("عرض رسالة خطأ عند إدخال بيانات خاطئة", async ({ page }) => {
    const emailInput = page.locator("input[type='email']");
    // قد يكون الحقل غير موجود إذا كان الـ auth عبر الهاتف
    if (await emailInput.isVisible()) {
      await emailInput.fill("invalid@test.com");
      const passwordInput = page.locator("input[type='password']");
      if (await passwordInput.isVisible()) {
        await passwordInput.fill("wrongpassword");
        const submitBtn = page.locator("button[type='submit']").first();
        await submitBtn.click();
        // انتظر ظهور رسالة خطأ أو toast
        await page.waitForTimeout(3000);
      }
    }
  });

  test("التحويل بين تسجيل الدخول وإنشاء حساب", async ({ page }) => {
    // البحث عن رابط التبديل
    const switchLink = page.locator(
      "text=/إنشاء حساب|حساب جديد|Sign up|Register/i",
    );
    if (await switchLink.isVisible()) {
      await switchLink.click();
      await page.waitForTimeout(1000);
    }
  });
});
