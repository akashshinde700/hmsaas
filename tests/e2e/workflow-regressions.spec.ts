import { test, expect } from '@playwright/test';

const tenant = { email: 'admin@sahyadrihospitalpune.in', password: 'Sahyadri@123' };
const other = { email: 'admin@arogyacarekharadi.in', password: 'Arogya@123' };
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/work email/i).fill(tenant.email);
  await page.getByLabel(/password/i).fill(tenant.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Command Overview' })).toBeVisible();
}

test('register a demo patient and search the directory', async ({ page }) => {
  await login(page);
  await page.locator('aside').getByRole('button', { name: /Patients \(UHID\)/ }).click();
  await page.getByRole('button', { name: 'Register Patient (UHID)' }).click();
  const name = `Test Patient ${Date.now()}`;
  await page.getByLabel('Full Name').fill(name);
  await page.getByLabel('10-Digit Mobile').fill('9876543210');
  await page.getByLabel(/Auto-issue/).uncheck();
  const saved = page.waitForResponse(r => r.url().endsWith('/api/patients') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Generate UHID & Save/ }).click();
  expect((await saved).status()).toBe(201);
  await page.getByPlaceholder(/Debounced search by UHID/).fill(name);
  await expect(page.getByRole('cell', { name: new RegExp(name) })).toBeVisible();
  await page.locator('aside').getByRole('button', { name: /OPD Queue/ }).click();
  await page.getByRole('button', { name: 'Issue OPD Token' }).click();
  const tokenForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Generate Token' }) });
  const patientOption = tokenForm.locator('select').first().locator('option').filter({ hasText: name });
  await tokenForm.locator('select').first().selectOption((await patientOption.getAttribute('value'))!);
  const issued = page.waitForResponse(r => r.url().endsWith('/api/opd') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Generate Token' }).click();
  expect((await issued).status()).toBe(201);
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name, exact: true }) }).filter({ has: page.getByRole('button', { name: 'Vitals', exact: true }) }).last();
  await card.getByRole('button', { name: 'Vitals', exact: true }).click();
  const savedVitals = page.waitForResponse(r => r.url().endsWith('/api/opd') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save Vitals' }).click();
  expect((await savedVitals).status()).toBe(201);
  await expect(page.getByText('Triage vitals recorded!')).toBeVisible();
});

