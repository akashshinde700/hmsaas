import { test, expect } from '@playwright/test';

test.describe('Platform Super-Admin Console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/platform-admin');
    await page.getByLabel(/email/i).fill('aetherdevsolutions@gmail.com');
    await page.getByLabel(/password/i).fill('Admin@123');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL('/platform-admin');
  });

  test('Platform admin dashboard shows organizations', async ({ page }) => {
    await expect(page.getByText(/Organizations/i)).toBeVisible();
    await expect(page.getByText(/Sahyadri/i)).toBeVisible();
  });

  test('Platform admin shows plans with pricing', async ({ page }) => {
    await page.getByText(/Plans|SaaS Plans/i).click();
    await expect(page.getByText(/Basic|Advance|Enterprise/i)).toBeVisible();
  });

  test('Platform admin shows affiliates and referral partners', async ({ page }) => {
    await page.getByText(/Affiliates|Referrals/i).click();
    await expect(page.getByText(/AFF-MEDTECH20|HOSP-SAHYADRI20/i)).toBeVisible();
  });

  test('Platform admin shows demo inquiries', async ({ page }) => {
    await page.getByText(/Inquiries|Demo Inquiries/i).click();
    await expect(page.getByText(/clinic|inquiry/i)).toBeVisible();
  });
});
