# MedWiki Continuous Medicine Sync Engine

This module powers continuous pharmaceutical data ingestion from `medwiki.co.in` into **AetherMed Cloud HMS** (`POST /api/medicines/sync`).

## How Data Flows Continuously Into Your SaaS

```text
[medwiki.co.in Molecules & Brands A-Z]
          │
          ▼  (Lightpanda CDP ws://127.0.0.1:9222 — 11x faster, 9x lower RAM than Chrome)
[medwiki/medwiki_sync.py]
   • Lockfile (`scraper.lock`) prevents overlapping cron runs
   • Incremental checkpoint (`scraper_checkpoint.json`) resumes cleanly
   • Extracts Brand, Salt Composition, Strength, Dosage Form, MRP, Schedule H/H1/OTC
          │
          ▼  POST /api/medicines/sync (Header: X-Medwiki-Key)
[src/lib/medwiki-engine.ts -> Prisma Medicine Table]
   • Compound Dedup Key: `global||name||generic||mfr||strength||form`
   • Auto-infers Route (Oral/IV/Inhalation/Ophthalmic), Default Dose & Frequency (1-0-1)
   • Builds normalized lowercase `searchText` index + invalidates sub-5ms LRU cache
   • Logs run metrics in `MedwikiSyncRun` (visible in Platform Admin -> MedWiki Sync tab!)
          │
          ▼
[All SaaS Clinics & Hospitals]
   • Instant <10ms autocomplete in OPD Smart Prescription Pad & IPD Medication Chart (MAR)
   • Per-doctor `DoctorMedicineDefault` auto-learns preferred dosing per clinician
```

## Running with Lightpanda Headless Browser (Recommended)

1. Download Lightpanda (`https://github.com/lightpanda-io/browser`):
   ```bash
   curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/latest/download/lightpanda-x86_64-linux
   chmod a+x ./lightpanda
   ./lightpanda serve --host 127.0.0.1 --port 9222 &
   ```

2. Run continuous delta sync:
   ```bash
   export HMS_SYNC_API_URL="http://127.0.0.1:3000/api/medicines/sync"
   export MEDWIKI_SYNC_API_KEY="mwk_live_aethermed_sync_key_2026"
   export LIGHTPANDA_CDP_URL="ws://127.0.0.1:9222"
   python3 medwiki/medwiki_sync.py --engine lightpanda --batch-size 25
   ```

3. Automate via Cron (runs daily at 2:30 AM IST):
   ```cron
   30 2 * * * cd /path/to/hmsaas && HMS_SYNC_API_URL="https://yourdomain.com/api/medicines/sync" MEDWIKI_SYNC_API_KEY="your_key" /usr/bin/python3 medwiki/medwiki_sync.py --engine lightpanda --max-terms 4 >> /var/log/medwiki_sync.log 2>&1
   ```
