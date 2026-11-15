/**
 * MEDWIKI SYNC API
 * POST   /api/medicines/sync — Push medicines from MedWiki (webhook or manual)
 * GET    /api/medicines/sync — Cron-triggered sync (protected by MEDWIKI_CRON_SECRET)
 *
 * Crash-proof: circuit breaker, retries, per-item isolation, timeouts.
 */

import { NextRequest } from 'next/server'
import { apiJson } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'
import { runMedwikiSync } from '@/lib/medwiki-sync'

export async function GET(req: NextRequest) {
  const startMs = performance.now()

  // Cron secret protection
  const cronSecret = req.headers.get('x-cron-secret') || ''
  const expectedSecret = process.env.MEDWIKI_CRON_SECRET || ''
  const platformAdmin = await getPlatformSession(req)

  if (!cronSecret || cronSecret !== expectedSecret || !platformAdmin) {
    return apiJson({ error: 'Unauthorized cron request' }, { status: 401, startMs })
  }

  try {
    const summary = await runMedwikiSync({
      triggerSource: 'cron',
      mode: 'continuous_delta',
    })

    return apiJson({ ok: true, ...summary }, { startMs })
  } catch (err) {
    return apiJson(
      { error: 'Sync failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500, startMs }
    )
  }
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const headerKey = req.headers.get('x-medwiki-key') || ''
  const expectedKey = process.env.MEDWIKI_SYNC_API_KEY || ''

  const keyValid = expectedKey.length > 0 && headerKey === expectedKey
  const platformAdmin = keyValid ? null : await getPlatformSession(req)

  if (!keyValid && !platformAdmin) {
    return apiJson(
      { error: 'Unauthorized: Provide valid X-Medwiki-Key header or Platform Admin session.' },
      { status: 401, startMs }
    )
  }

  const body = await req.json()
  const medicines = Array.isArray(body.medicines) ? body.medicines : []

  try {
    const summary = await runMedwikiSync({
      medicines: medicines.length > 0 ? medicines : undefined,
      triggerSource: String(body.triggerSource || 'medwiki_webhook'),
      mode: String(body.mode || 'continuous_delta'),
      queryOrTerm: body.queryOrTerm ? String(body.queryOrTerm) : undefined,
    })

    return apiJson(summary, { startMs })
  } catch (err) {
    return apiJson(
      { error: 'Sync failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500, startMs }
    )
  }
}
