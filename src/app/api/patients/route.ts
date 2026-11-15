import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const id = searchParams.get('id')

  if (id) {
    const patient = await db.patient.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
        prescriptions: {
          include: { items: true, doctor: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        ipdAdmissions: {
          include: {
            bed: { include: { category: true } },
            admittingDoctor: { select: { name: true } },
            deposits: true,
          },
          orderBy: { admittedAt: 'desc' },
        },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    })
    return apiJson({ patient }, { startMs })
  }

  const patients = await db.patient.findMany({
    where: {
      organizationId: session.organizationId,
      ...(q
        ? {
            OR: [
              { organizationId: session.organizationId, name: { contains: q } },
              { organizationId: session.organizationId, uhid: { contains: q } },
              { organizationId: session.organizationId, phone: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      ipdAdmissions: {
        where: { dischargedAt: null },
        select: { id: true, admissionNo: true, bed: { select: { bedNumber: true } } },
      },
      _count: { select: { prescriptions: true, ipdAdmissions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  })

  return apiJson({ patients }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()

  // Bulk Actions on Patients List (VIP toggle or Bulk Delete)
  if (body.action === 'bulkVip' && Array.isArray(body.ids)) {
    await db.patient.updateMany({
      where: { organizationId: session.organizationId, id: { in: body.ids.map(String) } },
      data: { isVip: Boolean(body.isVip) },
    })
    invalidateCachePrefix(`dash:${session.organizationId}`)
    return apiJson({ updated: body.ids.length }, { startMs })
  }

  if (body.action === 'bulkDelete' && Array.isArray(body.ids)) {
    await db.patient.deleteMany({
      where: { organizationId: session.organizationId, id: { in: body.ids.map(String) } },
    })
    invalidateCachePrefix(`dash:${session.organizationId}`)
    return apiJson({ deleted: body.ids.length }, { startMs })
  }

  const name = String(body.name || '').trim()
  const phone = String(body.phone || '').trim()

  if (!name || !phone) {
    return apiJson({ error: 'Patient full name and mobile number are required.' }, { status: 400, startMs })
  }

  const [settings, count, mainBranch] = await Promise.all([
    db.clinicSettings.findFirst({ where: { organizationId: session.organizationId } }),
    db.patient.count({ where: { organizationId: session.organizationId } }),
    db.branch.findFirst({ where: { organizationId: session.organizationId } }),
  ])

  const prefix = settings?.uhidPrefix || 'UHID'
  const uhid = `${prefix}-${String(count + 1).padStart(4, '0')}`

  const patient = await db.patient.create({
    data: {
      organizationId: session.organizationId,
      branchId: mainBranch?.id || null,
      uhid,
      name,
      gender: String(body.gender || 'Male'),
      ageYears: body.ageYears ? Number(body.ageYears) : null,
      bloodGroup: body.bloodGroup ? String(body.bloodGroup) : null,
      phone,
      email: body.email ? String(body.email).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      city: body.city ? String(body.city).trim() : 'Pune',
      abhaNumber: body.abhaNumber ? String(body.abhaNumber).trim() : null,
      allergies: body.allergies ? String(body.allergies).trim() : null,
      chronicConditions: body.chronicConditions ? String(body.chronicConditions).trim() : null,
      emergencyContact: body.emergencyContact ? String(body.emergencyContact).trim() : null,
      emergencyPhone: body.emergencyPhone ? String(body.emergencyPhone).trim() : null,
      insuranceProvider: body.insuranceProvider ? String(body.insuranceProvider).trim() : null,
      isVip: Boolean(body.isVip),
    },
  })

  // Optional: immediately add to today's OPD queue if requested
  if (body.addToOpdQueue) {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayCount = await db.opdQueue.count({
      where: { organizationId: session.organizationId, queueDate: todayStr },
    })
    await db.opdQueue.create({
      data: {
        organizationId: session.organizationId,
        patientId: patient.id,
        doctorId: body.doctorId || session.userId,
        tokenNumber: todayCount + 1,
        queueDate: todayStr,
        priority: body.isVip ? 'vip' : 'normal',
        visitType: 'New Visit',
        chiefComplaint: body.chiefComplaint || 'OPD Consultation',
        status: 'waiting',
      },
    })
  }

  invalidateCachePrefix(`dash:${session.organizationId}`)
  return apiJson({ patient }, { status: 201, startMs })
}
