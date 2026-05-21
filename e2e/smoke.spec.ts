import { expect, test } from '@playwright/test';

const hasRuntimeEnv = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

test.describe('RAAN web shell', () => {
  test.skip(!hasRuntimeEnv, 'Supabase runtime env is required for browser smoke tests.');

  test('loads without a runtime configuration error', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Missing VITE_SUPABASE_URL');
    await expect(page.locator('body')).not.toContainText('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  });
});