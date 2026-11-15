/**
 * MEDWIKI SERVICE — Separate Process (Port 4000)
 *
 * Runs independently of HMS (Port 3000). If MedWiki goes down,
 * HMS keeps working normally.
 *
 * Features:
 *   • Fetch medicine delta from MedWiki remote API
 *   • Enrich with GLM instructions (if GLM_API_KEY configured)
 *   • Push to HMS via /api/medicines/sync webhook
 *   • Circuit breaker + retries + timeouts (crash-proof)
 *   • Health endpoint: GET /health
 *
 * Usage:
 *   PORT=4000 MEDWIKI_API_KEY=xxx HMS_SYNC_URL=http://localhost:3000/api/medicines/sync HMS_SYNC_KEY=xxx node services/medwiki/server.js
 */

const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 4000;
const MEDWIKI_API_BASE = process.env.MEDWIKI_API_BASE_URL || 'https://api.medwiki.example.com';
const MEDWIKI_API_KEY = process.env.MEDWIKI_API_KEY || '';
const HMS_SYNC_URL = process.env.HMS_SYNC_URL || 'http://localhost:3000/api/medicines/sync';
const HMS_SYNC_KEY = process.env.HMS_SYNC_KEY || '';
const GLM_API_KEY = process.env.GLM_API_KEY || '';
const GLM_API_BASE = process.env.GLM_API_BASE || 'https://api.z.ai/api/paas/v4';
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 30 * 60 * 1000); // 30 min

// -----------------------------------------------------------------------------
// Circuit Breaker (MedWiki remote)
// -----------------------------------------------------------------------------
const cb = {
  failures: 0,
  lastFailure: 0,
  blockedUntil: 0,
  threshold: 5,
  cooldownMs: 60 * 1000,
};
function cbCanCall() {
  const now = Date.now();
  if (cb.blockedUntil && now < cb.blockedUntil) return false;
  return true;
}
function cbSuccess() { cb.failures = 0; cb.lastFailure = 0; cb.blockedUntil = 0; }
function cbFailure() {
  cb.failures += 1;
  cb.lastFailure = Date.now();
  if (cb.failures >= cb.threshold) cb.blockedUntil = Date.now() + cb.cooldownMs;
}

