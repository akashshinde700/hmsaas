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

  if (organizationId !== session.organizationId) {
    return apiJson({ error: 'Forbidden' }, { status: 403, startMs })
  }

  // Pharmacy module gate — org-level toggle
  const clinicSettings = await dbUnscoped.clinicSettings.findUnique({
    where: { organizationId: organizationId },
    select: { pharmacyEnabled: true },
  })
  if (!clinicSettings?.pharmacyEnabled) {
    return apiJson({ error: 'Pharmacy module is not enabled for this organization.' }, { status: 403, startMs })
  }

  // Verify stock exists and has enough quantity
  const stock = await dbUnscoped.pharmacyStock.findUnique({ where: { id: pharmacyStockId } })
  if (!stock || stock.organizationId !== organizationId || !stock.isActive) {
    return apiJson({ error: 'Stock batch not found or inactive.' }, { status: 404, startMs })
  }

  const amount = Number(quantity)
  const price = unitPrice == null ? stock.sellingPrice : Number(unitPrice)
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(price) || price < 0) {
    return apiJson({ error: 'Quantity must be a positive whole number and price must be non-negative.' }, { status: 400, startMs })
  }
  const patient = await dbUnscoped.patient.findFirst({ where: { id: patientId, organizationId }, select: { id: true } })
  if (!patient) return apiJson({ error: 'Patient not found in this organization.' }, { status: 404, startMs })
  if (prescriptionId) {
    const prescription = await dbUnscoped.prescription.findFirst({
      where: { id: prescriptionId, organizationId, patientId }, select: { id: true },
    })
    if (!prescription) return apiJson({ error: 'Prescription not found for this patient.' }, { status: 404, startMs })
  }

  // The availability check and decrement must be atomic to prevent overselling.
  const result = await dbUnscoped.$transaction(async (tx) => {
    const updated = await tx.pharmacyStock.updateMany({
      where: { id: pharmacyStockId, organizationId, isActive: true, quantity: { gte: amount } },
      data: { quantity: { decrement: amount } },
    })
    if (!updated.count) return null
    const dispense = await tx.pharmacyDispense.create({
      data: {
        organizationId, patientId, prescriptionId: prescriptionId || null, pharmacyStockId,
        quantity: amount, unitPrice: price, totalAmount: amount * price,
        dispensedBy: dispensedBy || session.name, notes: notes || null,
      },
      include: { pharmacyStock: { include: { medicine: { select: { name: true } } } } },
    })
    return dispense
  })
  if (!result) return apiJson({ error: 'Insufficient stock.' }, { status: 400, startMs })
  const dispense = result

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

  return apiJson({ dispense, remainingStock: dispense.pharmacyStock.quantity }, { status: 201, startMs })
}
