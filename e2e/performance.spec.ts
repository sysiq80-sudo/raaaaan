import { test, expect } from "@playwright/test";

test.describe("الأداء — Performance", () => {
  test("صفحة الدخول تحمّل بأقل من 5 ثوانٍ", async ({ page }) => {
    const start = Date.now();
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test("حجم bundle لا يتجاوز الحد المعقول", async ({ page }) => {
    const resources: number[] = [];
    page.on("response", (res) => {
      const ct = res.headers()["content-type"] || "";
      if (ct.includes("javascript")) {
        const cl = Number(res.headers()["content-length"] || 0);
        if (cl > 0) resources.push(cl);
      }
    });

    await page.goto("/auth", { waitUntil: "networkidle" });

    const totalJs = resources.reduce((a, b) => a + b, 0);
    // أقل من 5 ميجا (gzipped عادة أقل بكثير)
    expect(totalJs).toBeLessThan(5 * 1024 * 1024);
  });

  test("لا يوجد تسريب console.error مفرط", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/auth");
    await page.waitForTimeout(5000);

    // السماح ببعض أخطاء الشبكة (Supabase, Maps) لكن ليس أكثر من 10
    expect(errors.length).toBeLessThan(10);
  });
});

test.describe("RTL — دعم اليمين لليسار", () => {
  test("الصفحة تستخدم RTL direction", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForTimeout(2000);
    const dir = await page.locator("html").getAttribute("dir");
    const bodyDir = await page.locator("body").getAttribute("dir");
    // إما html أو body يحتوي RTL
    const isRtl = dir === "rtl" || bodyDir === "rtl";
    // أو CSS direction
    if (!isRtl) {
      const cssDir = await page.locator("body").evaluate(
        (el) => window.getComputedStyle(el).direction,
      );
      expect(cssDir).toBe("rtl");
    }
  });
});