// -----------------------------------------------------------------------------
// Fetch with timeout + retry
// -----------------------------------------------------------------------------
async function fetchWithRetry(url, opts = {}, retries = 3, timeoutMs = 10000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      return res;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

// -----------------------------------------------------------------------------
// Normalize medicine (mirrors HMS medwiki-engine logic)
// -----------------------------------------------------------------------------
function normalizeMedicine(raw) {
  const name = (raw.name || '').trim();
  if (!name) return null;
  const composition = (raw.composition || '').trim() || null;
  const genericName = (raw.genericName || '').trim() || extractGeneric(composition) || name;
  const dosageForm = (raw.dosageForm || '').trim() || detectForm(name) || 'Tablet';
  const strength = (raw.strength || '').trim() || extractStrength(composition) || extractStrength(name) || null;
  const manufacturer = (raw.manufacturer || '').trim() || null;
  const brand = (raw.brand || name).trim();
  const category = (raw.category || '').trim() || categorize(name, genericName, raw.uses || '');
  const route = (raw.defaultRoute || '').trim() || routeByForm(dosageForm) || 'Oral';
  const defaultDosage = (raw.defaultDosage || '').trim() || defaultDosageByForm(dosageForm) || '1 tablet';
  const defaultFrequency = (raw.defaultFrequency || '').trim() || defaultFreqByForm(dosageForm) || '1-0-1';
  const defaultDuration = (raw.defaultDuration || '').trim() || '5 days';
  const defaultTiming = (raw.defaultTiming || '').trim() || defaultTimingByName(name, route) || 'After Food';
  let mrp = null;
  if (raw.mrp !== null && raw.mrp !== undefined && raw.mrp !== '') {
    const p = Number(String(raw.mrp).replace(/[^0-9.]/g, ''));
    if (!isNaN(p) && p > 0) mrp = p;
  }
  const schedule = (raw.schedule || '').trim() || 'Schedule H';
  const isControlled = /H1|X/i.test(schedule);
  const scopePrefix = 'global';
  const dedupKey = [scopePrefix, name.toLowerCase(), genericName.toLowerCase(), (manufacturer || '').toLowerCase(), (strength || '').toLowerCase(), dosageForm.toLowerCase()].join('||');
  const searchText = [name, genericName, composition || '', brand, manufacturer || '', dosageForm, strength || '', category].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();

  return {
    organizationId: null,
    dedupKey,
    name,
    genericName,
    composition,
    brand,
    manufacturer,
    dosageForm,
    strength,
    packSize: (raw.packSize || '').trim() || null,
    category,
    therapeuticClass: category,
    mrp,
    schedule,
    isControlled,
    requiresPrescription: schedule !== 'OTC',
    defaultDosage,
    defaultFrequency,
    defaultDuration,
    defaultRoute: route,
    defaultTiming,
    defaultInstructions: raw.defaultInstructions ? String(raw.defaultInstructions).trim() || null : null,
    language: raw.language || 'en',
    uses: raw.uses ? String(raw.uses).trim() || null : null,
    sideEffects: raw.sideEffects ? String(raw.sideEffects).trim() || null : null,
    contraindications: raw.contraindications ? String(raw.contraindications).trim() || null : null,
    source: raw.source || 'medwiki',
    sourceUrl: raw.sourceUrl || null,
    searchText,
    lastSyncedAt: new Date().toISOString(),
  };
}

// Simple helpers (mirror of medwiki-engine)
function extractGeneric(comp) { if (!comp) return null; const m = comp.match(/\(([^)]+)\)/); return m ? m[1].trim() : null; }
function detectForm(name) { const n = name.toLowerCase(); if (/tablet|tab\b/i.test(n)) return 'Tablet'; if (/capsule|cap\b/i.test(n)) return 'Capsule'; if (/syrup/i.test(n)) return 'Syrup'; if (/injection|inj\b|vial/i.test(n)) return 'Injection'; if (/drop/i.test(n)) return 'Drops'; if (/cream/i.test(n)) return 'Cream'; if (/ointment/i.test(n)) return 'Ointment'; if (/gel/i.test(n)) return 'Gel'; if (/lotion/i.test(n)) return 'Lotion'; if (/spray/i.test(n)) return 'Spray'; if (/powder|sachet/i.test(n)) return 'Powder'; if (/infusion/i.test(n)) return 'Infusion'; return null; }
function extractStrength(text) { if (!text) return null; const m = text.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%|IU|units?))/i); return m ? m[0] : null; }
function categorize(name, generic, uses) { const t = `${name} ${generic} ${uses}`.toLowerCase(); if (/antibiotic|amoxi|cefix|cefuro|azithro|ciproflox/i.test(t)) return 'Antibiotic'; if (/paracetamol|ibuprofen|diclofenac|pain/i.test(t)) return 'Analgesic'; if (/blood|pressure|amlodipine|telmisartan/i.test(t)) return 'Cardiovascular'; if (/sugar|diabetes|metformin|glimepiride/i.test(t)) return 'Antidiabetic'; if (/allergy|cetirizine|loratadine/i.test(t)) return 'Antiallergic'; return 'General Medicine'; }
function routeByForm(f) { const m = { Tablet: 'Oral', Capsule: 'Oral', Syrup: 'Oral', Suspension: 'Oral', Powder: 'Oral', Drops: 'Oral', Solution: 'Oral', Injection: 'IV/IM', Infusion: 'IV Infusion', 'Eye Drop': 'Ophthalmic', Cream: 'Topical', Ointment: 'Topical', Gel: 'Topical', Lotion: 'Topical', Spray: 'Topical', Patch: 'Topical', Suppository: 'Rectal', Inhaler: 'Inhalation', Nebulizer: 'Inhalation' }; return m[f] || 'Oral'; }
function defaultDosageByForm(f) { const m = { Tablet: '1 tablet', Capsule: '1 capsule', Syrup: '10 ml', Suspension: '10 ml', Drops: '5 drops', Injection: '1 vial', Infusion: '1 bag', Cream: 'Apply thin layer', Ointment: 'Apply thin layer', Gel: 'Apply thin layer', Lotion: 'Apply thin layer', Spray: 'Spray as directed', Powder: '1 sachet', Inhaler: '1-2 puffs' }; return m[f] || '1 tablet'; }
function defaultFreqByForm(f) { const m = { Tablet: '1-0-1', Capsule: '1-0-1', Syrup: '1-0-1', Suspension: '1-0-1', Drops: '0-0-1', Injection: '1-0-0', Infusion: '1-0-0', Cream: '0-2-0', Ointment: '0-2-0', Gel: '0-2-0', Lotion: '0-2-0', Spray: '0-1-0', Powder: '0-0-1', Inhaler: '1-0-1' }; return m[f] || '1-0-1'; }
function defaultTimingByName(name, route) { const n = name.toLowerCase(); if (/prazole|domperidone|rabeprazole|pantoprazole|omeprazole/i.test(n)) return 'Before Food (Empty Stomach)'; if (route === 'Oral') return 'After Food'; return 'As Directed'; }

