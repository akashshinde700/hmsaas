import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'

/*
 * PATIENT RECORDS — Returns the logged-in patient's own records only.
 * Authentication via hms_patient_session cookie (base64 JSON with patientId).
 */

function getPatientId(req: NextRequest): string | null {
  const token = req.cookies.get('hms_patient_session')?.value
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    return payload.kind === 'patient' ? payload.patientId : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const patientId = getPatientId(req)
  if (!patientId) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const { searchParams } = new URL(req.url)
  const section = searchParams.get('section') || 'profile'

  const patient = await dbUnscoped.patient.findUnique({
    where: { id: patientId },
    include: {
      organization: {
        include: { settings: true, subscription: { include: { plan: true } } },
      },
    },
  })

  if (!patient) {
    return apiJson({ error: 'Patient not found.' }, { status: 404, startMs })
  }

  if (section === 'profile') {
    return apiJson({ patient }, { startMs })
  }

  if (section === 'prescriptions') {
    const prescriptions = await dbUnscoped.prescription.findMany({
      where: { patientId },
      include: { items: { include: { medicine: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return apiJson({ prescriptions }, { startMs })
  }

  if (section === 'laborders') {
    const labOrders = await dbUnscoped.labOrder.findMany({
      where: { patientId },
      orderBy: { orderedAt: 'desc' },
      take: 50,
    })
    return apiJson({ labOrders }, { startMs })
  }

  if (section === 'ipdadmissions') {
    const admissions = await dbUnscoped.ipdAdmission.findMany({
      where: { patientId },
      include: {
        bed: { include: { category: true } },
        admittingDoctor: { select: { name: true, specialization: true } },
      },
      orderBy: { admittedAt: 'desc' },
    })
    return apiJson({ admissions }, { startMs })
  }

  if (section === 'appointments') {
    const appointments = await dbUnscoped.appointment.findMany({
      where: { patientId },
      include: { doctor: { select: { name: true, specialization: true } } },
      orderBy: { appointmentDate: 'desc' },
      take: 50,
    })
    return apiJson({ appointments }, { startMs })
  }

  if (section === 'invoices') {
    const invoices = await dbUnscoped.invoice.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return apiJson({ invoices }, { startMs })
  }

  return apiJson({ error: 'Unknown section.' }, { status: 400, startMs })
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const patientId = getPatientId(req)
  if (!patientId) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const body = await req.json()
  const action = String(body.action || 'bookAppointment')

  if (action === 'bookAppointment') {
    const appointment = await dbUnscoped.appointment.create({
      data: {
        organizationId: String(body.organizationId || ''),
        patientId,
        doctorId: body.doctorId ? String(body.doctorId) : undefined,
        appointmentDate: body.appointmentDate
          ? new Date(body.appointmentDate)
          : new Date(Date.now() + 86400000),
        slotTime: String(body.slotTime || '10:00'),
        type: String(body.type || 'OPD Consultation'),
        reason: body.reason ? String(body.reason) : null,
        status: 'scheduled',
      },
      include: {
        doctor: { select: { name: true, specialization: true } },
      },
    })
    return apiJson({ appointment }, { status: 201, startMs })
  }

  return apiJson({ error: 'Unknown action.' }, { status: 400, startMs })
}
