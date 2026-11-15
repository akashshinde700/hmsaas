import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { getPlatformSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const plans = await dbUnscoped.plan.findMany({
    orderBy: [{ isCustom: 'asc' }, { sortOrder: 'asc' }, { priceMonthly: 'asc' }],
    include: { _count: { select: { subscriptions: true } } },
  })
  return apiJson(
    plans.map((p) => ({
      ...p,
      features: JSON.parse(p.featuresJson || '{}'),
      subscribersCount: p._count.subscriptions,
    })),
    { startMs }
  )
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const created = await dbUnscoped.plan.create({
    data: {
      name: String(body.name || 'New Plan').trim(),
      tier: String(body.tier || 'basic').trim(),
      doctorLimit: Number(body.doctorLimit || 3),
      branchLimit: Number(body.branchLimit || 1),
      staffLimit: Number(body.staffLimit || 5),
      bedLimit: Number(body.bedLimit || 10),
      storageLimitMB: Number(body.storageLimitMB || 2048),
      priceMonthly: Number(body.priceMonthly || 1999),
      priceYearly: Number(body.priceYearly || 19990),
      featuresJson: JSON.stringify(
        body.features || { opd: true, ipd: true, medwiki: true, lab: true }
      ),
      isCustom: false,
      isActive: true,
    },
  })
  invalidateCachePrefix('public:plans')
  return apiJson(
    { ...created, features: JSON.parse(created.featuresJson || '{}') },
    { status: 201, startMs }
  )
}

export async function PUT(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const id = String(body.id || '')
  if (!id) return apiJson({ error: 'Plan id required.' }, { status: 400, startMs })

  const updated = await dbUnscoped.plan.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.tier !== undefined ? { tier: String(body.tier).trim() } : {}),
      ...(body.doctorLimit !== undefined ? { doctorLimit: Number(body.doctorLimit) } : {}),
      ...(body.branchLimit !== undefined ? { branchLimit: Number(body.branchLimit) } : {}),
      ...(body.staffLimit !== undefined ? { staffLimit: Number(body.staffLimit) } : {}),
      ...(body.bedLimit !== undefined ? { bedLimit: Number(body.bedLimit) } : {}),
      ...(body.storageLimitMB !== undefined ? { storageLimitMB: Number(body.storageLimitMB) } : {}),
      ...(body.priceMonthly !== undefined ? { priceMonthly: Number(body.priceMonthly) } : {}),
      ...(body.priceYearly !== undefined ? { priceYearly: Number(body.priceYearly) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.features !== undefined ? { featuresJson: JSON.stringify(body.features) } : {}),
    },
  })
  invalidateCachePrefix('public:plans')
  return apiJson(
    { ...updated, features: JSON.parse(updated.featuresJson || '{}') },
    { startMs }
  )
}

export async function DELETE(req: NextRequest) {
  const startMs = performance.now()
  const session = await getPlatformSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  if (!id) return apiJson({ error: 'Plan id required.' }, { status: 400, startMs })

  const inUse = await dbUnscoped.subscription.count({ where: { planId: id } })
  if (inUse > 0) {
    return apiJson(
      { error: `Cannot delete: ${inUse} clinic(s) are subscribed to this plan.` },
      { status: 400, startMs }
    )
  }

  await dbUnscoped.plan.delete({ where: { id } })
  invalidateCachePrefix('public:plans')
  return apiJson({ success: true }, { startMs })
}
