import { test, expect } from '@playwright/test';

test.describe('Hospital Dashboard Modules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@sahyadrihospitalpune.in');
    await page.getByLabel(/password/i).fill('Sahyadri@123');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('Dashboard overview shows KPI cards and bento grid', async ({ page }) => {
    await expect(page.getByText(/OPD Queue Today/i)).toBeVisible();
    await expect(page.getByText(/IPD Ward Occupancy/i)).toBeVisible();
    await expect(page.getByText(/Collected Revenue/i)).toBeVisible();
    await expect(page.getByText(/MedWiki Drug Catalog/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+2 navigates to OPD Queue', async ({ page }) => {
    await page.keyboard.press('Alt+2');
    await expect(page.getByText(/Live OPD Token Queue/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+3 navigates to Smart Rx Pad', async ({ page }) => {
    await page.keyboard.press('Alt+3');
    await expect(page.getByText(/Smart OPD Prescription Pad/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+4 navigates to IPD Ward Board', async ({ page }) => {
    await page.keyboard.press('Alt+4');
    await expect(page.getByText(/In-Patient Department/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+5 navigates to Patients directory', async ({ page }) => {
    await page.keyboard.press('Alt+5');
    await expect(page.getByText(/Patients \(UHID\)/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+6 navigates to Medicine Formulary', async ({ page }) => {
    await page.keyboard.press('Alt+6');
    await expect(page.getByText(/Global MedWiki Formulary/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+7 navigates to Lab & Billing', async ({ page }) => {
    await page.keyboard.press('Alt+7');
    await expect(page.getByText(/Unified OPD & IPD Invoices/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+8 navigates to Refer & Earn', async ({ page }) => {
    await page.keyboard.press('Alt+8');
    await expect(page.getByText(/Refer & Earn/i)).toBeVisible();
  });

  test('Keyboard shortcut Alt+9 navigates to Hospital Settings', async ({ page }) => {
    await page.keyboard.press('Alt+9');
    await expect(page.getByText(/White-Label Letterhead/i)).toBeVisible();
  });

  test('Command palette opens with ⌘K / Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Meta+K');
    await expect(page.getByPlaceholder(/Type a module|Quick Jump/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Keyboard shortcuts help opens with ?', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText(/Workspace Keyboard Shortcuts/i)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Sidebar collapses with [ key', async ({ page }) => {
    await page.keyboard.press('[');
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/w-20/);
    await page.keyboard.press('[');
    await expect(sidebar).toHaveClass(/w-64/);
  });

  test('Focus mode toggles with ⌘F / Ctrl+F', async ({ page }) => {
    await page.keyboard.press('Meta+F');
    await expect(page.locator('aside')).toHaveClass(/w-16/);
    await page.keyboard.press('Meta+F');
  });

  test('OPD Queue shows tokens with status filters', async ({ page }) => {
    await page.keyboard.press('Alt+2');
    await expect(page.getByText(/Token #/i)).toBeVisible();
    await page.getByRole('button', { name: /Waiting/i }).click();
  });

  test('Smart Rx Pad allows adding medicine from MedWiki search', async ({ page }) => {
    await page.keyboard.press('Alt+3');
    await page.getByPlaceholder(/Search MedWiki/i).fill('Dolo');
    await page.getByText(/Dolo/i).first().click();
    await expect(page.getByText(/Dolo/i)).toBeVisible();
  });

  test('IPD Ward Board shows beds with occupancy status', async ({ page }) => {
    await page.keyboard.press('Alt+4');
    await expect(page.getByText(/Total Hospital Beds/i)).toBeVisible();
    await expect(page.getByText(/Available Free Beds/i)).toBeVisible();
  });

  test('Patient directory shows UHID table with filters', async ({ page }) => {
    await page.keyboard.press('Alt+5');
    await expect(page.getByText(/UHID/i)).toBeVisible();
    await expect(page.getByText(/Patient Details/i)).toBeVisible();
  });

  test('Refer & Earn tab shows affiliate dashboard', async ({ page }) => {
    await page.keyboard.press('Alt+8');
    await expect(page.getByText(/Refer & Earn/i)).toBeVisible();
  });
});
