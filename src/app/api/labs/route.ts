import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const orders = await db.labOrder.findMany({
    where: { organizationId: session.organizationId },
    include: {
      patient: { select: { id: true, name: true, uhid: true, ageYears: true, gender: true } },
    },
    orderBy: { orderedAt: 'desc' },
    take: 60,
  })
  return apiJson({ orders }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const count = await db.labOrder.count({ where: { organizationId: session.organizationId } })
  const order = await db.labOrder.create({
    data: {
      organizationId: session.organizationId,
      patientId: String(body.patientId),
      ipdAdmissionId: body.ipdAdmissionId || null,
      orderNo: `LAB-${String(count + 1).padStart(4, '0')}`,
      testName: String(body.testName).trim(),
      category: String(body.category || 'Pathology'),
      priority: String(body.priority || 'routine'),
      price: Number(body.price || 450),
      orderedBy: session.name,
    },
  })
  invalidateCachePrefix(`dash:${session.organizationId}`)
  return apiJson({ order }, { status: 201, startMs })
}

export async function PATCH(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const existing = await db.labOrder.findFirst({
    where: { id: String(body.id), organizationId: session.organizationId },
  })
  if (!existing) return apiJson({ error: 'Order not found' }, { status: 404, startMs })

  const updated = await dbUnscoped.labOrder.update({
    where: { id: existing.id },
    data: {
      status: String(body.status || 'completed'),
      resultSummary: body.resultSummary ? String(body.resultSummary) : existing.resultSummary,
      normalRange: body.normalRange ? String(body.normalRange) : existing.normalRange,
      isAbnormal: Boolean(body.isAbnormal),
      completedAt: body.status === 'completed' ? new Date() : existing.completedAt,
    },
  })
  invalidateCachePrefix(`dash:${session.organizationId}`)
  return apiJson({ order: updated }, { startMs })
}
