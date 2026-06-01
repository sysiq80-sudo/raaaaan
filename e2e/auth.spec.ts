import { expect, test } from '@playwright/test';

/**
 * ران — اختبارات الصفحات الأساسية (Auth)
 * 
 * تتحقق من تحميل صفحات التسجيل والتسجيل بدون أخطاء
 * وتضمن وجود عناصر الواجهة الأساسية
 */

const hasRuntimeEnv = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

test.describe('صفحة تسجيل الدخول — Auth', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required');

  test('تحميل صفحة المصادقة بدون أخطاء', async ({ page }) => {
    await page.goto('/auth');
    
    // لا توجد أخطاء في الكونسول
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    
    // انتظار تحميل الصفحة
    await page.waitForLoadState('networkidle');
    
    // الصفحة يجب أن تعرض محتوى
    await expect(page.locator('body')).toBeVisible();
    
    // لا أخطاء JavaScript حرجة
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('عرض حقل رقم الهاتف في صفحة الراكب', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // يجب وجود حقل إدخال (رقم هاتف أو بريد)
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('عرض زر تسجيل الدخول', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // يجب وجود زر submit
    const buttons = page.locator('button[type="submit"], button:has-text("دخول"), button:has-text("تسجيل"), button:has-text("إرسال")');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('صفحة تسجيل دخول السائق — Driver Auth', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required');

  test('تحميل صفحة تسجيل دخول السائق', async ({ page }) => {
    await page.goto('/driver/auth');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    
    // يجب وجود حقول البريد وكلمة المرور
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test('عدم السماح بتسجيل دخول فارغ', async ({ page }) => {
    await page.goto('/driver/auth');
    await page.waitForLoadState('networkidle');
    
    // اضغط زر الدخول مباشرة بدون إدخال بيانات
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      
      // يجب ألا يتم التنقل بعيداً عن الصفحة
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/driver/auth');
    }
  });
});

test.describe('صفحة تسجيل دخول الأدمن — Admin Login', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required');

  test('تحميل صفحة تسجيل دخول الأدمن', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    
    // يجب وجود حقل كلمة المرور
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput.first()).toBeVisible({ timeout: 10_000 });
  });

  test('رفض بيانات خاطئة', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // إدخال بيانات خاطئة
    const emailInput = page.locator('input[type="email"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill('fake@fake.com');
      await passwordInput.fill('wrongpassword123');
      
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();
      
      // يجب البقاء في صفحة الدخول
      await page.waitForTimeout(2000);
      expect(page.url()).toContain('/admin');
    }
  });
});
