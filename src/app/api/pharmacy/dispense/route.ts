/**
 * PHARMACY DISPENSE API
 * POST /api/pharmacy/dispense — dispense medicine to patient (deducts stock)
 * Body: { organizationId, patientId, prescriptionId, pharmacyStockId, quantity, unitPrice, dispensedBy, notes }
 */

import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson } from '@/lib/cache'
import { verifyActiveTenantSession } from '@/lib/auth'

const ALLOWED_ROLES = ['super_admin', 'admin', 'doctor', 'nurse', 'pharmacist']

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const session = await verifyActiveTenantSession(req)
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  const body = await req.json()
  const { organizationId, patientId, prescriptionId, pharmacyStockId, quantity, unitPrice, dispensedBy, notes } = body

  if (!organizationId || !patientId || !pharmacyStockId || !quantity) {
    return apiJson({ error: 'organizationId, patientId, pharmacyStockId, quantity required.' }, { status: 400, startMs })
  }

  if (organizationId !== session.organizationId && session.role !== 'super_admin') {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  // Verify stock exists and has enough quantity
  const stock = await dbUnscoped.pharmacyStock.findUnique({ where: { id: pharmacyStockId } })
  if (!stock || stock.organizationId !== organizationId || !stock.isActive) {
    return apiJson({ error: 'Stock batch not found or inactive.' }, { status: 404, startMs })
  }

  if (stock.quantity < Number(quantity)) {
    return apiJson({ error: `Insufficient stock. Available: ${stock.quantity}` }, { status: 400, startMs })
  }

  const totalAmount = Number(quantity) * Number(unitPrice || stock.sellingPrice)

  // Use transaction to deduct stock + create dispense record
  const result = await dbUnscoped.$transaction([
    dbUnscoped.pharmacyStock.update({
      where: { id: pharmacyStockId },
      data: { quantity: stock.quantity - Number(quantity) },
    }),
    dbUnscoped.pharmacyDispense.create({
      data: {
        organizationId,
        patientId,
        prescriptionId: prescriptionId || null,
        pharmacyStockId,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice || stock.sellingPrice),
        totalAmount,
        dispensedBy: dispensedBy || session.name,
        notes: notes || null,
      },
      include: {
        pharmacyStock: { include: { medicine: { select: { name: true } } } },
      },
    }),
  ])

  const dispense = result[1]

  await dbUnscoped.auditLog.create({
    data: {
      organizationId,
      actorName: session.name,
      actorRole: session.role,
      action: 'PHARMACY_DISPENSED',
      entity: 'PharmacyDispense',
      details: `Dispensed ${quantity}x ${stock.medicineId} to patient ${patientId}`,
    },
  })

  return apiJson({ dispense, remainingStock: result[0].quantity }, { status: 201, startMs })
}
