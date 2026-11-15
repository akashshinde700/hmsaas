# AetherMed Cloud HMS — Multi-Tenant OPD + IPD + MedWiki SaaS

Built with **Next.js 15 (App Router)**, **Prisma 6 ORM**, **Tailwind CSS v4**, **Motion (`motion/react`)**, and **Installable Healthcare PWA**.

## Key Capabilities
- **Public SaaS Marketing & Onboarding (`/`)**: Live database-driven SaaS plans (`Basic`, `Advance Hospital`, `Enterprise Multispecialty`), Monthly/Yearly pricing toggle, OPD + IPD + MedWiki showcase, and Lead Inquiry capture routed straight to Platform Admin.
- **SaaS Platform Admin (`/platform-admin`)**: Provision clinics with 1 click, view/copy generated credentials, switch plans, `Mark paid`, `+7d trial`, `Suspend`, `Customize plan`, `Reset pwd`, **`Login as` (1-click tenant impersonation)**, `Delete`, manage Plans/Inquiries/Blog, and monitor **Continuous MedWiki Drug Sync**.
- **OPD Smart Queue & 30-Second Prescription Pad (`/dashboard`)**: Reception token queue, nurse triage vitals, sub-5ms MedWiki + Custom drug autocomplete, per-doctor dosing memory, Schedule H/H1 alerts, multilingual dietary advice (`English` / `हिंदी` / `मराठी`), and printable A4 Hospital Letterhead Rx.
- **ICTHospital-Grade IPD & Live Ward Bed Board (`/dashboard`)**: Visual General/Semi-Private/Deluxe/ICU bed matrix, transactional single-bed admissions, bed transfers, doctor/nursing progress rounds, MAR drug administration chart, advance deposit receipts (`DEP-XXXX`), running IPD bill ledger, and printable NABH-style Discharge Summary.
- **Continuous MedWiki Scraper (`medwiki/medwiki_sync.py`)**: Streams normalized molecules & brands via Lightpanda headless CDP / Playwright / HTTP into `/api/medicines/sync`.

## Quick Start
```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

See [`FULL_AUDIT_AND_ARCHITECTURE.md`](./FULL_AUDIT_AND_ARCHITECTURE.md) for the complete legacy audit report, multi-tenant security model, and demo logins.
