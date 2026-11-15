import { test, expect } from '@playwright/test';

const TENANT_ADMIN = { email: 'admin@sahyadrihospitalpune.in', password: 'Sahyadri@123' };
const DOCTOR = { email: 'ananya.kulkarni@sahyadrihospitalpune.in', password: 'Doctor@123' };
const POLYCLINIC = { email: 'admin@arogyacarekharadi.in', password: 'Arogya@123' };
const PLATFORM_ADMIN = { email: 'aetherdevsolutions@gmail.com', password: 'Admin@123' };

test.describe('Authentication & Multi-Tenant Login', () => {
  test('Tenant admin can login and access dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TENANT_ADMIN.email);
    await page.getByLabel(/password/i).fill(TENANT_ADMIN.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Sahyadri Multispecialty Hospital', { exact: true })).toBeVisible();
  });

  test('Doctor can login and access dashboard with role-appropriate modules', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(DOCTOR.email);
    await page.getByLabel(/password/i).fill(DOCTOR.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL('/dashboard');
    // Doctor should see role badge
    await expect(page.locator('aside').getByText('Consulting Doctor', { exact: true })).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: /Hospital Settings/ })).toHaveCount(0);
    await expect(page.getByText('Temporary Workspace Glitch')).toHaveCount(0);
  });

  test('Polyclinic tenant can login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(POLYCLINIC.email);
    await page.getByLabel(/password/i).fill(POLYCLINIC.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('Platform admin can login and access platform admin console', async ({ page }) => {
    await page.goto('/platform-admin');
    await page.getByLabel(/email/i).fill(PLATFORM_ADMIN.email);
    await page.getByLabel(/password/i).fill(PLATFORM_ADMIN.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL('/platform-admin');
  });

  test('Invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page.getByText(/invalid|error/i)).toBeVisible();
  });
});
