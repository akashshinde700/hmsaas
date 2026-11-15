/**
 * DOCTOR APPOINTMENTS API (staff-side calendar)
 *
 * GET    /api/doctor/appointments?doctorId=...&date=YYYY-MM-DD&orgId=...
 * POST   /api/doctor/appointments  — create/update appointment
 *
 * Multi-tenant guarded. Only doctor/admin/receptionist roles.
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

const ALLOWED_ROLES = ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist']

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const { searchParams } = new URL(req.url)
  const doctorId = searchParams.get('doctorId') || undefined
  const date = searchParams.get('date') // YYYY-MM-DD
  const orgId = searchParams.get('orgId') || session.organizationId

  // Tenant guard
  if (orgId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  const where: any = { organizationId: orgId }
  if (doctorId) where.doctorId = doctorId
  if (date) {
    const start = new Date(date + 'T00:00:00')
    const end = new Date(date + 'T23:59:59')
    where.appointmentDate = { gte: start, lte: end }
  }

  const appointments = await dbUnscoped.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, uhid: true, name: true, phone: true, ageYears: true, gender: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
    orderBy: { appointmentDate: 'asc' },
  })

  return apiJson({ appointments }, { startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const body = await req.json()
  const {
    organizationId,
    patientId,
    doctorId,
    appointmentDate,
    slotTime,
    type,
    reason,
    status,
  } = body

  if (!organizationId || !patientId || !appointmentDate) {
    return apiJson({ error: 'organizationId, patientId, appointmentDate required.' }, { status: 400, startMs })
  }

  // Tenant guard
  if (organizationId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  // Verify patient belongs to org
  const patient = await dbUnscoped.patient.findUnique({ where: { id: patientId } })
  if (!patient || patient.organizationId !== organizationId) {
    return apiJson({ error: 'Patient not found in this organization.' }, { status: 404, startMs })
  }

  const appointment = await dbUnscoped.appointment.create({
    data: {
      organizationId,
      patientId,
      doctorId: doctorId || undefined,
      appointmentDate: new Date(appointmentDate),
      slotTime: slotTime || '10:00',
      type: type || 'OPD Consultation',
      reason: reason || null,
      status: status || 'scheduled',
    },
    include: {
      patient: { select: { id: true, uhid: true, name: true, phone: true } },
      doctor: { select: { id: true, name: true, specialization: true } },
    },
  })

  // Audit log
  await dbUnscoped.auditLog.create({
    data: {
      organizationId,
      actorName: session.name,
      actorRole: session.role,
      action: 'APPOINTMENT_BOOKED',
      entity: 'Appointment',
      details: `Booked for patient ${patient.name} (${patient.uhid}) on ${appointmentDate}`,
    },
  })

  return apiJson({ appointment }, { status: 201, startMs })
}
