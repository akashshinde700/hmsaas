import { NextRequest } from 'next/server'
import { db, dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const { searchParams } = new URL(req.url)
  const queueDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const speciality = searchParams.get('speciality') || undefined

  const [queue, appointments] = await Promise.all([
    db.opdQueue.findMany({
      where: {
        organizationId: session.organizationId,
        queueDate,
        ...(speciality
          ? { doctor: { specialization: { contains: speciality } } }
          : {}),
      },
      include: {
        patient: {
          include: {
            vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
        doctor: { select: { id: true, name: true, specialization: true } },
      },
      orderBy: { tokenNumber: 'asc' },
    }),
    db.appointment.findMany({
      where: { organizationId: session.organizationId },
      include: {
        patient: { select: { id: true, name: true, uhid: true, phone: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { appointmentDate: 'desc' },
      take: 30,
    }),
  ])

  return apiJson({ queue, appointments, queueDate }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const action = String(body.action || 'createToken')

  if (action === 'updateQueueStatus') {
    const queueId = String(body.queueId || body.id || '')
    const status = String(body.status || 'completed')
    await dbUnscoped.opdQueue.updateMany({
      where: { id: queueId, organizationId: session.organizationId },
      data: {
        status,
        ...(status === 'in_consultation' ? { calledAt: new Date() } : {}),
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      },
    })
    invalidateCachePrefix(`dash:${session.organizationId}`)
    return apiJson({ ok: true }, { startMs })
  }

  if (action === 'checkIn') {
    const patientId = String(body.patientId || '')
    const patient = await db.patient.findFirst({
      where: { id: patientId, organizationId: session.organizationId },
    })
    if (!patient) {
      return apiJson({ error: 'Patient not found in this hospital.' }, { status: 404, startMs })
    }
    const existingCount = await db.opdQueue.count({
      where: { organizationId: session.organizationId, queueDate: body.queueDate || new Date().toISOString().slice(0, 10) },
    })
    const item = await db.opdQueue.create({
      data: {
        organizationId: session.organizationId,
        patientId,
        doctorId: body.doctorId || session.userId,
        tokenNumber: existingCount + 1,
        queueDate: body.queueDate || new Date().toISOString().slice(0, 10),
        priority: String(body.priority || 'normal'),
        visitType: String(body.visitType || 'New Visit'),
        chiefComplaint: body.chiefComplaint || body.visitReason || null,
        status: 'waiting',
      },
    })
    invalidateCachePrefix(`dash:${session.organizationId}`)
    return apiJson({ item, tokenNumber: item.tokenNumber }, { status: 201, startMs })
  }

  if (action === 'bulkUpdateStatus' && Array.isArray(body.ids)) {
    const status = String(body.status || 'completed')
    await dbUnscoped.opdQueue.updateMany({
      where: { id: { in: body.ids.map(String) }, organizationId: session.organizationId },
      data: {
        status,
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      },
    })
    invalidateCachePrefix(`dash:${session.organizationId}`)
    return apiJson({ updated: body.ids.length }, { startMs })
  }

  if (action === 'recordVitals') {
    const vital = await db.vitalSign.create({
      data: {
        organizationId: session.organizationId,
        patientId: String(body.patientId),
        ipdAdmissionId: body.ipdAdmissionId || null,
        bpSystolic: body.bpSystolic ? Number(body.bpSystolic) : null,
        bpDiastolic: body.bpDiastolic ? Number(body.bpDiastolic) : null,
        pulse: body.pulse ? Number(body.pulse) : null,
        temperatureF: body.temperatureF ? Number(body.temperatureF) : null,
        spo2: body.spo2 ? Number(body.spo2) : null,
        weightKg: body.weightKg ? Number(body.weightKg) : null,
        heightCm: body.heightCm ? Number(body.heightCm) : null,
        bloodSugar: body.bloodSugar ? Number(body.bloodSugar) : null,
        recordedBy: session.name,
      },
    })
    if (body.queueId) {
      await dbUnscoped.opdQueue.updateMany({
        where: { id: String(body.queueId), organizationId: session.organizationId, status: 'waiting' },
        data: { status: 'vitals_done' },
      })
    }
    invalidateCachePrefix(`dash:${session.organizationId}`)
    return apiJson({ vital }, { status: 201, startMs })
  }

  if (action === 'bookAppointment') {
    const appt = await db.appointment.create({
      data: {
        organizationId: session.organizationId,
        patientId: String(body.patientId),
        doctorId: body.doctorId || session.userId,
        appointmentDate: body.appointmentDate ? new Date(body.appointmentDate) : new Date(),
        slotTime: String(body.slotTime || '10:30'),
        type: String(body.type || 'OPD Consultation'),
        reason: body.reason ? String(body.reason) : null,
      },
    })
    return apiJson({ appointment: appt }, { status: 201, startMs })
  }

  const queueDate = String(body.queueDate || new Date().toISOString().slice(0, 10))
  const existingCount = await db.opdQueue.count({
    where: { organizationId: session.organizationId, queueDate },
  })

  const item = await db.opdQueue.create({
    data: {
      organizationId: session.organizationId,
      patientId: String(body.patientId),
      doctorId: body.doctorId || session.userId,
      tokenNumber: existingCount + 1,
      queueDate,
      priority: String(body.priority || 'normal'),
      visitType: String(body.visitType || 'New Visit'),
      chiefComplaint:
        body.chiefComplaint || body.visitReason
          ? String(body.chiefComplaint || body.visitReason)
          : null,
      status: 'waiting',
    },
  })

  invalidateCachePrefix(`dash:${session.organizationId}`)
  return apiJson({ item, tokenNumber: item.tokenNumber }, { status: 201, startMs })
}

export async function PATCH(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session) return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })

  const body = await req.json()
  const id = String(body.id || '')
  const status = String(body.status || '')

  const existing = await db.opdQueue.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return apiJson({ error: 'Queue item not found.' }, { status: 404, startMs })

  const updated = await dbUnscoped.opdQueue.update({
    where: { id: existing.id },
    data: {
      status,
      ...(status === 'in_consultation' ? { calledAt: new Date() } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    },
  })

  invalidateCachePrefix(`dash:${session.organizationId}`)
  return apiJson({ item: updated }, { startMs })
}
