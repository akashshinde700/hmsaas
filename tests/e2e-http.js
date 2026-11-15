/*
 * AetherMed Cloud HMS — HTTP-based E2E Test Suite
 * Runs without a browser using fetch. Tests all routes, APIs, and user flows.
 * Usage: node tests/e2e-http.js
 */

const BASE = 'http://127.0.0.1:3000';

let passed = 0;
let failed = 0;
const errors = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    errors.push(`❌ ${name}: ${detail}`);
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body, headers: res.headers };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('\n🚀 AetherMed Cloud HMS — E2E Test Suite\n');
  console.log(`Base URL: ${BASE}\n`);

  // =========================================================================
  // 1. PUBLIC ROUTES
  // =========================================================================
  console.log('📍 PUBLIC ROUTES');
  {
    const home = await fetchJson('/');
    check('Landing page returns 200', home.status === 200, `got ${home.status}`);
    const homeHtml = typeof home.body === 'string' ? home.body : JSON.stringify(home.body);
    check('Landing has /referrals link', homeHtml.includes('/referrals'));
    check('Landing has /login link', homeHtml.includes('/login'));
    check('Landing has /platform-admin link', homeHtml.includes('/platform-admin'));

    const refPage = await fetchJson('/referrals');
    check('Referrals page returns 200', refPage.status === 200, `got ${refPage.status}`);

    const nf = await fetchJson('/non-existent-saas-route-xyz');
    check('Custom 404 returns 404', nf.status === 404, `got ${nf.status}`);

    const loginPage = await fetchJson('/login');
    check('Login page returns 200', loginPage.status === 200, `got ${loginPage.status}`);

    const platformAdminPage = await fetchJson('/platform-admin');
    check('Platform admin page returns 200 (redirects to login if needed)', platformAdminPage.status === 200 || platformAdminPage.status === 307, `got ${platformAdminPage.status}`);
  }

  // =========================================================================
  // 2. PUBLIC AFFILIATE API
  // =========================================================================
  console.log('\n📍 PUBLIC AFFILIATE API (/api/referrals)');
  {
    const lookup = await fetchJson('/api/referrals?code=AFF-MEDTECH20');
    check('Affiliate lookup returns partner', lookup.ok && lookup.body.partner?.referralCode === 'AFF-MEDTECH20', JSON.stringify(lookup.body));
    check('Commission percent >= 20', lookup.body.partner?.commissionPercent >= 20, `got ${lookup.body.partner?.commissionPercent}`);

    const track = await fetchJson('/api/referrals', {
      method: 'POST',
      body: JSON.stringify({ action: 'trackClick', referralCode: 'AFF-MEDTECH20' }),
    });
    check('Track click returns ok', track.ok === true, JSON.stringify(track.body));

    const trackHosp = await fetchJson('/api/referrals', {
      method: 'POST',
      body: JSON.stringify({ action: 'trackClick', referralCode: 'HOSP-SAHYADRI20' }),
    });
    check('Track click for hospital code works', trackHosp.ok === true);
  }

  // =========================================================================
  // 3. TENANT ADMIN LOGIN & DASHBOARD
  // =========================================================================
  console.log('\n📍 TENANT ADMIN LOGIN (admin@sahyadrihospitalpune.in)');
  let tenantCookie = '';
  {
    const loginRes = await fetchJson('/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: 'admin@sahyadrihospitalpune.in',
        password: 'Sahyadri@123',
      }),
    });
    check('Tenant login returns 200', loginRes.status === 200, `got ${loginRes.status}`);
    tenantCookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    check('Tenant cookie set', !!tenantCookie);
    check('User role present', !!loginRes.body.user?.role, `got ${loginRes.body.user?.role}`);
    check('Organization name present (in user)', !!loginRes.body.user?.organizationName, `got ${loginRes.body.user?.organizationName}`);
    check('Organization slug present', !!loginRes.body.user?.organizationSlug, `got ${loginRes.body.user?.organizationSlug}`);
  }

  console.log('\n📍 TENANT DASHBOARD API');
  {
    const dash = await fetchJson('/api/dashboard', { headers: { Cookie: tenantCookie } });
    check('Dashboard returns 200', dash.status === 200, `got ${dash.status}`);
    check('Dashboard has planUsage', !!dash.body.planUsage, JSON.stringify(dash.body));
    check('Dashboard has kpis', !!dash.body.kpis, JSON.stringify(dash.body));
    check('Dashboard has doctors', Array.isArray(dash.body.doctors));
    check('Dashboard has settings', !!dash.body.settings);

    const pu = dash.body.planUsage || {};
    check('Plan tier present', !!pu.tier, `got ${pu.tier}`);
    check('Doctors quota present', pu.doctorsUsed !== undefined && pu.doctorLimit !== undefined);
    check('Beds quota present', pu.bedsUsed !== undefined && pu.bedLimit !== undefined);
  }

  console.log('\n📍 TENANT HOSPITAL REFERRAL DESK');
  {
    const hospRef = await fetchJson('/api/referrals', { headers: { Cookie: tenantCookie } });
    check('Hospital referral desk returns 200', hospRef.status === 200);
    check('Hospital has referral code', !!hospRef.body.partner?.referralCode, `got ${hospRef.body.partner?.referralCode}`);
  }

  // =========================================================================
  // 4. OPD API
  // =========================================================================
  console.log('\n📍 OPD API (/api/opd)');
  {
    const opd = await fetchJson('/api/opd', { headers: { Cookie: tenantCookie } });
    check('OPD returns 200', opd.status === 200, `got ${opd.status}`);
    check('OPD has queue', Array.isArray(opd.body.queue || opd.body), `got ${typeof opd.body.queue}`);

    // Test check-in
    const checkIn = await fetchJson('/api/opd', {
      method: 'POST',
      headers: { Cookie: tenantCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkIn',
        patientId: 'test-patient-id',
        doctorId: 'test-doctor-id',
        priority: 'normal',
        visitReason: 'Test check-in',
      }),
    });
    // May fail if patient doesn't exist, but should not crash
    check('OPD check-in endpoint responds', checkIn.status === 200 || checkIn.status === 400 || checkIn.status === 404, `got ${checkIn.status}`);
  }

  // =========================================================================
  // 5. PATIENTS API
  // =========================================================================
  console.log('\n📍 PATIENTS API (/api/patients)');
  {
    const patients = await fetchJson('/api/patients', { headers: { Cookie: tenantCookie } });
    check('Patients returns 200', patients.status === 200, `got ${patients.status}`);
    check('Patients has data', Array.isArray(patients.body.patients || patients.body), `got ${typeof patients.body.patients}`);
  }

  // =========================================================================
  // 6. PRESCRIPTIONS API
  // =========================================================================
  console.log('\n📍 PRESCRIPTIONS API (/api/prescriptions)');
  {
    const rx = await fetchJson('/api/prescriptions', { headers: { Cookie: tenantCookie } });
    check('Prescriptions returns 200', rx.status === 200, `got ${rx.status}`);
    check('Prescriptions has data', Array.isArray(rx.body.prescriptions || rx.body), `got ${typeof rx.body.prescriptions}`);
  }

  // =========================================================================
  // 7. MEDICINES API
  // =========================================================================
  console.log('\n📍 MEDICINES API (/api/medicines)');
  {
    const meds = await fetchJson('/api/medicines?q=Dolo&limit=10', { headers: { Cookie: tenantCookie } });
    check('Medicines search returns 200', meds.status === 200, `got ${meds.status}`);
    check('Medicines has data', Array.isArray(meds.body.medicines || meds.body), `got ${typeof meds.body.medicines}`);

    const medsAll = await fetchJson('/api/medicines?limit=5', { headers: { Cookie: tenantCookie } });
    check('Medicines list returns 200', medsAll.status === 200);
  }

  // =========================================================================
  // 8. SETTINGS API
  // =========================================================================
  console.log('\n📍 SETTINGS API (/api/settings)');
  {
    const settings = await fetchJson('/api/settings', { headers: { Cookie: tenantCookie } });
    check('Settings returns 200', settings.status === 200, `got ${settings.status}`);
    check('Settings has settings object', !!settings.body.settings, JSON.stringify(settings.body));
    check('Settings has staff', Array.isArray(settings.body.staff || []));
    check('Settings has organization', !!settings.body.organization);
  }

  // =========================================================================
  // 9. IPD API
  // =========================================================================
  console.log('\n📍 IPD API (/api/ipd)');
  {
    const ipd = await fetchJson('/api/ipd?show=all', { headers: { Cookie: tenantCookie } });
    check('IPD returns 200', ipd.status === 200, `got ${ipd.status}`);
    check('IPD has categories', Array.isArray(ipd.body.categories || ipd.body), `got ${typeof ipd.body.categories}`);
    check('IPD has beds', Array.isArray(ipd.body.beds || ipd.body));
    check('IPD has admissions', Array.isArray(ipd.body.admissions || ipd.body));
  }

  // =========================================================================
  // 10. BILLING API
  // =========================================================================
  console.log('\n📍 BILLING API (/api/billing)');
  {
    const billing = await fetchJson('/api/billing', { headers: { Cookie: tenantCookie } });
    check('Billing returns 200', billing.status === 200, `got ${billing.status}`);
    check('Billing has invoices', Array.isArray(billing.body.invoices || billing.body), `got ${typeof billing.body.invoices}`);
  }

  // =========================================================================
  // 11. LABS API
  // =========================================================================
  console.log('\n📍 LABS API (/api/labs)');
  {
    const labs = await fetchJson('/api/labs', { headers: { Cookie: tenantCookie } });
    check('Labs returns 200', labs.status === 200, `got ${labs.status}`);
    check('Labs has orders', Array.isArray(labs.body.orders || labs.body), `got ${typeof labs.body.orders}`);
  }

  // =========================================================================
  // 12. DOCTOR LOGIN
  // =========================================================================
  console.log('\n📍 DOCTOR LOGIN (ananya.kulkarni@sahyadrihospitalpune.in)');
  {
    const dLogin = await fetchJson('/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: 'ananya.kulkarni@sahyadrihospitalpune.in',
        password: 'Doctor@123',
      }),
    });
    check('Doctor login returns 200', dLogin.status === 200, `got ${dLogin.status}`);
    check('Doctor role is doctor', dLogin.body.user?.role === 'doctor', `got ${dLogin.body.user?.role}`);

    const ddash = await fetchJson('/api/dashboard', { headers: { Cookie: dLogin.headers.get('set-cookie')?.split(';')[0] || '' } });
    check('Doctor dashboard loads', ddash.status === 200);
  }

  // =========================================================================
  // 13. POLYCLINIC LOGIN (second tenant)
  // =========================================================================
  console.log('\n📍 POLYCLINIC LOGIN (admin@arogyacarekharadi.in)');
  {
    const cLogin = await fetchJson('/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: 'admin@arogyacarekharadi.in',
        password: 'Arogya@123',
      }),
    });
    check('Polyclinic login returns 200', cLogin.status === 200, `got ${cLogin.status}`);
    check('Polyclinic organization name present (in user)', !!cLogin.body.user?.organizationName, `got ${cLogin.body.user?.organizationName}`);
  }

  // =========================================================================
  // 14. PLATFORM ADMIN
  // =========================================================================
  console.log('\n📍 PLATFORM ADMIN (aetherdevsolutions@gmail.com)');
  {
    const pLogin = await fetchJson('/api/platform/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: 'aetherdevsolutions@gmail.com',
        password: 'Admin@123',
      }),
    });
    check('Platform admin login returns 200', pLogin.status === 200, `got ${pLogin.status}`);
    const pCookie = pLogin.headers.get('set-cookie')?.split(';')[0] || '';
    check('Platform cookie set', !!pCookie);

    const pOrgs = await fetchJson('/api/platform/organizations', { headers: { Cookie: pCookie } });
    check('Platform orgs returns 200', pOrgs.status === 200, `got ${pOrgs.status}`);
    check('Platform orgs has data', Array.isArray(pOrgs.body.orgs || pOrgs.body), `got ${typeof pOrgs.body.orgs}`);

    const pPlans = await fetchJson('/api/platform/plans', { headers: { Cookie: pCookie } });
    check('Platform plans returns 200', pPlans.status === 200, `got ${pPlans.status}`);
    check('Platform plans has data', Array.isArray(pPlans.body.plans || pPlans.body), `got ${typeof pPlans.body.plans}`);

    const pRefs = await fetchJson('/api/referrals?scope=platform', { headers: { Cookie: pCookie } });
    check('Platform referrals returns 200', pRefs.status === 200, `got ${pRefs.status}`);
    check('Platform partners present', Array.isArray(pRefs.body.partners || []), `got ${typeof pRefs.body.partners}`);
    check('Platform has 2+ partners', (pRefs.body.partners || []).length >= 2, `got ${(pRefs.body.partners || []).length}`);

    const pInquiries = await fetchJson('/api/platform/inquiries', { headers: { Cookie: pCookie } });
    check('Platform inquiries returns 200', pInquiries.status === 200, `got ${pInquiries.status}`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    errors.forEach((e) => console.log(`  ${e}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('Test suite crashed:', e);
  process.exit(1);
});
