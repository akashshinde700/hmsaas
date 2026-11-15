/**
 * CRON ROUTE — MedWiki Continuous Sync
 *
 * Call this URL from your cron scheduler (cron-job.org, Hostinger cron, etc.)
 * every 30 minutes:
 *
 *   GET https://your-domain.com/api/cron/medwiki-sync
 *   Headers: x-cron-secret: YOUR_MEDWIKI_CRON_SECRET
 *
 * Protect with MEDWIKI_CRON_SECRET env var.
 */

import { NextRequest } from 'next/server'
import { runMedwikiSync } from '@/lib/medwiki-sync'

const ALLOWED_METHODS = ['GET']

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const startMs = performance.now()

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Cron secret check
  const cronSecret = req.headers.get('x-cron-secret') || ''
  const expectedSecret = process.env.MEDWIKI_CRON_SECRET || ''

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const summary = await runMedwikiSync({
      triggerSource: 'cron',
      mode: 'continuous_delta',
    })

    return Response.json({
      ok: true,
      ...summary,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
