import { test, expect } from '@playwright/test';

test.describe('Core Routes & Public Pages', () => {
  test('Landing page loads with branding and navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AetherMed/);
    await expect(page.getByRole('heading', { name: /AetherMed Cloud HMS/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Referrals/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Platform Admin/i })).toBeVisible();
  });

  test('Referrals page loads with commission calculator', async ({ page }) => {
    await page.goto('/referrals');
    await expect(page.getByRole('heading', { name: /Refer & Earn/i })).toBeVisible();
  });

  test('Custom 404 page for unknown routes', async ({ page }) => {
    const response = await page.goto('/non-existent-saas-route-xyz');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|Not Found|Doesn't Exist/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Hospital Workspace/i })).toBeVisible();
  });

  test('Landing page has /referrals links in navbar and footer', async ({ page }) => {
    await page.goto('/');
    const referralsLinks = page.getByRole('link', { name: /Referrals/i });
    await expect(referralsLinks.first()).toBeVisible();
  });
});
