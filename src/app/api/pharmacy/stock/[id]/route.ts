/**
 * PATCH /api/pharmacy/stock/[id] — update stock quantity / price
 * Body: { quantity, sellingPrice, reorderLevel, orgId }
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

const ALLOWED_ROLES = ['super_admin', 'admin', 'doctor', 'nurse', 'pharmacist']

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
  const { quantity, sellingPrice, reorderLevel, orgId } = body

  const org = orgId || session.organizationId
  if (org !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  // Pharmacy module gate — org-level toggle
  const clinicSettings = await dbUnscoped.clinicSettings.findUnique({
    where: { organizationId: org },
    select: { pharmacyEnabled: true },
  })
  if (!clinicSettings?.pharmacyEnabled) {
    return apiJson({ error: 'Pharmacy module is not enabled for this organization.' }, { status: 403, startMs })
  }

  const existing = await dbUnscoped.pharmacyStock.findUnique({ where: { id } })
  if (!existing || existing.organizationId !== org) {
    return apiJson({ error: 'Stock not found.' }, { status: 404, startMs })
  }

  const updated = await dbUnscoped.pharmacyStock.update({
    where: { id },
    data: {
      ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
      ...(sellingPrice !== undefined ? { sellingPrice: Number(sellingPrice) } : {}),
      ...(reorderLevel !== undefined ? { reorderLevel: Number(reorderLevel) } : {}),
    },
    include: {
      medicine: { select: { name: true } },
    },
  })

  await dbUnscoped.auditLog.create({
    data: {
      organizationId: org,
      actorName: session.name,
      actorRole: session.role,
      action: 'PHARMACY_STOCK_UPDATED',
      entity: 'PharmacyStock',
      details: `Stock updated for ${existing.medicineId} batch ${existing.batchNo}`,
    },
  })

  return apiJson({ stock: updated }, { startMs })
}