// -----------------------------------------------------------------------------
// GLM — Generate medicine instructions (free tier: glm-4.7-flash)
// -----------------------------------------------------------------------------
async function generateInstructionsWithGLM(medicine, language = 'en') {
  if (!GLM_API_KEY) return null;
  const langLabel = { en: 'English', hi: 'Hindi (हिन्दी)', mr: 'Marathi (मराठी)' }[language] || 'English';
  const prompt = `You are a clinical pharmacist. Write simple usage instructions for this medicine in ${langLabel} (${language}). Keep it under 60 words, patient-friendly, include dosage timing and a warning to follow doctor's advice.

Medicine: ${medicine.name}
Generic: ${medicine.genericName || '—'}
Composition: ${medicine.composition || '—'}
Dosage Form: ${medicine.dosageForm || '—'}
Strength: ${medicine.strength || '—'}
Default Dosage: ${medicine.defaultDosage || '—'}
Default Frequency: ${medicine.defaultFrequency || '—'}
Default Timing: ${medicine.defaultTiming || '—'}
Uses: ${medicine.uses || '—'}

Output ONLY the instructions text, no extra explanation.`;

  try {
    const res = await fetchWithRetry(`${GLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-4.7-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    }, 2, 15000);

    if (!res.ok) {
      console.error(`[GLM] HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  } catch (err) {
    console.error('[GLM] Error:', err.message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Push to HMS sync endpoint
// -----------------------------------------------------------------------------
async function pushToHMS(medicines) {
  try {
    const res = await fetchWithRetry(HMS_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HMS_SYNC_KEY ? { 'x-medwiki-key': HMS_SYNC_KEY } : {}),
      },
      body: JSON.stringify({
        medicines,
        triggerSource: 'medwiki_separate_service',
        mode: 'continuous_delta',
      }),
    }, 2, 15000);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HMS sync HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    return await res.json();
  } catch (err) {
    console.error('[HMS Sync] Failed:', err.message);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Main sync job
// -----------------------------------------------------------------------------
async function runSync() {
  console.log(`[MedWiki Service] Sync started at ${new Date().toISOString()}`);

  if (!cbCanCall()) {
    console.log('[MedWiki Service] Circuit breaker OPEN — skipping remote fetch');
    return;
  }

  let rawMedicines = [];
  try {
    // Fetch from MedWiki remote
    const url = new URL(`${MEDWIKI_API_BASE.replace(/\/$/, '')}/api/delta`);
    url.searchParams.set('limit', '100');
    const res = await fetchWithRetry(url.toString(), {
      headers: MEDWIKI_API_KEY ? { 'Authorization': `Bearer ${MEDWIKI_API_KEY}` } : {},
    }, 3, 15000);

    if (!res.ok) throw new Error(`MedWiki HTTP ${res.status}`);
    const data = await res.json();
    rawMedicines = Array.isArray(data.medicines) ? data.medicines : [];
    cbSuccess();
    console.log(`[MedWiki Service] Fetched ${rawMedicines.length} medicines from MedWiki`);
  } catch (err) {
    cbFailure();
    console.error('[MedWiki Service] Remote fetch failed:', err.message);
    return;
  }

  // Normalize + optionally enrich with GLM instructions
  const normalized = [];
  for (const raw of rawMedicines) {
    const n = normalizeMedicine(raw);
    if (!n) continue;

    // If no instructions and GLM is configured, generate them
    if (!n.defaultInstructions && GLM_API_KEY) {
      const generated = await generateInstructionsWithGLM(n, n.language);
      if (generated) n.defaultInstructions = generated;
    }

    normalized.push(n);
  }

  console.log(`[MedWiki Service] Normalized ${normalized.length} medicines`);

  // Push to HMS
  try {
    const result = await pushToHMS(normalized);
    console.log('[MedWiki Service] Pushed to HMS:', JSON.stringify(result));
  } catch (err) {
    console.error('[MedWiki Service] Push to HMS failed:', err.message);
  }
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medwiki',
    port: PORT,
    circuitBreaker: { failures: cb.failures, blockedUntil: cb.blockedUntil },
    glmConfigured: Boolean(GLM_API_KEY),
    hmsSyncUrl: HMS_SYNC_URL,
    timestamp: new Date().toISOString(),
  });
});

app.post('/sync', async (req, res) => {
  try {
    await runSync();
    res.json({ ok: true, message: 'Sync triggered' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MedWiki Service] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[MedWiki Service] HMS Sync URL: ${HMS_SYNC_URL}`);
  console.log(`[MedWiki Service] GLM configured: ${Boolean(GLM_API_KEY)}`);
  console.log(`[MedWiki Service] Health: http://0.0.0.0:${PORT}/health`);

  // Initial sync after 5s
  setTimeout(runSync, 5000);

  // Periodic sync
  setInterval(runSync, SYNC_INTERVAL_MS);
});
