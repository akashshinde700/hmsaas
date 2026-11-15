import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const rows = await dbUnscoped.platformInquiry.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return apiJson(
    rows.map((r) => ({
      ...r,
      followUps: JSON.parse(r.followUpsJson || '[]'),
    })),
    { startMs }
  )
}

export async function PATCH(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()

  if (body.action === 'bulkStatus' && Array.isArray(body.ids)) {
    await dbUnscoped.platformInquiry.updateMany({
      where: { id: { in: body.ids.map(String) } },
      data: { status: String(body.status || 'follow_up') },
    })
    return apiJson({ updated: body.ids.length }, { startMs })
  }

  if (body.action === 'bulkDelete' && Array.isArray(body.ids)) {
    await dbUnscoped.platformInquiry.deleteMany({
      where: { id: { in: body.ids.map(String) } },
    })
    return apiJson({ deleted: body.ids.length }, { startMs })
  }

  const id = String(body.id || '')
  if (!id) return apiJson({ error: 'Inquiry id required.' }, { status: 400, startMs })

  const existing = await dbUnscoped.platformInquiry.findUnique({ where: { id } })
  if (!existing) return apiJson({ error: 'Not found.' }, { status: 404, startMs })

  let followUps = JSON.parse(existing.followUpsJson || '[]')
  if (Array.isArray(body.followUps)) {
    followUps = body.followUps
  } else if (body.newFollowUpNote) {
    followUps = [
      ...followUps,
      {
        id: `fu-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        by: session.name,
        note: String(body.newFollowUpNote).trim(),
        nextDate: body.nextDate || null,
      },
    ]
  }

  const updated = await dbUnscoped.platformInquiry.update({
    where: { id },
    data: {
      ...(body.status ? { status: String(body.status) } : {}),
      followUpsJson: JSON.stringify(followUps),
    },
  })

  return apiJson(
    { ...updated, followUps: JSON.parse(updated.followUpsJson || '[]') },
    { startMs }
  )
}

export async function DELETE(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  if (!id) return apiJson({ error: 'Inquiry id required.' }, { status: 400, startMs })

  await dbUnscoped.platformInquiry.delete({ where: { id } })
  return apiJson({ success: true }, { startMs })
}