test('OPD failures are visible and keep the form open', async ({ page }) => {
  await login(page);
  await page.locator('aside').getByRole('button', { name: /OPD Queue/ }).click();
  await expect(page.getByRole('button', { name: 'Vitals', exact: true }).first()).toBeVisible();
  await page.route('**/api/opd', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated save failure' }) });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Vitals', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save Vitals' }).click();
  await expect(page.getByText('Simulated save failure')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Record Triage Vitals/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Issue OPD Token' }).click();
  await page.getByRole('button', { name: 'Generate Token' }).click();
  await expect(page.getByText('Simulated save failure').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Issue OPD Queue Token' })).toBeVisible();
});

test('OPD API rejects cross-tenant and mismatched relationships', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext();
  try {
    for (const [ctx, credentials] of [[a, tenant], [b, other]] as const) {
      const res = await ctx.request.post('/api/auth', { data: { action: 'login', ...credentials } });
      expect(res.ok()).toBeTruthy();
    }
    const dataA = await (await a.request.get('/api/patients')).json();
    const dataB = await (await b.request.get('/api/patients')).json();
    const patientA = dataA.patients[0].id, patientB = dataB.patients[0].id;
    const foreign = await a.request.post('/api/opd', { data: { action: 'recordVitals', patientId: patientB, pulse: 80 } });
    expect(foreign.status()).toBe(404);
    const fakeQueue = await a.request.post('/api/opd', { data: { action: 'recordVitals', patientId: patientA, queueId: 'not-a-matching-token', pulse: 80 } });
    expect(fakeQueue.status()).toBe(404);
    const fakeDoctor = await a.request.post('/api/opd', { data: { action: 'checkIn', patientId: patientA, doctorId: 'not-a-tenant-doctor' } });
    expect(fakeDoctor.status()).toBe(404);
    const unknown = await a.request.post('/api/opd', { data: { action: 'not-a-real-action', patientId: patientA } });
    expect(unknown.status()).toBe(400);
  } finally { await a.close(); await b.close(); }
});

test('platform admin can inspect create clinic, plan, catalog and blog forms', async ({ page }) => {
  await page.goto('/platform-admin');
  await page.getByLabel(/platform email/i).fill('aetherdevsolutions@gmail.com');
  await page.getByLabel(/password/i).fill('Admin@123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('button', { name: 'Create clinic' }).click();
  await expect(page.getByRole('heading', { name: /Provision New Hospital/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByText('Plan Name', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: /^MedWiki DB/ }).click();
  await page.getByRole('button', { name: 'Add Global Medicine' }).click();
  await expect(page.getByRole('heading', { name: /Add Formulation/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Blog', exact: true }).click();
  await page.getByRole('button', { name: 'New Article' }).click();
  await expect(page.getByRole('textbox', { name: 'Article Title' })).toBeVisible();
});

test('settings writes require an active administrator and staff roles are normalized', async ({ browser }) => {
  const admin = await browser.newContext();
  const doctor = await browser.newContext();
  const staff = await browser.newContext();
  try {
    expect((await admin.request.post('/api/auth', { data: { action: 'login', ...tenant } })).ok()).toBeTruthy();
    expect((await doctor.request.post('/api/auth', { data: { action: 'login', email: 'ananya.kulkarni@sahyadrihospitalpune.in', password: 'Doctor@123' } })).ok()).toBeTruthy();
    const forbidden = await doctor.request.post('/api/settings', { data: { action: 'addStaff', name: 'Forbidden', email: 'forbidden@example.test', role: 'ADMIN' } });
    expect(forbidden.status()).toBe(403);
    const invalid = await admin.request.post('/api/settings', { data: { action: 'addStaff', name: 'Invalid', email: 'invalid@example.test', role: 'super_admin' } });
    expect(invalid.status()).toBe(400);
    const email = `test-doctor-${Date.now()}@example.test`;
    const response = await admin.request.post('/api/settings', { data: { action: 'addStaff', name: 'Demo Doctor', email, role: 'DOCTOR', password: 'DemoTestPassword123', portalAccessEnabled: true } });
    expect(response.status()).toBe(201);
    const result = await response.json();
    expect(result.user.role).toBe('doctor');
    expect(result.user.portalAccessEnabled).toBe(true);
    expect(result.user.password).toBeUndefined();
    expect(result.user.generatedPasswordEnc).toBeUndefined();
    const signedIn = await staff.request.post('/api/auth', { data: { action: 'login', email, password: 'DemoTestPassword123' } });
    expect((await signedIn.json()).user.role).toBe('doctor');
  } finally { await admin.close(); await doctor.close(); await staff.close(); }
});

test('a tenant super admin cannot cross into another tenant pharmacy', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const loginA = await a.request.post('/api/auth', { data: { action: 'login', ...tenant } });
    const loginB = await b.request.post('/api/auth', { data: { action: 'login', ...other } });
    expect((await loginA.json()).user.role).toBe('super_admin');
    const foreignOrgId = (await loginB.json()).user.organizationId;
    const query = await a.request.get(`/api/pharmacy/stock?organizationId=${foreignOrgId}`);
    expect(query.status()).toBe(403);
    const add = await a.request.post('/api/pharmacy/stock', { data: { organizationId: foreignOrgId, medicineId: 'demo', batchNo: 'demo' } });
    expect(add.status()).toBe(403);
    const patch = await a.request.patch('/api/pharmacy/stock/demo', { data: { orgId: foreignOrgId, quantity: 1 } });
    expect(patch.status()).toBe(403);
    const dispense = await a.request.post('/api/pharmacy/dispense', { data: { organizationId: foreignOrgId, patientId: 'demo', pharmacyStockId: 'demo', quantity: 1 } });
    expect(dispense.status()).toBe(403);
  } finally { await a.close(); await b.close(); }
});

test('pharmacy dispense rejects invalid quantities and keeps stock consistent', async ({ page, browser }) => {
  const foreign = await browser.newContext();
  let original: Record<string, unknown> | undefined;
  try {
    await login(page);
    const loginOther = await foreign.request.post('/api/auth', { data: { action: 'login', ...other } });
    expect(loginOther.ok()).toBeTruthy();
    const session = await (await page.request.get('/api/auth')).json();
    const orgId = session.user.organizationId;
    original = (await (await page.request.get('/api/settings')).json()).settings;
    expect((await page.request.post('/api/settings', { data: { ...original, pharmacyEnabled: true } })).ok()).toBeTruthy();
    const medicines = await (await page.request.get('/api/medicines?q=dolo')).json();
    const medicineId = medicines.medicines[0].id;
    const patientId = (await (await page.request.get('/api/patients')).json()).patients[0].id;
    const foreignPatient = (await (await foreign.request.get('/api/patients')).json()).patients[0].id;
    const added = await page.request.post('/api/pharmacy/stock', { data: { organizationId: orgId, medicineId, batchNo: `TEST-${Date.now()}`, quantity: 3, mrp: 20, purchasePrice: 10, sellingPrice: 15 } });
    expect(added.status()).toBe(201);
    const stockId = (await added.json()).stock.id;
    const dispense = (quantity: number, patient = patientId) => page.request.post('/api/pharmacy/dispense', { data: { organizationId: orgId, patientId: patient, pharmacyStockId: stockId, quantity } });
    expect((await dispense(-2)).status()).toBe(400);
    expect((await dispense(1, foreignPatient)).status()).toBe(404);
    const success = await dispense(2);
    expect(success.status()).toBe(201);
    expect((await success.json()).remainingStock).toBe(1);
    expect((await dispense(2)).status()).toBe(400);
    await page.reload();
    await page.locator('aside').getByRole('button', { name: 'Pharmacy Stock' }).click();
    await expect(page.getByText(/Pharmacy Stock/i).first()).toBeVisible();
  } finally {
    if (original) await page.request.post('/api/settings', { data: original });
    await foreign.close();
  }
});
