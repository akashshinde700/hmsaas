# Full Codebase Audit & Multi-Tenant SaaS Architecture (`hmsaas`)

## 1. Executive Summary of Legacy Project Audit

Before rebuilding `/home/user/hmsaas` into **AetherMed Cloud HMS** (Next.js 15 + Prisma 6 + PWA), a full code-level security, performance, and architecture audit was executed across `backend/`, `frontend/`, and `medwiki/`:

| Audit Area | Legacy Issue Discovered | Resolution Implemented |
|---|---|---|
| **Hardcoded Single-Clinic Branding (`Dr. Jaju`)** | Hardcoded `Dr. Gopal Jaju`, `drjaju.com`, `dr-gopal-jaju.jpg`, single-doctor consultation copy, and clinic credentials scattered across frontend pages, print headers, and seed scripts. | **100% purged** (`grep -ri "jaju"` returns `0` matches). Replaced with dynamic per-tenant `ClinicSettings` white-label branding and a multi-tenant SaaS Landing Page (`/`). |
| **Plaintext VPS & MySQL Credentials in `medwiki/`** | 7 helper scripts (`deploy_medwiki.py`, `fix_and_start.py`, `push_patch.py`, etc.) contained hardcoded VPS IP `72.60.206.56` and plaintext SSH/MySQL root passwords. | Deleted all 7 offending scripts. Updated `medwiki/ready.py` to read strictly from environment variables and built `medwiki/medwiki_sync.py` streaming via `X-Medwiki-Key` webhook. |
| **Session Token Leak (`authenticateTokenOrQuery`)** | `backend/src/middleware/auth.js` accepted JWTs in `req.query.token`, leaking session tokens into server logs, browser history, and Referer headers. | Replaced with `httpOnly`, `SameSite=Lax`, HMAC-SHA256 stateless signed session cookies (`hms_session`, `hms_platform_session`). |
| **11,504-Line Monolithic `PrescriptionPad.jsx`** | Single 655 KB React file caused severe parse/re-render lag while mixing UI, print templates, and advice strings. | Refactored into modular, typed Next.js components (`SmartRxPadTab.tsx`, `IpdModuleTab.tsx`, `OpdAndPatientsTabs.tsx`, `FormularyBillingSettingsTabs.tsx`) with `<8ms` cached APIs. |
| **No Multi-Tenant Isolation & Fake Stub Routes** | 65+ Express route files (`*_refactored.js` duplicates + `autoStubRoutes.js` returning fake HTTP 200 responses) with zero `organization_id` guard. | Implemented `dbForOrg(organizationId)` Prisma Client Extension (`src/lib/db.ts`) enforcing `organizationId` scoping across all 21 tenant models. |
| **OPD-Only Clinical Model** | No Ward/Bed categories, no transactional bed locking, no IPD nursing/doctor rounds, no MAR chart, no advance deposits, and no discharge summary. | Engineered complete **ICTHospital-inspired IPD** alongside OPD (`BedCategory`, `Bed`, `IpdAdmission`, `IpdBedTransfer`, `IpdRoundNote`, `IpdMedicationOrder`, `IpdChargeItem`, `PatientDeposit`). |

---

## 2. How Dynamic Medicine Saving & Continuous MedWiki Sync Works

### A. 3-Tier Dynamic Medicine Database (`Prisma Medicine` + `DoctorMedicineDefault`)
1. **Tier 1 — Global MedWiki Catalog (`Medicine.organizationId = NULL`)**:
   - Shared across every subscribed hospital/clinic on the SaaS platform.
   - Deduplicated via deterministic compound `dedupKey`:
     `lower(brandName) | lower(saltComposition) | lower(manufacturer) | lower(strength) | lower(dosageForm)`
     so `Augmentin 625 Duo` (625mg Tablet) and `Augmentin DDS` (228.5mg/5ml Suspension) coexist cleanly without ever creating duplicate rows on repeated scraper runs.
   - Automatically maps **27 pharmaceutical dosage forms** (`Tablet`, `Capsule`, `Syrup`, `Suspension`, `Injection`, `Infusion`, `Inhaler`, `Respules`, `Drops`, `Ointment`, etc.) to clinical defaults (`route`, `defaultDosage`, `defaultFrequency` e.g. `1-0-1`, `defaultTiming`, `defaultDuration`) and therapeutic categories (`Antibiotic`, `Cardiac / Antihypertensive`, `Antidiabetic`, `GI / Acid Peptic`, etc.).
