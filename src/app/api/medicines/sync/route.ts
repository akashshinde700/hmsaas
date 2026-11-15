import { NextRequest } from 'next/server'
import { apiJson } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'
import { normalizeAndUpsertMedicines } from '@/lib/medwiki-engine'

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
  if (medicines.length === 0) {
    return apiJson({ error: 'medicines[] array required in request payload.' }, { status: 400, startMs })
  }

  const summary = await normalizeAndUpsertMedicines(medicines, {
    triggerSource: String(body.triggerSource || 'medwiki_webhook'),
    mode: String(body.mode || 'continuous_delta'),
    queryOrTerm: body.queryOrTerm ? String(body.queryOrTerm) : undefined,
  })

  return apiJson(summary, { startMs })
}
