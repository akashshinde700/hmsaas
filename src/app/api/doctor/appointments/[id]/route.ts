/**
 * PATCH /api/doctor/appointments/[id] — update appointment status
 * Body: { status, orgId }
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

const ALLOWED_ROLES = ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const { id } = await params
  const body = await req.json()
  const { status, orgId } = body

  const org = orgId || session.organizationId
  if (org !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  const existing = await dbUnscoped.appointment.findUnique({ where: { id } })
  if (!existing || existing.organizationId !== org) {
    return apiJson({ error: 'Appointment not found.' }, { status: 404, startMs })
  }

  const updated = await dbUnscoped.appointment.update({
    where: { id },
    data: { status: status || existing.status },
    include: {
      patient: { select: { id: true, uhid: true, name: true } },
      doctor: { select: { id: true, name: true } },
    },
  })

  await dbUnscoped.auditLog.create({
    data: {
      organizationId: org,
      actorName: session.name,
      actorRole: session.role,
      action: 'APPOINTMENT_UPDATED',
      entity: 'Appointment',
      details: `Status changed to ${updated.status} for appointment ${existing.id}`,
    },
  })

  return apiJson({ appointment: updated }, { startMs })
}
