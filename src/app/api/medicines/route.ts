import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, getOrSetCache, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'
import { normalizeMedicineRecord } from '@/lib/medwiki-engine'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const category = (searchParams.get('category') || '').trim()
  const scope = searchParams.get('scope') || 'all' // all, custom, global
  const limit = Math.min(Number(searchParams.get('limit') || 30), 100)

  const cacheKey = `meds:${session.organizationId}:${session.userId}:${scope}:${category}:${limit}:${q}`

  const { data, hit } = await getOrSetCache(cacheKey, 15_000, async () => {
    const orgWhere =
      scope === 'custom'
        ? { organizationId: session.organizationId }
        : scope === 'global'
        ? { organizationId: null }
        : { OR: [{ organizationId: session.organizationId }, { organizationId: null }] }

    const [rows, doctorDefaults] = await Promise.all([
      dbUnscoped.medicine.findMany({
        where: {
          ...orgWhere,
          isActive: true,
          ...(category && category !== 'ALL' ? { category } : {}),
          ...(q ? { searchText: { contains: q } } : {}),
        },
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
        take: limit * 2,
      }),
      db.doctorMedicineDefault.findMany({
        where: {
          organizationId: session.organizationId,
          doctorId: session.userId,
        },
      }),
    ])

    const defaultsByName = new Map(
      doctorDefaults.map((d) => [d.medicineName.toLowerCase(), d])
    )

    const enriched = rows.map((m) => {
      const docDef = defaultsByName.get(m.name.toLowerCase())
      const startsWithQuery = q && m.name.toLowerCase().startsWith(q) ? 1 : 0
      return {
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        composition: m.composition,
        brand: m.brand,
        manufacturer: m.manufacturer,
        dosageForm: m.dosageForm,
        strength: m.strength,
        packSize: m.packSize,
        category: m.category,
        mrp: m.mrp,
        schedule: m.schedule,
        isControlled: m.isControlled,
        source: m.organizationId ? 'clinic_custom' : m.source,
        isCustom: Boolean(m.organizationId),
        usageCount: m.usageCount,
        doctorUsage: docDef?.usageCount || 0,
        defaultDosage: docDef?.dosage || m.defaultDosage,
        defaultFrequency: docDef?.frequency || m.defaultFrequency,
        defaultDuration: docDef?.duration || m.defaultDuration,
        defaultTiming: docDef?.timing || m.defaultTiming,
        defaultRoute: docDef?.route || m.defaultRoute,
        defaultInstructions: docDef?.instructions || m.defaultInstructions,
        uses: m.uses,
        sideEffects: m.sideEffects,
        _rank: (docDef?.usageCount || 0) * 100 + startsWithQuery * 50 + (m.organizationId ? 20 : 0) + m.usageCount,
      }
    })

    enriched.sort((a, b) => b._rank - a._rank || a.name.localeCompare(b.name))
    return enriched.slice(0, limit)
  })

  return apiJson({ medicines: data, total: data.length, query: q }, { startMs, cacheHit: hit })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  if (!body.name || !String(body.name).trim()) {
    return apiJson({ error: 'Medicine name is required.' }, { status: 400, startMs })
  }

  const normalized = normalizeMedicineRecord({
    ...body,
    organizationId: session.organizationId,
    source: 'clinic_custom',
  })

  const existing = await dbUnscoped.medicine.findUnique({
    where: { dedupKey: normalized.dedupKey },
  })
  if (existing) {
    const updated = await dbUnscoped.medicine.update({
      where: { id: existing.id },
      data: { ...normalized, isActive: true },
    })
    invalidateCachePrefix(`meds:${session.organizationId}:`)
    return apiJson({ medicine: updated, updatedExisting: true }, { startMs })
  }

  const created = await dbUnscoped.medicine.create({ data: normalized })
  invalidateCachePrefix(`meds:${session.organizationId}:`)
  return apiJson({ medicine: created }, { status: 201, startMs })
}

export async function PATCH(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  if (body.action === 'saveDoctorDefault') {
    const medName = String(body.medicineName || '').trim()
    if (!medName) return apiJson({ error: 'medicineName required' }, { status: 400, startMs })

    await dbUnscoped.doctorMedicineDefault.upsert({
      where: {
        organizationId_doctorId_medicineName: {
          organizationId: session.organizationId,
          doctorId: session.userId,
          medicineName: medName,
        },
      },
      update: {
        dosage: body.dosage || undefined,
        frequency: body.frequency || undefined,
        duration: body.duration || undefined,
        timing: body.timing || undefined,
        route: body.route || undefined,
        instructions: body.instructions || undefined,
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      create: {
        organizationId: session.organizationId,
        doctorId: session.userId,
        medicineId: body.medicineId || null,
        medicineName: medName,
        dosage: body.dosage || null,
        frequency: body.frequency || null,
        duration: body.duration || null,
        timing: body.timing || null,
        route: body.route || null,
        instructions: body.instructions || null,
        usageCount: 1,
      },
    })
    invalidateCachePrefix(`meds:${session.organizationId}:`)
    return apiJson({ success: true }, { startMs })
  }

  return apiJson({ error: 'Unsupported action' }, { status: 400, startMs })
}

export async function DELETE(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  const med = await dbUnscoped.medicine.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!med) {
    return apiJson({ error: 'Only clinic custom medicines can be deleted by clinic users.' }, { status: 403, startMs })
  }

  await dbUnscoped.medicine.update({
    where: { id: med.id },
    data: { isActive: false },
  })
  invalidateCachePrefix(`meds:${session.organizationId}:`)
  return apiJson({ success: true }, { startMs })
}