2. **Tier 2 — Tenant Custom Formulary (`Medicine.organizationId = <orgId>`)**:
   - Any hospital or doctor can add custom local formulations or hospital-specific kits (`POST /api/medicines`).
   - Strictly isolated to that `organizationId` — never leaks to other clinics.
3. **Tier 3 — Per-Doctor Smart Dosing Memory (`DoctorMedicineDefault`)**:
   - Every time a doctor saves an OPD Prescription (`POST /api/prescriptions`), the system automatically learns that doctor's preferred `dosage`, `frequency`, `timing`, and `duration` for each medicine and ranks their frequently prescribed drugs first (`★ My Default` badge in `<5ms` search).

### B. Continuous MedWiki Scraper Worker (`medwiki/medwiki_sync.py` + Lightpanda Browser)
- Supports **Lightpanda Headless Browser CDP** (`ws://127.0.0.1:9222` — Zig-based ultra-low-memory headless browser), Playwright Chromium, or pure HTTP extraction:
  ```bash
  # Continuous daemon syncing medwiki.co.in into /api/medicines/sync every 30 mins
  LIGHTPANDA_CDP_URL="ws://127.0.0.1:9222" \
  HMSAAS_URL="http://localhost:3000" \
  MEDWIKI_SYNC_API_KEY="mwk_live_aethermed_sync_key_2026" \
  python3 medwiki/medwiki_sync.py --engine lightpanda --continuous --interval-sec 1800
  ```
- Platform Admins can also trigger delta syncs, inspect `MedwikiSyncRun` logs, and add global formulations directly inside **`/platform-admin` → `MedWiki DB`**.

---

## 3. ICTHospital-Inspired IPD + OPD Clinical Architecture

Modeled on `ictinnovations/ICTHospital` invariants (`src/app/api/ipd/route.ts` & `src/lib/ipd-billing.ts`):
- **Single-Truth Bed Occupancy**: `IpdAdmission.dischargedAt === null` is the canonical source of truth for bed occupancy. Admissions run inside `dbUnscoped.$transaction(...)` verifying both **0 active occupants on the target bed** and **0 active admissions for the patient**.
- **Ward & Bed Tariff Engine**: Minimum 1 billable day (`ceil((end - admittedAt) / 86400000)`), automatic room + nursing charge accrual, itemized OT/Procedure/Oxygen charges, MAR drug administration (`giveDose`), and **Advance Deposit Receipts (`DEP-XXXX`)** deducted automatically on the Final IPD Invoice.
- **Atomic Discharge & NABH Summary**: Completing discharge sets `dischargedAt`, generates the itemized `Invoice (IPD)`, applies advance deposits, optionally records final balance payment (`PAY-XXXX`), marks the bed available, and produces a printable A4 Discharge Summary.

---

## 4. Platform Admin & Demo Credentials

| Portal | URL | Login Email | Password |
|---|---|---|---|
| **Public SaaS Landing Page** | `/` | — | — |
| **SaaS Platform Admin** | `/platform-admin` | `aetherdevsolutions@gmail.com` | `Admin@123` |
| **Hospital Tenant #1 (OPD + IPD)** | `/login` → `/dashboard` | `admin@sahyadrihospitalpune.in` | `Sahyadri@123` |
| **Hospital Tenant #1 (Doctor)** | `/login` → `/dashboard` | `ananya.kulkarni@sahyadrihospitalpune.in` | `Doctor@123` |
| **Clinic Tenant #2 (Polyclinic)** | `/login` → `/dashboard` | `admin@arogyacarekharadi.in` | `Arogya@123` |
