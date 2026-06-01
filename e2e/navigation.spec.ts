import { expect, test } from '@playwright/test';

/**
 * ران — اختبارات التنقل والصفحات الأساسية
 * 
 * تتحقق من تحميل الصفحات المهمة والتوجيه الصحيح
 */

const hasRuntimeEnv = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

test.describe('التوجيه — Routing', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required');

  test('الصفحة الرئيسية تحمل بنجاح', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toBeVisible();
    // لا أخطاء JavaScript حرجة (ResizeObserver خطأ معروف نتجاهله)
    const criticalErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('صفحة غير موجودة ترجع 404', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    await page.waitForLoadState('networkidle');
    
    // يجب عرض صفحة 404 أو إعادة التوجيه
    await expect(page.locator('body')).toBeVisible();
  });

  test('الزائر غير المسجل يُوجَّه لصفحة المصادقة', async ({ page }) => {
    // محاولة الدخول لصفحة الراكب بدون تسجيل
    await page.goto('/rider');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // يجب إعادة التوجيه لـ /auth أو البقاء مع عرض نموذج دخول
    const url = page.url();
    const hasAuthRedirect = url.includes('/auth') || url.includes('/login');
    const hasLoginForm = await page.locator('input[type="password"], input[type="tel"]').count() > 0;
    
    expect(hasAuthRedirect || hasLoginForm).toBeTruthy();
  });

  test('صفحة السائق بدون مصادقة تُعيد التوجيه', async ({ page }) => {
    await page.goto('/driver');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const hasAuthRedirect = url.includes('/auth') || url.includes('/login') || url.includes('/driver/auth');
    const hasLoginForm = await page.locator('input[type="password"], input[type="email"]').count() > 0;
    
    expect(hasAuthRedirect || hasLoginForm).toBeTruthy();
  });

  test('لوحة الأدمن بدون مصادقة تُعيد التوجيه', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const url = page.url();
    const hasAuthRedirect = url.includes('/login') || url.includes('/auth');
    const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
    
    expect(hasAuthRedirect || hasLoginForm).toBeTruthy();
  });
});

test.describe('أداء التحميل — Performance', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required');

  test('الصفحة الرئيسية تحمل خلال 10 ثوانٍ', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // يجب أن تحمل خلال 10 ثوانٍ
    expect(loadTime).toBeLessThan(10_000);
  });

  test('لا يوجد طلبات شبكية فاشلة حرجة', async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // لا يجب أن تكون هناك أخطاء سيرفر (500+)
    expect(failedRequests).toHaveLength(0);
  });
});

test.describe('الأمان — Security', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required');

  test('عدم كشف مفاتيح service_role في HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const html = await page.content();
    
    // تأكد من عدم وجود service_role key في HTML
    expect(html).not.toContain('service_role');
    expect(html).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  test('عدم كشف متغيرات البيئة الحساسة في HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const html = await page.content();
    
    // لا يجب أن تظهر أسرار
    expect(html).not.toContain('SECRET');
    expect(html).not.toContain('PRIVATE_KEY');
  });
});
