import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  try {
    const body = await req.json()
    const clinicName = String(body.clinicName || '').trim()
    const contactName = String(body.contactName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()

    if (!clinicName || !contactName || !email) {
      return apiJson(
        { error: 'Hospital/Clinic name, contact person, and email are required.' },
        { status: 400, startMs }
      )
    }

    const inquiry = await dbUnscoped.platformInquiry.create({
      data: {
        clinicName,
        contactName,
        email,
        phone: String(body.phone || '').trim() || null,
        city: String(body.city || '').trim() || null,
        facilityType: String(body.facilityType || 'Hospital (OPD + IPD)').trim(),
        bedsCount: String(body.bedsCount || '').trim() || null,
        selectedPlan: String(body.selectedPlan || '').trim() || null,
        message: String(body.message || '').trim() || null,
        status: 'new',
        followUpsJson: '[]',
      },
    })

    invalidateCachePrefix('platform:')
    return apiJson({ success: true, id: inquiry.id }, { status: 201, startMs })
  } catch {
    return apiJson({ error: 'Unable to submit inquiry right now.' }, { status: 500, startMs })
  }
}
